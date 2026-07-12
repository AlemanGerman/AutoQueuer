import React, { useDeferredValue, useEffect, useRef, useState } from "react";
import styles from "./css/app.module.scss";
import { searchTracks } from "./lib/search";
import { loadLanguage, loadRules, removeRule, saveLanguage, setRuleEnabled, upsertRule } from "./lib/storage";
import { buildTrackFromPlayerItem, buildTrackIdentityKey, formatDuration, tracksMatch } from "./lib/tracks";
import { AppLanguage, TrackSummary, TransitionRule } from "./lib/types";

type StatusTone = "success" | "error";

type StatusMessage = {
  tone: StatusTone;
  text: string;
} | null;

type PlayerStateEvent = Event & {
  data?: Spicetify.PlayerState;
};

type AssignmentTarget = "from" | "to";

const COPY = {
  es: {
    title: "AutoQueuer",
    subtitle: "",
    newTransition: "Nueva regla",
    editingTransition: "Editando regla",
    editingBadge: "Editando",
    source: "Cuando se reproduzca",
    target: "Agregar a la fila",
    clear: "Limpiar",
    emptyTrack: (label: string) => `Selecciona una canción`,
    chooseFromSearch: "",
    searchSong: "Buscar canción",
    searchPlaceholder: "Busca por canción o artista",
    searchHint: (target: string) => `Un click la pone en “${target}”.`,
    searching: "Buscando...",
    noResults: "No hubo resultados.",
    notFound: "No se encontró ninguna canción.",
    searchFailed: "La búsqueda falló.",
    probability: "Probabilidad",
    always: "Siempre",
    probabilityLabel: (percent: number) => `Probabilidad ${percent}%`,
    useProbability: "Usar probabilidad",
    saveTransition: "Guardar regla",
    saveChanges: "Guardar cambios",
    transitions: "Mis Reglas",
    emptyTransitions: "No hay reglas todavía.",
    edit: "Editar",
    pause: "Pausar",
    activate: "Activar",
    delete: "Borrar",
    active: "Activa",
    paused: "Pausada",
    deleteTitle: "Eliminar regla",
    deleteBody: (from: string, to: string) => `¿Eliminar la regla entre ${from} y ${to}?`,
    cancel: "Cancelar",
    confirmDelete: "Sí, eliminar",
    selectedFirst: "Primero selecciona una canción del buscador.",
    selectBoth: "Debes seleccionar una canción en “Cuando se reproduzca” y otra en “Agregar a la fila”",
    sameTrack: "Las dos canciones deben ser diferentes.",
    saved: "Regla guardada.",
    updated: "Regla actualizada.",
    deleted: "Regla eliminada.",
    languageShort: {
      es: "ES",
      en: "EN",
    },
    searchTransitions: "Buscar regla...",
    sortBy: "Ordenar",
    sortDefault: "Por defecto",
    sortAlpha: "Alfabético",
    sortArtist: "Por artista",
  },
  en: {
    title: "AutoQueuer",
    subtitle: "",
    newTransition: "New rule",
    editingTransition: "Editing rule",
    editingBadge: "Editing",
    source: "When playing",
    target: "Queue song",
    clear: "Clear",
    emptyTrack: (label: string) => `Select a song`,
    chooseFromSearch: "",
    searchSong: "Search song",
    searchPlaceholder: "Search by song or artist",
    searchHint: (target: string) => `One click sends it to “${target}”.`,
    searching: "Searching...",
    noResults: "No results.",
    notFound: "No songs found.",
    searchFailed: "Search failed.",
    probability: "Probability",
    always: "Always",
    probabilityLabel: (percent: number) => `${percent}% chance`,
    useProbability: "Use probability",
    saveTransition: "Save rule",
    saveChanges: "Save changes",
    transitions: "My Rules",
    emptyTransitions: "No rules yet.",
    edit: "Edit",
    pause: "Pause",
    activate: "Activate",
    delete: "Delete",
    active: "Active",
    paused: "Paused",
    deleteTitle: "Delete rule",
    deleteBody: (from: string, to: string) => `Delete the rule between ${from} and ${to}?`,
    cancel: "Cancel",
    confirmDelete: "Yes, delete",
    selectedFirst: "Select a song from search first.",
    selectBoth: "You must select a song for “When playing” and another for “Queue song”.",
    sameTrack: "The two songs must be different.",
    saved: "Rule saved.",
    updated: "Rule updated.",
    deleted: "Rule deleted.",
    languageShort: {
      es: "ES",
      en: "EN",
    },
    searchTransitions: "Search rules...",
    sortBy: "Sort",
    sortDefault: "Default",
    sortAlpha: "Alphabetical",
    sortArtist: "By artist",
  },
} as const;

