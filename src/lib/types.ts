export type TrackSummary = {
  uri: string;
  title: string;
  artist: string;
  durationMs: number;
  imageUrl?: string;
};

export type TransitionRule = {
  id: string;
  from: TrackSummary;
  to: TrackSummary;
  enabled: boolean;
  probabilityEnabled: boolean;
  probabilityPercent: number;
};

export type AppLanguage = "es" | "en";

export const STORAGE_KEYS = {
  rules: "autoqueuer:rules",
  language: "autoqueuer:language",
} as const;