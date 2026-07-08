import { loadLanguage, loadRules } from "../lib/storage";
import { buildTrackFromPlayerItem, tracksMatch } from "../lib/tracks";
import { TransitionRule } from "../lib/types";

type SongChangeEvent = Event & {
  data: Spicetify.PlayerState;
};

type PlayerEventListener = (event?: Event) => void;

type PendingTransition = {
  id: string;
  playbackId?: string;
  fromUri: string;
  toUri: string;
  toTitle: string;
  thresholdMs: number;
  probabilityEnabled: boolean;
  probabilityPercent: number;
};

type AWindow = Window & {
  __autoQueuerSongChangeListener?: PlayerEventListener;
  __autoQueuerProgressListener?: PlayerEventListener;
  __autoQueuerPollInterval?: number;
};

const EXT_COPY = {
  es: {
    added: (title: string) => `"${title}" se añadió a la fila`,
    addedWithProb: (title: string, roll: number, pct: number) => `"${title}" añadido a la fila (Probabilidad: ${roll}% de ${pct}%)`,
    failedProb: (title: string, roll: number, pct: number) => `No se añadió "${title}" (Probabilidad: ${roll}% de ${pct}%)`,
    error: "Error al añadir la transición",
  },
  en: {
    added: (title: string) => `"${title}" was added to the queue`,
    addedWithProb: (title: string, roll: number, pct: number) => `"${title}" added to queue (Chance: ${roll}% of ${pct}%)`,
    failedProb: (title: string, roll: number, pct: number) => `"${title}" not added (Chance: ${roll}% of ${pct}%)`,
    error: "Error adding transition",
  },
} as const;

const TRANSITION_THRESHOLD_RATIO = 0.7;
const POLL_INTERVAL_MS = 1000;
const handledPlaybackIds = new Set<string>();
let pendingTransition: PendingTransition | null = null;

function rememberPlayback(playbackId: string): void {
  handledPlaybackIds.add(playbackId);

  if (handledPlaybackIds.size <= 100) {
    return;
  }

  const oldestPlaybackId = handledPlaybackIds.values().next().value;

  if (oldestPlaybackId) {
    handledPlaybackIds.delete(oldestPlaybackId);
  }
}

async function waitForSpicetify(): Promise<void> {
  while (
    !Spicetify?.Player ||
    !Spicetify.Player.addEventListener ||
    !Spicetify.Player.removeEventListener ||
    !Spicetify.Player.data ||
    !Spicetify.Player.getProgress ||
    !Spicetify.showNotification ||
    !Spicetify?.LocalStorage
  ) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
}

function resetPendingTransition(): void {
  pendingTransition = null;
}

function findMatchingRule(state: Spicetify.PlayerState): TransitionRule | null {
  const currentTrack = buildTrackFromPlayerItem(state.item);

  if (!currentTrack) {
    return null;
  }

  return loadRules().find((rule) => rule.enabled && tracksMatch(rule.from, currentTrack)) || null;
}

function getTrackDurationMs(state: Spicetify.PlayerState): number {
  const durationCandidates = [
    state.duration,
    state.item?.duration?.milliseconds,
    Number(state.item?.metadata?.duration),
    Spicetify.Player.getDuration?.(),
  ];

  return durationCandidates.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0) || 0;
}

function getPlaybackId(state: Spicetify.PlayerState, currentUri: string): string {
  if (state.playbackId) {
    return state.playbackId;
  }

  return `${currentUri}:${state.timestamp || Date.now()}`;
}

function getProgressMs(state: Spicetify.PlayerState, progressFromEvent?: number): number {
  const eventProgress = typeof progressFromEvent === "number" && Number.isFinite(progressFromEvent) ? progressFromEvent : 0;
  const playerProgress = Spicetify.Player.getProgress?.() || 0;

  if (playerProgress > 0) {
    return playerProgress;
  }

  if (eventProgress > 0) {
    return eventProgress;
  }

  const position = Number(state.positionAsOfTimestamp) || 0;

  if (state.isPaused || !state.timestamp || position <= 0) {
    return position;
  }

  return position + Math.max(0, Date.now() - state.timestamp);
}

function buildPendingTransition(state: Spicetify.PlayerState): PendingTransition | null {
  const currentUri = state.item?.uri;
  const durationMs = getTrackDurationMs(state);
  const matchingRule = findMatchingRule(state);

  if (!matchingRule || !durationMs || !currentUri) {
    return null;
  }

  return {
    id: getPlaybackId(state, currentUri),
    playbackId: state.playbackId || undefined,
    fromUri: currentUri,
    toUri: matchingRule.to.uri,
    toTitle: matchingRule.to.title,
    thresholdMs: durationMs * TRANSITION_THRESHOLD_RATIO,
    probabilityEnabled: matchingRule.probabilityEnabled,
    probabilityPercent: matchingRule.probabilityPercent,
  };
}

