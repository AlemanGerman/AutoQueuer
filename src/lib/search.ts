import { buildTrackFromSearchItem, isTrackUri, SearchTrackItem } from "./tracks";
import { TrackSummary } from "./types";

type UnknownRecord = Record<string, any>;

const SEARCH_TRACKS_HASH = "59ee4a659c32e9ad894a71308207594a65ba67bb6b632b183abe97303a51fa55";
const SEARCH_DESKTOP_HASH = "841750deaa0a25991df1437c43b1c7188da731ca311039581a6543c96dd07dfa";
const SEARCH_TOP_RESULTS_LIST_HASH = "474a35115866d6a40d95b780f8de82a3c6edd2a6dfd4387b286bb838a023431c";

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function extractArtistNames(track: UnknownRecord): string[] {
  const itemArtists = toArray<UnknownRecord>(track.artists?.items);

  if (itemArtists.length > 0) {
    return itemArtists
      .map((artist) => artist?.profile?.name ?? artist?.name)
      .filter((name): name is string => isNonEmptyString(name));
  }

  return toArray<UnknownRecord>(track.artists)
    .map((artist) => artist?.profile?.name ?? artist?.name)
    .filter((name): name is string => isNonEmptyString(name));
}

function extractImageUrl(track: UnknownRecord): string | undefined {
  const albumNode = isRecord(track.albumOfTrack)
    ? track.albumOfTrack
    : isRecord(track.album)
      ? track.album
      : null;

  if (!albumNode) {
    return undefined;
  }

  const sources = toArray<UnknownRecord>(albumNode.coverArt?.sources ?? albumNode.images);

  return sources.map((source) => source?.url).find((url): url is string => isNonEmptyString(url));
}

function extractDurationMs(track: UnknownRecord): number {
  const candidateValues = [
    track.duration?.totalMilliseconds,
    track.duration?.milliseconds,
    track.durationMs,
    track.duration_ms,
  ];

  const duration = candidateValues.find((value) => typeof value === "number" && Number.isFinite(value));
  return typeof duration === "number" ? duration : 0;
}

function unwrapTrackNode(item: unknown): UnknownRecord | null {
  const candidates = [
    item,
    isRecord(item) ? item.data : null,
    isRecord(item) ? item.item : null,
    isRecord(item) ? item.item?.data : null,
    isRecord(item) ? item.track : null,
    isRecord(item) ? item.track?.data : null,
    isRecord(item) ? item.content : null,
    isRecord(item) ? item.content?.data : null,
    isRecord(item) ? item.entity : null,
    isRecord(item) ? item.entity?.data : null,
  ];

  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue;
    }

    const uri = candidate.uri ?? candidate.linked_from?.uri;
    const name = candidate.name ?? candidate.title;

    if (isNonEmptyString(uri) && isNonEmptyString(name)) {
      return candidate;
    }
  }

  return null;
}

function mapTrackNode(track: UnknownRecord): SearchTrackItem | null {
  const uri = track.uri ?? track.linked_from?.uri;
  const name = track.name ?? track.title;

  if (!isNonEmptyString(uri) || !isNonEmptyString(name) || !isTrackUri(uri)) {
    return null;
  }

  const artistNames = extractArtistNames(track);
  const albumNode = isRecord(track.albumOfTrack)
    ? track.albumOfTrack
    : isRecord(track.album)
      ? track.album
      : {};

  return {
    uri,
    name,
    duration_ms: extractDurationMs(track),
    album: {
      name: isNonEmptyString(albumNode.name) ? albumNode.name : "",
      images: extractImageUrl(track) ? [{ url: extractImageUrl(track)! }] : [],
    },
    artists: artistNames.map((artistName) => ({ name: artistName })),
  };
}

function extractTrackItems(response: unknown): unknown[] {
  const responseRecord = isRecord(response) ? response : {};
  const candidateLists = [
    responseRecord.data?.searchV2?.tracksV2?.itemsV2,
    responseRecord.data?.searchV2?.tracksV2?.items,
    responseRecord.searchV2?.tracksV2?.itemsV2,
    responseRecord.searchV2?.tracksV2?.items,
    responseRecord.data?.searchV2?.topResultsV2?.itemsV2,
    responseRecord.searchV2?.topResultsV2?.itemsV2,
    responseRecord.data?.search?.tracks?.items,
    responseRecord.search?.tracks?.items,
  ];

  return candidateLists.find(Array.isArray) ?? [];
}

function mapResults(response: unknown): TrackSummary[] {
  const items = extractTrackItems(response);

  return items
    .map((item) => unwrapTrackNode(item))
    .filter((item): item is UnknownRecord => item !== null)
    .map((track) => mapTrackNode(track))
    .filter((item): item is SearchTrackItem => item !== null)
    .map((item) => buildTrackFromSearchItem(item));
}

function dedupeTracks(results: TrackSummary[], limit: number): TrackSummary[] {
  const seenUris = new Set<string>();
  const deduped: TrackSummary[] = [];

  for (const result of results) {
    if (seenUris.has(result.uri)) {
      continue;
    }

    seenUris.add(result.uri);
    deduped.push(result);

    if (deduped.length >= limit) {
      break;
    }
  }

  return deduped;
}

function getAuthorizationToken(): string {
  const token = Spicetify.Platform?.AuthorizationAPI?.getState?.()?.token?.accessToken;

  if (!isNonEmptyString(token)) {
    throw new Error("AutoQueuer: no se pudo obtener el token de Spotify");
  }

  return token;
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getAuthorizationToken()}`,
      "Content-Type": "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AutoQueuer: ${response.status} ${response.statusText} ${body}`);
  }

  return response.json();
}

