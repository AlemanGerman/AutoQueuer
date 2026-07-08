import { TrackSummary } from "./types";

type SearchArtist = {
  name: string;
};

type SearchImage = {
  url: string;
};

type SearchAlbum = {
  name: string;
  images?: SearchImage[];
};

export type SearchTrackItem = {
  uri: string;
  name: string;
  duration_ms: number;
  album: SearchAlbum;
  artists: SearchArtist[];
};

const TRACK_URI_PATTERN = /^spotify:track:[A-Za-z0-9]+$/;
const MATCH_DURATION_TOLERANCE_MS = 4000;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildArtistLabel(artistNames: string[]): string {
  const filteredNames = artistNames.map((name) => name.trim()).filter(Boolean);
  return filteredNames.join(", ");
}

function parseDurationMs(value: unknown): number {
  const duration = typeof value === "string" ? Number(value) : value;

  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  return duration < 10000 ? duration * 1000 : duration;
}

function extractMetadataArtistNames(metadata?: Spicetify.TrackMetadata): string[] {
  if (!metadata) {
    return [];
  }

  return Object.entries(metadata)
    .filter(([key]) => key === "artist_name" || /^artist_name:\d+$/.test(key))
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, undefined, { numeric: true }))
    .map(([, value]) => value)
    .filter(Boolean);
}

function roundDurationBucket(durationMs: number): number {
  return Math.round(durationMs / 2000);
}

export function isTrackUri(value: string): boolean {
  return TRACK_URI_PATTERN.test(value.trim());
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function buildTrackIdentityKey(track: TrackSummary): string {
  return [
    normalizeText(track.title),
    normalizeText(track.artist),
    roundDurationBucket(track.durationMs),
  ].join("::");
}

export function buildTrackFromPlayerItem(item?: Spicetify.PlayerTrack | null): TrackSummary | null {
  if (!item?.uri || !isTrackUri(item.uri)) {
    return null;
  }

  const artistNames = item.artists?.map((artist) => artist.name).filter(Boolean) || extractMetadataArtistNames(item.metadata);

  return {
    uri: item.uri,
    title: item.name?.trim() || item.metadata?.title || item.uri,
    artist: buildArtistLabel(artistNames) || item.metadata?.artist_name || "Artista desconocido",
    durationMs: parseDurationMs(item.duration?.milliseconds) || parseDurationMs(item.metadata?.duration),
    imageUrl:
      item.images?.[0]?.url ||
      item.metadata?.image_xlarge_url ||
      item.metadata?.image_large_url ||
      item.metadata?.image_url ||
      undefined,
  };
}

export function buildTrackFromSearchItem(item: SearchTrackItem): TrackSummary {
  const artistNames = item.artists?.map((artist) => artist.name).filter(Boolean) || [];

  return {
    uri: item.uri,
    title: item.name,
    artist: buildArtistLabel(artistNames) || "Artista desconocido",
    durationMs: parseDurationMs(item.duration_ms),
    imageUrl: item.album?.images?.[0]?.url,
  };
}

export function tracksMatch(sourceTrack: TrackSummary, currentTrack: TrackSummary): boolean {
  if (sourceTrack.uri === currentTrack.uri) {
    return true;
  }

  const sameTitle = normalizeText(sourceTrack.title) === normalizeText(currentTrack.title);
  const sameArtist = normalizeText(sourceTrack.artist) === normalizeText(currentTrack.artist);
  const closeDuration =
    sourceTrack.durationMs > 0 &&
    currentTrack.durationMs > 0 &&
    Math.abs(sourceTrack.durationMs - currentTrack.durationMs) <= MATCH_DURATION_TOLERANCE_MS;

  return sameTitle && sameArtist && closeDuration;
}