async function addTrackToQueue(uri: string): Promise<void> {
  const spicetify = Spicetify as typeof Spicetify & {
    Platform?: {
      PlayerAPI?: {
        addToQueue?: (track: string | { uri: string } | Array<{ uri: string }>) => Promise<void>;
      };
    };
    addToQueue?: (track: string | Array<{ uri: string }>) => Promise<void>;
  };

  if (spicetify.addToQueue) {
    try {
      await spicetify.addToQueue([{ uri }]);
      return;
    } catch (error) {
      console.warn("AutoQueuer: Spicetify.addToQueue([{ uri }]) falló, intentando fallback", error);
    }

    await spicetify.addToQueue(uri);
    return;
  }

  if (spicetify.Platform?.PlayerAPI?.addToQueue) {
    await spicetify.Platform.PlayerAPI.addToQueue({ uri });
    return;
  }

  throw new Error("No hay API disponible para añadir canciones a la fila");
}

async function tryQueueTransition(state: Spicetify.PlayerState, progressFromEvent?: number): Promise<void> {
  if (!pendingTransition || state.isPaused) {
    return;
  }

  const currentUri = state.item?.uri;
  const playbackId = state.playbackId;
  const progressMs = getProgressMs(state, progressFromEvent);

  if (!currentUri) {
    resetPendingTransition();
    return;
  }

  if (
    currentUri !== pendingTransition.fromUri ||
    (playbackId && pendingTransition.playbackId && playbackId !== pendingTransition.playbackId)
  ) {
    resetPendingTransition();
    return;
  }

  if (handledPlaybackIds.has(pendingTransition.id)) {
    resetPendingTransition();
    return;
  }

  if (progressMs < pendingTransition.thresholdMs) {
    return;
  }

  const nextTransition = pendingTransition;
  rememberPlayback(nextTransition.id);
  resetPendingTransition();

  // --- NUEVA LÓGICA DE IDIOMA Y PROBABILIDAD ---
  const userLang = (loadLanguage() as "es" | "en") || "es";
  const copy = EXT_COPY[userLang] || EXT_COPY.es;

  if (nextTransition.probabilityEnabled) {
    // Calculamos el tiro (número entre 1 y 100 redondeado sin decimales para la notificación)
    const roll = Math.floor(Math.random() * 100) + 1;
    const passed = roll <= nextTransition.probabilityPercent;

    if (passed) {
      try {
        await addTrackToQueue(nextTransition.toUri);
        Spicetify.showNotification(copy.addedWithProb(nextTransition.toTitle, roll, nextTransition.probabilityPercent));
      } catch (error) {
        console.error("AutoQueuer: no se pudo añadir la transición", error);
        Spicetify.showNotification(copy.error, true);
      }
    } else {
      // Como pediste que avise "ya sea que se haya cumplido o no", si falla el tiro, 
      // enviamos la notificación indicando que no se añadió y qué numero cayó.
      Spicetify.showNotification(copy.failedProb(nextTransition.toTitle, roll, nextTransition.probabilityPercent));
    }
  } else {
    // Transición estándar sin factor de probabilidad ("Siempre")
    try {
      await addTrackToQueue(nextTransition.toUri);
      Spicetify.showNotification(copy.added(nextTransition.toTitle));
    } catch (error) {
      console.error("AutoQueuer: no se pudo añadir la transición", error);
      Spicetify.showNotification(copy.error, true);
    }
  }
}

async function handleSongChange(event?: SongChangeEvent): Promise<void> {
  const state = event?.data || Spicetify.Player.data;

  if (!state?.item?.uri) {
    resetPendingTransition();
    return;
  }

  pendingTransition = buildPendingTransition(state);
  await tryQueueTransition(state);
}

async function handleProgress(progressFromEvent?: number): Promise<void> {
  const state = Spicetify.Player.data;

  if (!state?.item?.uri) {
    resetPendingTransition();
    return;
  }

  await tryQueueTransition(state, progressFromEvent);
}

const songChangeListener: PlayerEventListener = (event) => {
  void handleSongChange(event as SongChangeEvent | undefined);
};

const progressListener: PlayerEventListener = (event) => {
  void handleProgress((event as Event & { data?: number } | undefined)?.data);
};

async function main(): Promise<void> {
  await waitForSpicetify();

  const appWindow = window as AWindow;

  if (appWindow.__autoQueuerSongChangeListener) {
    Spicetify.Player.removeEventListener("songchange", appWindow.__autoQueuerSongChangeListener);
  }

  if (appWindow.__autoQueuerProgressListener) {
    Spicetify.Player.removeEventListener("onprogress", appWindow.__autoQueuerProgressListener);
  }

  if (appWindow.__autoQueuerPollInterval) {
    window.clearInterval(appWindow.__autoQueuerPollInterval);
  }

  appWindow.__autoQueuerSongChangeListener = songChangeListener;
  appWindow.__autoQueuerProgressListener = progressListener;

  Spicetify.Player.addEventListener("songchange", songChangeListener);
  Spicetify.Player.addEventListener("onprogress", progressListener);
  appWindow.__autoQueuerPollInterval = window.setInterval(() => {
    void handleProgress();
  }, POLL_INTERVAL_MS);

  await handleSongChange();
}

void main();