type Copy = (typeof COPY)[AppLanguage];

function createRuleId(): string {
  return `transition_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function probabilityText(copy: Copy, probabilityEnabled: boolean, probabilityPercent: number): string {
  return probabilityEnabled ? copy.probabilityLabel(probabilityPercent) : copy.always;
}

function TrackThumb({ track, stacked }: { track: TrackSummary | null; stacked?: boolean }): React.JSX.Element {
  if (!track?.imageUrl) {
    return <div className={stacked ? styles.thumbFallbackStacked : styles.thumbFallback}>♪</div>;
  }

  return <img className={stacked ? styles.thumbStacked : styles.thumb} src={track.imageUrl} alt={track.title} />;
}

function SelectedTrackCard({
  copy,
  isActive,
  label,
  onSelect,
  onClear,
  track,
}: {
  copy: Copy;
  isActive: boolean;
  label: string;
  onSelect: () => void;
  onClear: () => void;
  track: TrackSummary | null;
}): React.JSX.Element {
  return (
    <div
      className={isActive ? styles.selectedCardActive : styles.selectedCard}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.selectedHeader}>
        <span className={styles.cardLabel}>{label}</span>
        <button
          className={styles.ghostButton}
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
          type="button"
          disabled={!track}
        >
          {copy.clear}
        </button>
      </div>

      <div className={styles.selectedBody}>
        <TrackThumb track={track} />
        <div className={styles.trackMeta}>
          <div className={styles.trackTitle}>{track?.title || copy.emptyTrack(label)}</div>
          <div className={styles.trackSubtitle}>{track ? track.artist : copy.chooseFromSearch}</div>
          <div className={styles.trackInfo}>
            <span>{track ? formatDuration(track.durationMs) : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchResultRow({
  actionLabel,
  isSelected,
  onClick,
  track,
}: {
  actionLabel: string;
  isSelected: boolean;
  onClick: () => void;
  track: TrackSummary;
}): React.JSX.Element {
  return (
    <button className={isSelected ? styles.resultRowSelected : styles.resultRow} onClick={onClick} type="button">
      <TrackThumb track={track} />
      <div className={styles.resultMeta}>
        <div className={styles.resultTitle}>{track.title}</div>
        <div className={styles.resultSubtitle}>{track.artist}</div>
        <div className={styles.resultInfo}>
          <span>{formatDuration(track.durationMs)}</span>
        </div>
      </div>
      <div className={styles.resultAction}>{actionLabel}</div>
    </button>
  );
}

function TransitionCard({
  copy,
  isCurrent,
  onDelete,
  onEdit,
  onToggle,
  transition,
}: {
  copy: Copy;
  isCurrent: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
  transition: TransitionRule;
}): React.JSX.Element {
  return (
    <article className={isCurrent ? styles.transitionCardCurrent : styles.transitionCard}>
      <div className={styles.transitionMedia}>
        <div className={styles.stack}>
          <TrackThumb track={transition.from} stacked />
          <TrackThumb track={transition.to} stacked />
        </div>
      </div>

      <div className={styles.transitionContent}>
        <div className={styles.transitionTitle}>{transition.from.title}</div>
        <div className={styles.transitionSubtitle}>
          {transition.to.title} · {transition.to.artist}
        </div>

        <div className={styles.transitionBadges}>
          <span className={styles.transitionBadgePrimary}>
            {probabilityText(copy, transition.probabilityEnabled, transition.probabilityPercent)}
          </span>
          <span className={transition.enabled ? styles.transitionBadgeState : styles.transitionBadgeMuted}>
            {transition.enabled ? copy.active : copy.paused}
          </span>
        </div>
      </div>

      <div className={styles.transitionActions}>
        <button className={styles.iconButton} onClick={onEdit} type="button">
          {copy.edit}
        </button>
        <button className={styles.iconButton} onClick={onToggle} type="button">
          {transition.enabled ? copy.pause : copy.activate}
        </button>
        <button className={styles.iconButtonDanger} onClick={onDelete} type="button">
          {copy.delete}
        </button>
      </div>
    </article>
  );
}

function DeleteTransitionModal({
  copy,
  onCancel,
  onConfirm,
  transition,
}: {
  copy: Copy;
  onCancel: () => void;
  onConfirm: () => void;
  transition: TransitionRule;
}): React.JSX.Element {
  const modal = (
    <div className={styles.modalOverlay} onClick={onCancel} role="presentation">
      <div
        aria-modal="true"
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.modalTitle}>{copy.deleteTitle}</div>
        <div className={styles.modalText}>
          {copy.deleteBody(transition.from.title, transition.to.title)}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.ghostButton} onClick={onCancel} type="button">
            {copy.cancel}
          </button>
          <button className={styles.iconButtonDanger} onClick={onConfirm} type="button">
            {copy.confirmDelete}
          </button>
        </div>
      </div>
    </div>
  );

  return Spicetify.ReactDOM.createPortal(modal, document.body);
}

function useTrackSearch(query: string, enabled: boolean, copy: Copy) {
  const deferredQuery = useDeferredValue(query.trim());
  const [results, setResults] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || deferredQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextResults = await searchTracks(deferredQuery, 10);

        if (isCancelled) {
          return;
        }

        setResults(nextResults);
        if (nextResults.length === 0) {
          setError(copy.notFound);
        }
      } catch (searchError) {
        if (isCancelled) {
          return;
        }

        console.error("Autoqueuer: error buscando canciones", searchError);
        setResults([]);
        setError(copy.searchFailed);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [copy.notFound, copy.searchFailed, deferredQuery, enabled]);

  return {
    results,
    isLoading,
    error,
    hasQuery: deferredQuery.length >= 2,
  };
}

function App(): React.JSX.Element {
  const composerRef = useRef<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>("es");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget>("from");
  const [recentTrackUri, setRecentTrackUri] = useState<string | null>(null);
  const [fromTrack, setFromTrack] = useState<TrackSummary | null>(null);
  const [toTrack, setToTrack] = useState<TrackSummary | null>(null);
  const [currentTrack, setCurrentTrack] = useState<TrackSummary | null>(null);
  const [editingTransitionId, setEditingTransitionId] = useState<string | null>(null);
  const [transitionPendingDelete, setTransitionPendingDelete] = useState<TransitionRule | null>(null);
  const [transitions, setTransitions] = useState<TransitionRule[]>([]);
  const [probabilityEnabled, setProbabilityEnabled] = useState(false);
  const [probabilityPercent, setProbabilityPercent] = useState(50);
  const [isProbabilityInteracting, setIsProbabilityInteracting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [transitionSearchQuery, setTransitionSearchQuery] = useState("");
  type SortMode = "default" | "alpha" | "artist";
  const [transitionSortMode, setTransitionSortMode] = useState<SortMode>("default");

  const copy = COPY[language];
  const searchState = useTrackSearch(searchQuery, isReady, copy);

  useEffect(() => {
    let isDisposed = false;

    const init = async () => {
      while (
        !Spicetify?.LocalStorage ||
        !Spicetify?.CosmosAsync ||
        !Spicetify?.Player?.addEventListener ||
        !Spicetify?.Player?.removeEventListener
      ) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }

      if (isDisposed) {
        return;
      }

      setLanguage(loadLanguage());
      setTransitions(loadRules());
      setCurrentTrack(buildTrackFromPlayerItem(Spicetify.Player.data?.item));
      setIsReady(true);
    };

    void init();

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const songChangeListener = (event?: Event) => {
      const state = (event as PlayerStateEvent | undefined)?.data || Spicetify.Player.data;
      setCurrentTrack(buildTrackFromPlayerItem(state?.item));
    };

    Spicetify.Player.addEventListener("songchange", songChangeListener);

    return () => {
      Spicetify.Player.removeEventListener("songchange", songChangeListener);
    };
  }, [isReady]);

  function setStatus(tone: StatusTone, text: string): void {
    setStatusMessage({ tone, text });
  }

  function clearComposer(): void {
    setEditingTransitionId(null);
    setAssignmentTarget("from");
    setRecentTrackUri(null);
    setSearchQuery("");
    setFromTrack(null);
    setToTrack(null);
    setProbabilityEnabled(false);
    setProbabilityPercent(50);
    setStatusMessage(null);
  }

  function assignTrack(track: TrackSummary, target: AssignmentTarget): void {
    setRecentTrackUri(track.uri);
    setStatusMessage(null);

    if (target === "from") {
      setFromTrack(track);
      setAssignmentTarget("to");
      return;
    }

    setToTrack(track);
    setAssignmentTarget("from");
  }

  function saveTransition(): void {
    if (!fromTrack || !toTrack) {
      setStatus("error", copy.selectBoth);
      return;
    }

    if (fromTrack.uri === toTrack.uri) {
      setStatus("error", copy.sameTrack);
      return;
    }

    const isEditing = editingTransitionId !== null;
    const sourceKey = buildTrackIdentityKey(fromTrack);
    const existingTransition =
      transitions.find((transition) => transition.id === editingTransitionId) ||
      transitions.find((transition) => buildTrackIdentityKey(transition.from) === sourceKey);
      
    const nextTransition: TransitionRule = {
      id: existingTransition?.id || createRuleId(),
      from: fromTrack,
      to: toTrack,
      enabled: existingTransition?.enabled ?? true,
      probabilityEnabled,
      probabilityPercent,
    };

    setTransitions(upsertRule(nextTransition));
    clearComposer();
    setStatus("success", isEditing ? copy.updated : copy.saved);
  }

  function editTransition(transition: TransitionRule): void {
    setEditingTransitionId(transition.id);
    setFromTrack(transition.from);
    setToTrack(transition.to);
    setAssignmentTarget("from");
    setRecentTrackUri(transition.from.uri);
    setProbabilityEnabled(transition.probabilityEnabled);
    setProbabilityPercent(transition.probabilityPercent);
    setStatusMessage(null);
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function confirmDeleteTransition(): void {
    const transition = transitionPendingDelete;

    if (!transition) {
      return;
    }

    if (editingTransitionId === transition.id) {
      clearComposer();
    }

    setTransitions(removeRule(transition.id));
    setTransitionPendingDelete(null);
    setStatus("success", copy.deleted);
  }

  const matchingTransitionIds = new Set(
    transitions
      .filter((transition) => currentTrack && tracksMatch(transition.from, currentTrack))
      .map((transition) => transition.id),
  );
  const highlightedTransitionIds = new Set(
    transitions
      .filter((transition) => currentTrack && transition.enabled && tracksMatch(transition.from, currentTrack))
      .map((transition) => transition.id),
  );
  // 1. Filtrar las transiciones por la búsqueda
  const filteredTransitions = transitions.filter((t) => {
    if (!transitionSearchQuery.trim()) return true;
    const query = transitionSearchQuery.toLowerCase();
    return (
      t.from.title.toLowerCase().includes(query) ||
      t.from.artist.toLowerCase().includes(query) ||
      t.to.title.toLowerCase().includes(query) ||
      t.to.artist.toLowerCase().includes(query)
    );
  });

  // 2. Ordenar las transiciones filtradas
  const orderedTransitions = filteredTransitions
    .map((transition, index) => ({
      transition,
      index,
      isMatchingCurrent: matchingTransitionIds.has(transition.id),
    }))
    .sort((left, right) => {
      // Las coincidencias con la canción actual SIEMPRE van arriba
      if (left.isMatchingCurrent !== right.isMatchingCurrent) {
        return Number(right.isMatchingCurrent) - Number(left.isMatchingCurrent);
      }

      // Orden Alfabético (Por título de canción de origen)
      if (transitionSortMode === "alpha") {
        return left.transition.from.title.localeCompare(right.transition.from.title);
      }

      // Orden por Artista (Por artista de origen)
      if (transitionSortMode === "artist") {
        return left.transition.from.artist.localeCompare(right.transition.from.artist);
      }

      // Orden por Defecto (Por como fueron creadas)
      return left.index - right.index;
    });

  const isEditing = editingTransitionId !== null;

  function removeSelectedTrack(target: "from" | "to"): void {
    if (target === "from") {
      setFromTrack(null);
      setAssignmentTarget("from");
      return;
    }

    setToTrack(null);
    setAssignmentTarget("to");
  }

  const probabilityBubblePosition = ((probabilityPercent - 1) / 98) * 100;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTopRow}>
          <h1 className={styles.headerTitle}>{copy.title}</h1>
          <div className={styles.languageSwitcher}>
            {(["es", "en"] as const).map((nextLanguage) => (
              <button
                className={language === nextLanguage ? styles.languageButtonActive : styles.languageButton}
                key={nextLanguage}
                onClick={() => {
                  setLanguage(saveLanguage(nextLanguage));
                }}
                type="button"
              >
                {copy.languageShort[nextLanguage]}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.headerSubtitle}>{copy.subtitle}</p>
      </header>

      <section className={styles.composerPanel} ref={composerRef}>
        <div className={styles.builderPanel}>
          <div className={styles.panelTitleRow}>
            <div className={styles.sectionLabel}>{isEditing ? copy.editingTransition : copy.newTransition}</div>
            {isEditing ? <span className={styles.editingBadge}>{copy.editingBadge}</span> : null}
          </div>

          <div className={styles.selectedGrid}>
            <SelectedTrackCard
              copy={copy}
              isActive={assignmentTarget === "from"}
              label={copy.source}
              onClear={() => removeSelectedTrack("from")}
              onSelect={() => setAssignmentTarget("from")}
              track={fromTrack}
            />
            <SelectedTrackCard
              copy={copy}
              isActive={assignmentTarget === "to"}
              label={copy.target}
              onClear={() => removeSelectedTrack("to")}
              onSelect={() => setAssignmentTarget("to")}
              track={toTrack}
            />
          </div>

          <div className={styles.inlineSearchBlock}>
            <div className={styles.sectionLabel}>{copy.searchSong}</div>

            <input
              className={styles.searchInput}
              placeholder={copy.searchPlaceholder}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            <div className={styles.searchHint}>
              {copy.searchHint(assignmentTarget === "from" ? copy.source : copy.target)}
            </div>

            {searchState.isLoading ? <div className={styles.searchState}>{copy.searching}</div> : null}
            {searchState.error ? <div className={styles.searchError}>{searchState.error}</div> : null}
            {!searchState.isLoading && searchState.hasQuery && searchState.results.length === 0 && !searchState.error ? (
              <div className={styles.searchState}>{copy.noResults}</div>
            ) : null}

            <div className={styles.searchResults}>
              {searchState.results.map((track) => (
                <SearchResultRow
                  actionLabel={assignmentTarget === "from" ? copy.source : copy.target}
                  isSelected={recentTrackUri === track.uri}
                  key={track.uri}
                  onClick={() => assignTrack(track, assignmentTarget)}
                  track={track}
                />
              ))}
            </div>
          </div>

          <div className={probabilityEnabled ? styles.probabilityCard : styles.probabilityCardInactive}>
            <div className={styles.probabilityHeader}>
              <span className={styles.probabilityTitle}>{copy.probability}</span>
            </div>

            <div className={styles.sliderWrap}>
              {probabilityEnabled && isProbabilityInteracting ? (
                <div className={styles.sliderBubble} style={{ left: `calc(${probabilityBubblePosition}% - 2px)` }}>
                  {probabilityPercent}%
                </div>
              ) : null}

              <input
                className={styles.slider}
                disabled={!probabilityEnabled}
                max={99}
                min={1}
                onBlur={() => setIsProbabilityInteracting(false)}
                onChange={(event) => setProbabilityPercent(Number(event.target.value))}
                onFocus={() => setIsProbabilityInteracting(true)}
                onMouseEnter={() => setIsProbabilityInteracting(true)}
                onMouseLeave={() => setIsProbabilityInteracting(false)}
                onPointerDown={() => setIsProbabilityInteracting(true)}
                onPointerUp={() => setIsProbabilityInteracting(false)}
                type="range"
                value={probabilityPercent}
              />
            </div>

            <div className={styles.sliderLabels}>
              <span>1%</span>
              <span>50%</span>
              <span>99%</span>
            </div>

            <div className={styles.probabilityFooter}>
              <label className={styles.checkboxRow}>
                <input
                  checked={probabilityEnabled}
                  className={styles.checkboxInput}
                  onChange={(event) => setProbabilityEnabled(event.target.checked)}
                  type="checkbox"
                />
                <span className={styles.checkboxBox} />
                <span className={styles.checkboxLabel}>{copy.useProbability}</span>
              </label>
            </div>
          </div>

          <div className={styles.builderActions}>
            <button className={styles.primaryButton} onClick={saveTransition} type="button">
              {isEditing ? copy.saveChanges : copy.saveTransition}
            </button>
            <button className={styles.ghostButton} onClick={clearComposer} type="button">
              {copy.clear}
            </button>
          </div>

          {statusMessage ? (
            <div className={statusMessage.tone === "success" ? styles.statusSuccess : styles.statusError}>{statusMessage.text}</div>
          ) : null}
        </div>
      </section>

      <section className={styles.transitionsSection}>
        <div className={styles.transitionsHeader} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className={styles.sectionLabel}>{copy.transitions}</div>
          
          {/* NUEVOS CONTROLES DE BÚSQUEDA Y ORDEN */}
          <div className={styles.transitionsControls}>
            <input
              className={styles.filterInput}
              placeholder={copy.searchTransitions}
              value={transitionSearchQuery}
              onChange={(e) => setTransitionSearchQuery(e.target.value)}
            />
            <button 
              className={styles.ghostButton}
              onClick={() => {
                const nextMode = transitionSortMode === "default" ? "alpha" : transitionSortMode === "alpha" ? "artist" : "default";
                setTransitionSortMode(nextMode);
              }}
              type="button"
            >
              {copy.sortBy}: {transitionSortMode === "default" ? copy.sortDefault : transitionSortMode === "alpha" ? copy.sortAlpha : copy.sortArtist}
            </button>
          </div>
        </div>

        <div className={styles.transitionsList}>
          {orderedTransitions.map(({ transition }) => (
            <TransitionCard
              copy={copy}
              key={transition.id}
              isCurrent={highlightedTransitionIds.has(transition.id)}
              onDelete={() => setTransitionPendingDelete(transition)}
              onEdit={() => editTransition(transition)}
              onToggle={() => setTransitions(setRuleEnabled(transition.id, !transition.enabled))}
              transition={transition}
            />
          ))}

          {transitions.length === 0 ? <div className={styles.emptyState}>{copy.emptyTransitions}</div> : null}
        </div>
      </section>

      {transitionPendingDelete ? (
        <DeleteTransitionModal
          copy={copy}
          onCancel={() => setTransitionPendingDelete(null)}
          onConfirm={confirmDeleteTransition}
          transition={transitionPendingDelete}
        />
      ) : null}

      <footer className={styles.footer}>
        Creado por <a href="https://github.com/AlemanGerman/AutoQueuer" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>AlemanGerman</a>
      </footer>
    </div>
  );
}

export default App;