async function searchWithPersistedQuery(
  operationName: string,
  hash: string,
  variables: Record<string, any>,
  limit: number,
): Promise<TrackSummary[]> {
  const endpoint =
    "https://api-partner.spotify.com/pathfinder/v1/query" +
    `?operationName=${encodeURIComponent(operationName)}` +
    `&variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }))}`;

  const response = await fetchJson(endpoint, {
    "Spotify-App-Version": Spicetify.Platform?.version ?? "",
    "App-Platform": Spicetify.Platform?.PlatformData?.app_platform ?? "",
  });
  return dedupeTracks(mapResults(response), limit);
}

async function searchWithGraphQLDefinition(
  definitionName: string,
  variables: Record<string, any>,
  limit: number,
): Promise<TrackSummary[]> {
  const definition = Spicetify.GraphQL?.Definitions?.[definitionName];

  if (!definition || !Spicetify.GraphQL?.Request) {
    return [];
  }

  const response = await Spicetify.GraphQL.Request(definition, variables);
  return dedupeTracks(mapResults(response), limit);
}

async function searchWithPlatformSearchApi(query: string, limit: number): Promise<TrackSummary[]> {
  const searchApi = Spicetify.Platform?.SearchAPI;

  if (!searchApi?.getSearchCategoryResults) {
    return [];
  }

  const response = await searchApi.getSearchCategoryResults("tracks", {
    searchTerm: query,
    offset: 0,
    limit,
    includeAudiobooks: true,
    includePreReleases: true,
    includeAuthors: false,
  });

  const items = Array.isArray(response?.items) ? response.items : [];
  return dedupeTracks(mapResults({ searchV2: { tracksV2: { items } } }), limit);
}

async function searchWithTopResultsList(query: string, limit: number): Promise<TrackSummary[]> {
  const response = await searchWithPersistedQuery(
    "searchTopResultsList",
    SEARCH_TOP_RESULTS_LIST_HASH,
    {
      query,
      limit: Math.max(limit * 3, 18),
      offset: 0,
      numberOfTopResults: Math.max(limit * 2, 12),
      includeArtistHasConcertsField: false,
      includeLocalConcertsField: false,
      includeAudiobooks: true,
      includeAuthors: false,
      includePreReleases: true,
      sectionFilters: ["Generic", "VideoContent"],
    },
    limit * 3,
  );

  return dedupeTracks(response, limit);
}

async function searchWithPublicEndpoint(query: string, limit: number): Promise<TrackSummary[]> {
  const encodedQuery = encodeURIComponent(query);
  const endpoints = [
    `https://api.spotify.com/v1/search?type=track&limit=${limit}&q=${encodedQuery}`,
    `https://api.spotify.com/v1/search?type=track&limit=${limit}&q=${encodedQuery}&market=US`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = (await fetchJson(endpoint)) as {
        tracks?: { items?: SearchTrackItem[] };
      };
      const items = Array.isArray(response?.tracks?.items) ? response.tracks.items : [];

      if (items.length > 0) {
        return dedupeTracks(items.map((item) => buildTrackFromSearchItem(item)), limit);
      }
    } catch (error) {
      console.error("AutoQueuer: public search endpoint falló", endpoint, error);
    }
  }

  return [];
}

export async function searchTracks(query: string, limit = 8): Promise<TrackSummary[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [];
  }

  const trackVariables = {
    searchTerm: trimmedQuery,
    offset: 0,
    limit,
    numberOfTopResults: Math.min(limit, 10),
    includeAudiobooks: true,
    includePreReleases: true,
    includeAuthors: false,
  };
  const desktopVariables = {
    query: trimmedQuery,
    offset: 0,
    limit,
    numberOfTopResults: Math.min(limit, 10),
    includeAudiobooks: true,
    includeArtistHasConcertsField: false,
    includeLocalConcertsField: false,
    includePreReleases: true,
    includeAuthors: false,
  };

  const strategies: Array<{
    label: string;
    run: () => Promise<TrackSummary[]>;
  }> = [
    {
      label: "platform search api",
      run: () => searchWithPlatformSearchApi(trimmedQuery, limit),
    },
    {
      label: "graphql searchTracks",
      run: () => searchWithGraphQLDefinition("searchTracks", trackVariables, limit),
    },
    {
      label: "persisted searchTracks",
      run: () => searchWithPersistedQuery("searchTracks", SEARCH_TRACKS_HASH, trackVariables, limit),
    },
    {
      label: "top results list",
      run: () => searchWithTopResultsList(trimmedQuery, limit),
    },
    {
      label: "graphql searchDesktop",
      run: () => searchWithGraphQLDefinition("searchDesktop", desktopVariables, limit),
    },
    {
      label: "persisted searchDesktop",
      run: () => searchWithPersistedQuery("searchDesktop", SEARCH_DESKTOP_HASH, desktopVariables, limit),
    },
  ];

  const errors: Array<{ label: string; error: unknown }> = [];

  for (const strategy of strategies) {
    try {
      const results = await strategy.run();

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      errors.push({ label: strategy.label, error });
      console.error(`: falló ${strategy.label}`, error);
    }
  }

  const publicResults = await searchWithPublicEndpoint(trimmedQuery, limit);

  if (publicResults.length > 0) {
    return publicResults;
  }

  if (errors.length > 0) {
    throw new Error("AutoQueuer: todas las estrategias de búsqueda fallaron");
  }

  return [];
}
