import { buildTrackIdentityKey } from "./tracks";
import { AppLanguage, STORAGE_KEYS, TrackSummary, TransitionRule } from "./types";

type PartialTrackSummary = Partial<TrackSummary> & {
  uri?: string;
  title?: string;
  artist?: string;
};

type PartialTransitionRule = Partial<TransitionRule> & {
  from?: PartialTrackSummary;
  to?: PartialTrackSummary;
};

function readJson<T>(key: string, fallback: T): T {
  const rawValue = Spicetify.LocalStorage.get(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function normalizeTrack(track?: PartialTrackSummary): TrackSummary | null {
  if (!track?.uri || !track?.title) {
    return null;
  }

  return {
    uri: track.uri,
    title: track.title,
    artist: track.artist || "Artista desconocido",
    durationMs: Number(track.durationMs) || 0,
    imageUrl: track.imageUrl,
  };
}

function normalizeRule(rule: PartialTransitionRule, index: number): TransitionRule | null {
  const fromTrack = normalizeTrack(rule.from);
  const toTrack = normalizeTrack(rule.to);

  if (!fromTrack || !toTrack) {
    return null;
  }

  const now = Date.now();

  return {
    id: rule.id || `transition_${now}_${index}`,
    from: fromTrack,
    to: toTrack,
    enabled: rule.enabled ?? true,
    probabilityEnabled: rule.probabilityEnabled ?? false,
    probabilityPercent: Math.min(99, Math.max(1, Number(rule.probabilityPercent) || 50)),
  };
}

function normalizeRules(rules: unknown): TransitionRule[] {
  return Array.isArray(rules)
    ? rules
        .map((rule, index) => normalizeRule(rule as PartialTransitionRule, index))
        .filter((rule): rule is TransitionRule => rule !== null)
    : [];
}

export function loadRules(): TransitionRule[] {
  const rawValue = Spicetify.LocalStorage.get(STORAGE_KEYS.rules);
  const parsedRules = rawValue ? readJson<PartialTransitionRule[]>(STORAGE_KEYS.rules, []) : [];
  const normalizedRules = normalizeRules(parsedRules);
  const normalizedJson = JSON.stringify(normalizedRules);

  if (rawValue !== normalizedJson) {
    Spicetify.LocalStorage.set(STORAGE_KEYS.rules, normalizedJson);
  }

  return normalizedRules;
}

export function saveRules(rules: TransitionRule[]): TransitionRule[] {
  const normalizedRules = normalizeRules(rules);
  Spicetify.LocalStorage.set(STORAGE_KEYS.rules, JSON.stringify(normalizedRules));
  return normalizedRules;
}

export function upsertRule(nextRule: TransitionRule): TransitionRule[] {
  const nextSourceKey = buildTrackIdentityKey(nextRule.from);
  const otherRules = loadRules().filter((rule) => {
    if (rule.id === nextRule.id) {
      return false;
    }

    return buildTrackIdentityKey(rule.from) !== nextSourceKey;
  });

  return saveRules([nextRule, ...otherRules]);
}

export function removeRule(ruleId: string): TransitionRule[] {
  const nextRules = loadRules().filter((rule) => rule.id !== ruleId);
  return saveRules(nextRules);
}

export function setRuleEnabled(ruleId: string, enabled: boolean): TransitionRule[] {
  const nextRules = loadRules().map((rule) => {
    if (rule.id !== ruleId) {
      return rule;
    }

    return {
      ...rule,
      enabled,
    };
  });

  return saveRules(nextRules);
}

export function loadLanguage(): AppLanguage {
  const language = Spicetify.LocalStorage.get(STORAGE_KEYS.language);
  return language === "en" ? "en" : "es";
}

export function saveLanguage(language: AppLanguage): AppLanguage {
  Spicetify.LocalStorage.set(STORAGE_KEYS.language, language);
  return language;
}
