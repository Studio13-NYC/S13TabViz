const fileInput = document.querySelector("#tabFile");
const sourceButtonText = document.querySelector("#sourceButtonText");
const sourceLibrary = document.querySelector("#sourceLibrary");
const refreshSources = document.querySelector("#refreshSources");
const storageStatus = document.querySelector("#storageStatus");
const metronomeFile = document.querySelector("#metronomeFile");
const clickButtonText = document.querySelector("#clickButtonText");
const playPause = document.querySelector("#playPause");
const restart = document.querySelector("#restart");
const tempo = document.querySelector("#tempo");
const tempoValue = document.querySelector("#tempoValue");
const notesLayer = document.querySelector("#notesLayer");
const nowPlaying = document.querySelector("#nowPlaying");
const hitTargets = [...document.querySelectorAll(".strike-line span")];
const generateReport = document.querySelector("#generateReport");
const debugRunLabel = document.querySelector("#debugRunLabel");
const debugPlayhead = document.querySelector("#debugPlayhead");
const debugLastTick = document.querySelector("#debugLastTick");
const debugHitNotes = document.querySelector("#debugHitNotes");
const debugEventCounts = document.querySelector("#debugEventCounts");
const debugEvents = document.querySelector("#debugEvents");
const debugReport = document.querySelector("#debugReport");
const backingToggle = document.querySelector("#backingToggle");
const mixSlider = document.querySelector("#mixSlider");
const backingStatus = document.querySelector("#backingStatus");

const BAR_UNITS = 1;
const QUARTER_NOTE_UNITS = 0.25;
const EIGHTH_NOTE_UNITS = 0.125;
const TRIPLET_EIGHTH_UNITS = 1 / 12;
const HALF_NOTE_UNITS = 0.5;
const WHOLE_NOTE_UNITS = 1;
const SIXTEENTH_NOTE_UNITS = 0.0625;
const THIRTY_SECOND_NOTE_UNITS = 0.03125;
const SIXTY_FOURTH_NOTE_UNITS = 0.015625;
const START_POSITION = -BAR_UNITS;
const HORIZON_UNITS = BAR_UNITS;
const EMPTY_RUNWAY_UNITS = 0;
const PLAY_START_POSITION = START_POSITION - HORIZON_UNITS - EMPTY_RUNWAY_UNITS;
const TOP_Y = 9;
const HIT_Y = 82;
const PAST_HIT_UNITS_VISIBLE = QUARTER_NOTE_UNITS * 1.35;
const HIT_ZONE_WINDOW_UNITS = QUARTER_NOTE_UNITS * 0.1;
const STRIKE_SYNC_WINDOW_UNITS = QUARTER_NOTE_UNITS * 0.025;
const METRONOME_LOOKAHEAD_SECONDS = 0.08;
const WHOLE_NOTE_HEIGHT = 184;
const DEFAULT_GP_NOTES_URL = "./data/input/processed/hand-sync-pt1-notes.json";
const DEFAULT_GP_BACKING_URL = "./data/input/processed/hand-sync-pt1-backing.mp3";
const INPUT_MANIFEST_URL = "./data/input/index.json";
const AZURE_CONFIG_URL = "./data/input/azure-config.json";
const AZURE_SAS_STORAGE_KEY = "s13tabviz.azureContainerSasUrl";
const DEFAULT_INPUT_PREFIX = "input/";
const DEFAULT_PROCESSED_PREFIX = "input/processed/";
const DEFAULT_MIX_POSITION = 50;
const BACKING_DRIFT_CORRECTION_SECONDS = 0.08;
const TEMPO_MIN = Number(tempo.min) || 40;
const TEMPO_MAX = Number(tempo.max) || 180;
const NOTE_VALUE_TO_UNITS = {
  Whole: WHOLE_NOTE_UNITS,
  Half: HALF_NOTE_UNITS,
  Quarter: QUARTER_NOTE_UNITS,
  Eighth: EIGHTH_NOTE_UNITS,
  "16th": SIXTEENTH_NOTE_UNITS,
  Sixteenth: SIXTEENTH_NOTE_UNITS,
  "32nd": THIRTY_SECOND_NOTE_UNITS,
  ThirtySecond: THIRTY_SECOND_NOTE_UNITS,
  "64th": SIXTY_FOURTH_NOTE_UNITS,
  SixtyFourth: SIXTY_FOURTH_NOTE_UNITS,
};

// Visual lane mapping uses user-facing guitar strings: 1 is high e, 6 is low E.
const laneColor = {
  1: "var(--violet)",
  2: "var(--blue)",
  3: "var(--cyan)",
  4: "var(--green)",
  5: "var(--orange)",
  6: "var(--red)",
};

const laneLabels = {
  1: "e",
  2: "B",
  3: "G",
  4: "D",
  5: "A",
  6: "E",
};

const stringPositions = {
  1: 12,
  2: 27.2,
  3: 42.4,
  4: 57.6,
  5: 72.8,
  6: 88,
};

const stringBackPositions = {
  1: 18.2,
  2: 31,
  3: 43.2,
  4: 56.8,
  5: 69,
  6: 81.8,
};

const countInNotes = Array.from({ length: 4 }, (_, index) => ({
  isCount: true,
  position: START_POSITION + index * QUARTER_NOTE_UNITS,
  durationUnits: QUARTER_NOTE_UNITS,
  count: (index % 4) + 1,
}));

const fallbackNotes = [
  { string: 3, fret: 5, position: 0, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 2, fret: 5, position: EIGHTH_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 1, fret: 5, position: QUARTER_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 2, fret: 6, position: QUARTER_NOTE_UNITS + EIGHTH_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 3, fret: 7, position: HALF_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 4, fret: 7, position: HALF_NOTE_UNITS + EIGHTH_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 5, fret: 8, position: HALF_NOTE_UNITS + QUARTER_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 6, fret: 8, position: HALF_NOTE_UNITS + QUARTER_NOTE_UNITS + EIGHTH_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 5, fret: 7, position: BAR_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 4, fret: 5, position: BAR_UNITS + EIGHTH_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 3, fret: 4, position: BAR_UNITS + QUARTER_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 2, fret: 5, position: BAR_UNITS + QUARTER_NOTE_UNITS + EIGHTH_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
  { string: 3, fret: 7, position: BAR_UNITS + HALF_NOTE_UNITS, durationUnits: EIGHTH_NOTE_UNITS },
];

// Runtime song state is replaced by extracted GPIF JSON once loadDefaultGpData succeeds.
let songNotes = [...fallbackNotes];
let timelineNotes = [...countInNotes, ...songNotes];
let songEndPosition = BAR_UNITS * 2;
let sourceMetadata = {
  file: "Hand Sync pt1 + BT.gp",
  title: "Hand Sync pt.1",
  tempo: 120,
  timeSignature: "4/4",
  backingTrack: {
    available: false,
    url: null,
    embeddedPath: null,
    label: "No backing track",
    nativeTempo: 120,
    startOffsetUnits: 0,
    startOffsetSeconds: 0,
  },
  scoreTimingSource: "GPIF notes",
};

let isPlaying = false;
let startedAtAudio = 0;
let pausedAt = PLAY_START_POSITION;
let currentPlayhead = pausedAt;
let rafId = 0;
let metronomeBuffer = null;
let audioContext = null;
let metronomeBus = null;
let backingBus = null;
let lastMetronomeTickIndex = null;
let activeTempo = Number(tempo.value);
let activeHitKeys = new Set();
let activeStrikeKeys = new Set();
let debugAudioDestination = null;
let syncAudioRecorder = null;
let syncAudioChunks = [];
let scheduledClickNodes = new Set();
let backingTrackAudio = null;
let backingMediaSource = null;
let backingTrackObjectUrl = null;
let backingTrackLoadToken = 0;
let lastBackingStart = null;
let backingStartTimer = 0;
let backingDriftSeconds = null;
let backingStatusError = "";
let sourceLibraryEntries = [];
let azureStorageConfig = null;
let activeSourceKey = "";
let mixerState = {
  position: DEFAULT_MIX_POSITION / 100,
  metronomeGain: 1,
  backingGain: 0,
  backingAvailable: false,
  backingEnabled: true,
  backingLoaded: false,
  backingPlaying: false,
};

const syncDebug = {
  currentRun: null,
  runHistory: [],
  metronomeEvents: [],
  noteHitEvents: [],
  noteStrikeEvents: [],
  visibleHitNotes: [],
  latestReport: "",
};

window.__syncDebug = syncDebug;
window.__metronomeEvents = syncDebug.metronomeEvents;
window.__mixerState = mixerState;

// Purpose: fold song playback back to the start after the extracted notes end.
// Warning: do not normalize negative count-in or lead-in space, because those units are a one-way pre-roll.
// Why this shape: refactored from beat-based looping to whole-note position looping so quarter notes are .25, not 1.
function normalizePlaybackPosition(position) {
  if (position < songEndPosition) return position;
  return ((position % songEndPosition) + songEndPosition) % songEndPosition;
}

// Purpose: convert an absolute position into display/report bar metadata.
// Warning: negative units are treated as count-in/lead-in, not song bars.
// Why this shape: reports need human-readable positions without changing the underlying position clock.
function timeSignaturePosition(position) {
  const tickIndex = Math.floor(position / QUARTER_NOTE_UNITS + 0.0001);
  const positionInBar = ((tickIndex % 4) + 4) % 4;
  const bar =
    position < 0
      ? "count-in"
      : Math.floor(position / BAR_UNITS) + 1;

  return {
    bar,
    positionInBar: positionInBar + 1,
    timeSignature: "4/4",
  };
}

// Purpose: produce the short visible/debug label for a rendered note.
// Warning: count-in labels intentionally do not use string/fret data.
// Why this shape: one helper keeps UI text and sync report text consistent.
function noteLabel(note) {
  return note.isCount ? `Count ${note.count}` : `${laneLabels[note.string]}${note.fret}`;
}

// Purpose: return a note duration in whole-note units with a quarter-note fallback for old demo data.
// Warning: fallback should only protect legacy/fallback notes; extracted data should carry durationUnits.
// Why this shape: all timing and sizing math stays in units instead of mixed notation strings.
function durationUnits(note) {
  return note.durationUnits || QUARTER_NOTE_UNITS;
}

// Purpose: translate position durations into stable CSS/debug duration names.
// Warning: keep the tolerance narrow so malformed durations are visible in reports.
// Why this shape: labels drive both note styling and proof-report readability.
function durationLabel(note) {
  const units = durationUnits(note);
  if (Math.abs(units - WHOLE_NOTE_UNITS) < 0.001) return "whole";
  if (Math.abs(units - HALF_NOTE_UNITS) < 0.001) return "half";
  if (Math.abs(units - QUARTER_NOTE_UNITS) < 0.001) return "quarter";
  if (Math.abs(units - EIGHTH_NOTE_UNITS) < 0.001) return "eighth";
  if (Math.abs(units - TRIPLET_EIGHTH_UNITS) < 0.001) return "eighth-triplet";
  if (Math.abs(units - SIXTEENTH_NOTE_UNITS) < 0.001) return "sixteenth";
  if (Math.abs(units - THIRTY_SECOND_NOTE_UNITS) < 0.001) return "thirty-second";
  if (Math.abs(units - SIXTY_FOURTH_NOTE_UNITS) < 0.001) return "sixty-fourth";
  return `${Number(units.toFixed(3))} units`;
}

// Purpose: capture a note's sync/debug metadata at the moment it enters a hit window.
// Warning: scheduled audio time is based on the run's starting position, so it must be called after startSyncRun().
// Why this shape: refactored from frame-only timestamps to include scheduled audio time, which gives cleaner click/note sync proof.
function noteMetadata(note, playhead, rawPosition, pos) {
  const distance = distanceToNote(note, playhead);
  const scheduledAudioContextSeconds =
    syncDebug.currentRun && Number.isFinite(startedAtAudio)
      ? scheduledAudioTimeForPosition(note.position)
      : null;
  return {
    key: `${note.isCount ? "count" : "note"}:${note.position}:${note.string || "all"}:${note.fret || note.count}`,
    label: noteLabel(note),
    kind: note.isCount ? "count-in" : "song-note",
    scheduledPosition: note.position,
    string: note.isCount ? "all" : laneLabels[note.string],
    fret: note.isCount ? null : note.fret,
    count: note.isCount ? note.count : null,
    durationUnits: Number(durationUnits(note).toFixed(4)),
    durationLabel: durationLabel(note),
    measure: note.measure || null,
    sourceMeasure: note.sourceMeasure || null,
    positionInMeasure: note.positionInMeasure ?? null,
    pickStroke: note.pickStroke || null,
    scheduledAudioContextSeconds:
      scheduledAudioContextSeconds === null
        ? null
        : Number(scheduledAudioContextSeconds.toFixed(4)),
    playhead: Number(playhead.toFixed(4)),
    rawPosition: Number(rawPosition.toFixed(4)),
    distanceToHit: Number(distance.toFixed(4)),
    screenXPercent: Number(pos.x.toFixed(2)),
    screenYPercent: Number(pos.y.toFixed(2)),
  };
}

// Purpose: snapshot playback/source settings for the current sync report.
// Warning: this should be called at run start; later UI changes should not rewrite old run settings.
// Why this shape: reports need to describe the exact runtime state used for a capture.
function runSettings() {
  return {
    sourceFile: sourceMetadata.file || "Fallback demo notes",
    sourceTitle: sourceMetadata.title,
    bpm: activeTempo,
    timeSignature: sourceMetadata.timeSignature || "4/4",
    scoreTimingSource: sourceMetadata.scoreTimingSource || "GPIF notes",
    metronomeSound: clickButtonText?.textContent || "Default Click",
    clickSource: metronomeBuffer ? "selected wav" : "built-in click",
    backingTrack: {
      available: Boolean(sourceMetadata.backingTrack?.available),
      loaded: Boolean(isBackingTrackLoaded()),
      enabled: Boolean(backingToggle?.checked),
      label: sourceMetadata.backingTrack?.label || "No backing track",
      nativeTempo: sourceMetadata.backingTrack?.nativeTempo || sourceMetadata.tempo || 120,
      startOffsetSeconds: Number(backingStartOffsetSeconds().toFixed(3)),
      preservesPitch: backingTrackAudio ? backingPitchPreserveEnabled(backingTrackAudio) : false,
      tempoRatio: Number(backingTempoRatio().toFixed(4)),
      mediaCurrentTime: backingTrackAudio ? Number(backingTrackAudio.currentTime.toFixed(3)) : null,
      expectedCurrentTime: expectedBackingMediaTime(currentPlayhead),
      driftSeconds: backingDriftSeconds,
      mixerPosition: Number(mixerState.position.toFixed(2)),
      metronomeGain: Number(mixerState.metronomeGain.toFixed(3)),
      backingGain: Number(mixerState.backingGain.toFixed(3)),
    },
    countInUnits: BAR_UNITS,
    startPosition: START_POSITION,
    playStartPosition: PLAY_START_POSITION,
    horizonUnits: HORIZON_UNITS,
    emptyRunwayUnits: EMPTY_RUNWAY_UNITS,
    hitZoneWindowUnits: HIT_ZONE_WINDOW_UNITS,
    strikeSyncWindowUnits: STRIKE_SYNC_WINDOW_UNITS,
    durationScale: {
      whole: WHOLE_NOTE_UNITS,
      half: HALF_NOTE_UNITS,
      quarter: QUARTER_NOTE_UNITS,
      eighth: EIGHTH_NOTE_UNITS,
      tripletEighth: Number(TRIPLET_EIGHTH_UNITS.toFixed(4)),
    },
    userAgent: navigator.userAgent,
  };
}

// Purpose: initialize a new sync/debug run and clear prior per-run event arrays.
// Warning: call before scheduling metronome ticks so event timestamps share the same run id.
// Why this shape: a simple in-memory run object is enough for prototype proof without adding storage.
function startSyncRun() {
  const now = new Date();
  syncDebug.currentRun = {
    id: `run-${now.toISOString().replace(/[:.]/g, "-")}`,
    startedAtIso: now.toISOString(),
    startedAtPerformanceMs: Number(performance.now().toFixed(3)),
    startedAtPosition: pausedAt,
    settings: runSettings(),
  };
  syncDebug.runHistory.push(syncDebug.currentRun);
  syncDebug.metronomeEvents.length = 0;
  syncDebug.noteHitEvents.length = 0;
  syncDebug.noteStrikeEvents.length = 0;
  syncDebug.visibleHitNotes.length = 0;
  activeHitKeys = new Set();
  activeStrikeKeys = new Set();
  window.__metronomeEvents = syncDebug.metronomeEvents;
  updateDebugPanel();
}

// Purpose: provide common timestamp fields for debug events.
// Warning: audioContextSeconds can be null before audio has been initialized.
// Why this shape: centralizing timestamps keeps report events comparable.
function eventBase() {
  const context = audioContext;
  return {
    runId: syncDebug.currentRun?.id || "no-run",
    timestampIso: new Date().toISOString(),
    performanceMs: Number(performance.now().toFixed(3)),
    audioContextSeconds: context ? Number(context.currentTime.toFixed(4)) : null,
  };
}

// Purpose: compute the Web Audio time at which a whole-note position should sound for the active run.
// Warning: this depends on startedAtAudio and currentRun.startedAtPosition being set before use.
// Why this shape: refactored from beat-based math so BPM still means quarter notes while quarter-note position equals .25.
function scheduledAudioTimeForPosition(position) {
  const bpm = activeTempo;
  const startedAtPosition = syncDebug.currentRun?.startedAtPosition ?? pausedAt;
  return startedAtAudio + ((position - startedAtPosition) / QUARTER_NOTE_UNITS) * (60 / bpm);
}

// Purpose: record that a note entered the broad visual hit-zone window.
// Warning: this is not the tight strike/sync proof event; it is intentionally wider.
// Why this shape: broad entries help diagnose visibility while strike events prove click alignment.
function logNoteHit(noteMeta) {
  const event = {
    ...eventBase(),
    eventType: "note-in-hit-zone",
    ...noteMeta,
  };
  syncDebug.noteHitEvents.push(event);
}

// Purpose: record that a note entered the tight strike-sync window.
// Warning: use this for sync proof, not the wider hit-zone animation.
// Why this shape: a smaller window prevents eighth-note passages from looking falsely out of sync.
function logNoteStrike(noteMeta) {
  const event = {
    ...eventBase(),
    eventType: "note-strike-sync",
    ...noteMeta,
  };
  syncDebug.noteStrikeEvents.push(event);
}

// Purpose: refresh the permanent sync debug panel.
// Warning: it mutates DOM every frame, so keep the payload compact.
// Why this shape: the prototype needs visible runtime truth without opening devtools.
function updateDebugPanel(rawPosition = currentPlayhead) {
  const run = syncDebug.currentRun;
  debugRunLabel.textContent = run
    ? `${run.id} | ${run.settings.sourceFile} | ${run.settings.bpm} BPM`
    : "No run yet";
  debugPlayhead.textContent = `${Number(currentPlayhead.toFixed(3))} position`;
  const lastTick = syncDebug.metronomeEvents.at(-1);
  debugLastTick.textContent = lastTick
    ? `Position ${lastTick.position} (${lastTick.bar}:${lastTick.positionInBar})`
    : "-";
  debugHitNotes.textContent = syncDebug.visibleHitNotes.length
    ? syncDebug.visibleHitNotes.map((note) => note.label).join(", ")
    : "-";
  debugEventCounts.textContent = `${syncDebug.metronomeEvents.length} ticks / ${syncDebug.noteHitEvents.length} hits / ${syncDebug.noteStrikeEvents.length} strikes`;

  const recent = [
    ...syncDebug.metronomeEvents.slice(-4).map((event) => ({
      type: "Tick",
      text: `position ${event.position} -> ${event.hitNotes.join(", ") || "no hit"}`,
    })),
    ...syncDebug.noteHitEvents.slice(-4).map((event) => ({
      type: "Hit",
      text: `${event.label} @ position ${event.scheduledPosition}`,
    })),
    ...syncDebug.noteStrikeEvents.slice(-4).map((event) => ({
      type: "Strike",
      text: `${event.label} @ position ${event.scheduledPosition}`,
    })),
  ].slice(-8);

  debugEvents.innerHTML = "";
  for (const event of recent) {
    const item = document.createElement("div");
    item.className = "debug-event";
    item.innerHTML = `<strong>${event.type}</strong> ${event.text}`;
    debugEvents.append(item);
  }
}

// Purpose: find the closest metronome tick for a note strike event.
// Warning: position distance dominates the score; timestamp only breaks ties within the same position.
// Why this shape: refactored to prefer scheduled audio times over frame timestamps for more accurate sync reporting.
function nearestTickForHit(hit) {
  return syncDebug.metronomeEvents.reduce((closest, tick) => {
    const delta = Math.abs(tick.position - hit.scheduledPosition);
    const tickSeconds = tick.scheduledAudioContextSeconds ?? tick.audioContextSeconds;
    const hitSeconds = hit.scheduledAudioContextSeconds ?? hit.audioContextSeconds;
    const timingDeltaMs =
      tickSeconds !== null && hitSeconds !== null
        ? (tickSeconds - hitSeconds) * 1000
        : tick.performanceMs - hit.performanceMs;
    const score = Math.abs(delta) * 100000 + Math.abs(timingDeltaMs);
    return !closest || score < closest.score
      ? { tick, score, positionDelta: delta, timingDeltaMs }
      : closest;
  }, null);
}

// Purpose: pair every strike event with its nearest metronome tick.
// Warning: off-position notes will pair with nearby ticks but are filtered later for pass/fail proof.
// Why this shape: pairing once keeps report generation straightforward.
function syncPairs() {
  return syncDebug.noteStrikeEvents.map((hit) => {
    const nearest = nearestTickForHit(hit);
    return {
      hit,
      tick: nearest?.tick || null,
      timingDeltaMs: nearest ? Number(nearest.timingDeltaMs.toFixed(2)) : null,
      positionDelta: nearest ? Number(nearest.positionDelta.toFixed(4)) : null,
    };
  });
}

// Purpose: identify notes that are supposed to align with quarter-note metronome ticks.
// Warning: eighth-note off-grid notes should not be treated as failed metronome sync.
// Why this shape: refactored from integer beat checks to quarter-grid checks after moving to whole-note units.
function isQuarterAlignedHit(event) {
  const tickPosition = event.scheduledPosition / QUARTER_NOTE_UNITS;
  return Math.abs(tickPosition - Math.round(tickPosition)) < 0.001;
}

// Purpose: build the human-readable sync report shown in-app and returned to Playwright.
// Warning: it reports prototype evidence, not a formal test oracle for every possible song.
// Why this shape: plain Markdown is easy to inspect, save, and compare across runs.
function buildSyncReport() {
  const run = syncDebug.currentRun;
  const settings = run?.settings || runSettings();
  const liveBacking = mixerState;
  const pairs = syncPairs().filter((pair) => pair.tick);
  const positionAlignedPairs = pairs.filter((pair) => isQuarterAlignedHit(pair.hit) && pair.positionDelta === 0);
  const offGridHits = syncDebug.noteHitEvents.filter((event) => !isQuarterAlignedHit(event));
  const tickIntervals = syncDebug.metronomeEvents.slice(1).map((tick, index) => {
    const previous = syncDebug.metronomeEvents[index];
    return tick.performanceMs - previous.performanceMs;
  });
  const averageTickInterval =
    tickIntervals.length > 0
      ? tickIntervals.reduce((sum, value) => sum + value, 0) / tickIntervals.length
      : 0;
  const expectedInterval = 60000 / settings.bpm;
  const maxSyncDelta = positionAlignedPairs.length
    ? Math.max(...positionAlignedPairs.map((pair) => Math.abs(pair.timingDeltaMs)))
    : 0;
  const countHits = syncDebug.noteHitEvents.filter((event) => event.kind === "count-in");
  const summary =
    pairs.length > 0 && positionAlignedPairs.length >= 5
    ? "PASS: metronome ticks and quarter-aligned hit-zone entries are driven from the same playhead clock."
      : "CHECK: not enough matched tick/hit evidence has been captured yet.";

  const lines = [
    "# Lukas+S13 Sync Debug Report",
    "",
    "## Quick Summary",
    summary,
    "",
    "## Run Settings",
    `- Run ID: ${run?.id || "No run"}`,
    `- Started: ${run?.startedAtIso || "Not started"}`,
    `- Source: ${settings.sourceFile}`,
    `- Source title: ${settings.sourceTitle}`,
    `- BPM: ${settings.bpm}`,
    `- Time signature: ${settings.timeSignature}`,
    `- Score timing source: ${settings.scoreTimingSource}`,
    `- Backing track: ${settings.backingTrack.available ? settings.backingTrack.label : "none"}`,
    `- Backing loaded/enabled: ${settings.backingTrack.loaded ? "yes" : "no"} / ${settings.backingTrack.enabled ? "yes" : "no"}`,
    `- Backing pitch preserve / tempo ratio: ${liveBacking.backingPreservesPitch ? "yes" : "no"} / ${liveBacking.backingTempoRatio ?? settings.backingTrack.tempoRatio}`,
    `- Backing media time / expected / drift: ${liveBacking.backingMediaCurrentTime ?? "n/a"} / ${liveBacking.backingExpectedCurrentTime ?? "n/a"} / ${liveBacking.backingDriftSeconds ?? "n/a"}`,
    `- Mixer gains: click ${settings.backingTrack.metronomeGain} / backing ${settings.backingTrack.backingGain}`,
    `- Count-in units: ${settings.countInUnits}`,
    `- Metronome sound: ${settings.metronomeSound}`,
    `- Click source: ${settings.clickSource}`,
    `- Horizon units: ${settings.horizonUnits}`,
    `- Empty runway units: ${settings.emptyRunwayUnits}`,
    `- Hit-zone window units: ${settings.hitZoneWindowUnits}`,
    `- Strike sync window units: ${settings.strikeSyncWindowUnits}`,
    "",
    "## Proof Points",
    `- Metronome ticks captured: ${syncDebug.metronomeEvents.length}`,
    `- Hit-zone entries captured: ${syncDebug.noteHitEvents.length}`,
    `- Strike sync entries captured: ${syncDebug.noteStrikeEvents.length}`,
    `- Count-in hits captured: ${countHits.map((event) => event.label).join(", ") || "none"}`,
    `- Expected tick interval: ${expectedInterval.toFixed(2)} ms`,
    `- Average captured tick interval: ${averageTickInterval.toFixed(2)} ms`,
    `- Matched position-aligned tick/hit pairs: ${positionAlignedPairs.length}`,
    `- Off-quarter-grid note entries captured separately: ${offGridHits.length}`,
    `- Max tick-to-hit timestamp delta among position-aligned pairs: ${maxSyncDelta.toFixed(2)} ms`,
    "",
    "## Quarter-Aligned Tick / Hit Samples",
  ];

  for (const pair of positionAlignedPairs.slice(0, 12)) {
    lines.push(
      `- Position ${pair.tick.position}: tick ${pair.tick.timestampIso} | hit ${pair.hit.label} at ${pair.hit.timestampIso} | delta ${pair.timingDeltaMs} ms`
    );
  }

  lines.push("", "## Off-Quarter-Grid Hit-Zone Entries");
  for (const hit of offGridHits.slice(0, 12)) {
    lines.push(
      `- ${hit.label} scheduledPosition=${hit.scheduledPosition} time=${hit.timestampIso}`
    );
  }

  lines.push("", "## Recent Metronome Ticks");
  for (const tick of syncDebug.metronomeEvents.slice(-12)) {
    lines.push(
      `- Position ${tick.position} (${tick.bar}:${tick.positionInBar}) accent=${tick.accent} hitNotes=${tick.hitNotes.join(", ") || "none"} time=${tick.timestampIso}`
    );
  }

  lines.push("", "## Recent Hit-Zone Entries");
  for (const hit of syncDebug.noteHitEvents.slice(-12)) {
    lines.push(
      `- ${hit.label} kind=${hit.kind} scheduledPosition=${hit.scheduledPosition} rawPosition=${hit.rawPosition} y=${hit.screenYPercent}% time=${hit.timestampIso}`
    );
  }

  lines.push("", "## Recent Strike Sync Entries");
  for (const strike of syncDebug.noteStrikeEvents.slice(-12)) {
    lines.push(
      `- ${strike.label} kind=${strike.kind} scheduledPosition=${strike.scheduledPosition} rawPosition=${strike.rawPosition} y=${strike.screenYPercent}% time=${strike.timestampIso}`
    );
  }

  const report = lines.join("\n");
  syncDebug.latestReport = report;
  window.__latestSyncReport = report;
  return report;
}

window.buildSyncReport = buildSyncReport;

// Purpose: convert an audio Blob into a data URL for Playwright artifact capture.
// Warning: large captures can create large strings, so keep debug recordings short.
// Why this shape: browser-side MediaRecorder data can cross the Playwright boundary as JSON.
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Purpose: start recording app-generated mixer audio into an in-memory MediaRecorder.
// Warning: this captures only audio routed through the app mixer, not arbitrary system audio.
// Why this shape: Playwright can verify click/backing presence without depending on external audio devices.
window.startSyncAudioCapture = async () => {
  ensureAudioContext();
  syncAudioChunks = [];
  if (syncAudioRecorder?.state === "recording") {
    syncAudioRecorder.stop();
  }

  syncAudioRecorder = new MediaRecorder(debugAudioDestination.stream, {
    mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm",
  });
  syncAudioRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) syncAudioChunks.push(event.data);
  });
  syncAudioRecorder.start();

  return {
    ok: true,
    mimeType: syncAudioRecorder.mimeType,
  };
};

// Purpose: stop the in-app audio recorder and return the captured audio as metadata plus a data URL.
// Warning: returns null if recording was not active; callers should tolerate that during failed runs.
// Why this shape: the same helper supports report JSON and later FFmpeg muxing.
window.stopSyncAudioCapture = async () => {
  if (!syncAudioRecorder || syncAudioRecorder.state === "inactive") {
    return null;
  }

  const stopped = new Promise((resolve) => {
    syncAudioRecorder.addEventListener("stop", resolve, { once: true });
  });
  syncAudioRecorder.stop();
  await stopped;

  const blob = new Blob(syncAudioChunks, { type: syncAudioRecorder.mimeType || "audio/webm" });
  const result = {
    mimeType: blob.type,
    size: blob.size,
    dataUrl: await blobToDataUrl(blob),
  };
  window.__lastSyncAudioCapture = result;
  return result;
};

// Purpose: compute how many units remain before a note reaches the hit line.
// Warning: count-in notes intentionally disappear after song start to avoid looping them with the song.
// Why this shape: refactored behavior keeps count-in one-shot while song notes can wrap after songEndPosition.
function distanceToNote(note, playhead) {
  if (note.isCount) {
    return playhead < 0 ? note.position - playhead : Number.POSITIVE_INFINITY;
  }

  let distance = note.position - playhead;
  if (playhead >= 0 && distance < -songEndPosition / 2) distance += songEndPosition;
  if (playhead >= 0 && distance > songEndPosition / 2) distance -= songEndPosition;
  return distance;
}

// Purpose: project position distance into the 2D highway coordinate system.
// Warning: the post-hit region is deliberately visible so notes scroll through the hit zone instead of vanishing at contact.
// Why this shape: refactored from a narrow post-hit cutoff to PAST_HIT_UNITS_VISIBLE so blocks pass behind transparent hit boxes.
function positionForDistance(distance, xNear = 50, xFar = 50) {
  if (!Number.isFinite(distance)) {
    return {
      x: xNear,
      y: -100,
      scale: 0,
      isVisible: false,
      isHit: false,
    };
  }

  const y =
    distance >= 0
      ? HIT_Y - distance * ((HIT_Y - TOP_Y) / HORIZON_UNITS)
      : HIT_Y - (distance / QUARTER_NOTE_UNITS) * 22;
  const progress = Math.max(0, Math.min(1, (y - TOP_Y) / (HIT_Y - TOP_Y)));
  const scale = Math.max(0.42, Math.min(1.12, 0.42 + progress * 0.72));
  const x = xFar + (xNear - xFar) * progress;

  return {
    x,
    y,
    scale,
    isVisible:
      distance >= -PAST_HIT_UNITS_VISIBLE &&
      distance <= HORIZON_UNITS &&
      y >= TOP_Y &&
      y < 112,
    isHit: Math.abs(distance) < HIT_ZONE_WINDOW_UNITS,
    isStrike: Math.abs(distance) < STRIKE_SYNC_WINDOW_UNITS,
  };
}

// Purpose: compute screen position and fixed visual dimensions for a note.
// Warning: do not multiply same-duration notes by perspective scale; that made equal notes look randomly sized.
// Why this shape: refactored from perspective-scaled block dimensions to duration-only dimensions so equal rhythmic values render equally.
function positionForNote(note, playhead) {
  const distance = distanceToNote(note, playhead);
  const position = positionForDistance(
    distance,
    note.isCount ? 50 : stringPositions[note.string],
    note.isCount ? 50 : stringBackPositions[note.string]
  );
  const baseWidth = note.isCount ? 112 : 48;
  const durationHeight = note.isCount
    ? 38
    : Math.max(22, WHOLE_NOTE_HEIGHT * durationUnits(note));

  return {
    ...position,
    size: baseWidth,
    durationHeight,
  };
}

// Purpose: list visible bar lines for the current playhead.
// Warning: bar lines use the same projection as notes, so changing projection math affects both.
// Why this shape: measure boundaries arrive at the hit zone in the same position space as notes.
function visibleMeasureLines(playhead) {
  const lines = [];

  for (let position = 0; position < songEndPosition; position += BAR_UNITS) {
    let distance = position - playhead;
    if (playhead >= 0 && distance < -songEndPosition / 2) distance += songEndPosition;
    if (playhead >= 0 && distance > songEndPosition / 2) distance -= songEndPosition;
    const pos = positionForDistance(distance, 50, 50);
    if (!pos.isVisible) continue;
    const label = position === 0 ? "Bar 1" : `Bar ${Math.floor(position / BAR_UNITS) + 1}`;
    lines.push({
      position,
      label,
      y: pos.y,
      scale: pos.scale,
    });
  }

  return lines;
}

// Purpose: return direct XML children with a matching tag name.
// Warning: GPIF has repeated tag names at different depths, so direct-child lookup avoids accidental deep matches.
// Why this shape: browser DOMParser has no ElementTree-style path helper, so this keeps GPIF parsing explicit.
function directChildren(node, tagName) {
  return [...node.children].filter((child) => child.tagName === tagName);
}

// Purpose: return the first direct XML child with a matching tag name.
// Warning: returns null when the expected GPIF node is absent; callers should provide fallbacks.
// Why this shape: most GPIF fields used here are optional enough to parse defensively.
function directChild(node, tagName) {
  return directChildren(node, tagName)[0] || null;
}

// Purpose: read trimmed text from a direct child node.
// Warning: this intentionally does not search descendants; pass the correct parent node.
// Why this shape: it mirrors the Python extractor's child_text() helper for browser parsing.
function childText(node, tagName, fallback = "") {
  const child = directChild(node, tagName);
  return child?.textContent?.trim() || fallback;
}

// Purpose: find a GPIF <Property> by name under a node.
// Warning: returns null for absent properties, which is common for rests or unsupported note shapes.
// Why this shape: GPIF stores string/fret/MIDI data in named property bags rather than direct fields.
function propertyNode(node, name) {
  const properties = directChild(node, "Properties");
  if (!properties) return null;
  return directChildren(properties, "Property").find((property) => property.getAttribute("name") === name) || null;
}

// Purpose: read an integer value from a named GPIF property child.
// Warning: returns null instead of throwing so unsupported notes can be skipped cleanly.
// Why this shape: it matches the Python extractor's defensive parsing path.
function intProperty(node, name, childName) {
  const property = propertyNode(node, name);
  const value = property ? childText(property, childName) : "";
  return value ? Number.parseInt(value, 10) : null;
}

// Purpose: convert a GPIF rhythm node into units.
// Warning: unsupported rhythm names throw, because guessing durations would desync the highway.
// Why this shape: all runtime timing is position-based, including dots and tuplets.
function rhythmDurationUnits(rhythm) {
  const value = childText(rhythm, "NoteValue", "Quarter");
  let units = NOTE_VALUE_TO_UNITS[value];
  if (!units) throw new Error(`Unsupported GPIF rhythm value: ${value}`);

  if (directChild(rhythm, "AugmentationDot")) {
    units *= 1.5;
  }

  const tuplet = directChild(rhythm, "PrimaryTuplet");
  if (tuplet) {
    const numerator = Number.parseFloat(childText(tuplet, "Numerator", "1"));
    const denominator = Number.parseFloat(childText(tuplet, "Denominator", "1"));
    if (numerator) units *= denominator / numerator;
  }

  return units;
}

// Purpose: read a ZIP filename or comment from raw bytes.
// Warning: GP8 packages use standard ZIP structures here; this helper does not handle encrypted names.
// Why this shape: a tiny TextDecoder wrapper keeps the package parser dependency-free.
function readZipText(view, offset, length) {
  return new TextDecoder().decode(new Uint8Array(view.buffer, offset, length));
}

// Purpose: locate the ZIP end-of-central-directory record in a GP package.
// Warning: ZIP64 and malformed archives intentionally throw because silent guesses would load the wrong score.
// Why this shape: GP8 files are ordinary ZIP packages, so finding the central directory is enough to locate score.gpif.
function findZipEndOfCentralDirectory(view) {
  const signature = 0x06054b50;
  const minimumSize = 22;
  const maxCommentLength = 0xffff;
  const start = Math.max(0, view.byteLength - minimumSize - maxCommentLength);
  for (let offset = view.byteLength - minimumSize; offset >= start; offset -= 1) {
    if (view.getUint32(offset, true) === signature) return offset;
  }
  throw new Error("Could not find ZIP central directory in GP package.");
}

// Purpose: inflate a deflated ZIP entry with the browser's native stream decompressor.
// Warning: requires DecompressionStream support; use the Python extractor when a browser lacks it.
// Why this shape: it keeps packaged .gp input working in the static app without adding JSZip or a build step.
async function inflateZipEntry(bytes) {
  if (!("DecompressionStream" in window)) {
    throw new Error("This browser cannot inflate GP ZIP entries; use tools/extract_gp_notes.py instead.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Purpose: extract one named file from a GP8 ZIP package.
// Warning: only stored and deflated entries are supported, which covers normal GP8 packages.
// Why this shape: the app needs score.gpif plus optional backing assets, so a small ZIP reader is simpler than adding a package dependency.
async function extractZipEntry(arrayBuffer, wantedName) {
  const view = new DataView(arrayBuffer);
  const eocd = findZipEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralDirectoryOffset = view.getUint32(eocd + 16, true);
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory entry.");
    }
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const entryName = readZipText(view, offset + 46, nameLength).replace(/\\/g, "/");

    if (entryName === wantedName) {
      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
        throw new Error("Invalid ZIP local header for score.gpif.");
      }
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressedBytes = new Uint8Array(arrayBuffer, dataOffset, compressedSize);
      if (compressionMethod === 0) return compressedBytes;
      if (compressionMethod === 8) return inflateZipEntry(compressedBytes);
      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`${wantedName} was not found in the GP package.`);
}

// Purpose: read backing-track metadata from GPIF XML.
// Warning: this only describes the asset; callers still need to fetch or extract the bytes.
// Why this shape: JSON, GPIF, and packaged GP inputs can share the same backing metadata contract.
function backingTrackFromGpif(doc, tempo) {
  const backing = doc.querySelector("BackingTrack");
  const assetId = backing ? childText(backing, "AssetId") : "";
  const asset = assetId
    ? [...doc.querySelectorAll("Assets > Asset")].find((candidate) => candidate.getAttribute("id") === assetId)
    : null;
  const embeddedPath = asset ? childText(asset, "EmbeddedFilePath") : "";
  const originalPath = asset ? childText(asset, "OriginalFilePath") : "";
  const label =
    (backing ? childText(backing, "Name") : "") ||
    originalPath.split(/[\\/]/).at(-1) ||
    embeddedPath.split(/[\\/]/).at(-1) ||
    "Backing track";

  return {
    available: Boolean(embeddedPath),
    url: null,
    embeddedPath: embeddedPath || null,
    label,
    nativeTempo: tempo,
    startOffsetUnits: 0,
    startOffsetSeconds: 0,
  };
}

// Purpose: parse a selected packaged Guitar Pro file into the app payload.
// Warning: score.gpif still drives timing; embedded MP3 bytes are optional playback audio, not note data.
// Why this shape: refactored from a status-only .gp branch to real in-browser GP package plus backing input.
async function parseGpPackage(file) {
  const packageBytes = await file.arrayBuffer();
  const scoreBytes = await extractZipEntry(packageBytes, "Content/score.gpif");
  const gpifText = new TextDecoder().decode(scoreBytes);
  const payload = parseGpifText(gpifText, file.name);
  const embeddedPath = payload.source.backingTrack?.embeddedPath;

  if (embeddedPath) {
    const backingBytes = await extractZipEntry(packageBytes, embeddedPath);
    const backingBlob = new Blob([backingBytes], { type: audioMimeTypeForPath(embeddedPath) });
    if (backingTrackObjectUrl) URL.revokeObjectURL(backingTrackObjectUrl);
    backingTrackObjectUrl = URL.createObjectURL(backingBlob);
    payload.source.backingTrack = {
      ...payload.source.backingTrack,
      available: true,
      url: backingTrackObjectUrl,
    };
    payload.runtimeAssets = {
      backingBlob,
    };
  }

  return payload;
}

// Purpose: parse raw GPIF XML selected in the browser into the app's renderable JSON payload.
// Warning: this expects GPIF XML; packaged .gp files should go through parseGpPackage().
// Why this shape: it reuses the extractor's data model so JSON and GPIF inputs follow the same render path.
function parseGpifText(xmlText, fileLabel) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error(parseError.textContent || "Invalid GPIF XML");

  const score = doc.querySelector("Score");
  const tempoValue = doc.querySelector("MasterTrack > Automations > Automation > Value")?.textContent?.trim();
  const tempo = tempoValue ? Number.parseInt(Number.parseFloat(tempoValue.split(/\s+/)[0]), 10) : 120;

  const rhythmById = new Map(
    [...doc.querySelectorAll("Rhythms > Rhythm")].map((rhythm) => [
      rhythm.getAttribute("id"),
      rhythmDurationUnits(rhythm),
    ])
  );

  const noteById = new Map();
  for (const note of doc.querySelectorAll("Notes > Note")) {
    const gpString = intProperty(note, "String", "String");
    const fret = intProperty(note, "Fret", "Fret");
    const midi = intProperty(note, "Midi", "Number");
    if (gpString === null || fret === null) continue;
    noteById.set(note.getAttribute("id"), {
      gpString,
      string: 6 - gpString,
      fret,
      midi,
    });
  }

  const positionById = new Map();
  for (const position of doc.querySelectorAll("Beats > Beat")) {
    const rhythmRef = directChild(position, "Rhythm")?.getAttribute("ref") || "";
    const pick = childText(propertyNode(position, "PickStroke") || position, "Direction", "");
    positionById.set(position.getAttribute("id"), {
      durationUnits: rhythmById.get(rhythmRef) || QUARTER_NOTE_UNITS,
      noteIds: childText(position, "Notes").split(/\s+/).filter(Boolean),
      pickStroke: pick.toLowerCase() || null,
      section: childText(position, "FreeText"),
    });
  }

  const voiceById = new Map(
    [...doc.querySelectorAll("Voices > Voice")].map((voice) => [
      voice.getAttribute("id"),
      childText(voice, "Beats").split(/\s+/).filter(Boolean),
    ])
  );

  const bars = [...doc.querySelectorAll("Bars > Bar")].map((bar) => ({
    id: bar.getAttribute("id"),
    voiceIds: childText(bar, "Voices").split(/\s+/).filter((value) => value && value !== "-1"),
  }));

  const firstPlayableBar = Math.max(0, bars.findIndex((bar) => bar.voiceIds.length));
  const notes = [];
  const measures = [];
  const sections = [];

  bars.slice(firstPlayableBar).forEach((bar, relativeIndex) => {
    let positionCursor = 0;
    let noteCount = 0;
    const durations = new Set();
    const sourceMeasure = firstPlayableBar + relativeIndex + 1;
    const measure = relativeIndex + 1;

    for (const voiceId of bar.voiceIds) {
      for (const positionId of voiceById.get(voiceId) || []) {
        const position = positionById.get(positionId);
        if (!position) continue;

        if (position.section) {
          sections.push({ measure, sourceMeasure, label: position.section });
        }

        for (const noteId of position.noteIds) {
          const note = noteById.get(noteId);
          if (!note) continue;
          notes.push({
            string: note.string,
            fret: note.fret,
            position: Number(((measure - 1) * BAR_UNITS + positionCursor).toFixed(6)),
            durationUnits: position.durationUnits,
            sourceMeasure,
            measure,
            positionInMeasure: Number(positionCursor.toFixed(6)),
            gpString: note.gpString,
            midi: note.midi,
            pickStroke: position.pickStroke,
          });
          noteCount += 1;
          durations.add(position.durationUnits);
        }

        positionCursor += position.durationUnits;
      }
    }

    measures.push({
      measure,
      sourceMeasure,
      noteCount,
      durationUnits: Number(positionCursor.toFixed(6)),
      durations: [...durations].sort((a, b) => a - b),
    });
  });

  const backingTrack = backingTrackFromGpif(doc, tempo);
  backingTrack.startOffsetUnits = Number((firstPlayableBar * BAR_UNITS).toFixed(6));
  backingTrack.startOffsetSeconds = Number(backingSecondsFromUnits(backingTrack.startOffsetUnits, tempo).toFixed(6));

  return {
    source: {
      file: fileLabel,
      title: score ? childText(score, "Title", fileLabel) : fileLabel,
      subtitle: score ? childText(score, "Artist") : "",
      tempo,
      timeSignature: "4/4",
      backingTrack,
      scoreTimingSource: "GPIF notes",
    },
    summary: {
      measures: measures.length,
      notes: notes.length,
      firstPlayableSourceMeasure: firstPlayableBar + 1,
      durationValues: [...new Set(notes.map((note) => note.durationUnits))].sort((a, b) => a - b),
      allEighthNotes: notes.every((note) => Math.abs(note.durationUnits - EIGHTH_NOTE_UNITS) < 0.001),
      allMeasuresEightNotes: measures.every(
        (measure) =>
          measure.noteCount === 8 &&
          Math.abs(measure.durationUnits - BAR_UNITS) < 0.001 &&
          measure.durations.length === 1 &&
          Math.abs(measure.durations[0] - EIGHTH_NOTE_UNITS) < 0.001
      ),
    },
    sections,
    measures,
    notes,
  };
}

// Purpose: update the source-picker button state without adding a second source label.
// Warning: keep this to short control states only; filenames belong in reports, not the crowded header.
// Why this shape: refactored from a separate file metadata block so the header has one source control.
function setSourceButtonText(message) {
  if (sourceButtonText) sourceButtonText.textContent = message;
}

// Purpose: show source-library and storage messages in one compact status line.
// Warning: keep messages short because the control lives in the crowded header.
// Why this shape: upload, Azure, and parser failures need visible feedback without adding a modal.
function setStorageStatus(message = "", { error = false } = {}) {
  if (!storageStatus) return;
  storageStatus.textContent = message;
  storageStatus.classList.toggle("is-error", error);
}

// Purpose: produce a stable id for local manifest and Azure source entries.
// Warning: names can repeat across storage backends, so include the source kind/path.
// Why this shape: the select can safely map back to a source object after refreshes.
function sourceEntryKey(entry) {
  return `${entry.storage || "local"}:${entry.blobName || entry.path || entry.name}`;
}

// Purpose: normalize file names into processed asset paths.
// Warning: this is for storage keys only; visible source names keep their original spelling.
// Why this shape: processed notes and backing files need deterministic names in input/processed.
function sourceSlug(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "source";
}

// Purpose: infer a browser media MIME type from an embedded backing asset path.
// Warning: this labels common audio formats; actual playback support still depends on the browser.
// Why this shape: Guitar Pro packages can embed OGG as well as MP3, and mislabeled blobs can fail playback.
function audioMimeTypeForPath(path = "") {
  const lower = path.toLowerCase();
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "audio/ogg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  return "audio/mpeg";
}

// Purpose: derive a source format from a file name.
// Warning: only GP8 packages can be parsed into timed notes in-browser today.
// Why this shape: GP5 files should be stored and listed honestly instead of pretending they are playable.
function sourceFormat(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".gp5")) return "gp5";
  if (lower.endsWith(".gp")) return "gp";
  if (lower.endsWith(".gpif") || lower.endsWith(".xml")) return "gpif";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".pdf")) return "pdf";
  return "unknown";
}

// Purpose: convert manifest entries into the app's source-library record shape.
// Warning: manifest paths are app-relative URLs, not filesystem paths.
// Why this shape: local and Azure records can share the same loading pipeline.
function normalizeManifestSource(entry) {
  const name = entry.name || entry.file || entry.path?.split("/").at(-1) || "Untitled source";
  return {
    name,
    format: entry.format || sourceFormat(name),
    path: entry.path,
    processed: entry.processed || null,
    storage: "manifest",
  };
}

// Purpose: render the saved source select from the current library entries.
// Warning: disabled options still appear so unsupported files are visible as stored input.
// Why this shape: the user should be able to see existing input files even when processing is not supported yet.
function renderSourceLibrary() {
  if (!sourceLibrary) return;
  sourceLibrary.innerHTML = "";
  if (!sourceLibraryEntries.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved sources";
    sourceLibrary.append(option);
    return;
  }

  for (const entry of sourceLibraryEntries) {
    const option = document.createElement("option");
    option.value = entry.key;
    const suffix = entry.storage === "azure" ? "Azure" : entry.storage === "session" ? "Session" : "Input";
    option.textContent = `${entry.name} (${suffix})`;
    sourceLibrary.append(option);
  }
  if (activeSourceKey && sourceLibraryEntries.some((entry) => entry.key === activeSourceKey)) {
    sourceLibrary.value = activeSourceKey;
  }
}

// Purpose: read the optional Azure Blob Storage config for local and deployed static pages.
// Warning: a browser app must use a SAS URL or an API-issued SAS; never commit an account key.
// Why this shape: the same code path can list/upload in local dev and GitHub Pages when CORS/SAS are configured.
async function loadAzureStorageConfig() {
  const fallback = {
    enabled: false,
    containerSasUrl: "",
    inputPrefix: DEFAULT_INPUT_PREFIX,
    processedPrefix: DEFAULT_PROCESSED_PREFIX,
  };

  try {
    const response = await fetch(AZURE_CONFIG_URL, { cache: "no-store" });
    if (response.ok) fallback.enabled = false;
    if (response.ok) Object.assign(fallback, await response.json());
  } catch {
    // Missing config is fine; the local manifest still works.
  }

  const storedSas = localStorage.getItem(AZURE_SAS_STORAGE_KEY);
  if (storedSas) {
    fallback.enabled = true;
    fallback.containerSasUrl = storedSas;
  }

  fallback.inputPrefix ||= DEFAULT_INPUT_PREFIX;
  fallback.processedPrefix ||= DEFAULT_PROCESSED_PREFIX;
  azureStorageConfig = fallback;
  return fallback;
}

// Purpose: split an Azure container SAS URL into a base URL and query string.
// Warning: callers should treat parse failures as disabled Azure storage.
// Why this shape: blob URLs and list-container URLs use the same SAS query with different paths/params.
function azureContainerParts() {
  if (!azureStorageConfig?.enabled || !azureStorageConfig.containerSasUrl) return null;
  try {
    const url = new URL(azureStorageConfig.containerSasUrl);
    const sas = url.search.startsWith("?") ? url.search.slice(1) : url.search;
    url.search = "";
    return { baseUrl: url.href.replace(/\/$/, ""), sas };
  } catch {
    return null;
  }
}

// Purpose: append SAS and operation params to an Azure Storage URL.
// Warning: SAS params must remain exactly as issued by Azure.
// Why this shape: direct REST calls avoid a bundler or client SDK in this static app.
function azureUrlWithParams(baseUrl, params = {}) {
  const parts = azureContainerParts();
  if (!parts) return null;
  const query = new URLSearchParams(parts.sas);
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  return `${baseUrl}?${query.toString()}`;
}

// Purpose: build a direct blob URL for reading or writing a blob path.
// Warning: each path segment must be encoded without encoding slashes.
// Why this shape: Azure "folders" are blob-name prefixes such as input/processed/.
function azureBlobUrl(blobName) {
  const parts = azureContainerParts();
  if (!parts) return null;
  const encodedName = blobName.split("/").map(encodeURIComponent).join("/");
  return azureUrlWithParams(`${parts.baseUrl}/${encodedName}`);
}

// Purpose: list source and processed blobs from Azure input prefixes.
// Warning: requires a SAS with list/read permissions and matching CORS rules for the app origin.
// Why this shape: users can pick existing uploaded files from the same static UI.
async function listAzureSourceEntries() {
  const parts = azureContainerParts();
  if (!parts) return [];
  const inputPrefix = azureStorageConfig.inputPrefix || DEFAULT_INPUT_PREFIX;
  const processedPrefix = azureStorageConfig.processedPrefix || DEFAULT_PROCESSED_PREFIX;
  const listUrl = azureUrlWithParams(parts.baseUrl, {
    restype: "container",
    comp: "list",
    prefix: inputPrefix,
  });
  const response = await fetch(listUrl);
  if (!response.ok) throw new Error(`Azure list failed: HTTP ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), "application/xml");
  const blobNames = [...doc.querySelectorAll("Blob > Name")].map((node) => node.textContent || "");
  const processedNames = new Set(blobNames.filter((name) => name.startsWith(processedPrefix)));
  return blobNames
    .filter((blobName) => blobName.startsWith(inputPrefix))
    .filter((blobName) => !blobName.startsWith(processedPrefix))
    .filter((blobName) => /\.(gp|gp5|gpif|xml|json)$/i.test(blobName))
    .map((blobName) => {
      const name = blobName.split("/").at(-1);
      const slug = sourceSlug(name);
      const notesName = `${processedPrefix}${slug}-notes.json`;
      const backingName = `${processedPrefix}${slug}-backing.mp3`;
      return {
        name,
        format: sourceFormat(name),
        path: azureBlobUrl(blobName),
        blobName,
        processed: processedNames.has(notesName)
          ? {
              notes: azureBlobUrl(notesName),
              backing: processedNames.has(backingName) ? azureBlobUrl(backingName) : null,
            }
          : null,
        storage: "azure",
      };
    });
}

// Purpose: load local manifest sources and optional Azure sources into the select.
// Warning: Azure failures should not break the local test library.
// Why this shape: local and deployed builds both get a deterministic input folder while Azure is available when configured.
async function loadSourceLibrary() {
  setStorageStatus("Loading sources...");
  const entries = [];

  try {
    const response = await fetch(INPUT_MANIFEST_URL, { cache: "no-store" });
    if (response.ok) {
      const manifest = await response.json();
      entries.push(...(manifest.sources || []).map(normalizeManifestSource));
    }
  } catch (error) {
    console.warn("Input manifest could not be loaded.", error);
  }

  const config = await loadAzureStorageConfig();
  if (config.enabled && config.containerSasUrl) {
    try {
      entries.push(...await listAzureSourceEntries());
    } catch (error) {
      console.warn("Azure input list could not be loaded.", error);
      setStorageStatus("Azure unavailable; using local input", { error: true });
    }
  }

  const seen = new Set();
  sourceLibraryEntries = entries.map((entry) => ({ ...entry, key: sourceEntryKey(entry) })).filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });

  renderSourceLibrary();
  if (sourceLibraryEntries.length && !activeSourceKey) {
    activeSourceKey = sourceLibraryEntries[0].key;
    sourceLibrary.value = activeSourceKey;
  }

  if (!storageStatus?.classList.contains("is-error")) {
    const storageLabel = config.enabled && config.containerSasUrl ? "Azure + input" : "Input folder";
    setStorageStatus(`${storageLabel}: ${sourceLibraryEntries.length} source${sourceLibraryEntries.length === 1 ? "" : "s"}`);
  }
}

// Purpose: upload a blob to Azure Blob Storage through a SAS URL.
// Warning: requires create/write permissions and CORS allowing PUT from the app origin.
// Why this shape: static GitHub Pages can store uploads without a server when Azure issues a scoped SAS.
async function uploadAzureBlob(blobName, body, contentType = "application/octet-stream") {
  const url = azureBlobUrl(blobName);
  if (!url) throw new Error("Azure Blob Storage is not configured.");
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "x-ms-version": "2023-11-03",
      "Content-Type": contentType,
    },
    body,
  });
  if (!response.ok) throw new Error(`Azure upload failed: HTTP ${response.status}`);
}

// Purpose: fetch an app or Azure URL as a File-like object for the existing GP parser.
// Warning: File construction is used only to preserve the selected source name in reports.
// Why this shape: processed and raw library entries should exercise the same parser as manual uploads.
async function fetchSourceFile(entry) {
  const response = await fetch(entry.path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Source fetch failed: HTTP ${response.status}`);
  const blob = await response.blob();
  return new File([blob], entry.name, { type: blob.type || "application/octet-stream" });
}

// Purpose: apply a processed notes JSON payload and point its backing URL at the processed backing asset.
// Warning: do not mutate cached payload objects from fetch callers.
// Why this shape: prepared files under input/processed should be the fastest path for existing sources.
async function loadProcessedEntry(entry) {
  const response = await fetch(entry.processed.notes, { cache: "no-store" });
  if (!response.ok) throw new Error(`Processed notes fetch failed: HTTP ${response.status}`);
  const payload = await response.json();
  const nextPayload = {
    ...payload,
    source: {
      ...payload.source,
      file: entry.name,
      backingTrack: {
        ...payload.source?.backingTrack,
        url: entry.processed.backing || payload.source?.backingTrack?.url || null,
        available: Boolean(entry.processed.backing || payload.source?.backingTrack?.available),
      },
    },
  };
  applySongData(nextPayload);
}

// Purpose: prepare a newly parsed GP8 package into JSON/backing blobs for input/processed storage.
// Warning: GP5 is not parsed here; it needs a separate GP5 parser/converter before notes can render.
// Why this shape: upload and on-demand library processing share the same output naming.
function processedAssetNamesForSource(name) {
  const slug = sourceSlug(name);
  const processedPrefix = azureStorageConfig?.processedPrefix || DEFAULT_PROCESSED_PREFIX;
  return {
    notes: `${processedPrefix}${slug}-notes.json`,
    backing: `${processedPrefix}${slug}-backing.mp3`,
  };
}

// Purpose: store prepared GP8 notes/backing in Azure input/processed when Azure is configured.
// Warning: local static files cannot be written by the browser; local processing uses object URLs for the current session.
// Why this shape: deployed and local browser runs use the same Azure container when a SAS URL is present.
async function storeProcessedAssets(fileName, payload) {
  if (!azureStorageConfig?.enabled || !azureStorageConfig.containerSasUrl) return null;
  const names = processedAssetNamesForSource(fileName);
  const storagePayload = JSON.stringify(stripRuntimeProcessingAssets(payload), null, 2);
  await uploadAzureBlob(names.notes, new Blob([storagePayload], { type: "application/json" }), "application/json");
  if (payload.runtimeAssets?.backingBlob) {
    await uploadAzureBlob(names.backing, payload.runtimeAssets.backingBlob, payload.runtimeAssets.backingBlob.type || "audio/mpeg");
  }
  return {
    notes: azureBlobUrl(names.notes),
    backing: payload.runtimeAssets?.backingBlob ? azureBlobUrl(names.backing) : null,
  };
}

// Purpose: remove object URL/runtime-only blobs before persisting processed JSON.
// Warning: object URLs are browser-session local and must never be written into durable processed JSON.
// Why this shape: processed JSON should be portable between local and deployed app surfaces.
function stripRuntimeProcessingAssets(payload) {
  const clean = JSON.parse(JSON.stringify(payload));
  const sourceName = clean.source?.file || "source";
  const backingPath = clean.source?.backingTrack?.embeddedPath || "";
  delete clean.runtimeAssets;
  if (clean.source?.backingTrack?.url?.startsWith("blob:")) {
    const extension = backingPath.split(".").pop() || "mp3";
    clean.source.backingTrack.url = `${sourceSlug(sourceName)}-backing.${extension}`;
  }
  return clean;
}

// Purpose: load one saved input source into the highway.
// Warning: GP5 and PDF are stored/listed but not converted into timed notes by this browser parser.
// Why this shape: selecting a source should either use prepared content or truthfully explain the missing processor.
async function loadSourceEntry(entry) {
  if (!entry) return;
  activeSourceKey = entry.key;
  setSourceButtonText("Loading...");
  setStorageStatus(entry.name);

  try {
    if (entry.format === "gp5") {
      setSourceButtonText("Select source");
      setStorageStatus("GP5 stored; export GP8 .gp or GPIF to render notes", { error: true });
      return;
    }
    if (entry.format === "pdf") {
      setSourceButtonText("Select source");
      setStorageStatus("PDF stored; timed-note extraction is not available", { error: true });
      return;
    }
    if (entry.processed?.notes) {
      await loadProcessedEntry(entry);
      setStorageStatus(`Loaded processed: ${entry.name}`);
      return;
    }

    const file = await fetchSourceFile(entry);
    if (entry.format === "json") {
      applySongData(JSON.parse(await file.text()));
    } else if (entry.format === "gpif") {
      applySongData(parseGpifText(await file.text(), entry.name));
    } else if (entry.format === "gp") {
      const payload = await parseGpPackage(file);
      const stored = await storeProcessedAssets(entry.name, payload);
      if (stored) {
        payload.source.backingTrack.url = stored.backing || payload.source.backingTrack.url;
        payload.source.backingTrack.available = Boolean(stored.backing || payload.source.backingTrack.available);
      }
      applySongData(payload);
      setStorageStatus(stored ? `Processed to Azure: ${entry.name}` : `Processed session: ${entry.name}`);
    }
  } catch (error) {
    console.warn("Source could not be loaded.", error);
    setSourceButtonText("Select source");
    setStorageStatus(error.message || "Source could not be loaded", { error: true });
  }
}

// Purpose: add a newly uploaded/session source to the picker without duplicating existing records.
// Warning: caller owns object URL lifetime for session-only uploads.
// Why this shape: manual uploads should immediately become selectable like manifest/Azure sources.
function addOrReplaceSourceEntry(entry) {
  const nextEntry = { ...entry, key: sourceEntryKey(entry) };
  sourceLibraryEntries = [
    nextEntry,
    ...sourceLibraryEntries.filter((candidate) => candidate.key !== nextEntry.key),
  ];
  activeSourceKey = nextEntry.key;
  renderSourceLibrary();
}

// Purpose: store the original uploaded source file in Azure input/ when configured.
// Warning: without Azure config, browser uploads are session-only because static pages cannot write local repo files.
// Why this shape: local and deployed app surfaces share the same blob-backed input folder contract.
async function storeUploadedSourceFile(file) {
  if (!azureStorageConfig) await loadAzureStorageConfig();
  if (!azureStorageConfig?.enabled || !azureStorageConfig.containerSasUrl) return null;
  const inputPrefix = azureStorageConfig.inputPrefix || DEFAULT_INPUT_PREFIX;
  const blobName = `${inputPrefix}${file.name}`;
  await uploadAzureBlob(blobName, file, file.type || "application/octet-stream");
  return {
    blobName,
    path: azureBlobUrl(blobName),
    storage: "azure",
  };
}

// Purpose: parse and optionally store a user-selected source file.
// Warning: GP5/PDF uploads can be stored but are not converted into timed notes by this static parser.
// Why this shape: the selected file's actual bytes drive the highway instead of falling back to the default JSON.
async function handleSelectedSourceFile(selected) {
  const format = sourceFormat(selected.name);
  setSourceButtonText("Loading...");
  setStorageStatus(`Preparing ${selected.name}`);

  try {
    const storedSource = await storeUploadedSourceFile(selected);
    if (format === "gp5") {
      setSourceButtonText("Select source");
      setStorageStatus(
        storedSource ? "GP5 stored in Azure; GP5 note extraction is not available" : "GP5 selected; GP5 note extraction is not available",
        { error: true }
      );
      return;
    }
    if (format === "pdf") {
      setSourceButtonText("Select source");
      setStorageStatus("PDF input needs a timed-note extraction step", { error: true });
      return;
    }

    let payload = null;
    let processed = null;
    if (format === "json") {
      payload = JSON.parse(await selected.text());
    } else if (format === "gpif") {
      payload = parseGpifText(await selected.text(), selected.name);
    } else if (format === "gp") {
      payload = await parseGpPackage(selected);
      processed = await storeProcessedAssets(selected.name, payload);
      if (processed) {
        payload.source.backingTrack.url = processed.backing || payload.source.backingTrack.url;
        payload.source.backingTrack.available = Boolean(processed.backing || payload.source.backingTrack.available);
      }
    } else {
      throw new Error("Unsupported source format.");
    }

    applySongData(payload);
    const sessionUrl = storedSource?.path || URL.createObjectURL(selected);
    addOrReplaceSourceEntry({
      name: selected.name,
      format,
      path: sessionUrl,
      processed,
      storage: storedSource?.storage || "session",
      blobName: storedSource?.blobName || null,
    });
    setStorageStatus(storedSource ? `Uploaded: ${selected.name}` : `Loaded session: ${selected.name}`);
  } catch (error) {
    console.warn("Selected file could not be parsed into note data.", error);
    setSourceButtonText("Select source");
    setStorageStatus(error.message || "Selected source could not be loaded", { error: true });
  }
}

// Purpose: keep the tempo range and editable BPM input in sync.
// Warning: this clamps committed values to the supported range and preserves playback continuity when requested.
// Why this shape: one setter prevents the slider and typed BPM field from drifting apart.
function setTempoValue(nextTempo, { reanchor = false } = {}) {
  const parsed = Number.parseInt(nextTempo, 10);
  const clamped = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Number.isFinite(parsed) ? parsed : activeTempo));
  tempo.value = String(clamped);
  tempoValue.value = String(clamped);
  if (reanchor) reanchorPlaybackClockForTempoChange(clamped);
  else activeTempo = clamped;
  updateBackingPlaybackRate();
  updateDebugPanel();
  return clamped;
}

// Purpose: apply extracted note payloads to the live song state.
// Warning: payload.notes must already be timed in units; this function does not infer timing from PDF/audio.
// Why this shape: refactored from legacy beat-field conversion to a strict unit payload so bad timing data fails visibly instead of drifting.
function applySongData(payload) {
  if (!payload?.notes?.length) return;
  sourceMetadata = {
    ...sourceMetadata,
    ...payload.source,
    backingTrack: {
      available: false,
      url: null,
      embeddedPath: null,
      label: "No backing track",
      nativeTempo: payload.source?.tempo || sourceMetadata.tempo || 120,
      startOffsetUnits: 0,
      startOffsetSeconds: 0,
      ...payload.source?.backingTrack,
    },
  };
  songNotes = payload.notes.map((note) => {
    return {
      string: note.string,
      fret: note.fret,
      position: note.position,
      durationUnits: note.durationUnits,
      sourceMeasure: note.sourceMeasure,
      measure: note.measure,
      positionInMeasure: note.positionInMeasure,
      pickStroke: note.pickStroke,
      gpString: note.gpString,
      midi: note.midi,
    };
  });
  timelineNotes = [...countInNotes, ...songNotes];
  songEndPosition = Math.max(
    BAR_UNITS,
    Math.ceil(Math.max(...songNotes.map((note) => note.position + durationUnits(note))) / BAR_UNITS) * BAR_UNITS
  );
  window.__sourceSummary = {
    file: sourceMetadata.file,
    title: sourceMetadata.title,
    tempo: sourceMetadata.tempo,
    notes: songNotes.length,
    songEndPosition,
    backingAvailable: Boolean(sourceMetadata.backingTrack?.available),
  };
  setSourceButtonText("Loaded");
  if (sourceMetadata.tempo) {
    setTempoValue(sourceMetadata.tempo);
  }
  loadBackingTrack(sourceMetadata.backingTrack);
  render(pausedAt);
  updateDebugPanel();
}

// Purpose: load the default extracted Guitar Pro note JSON at startup.
// Warning: failure falls back to demo notes so the app still renders, but reports should show the loaded source.
// Why this shape: static JSON keeps the prototype runnable from a simple local web server.
async function loadDefaultGpData() {
  try {
    const response = await fetch(DEFAULT_GP_NOTES_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.source?.backingTrack?.available) {
      payload.source.backingTrack.url = DEFAULT_GP_BACKING_URL;
    }
    applySongData(payload);
  } catch (error) {
    setSourceButtonText("Select source");
    updateMixerState();
    console.warn("Using fallback note data because GP note JSON was not loaded.", error);
  }
}

// Purpose: find the closest timeline note for the status row.
// Warning: this is display-only and should not be used for sync decisions.
// Why this shape: nearest-note text is cheap to compute from the current playhead each frame.
function activeNote(playhead) {
  return timelineNotes.reduce((closest, note) => {
    const delta = Math.abs(distanceToNote(note, playhead));
    return !closest || delta < closest.delta ? { note, delta } : closest;
  }, null).note;
}

// Purpose: draw one frame of measure lines, notes, hit states, and debug UI.
// Warning: this clears and rebuilds the notes layer each frame, which is acceptable for this prototype but not a final renderer.
// Why this shape: a single render pass keeps visual state, hit logging, and debug display tied to the same playhead.
function render(playhead = pausedAt, rawPosition = playhead) {
  notesLayer.innerHTML = "";
  hitTargets.forEach((target) => target.classList.remove("is-active"));
  const active = activeNote(playhead);
  const currentHitKeys = new Set();
  const currentStrikeKeys = new Set();
  const visibleHitNotes = [];

  if (nowPlaying) {
    nowPlaying.textContent =
      playhead < START_POSITION - HORIZON_UNITS
        ? "Ready"
        : active.isCount
          ? `Count-in ${active.count}`
          : `String ${laneLabels[active.string]} - Fret ${active.fret} - ${durationLabel(active)}`;
  }

  for (const measure of visibleMeasureLines(playhead)) {
    const element = document.createElement("div");
    element.className = "measure-line";
    element.style.setProperty("--y", `${measure.y}%`);
    element.style.setProperty("--measure-scale", measure.scale);
    element.innerHTML = `<span>${measure.label}</span>`;
    notesLayer.append(element);
  }

  for (const note of timelineNotes) {
    const pos = positionForNote(note, playhead);
    if (!pos.isVisible) continue;

    const element = document.createElement("div");
    element.className = `note${note.isCount ? " is-count" : ""}${pos.isStrike ? " is-hit" : ""}`;
    if (pos.isHit) {
      if (pos.isStrike) {
        if (note.isCount) hitTargets.forEach((target) => target.classList.add("is-active"));
        else hitTargets[note.string - 1]?.classList.add("is-active");
      }
      const meta = noteMetadata(note, playhead, rawPosition, pos);
      currentHitKeys.add(meta.key);
      visibleHitNotes.push(meta);
      if (!activeHitKeys.has(meta.key)) {
        logNoteHit(meta);
      }
      if (pos.isStrike) {
        currentStrikeKeys.add(meta.key);
        if (!activeStrikeKeys.has(meta.key)) {
          logNoteStrike(meta);
        }
      }
    }
    element.textContent = note.isCount ? `Count ${note.count}` : note.fret;
    element.style.setProperty("--lane-color", note.isCount ? "var(--hit)" : laneColor[note.string]);
    element.style.setProperty("--x", `${pos.x}%`);
    element.style.setProperty("--y", `${pos.y}%`);
    element.style.setProperty("--size", `${pos.size}px`);
    element.style.setProperty("--note-height", `${pos.durationHeight}px`);
    element.dataset.duration = durationLabel(note);
    notesLayer.append(element);
  }

  activeHitKeys = currentHitKeys;
  activeStrikeKeys = currentStrikeKeys;
  syncDebug.visibleHitNotes = visibleHitNotes;
  updateDebugPanel(rawPosition);
}

// Purpose: convert whole-note units into seconds at a backing track's native tempo.
// Warning: pass native tempo, not the user's active tempo; the media element tempo ratio handles practice tempo changes.
// Why this shape: both extracted metadata and runtime seeking need the same unit-to-audio conversion.
function backingSecondsFromUnits(units, nativeTempo) {
  return (Math.max(0, units) / QUARTER_NOTE_UNITS) * (60 / nativeTempo);
}

// Purpose: convert a song position into seconds in the original backing-track file.
// Warning: this uses the backing track's native tempo; the media element tempo ratio handles current tempo changes.
// Why this shape: offset math stays stable even when the tempo slider changes during practice.
function backingSecondsForPosition(position) {
  const nativeTempo = sourceMetadata.backingTrack?.nativeTempo || sourceMetadata.tempo || Number(tempo.value) || 120;
  return backingSecondsFromUnits(position, nativeTempo);
}

// Purpose: return how much exported pre-roll should be skipped before song position zero.
// Warning: this comes from skipped GPIF source measures, not waveform silence detection.
// Why this shape: the backing MP3 starts at source measure 1 while the highway starts at the first playable source measure.
function backingStartOffsetSeconds() {
  const backing = sourceMetadata.backingTrack || {};
  const nativeTempo = backing.nativeTempo || sourceMetadata.tempo || Number(tempo.value) || 120;
  if (Number.isFinite(backing.startOffsetSeconds) && backing.startOffsetSeconds > 0) {
    return backing.startOffsetSeconds;
  }
  return backingSecondsFromUnits(backing.startOffsetUnits || 0, nativeTempo);
}

// Purpose: compute the backing media tempo ratio from current BPM and native backing tempo.
// Warning: the browser preserves pitch for this media-element playbackRate; do not use AudioBufferSourceNode for backing here.
// Why this shape: it keeps backing, notes, and metronome on the same playhead clock without adding a DSP dependency.
function backingTempoRatio() {
  const nativeTempo = sourceMetadata.backingTrack?.nativeTempo || sourceMetadata.tempo || Number(tempo.value) || 120;
  return activeTempo / nativeTempo;
}

// Purpose: detect whether the loaded media element has enough metadata to seek and play.
// Warning: readyState can fall back during errors, so use this as live state rather than a permanent load flag.
// Why this shape: media-element playback needs duration/currentTime instead of a decoded AudioBuffer.
function isBackingTrackLoaded() {
  return Boolean(backingTrackAudio && backingTrackAudio.readyState >= HTMLMediaElement.HAVE_METADATA);
}

// Purpose: enable the browser's pitch-preserving playback mode across current engine property names.
// Warning: unsupported properties are harmless, but the standard preservesPitch flag is the one reports should prefer.
// Why this shape: HTML media playback is the simplest static-app path for tempo changes without pitch shifting.
function enableBackingPitchPreservation(audio) {
  if ("preservesPitch" in audio) audio.preservesPitch = true;
  if ("mozPreservesPitch" in audio) audio.mozPreservesPitch = true;
  if ("webkitPreservesPitch" in audio) audio.webkitPreservesPitch = true;
}

// Purpose: report whether pitch preservation is enabled on the backing media element.
// Warning: older browser aliases may exist without the standard property.
// Why this shape: tests and sync reports need an explicit runtime fact, not just a code-path assumption.
function backingPitchPreserveEnabled(audio = backingTrackAudio) {
  if (!audio) return false;
  if ("preservesPitch" in audio) return audio.preservesPitch;
  if ("mozPreservesPitch" in audio) return audio.mozPreservesPitch;
  if ("webkitPreservesPitch" in audio) return audio.webkitPreservesPitch;
  return false;
}

// Purpose: create the reusable backing audio element and route it through the mixer bus.
// Warning: createMediaElementSource can only be called once for a given media element.
// Why this shape: one media element can change tempo with pitch preservation while still flowing through debug capture.
function ensureBackingAudioElement() {
  const context = ensureAudioContext();
  if (!backingTrackAudio) {
    backingTrackAudio = new Audio();
    backingTrackAudio.preload = "auto";
    backingTrackAudio.loop = false;
    enableBackingPitchPreservation(backingTrackAudio);
    backingTrackAudio.addEventListener("ended", () => {
      if (isPlaying && backingToggle?.checked) {
        startBackingTrack(0);
      } else {
        updateMixerState();
      }
    });
    backingTrackAudio.addEventListener("error", () => {
      backingStatusError = "Backing unavailable";
      updateMixerState();
    });
  }

  if (!backingMediaSource) {
    backingMediaSource = context.createMediaElementSource(backingTrackAudio);
    connectToOutputs(backingMediaSource, "backing");
  }

  return backingTrackAudio;
}

// Purpose: return the original-file loop window for the playable song section.
// Warning: this depends on media metadata; callers should tolerate null before the backing is loaded.
// Why this shape: the MP3 contains GP export pre-roll while the visual timeline starts at playable position zero.
function backingLoopInfo() {
  if (!isBackingTrackLoaded()) return null;
  const preRollOffset = backingStartOffsetSeconds();
  const mediaDuration = backingTrackAudio.duration;
  const loopStart = Math.min(preRollOffset, Math.max(0, mediaDuration - 0.01));
  const loopDuration = backingSecondsForPosition(songEndPosition);
  const loopEnd = Math.min(mediaDuration, loopStart + loopDuration);
  const loopLength = Math.max(0, loopEnd - loopStart);
  return { loopStart, loopEnd, loopLength };
}

// Purpose: compute the backing media time that should align with a visual playhead position.
// Warning: negative count-in space has no backing audio; return null until song position zero is reached.
// Why this shape: drift checks compare media currentTime against the same native-tempo offset math used for starts.
function expectedBackingMediaTime(position = currentPlayhead) {
  const loop = backingLoopInfo();
  if (!loop || position < 0) return null;
  const songPosition = normalizePlaybackPosition(position);
  let expected = loop.loopStart + backingSecondsForPosition(songPosition);
  if (loop.loopLength > 0) expected = loop.loopStart + ((expected - loop.loopStart) % loop.loopLength);
  return Number(expected.toFixed(4));
}

// Purpose: keep media-element backing playback aligned to the visual playhead.
// Warning: normal frame jitter should not seek constantly; only correct meaningful drift or explicit tempo changes.
// Why this shape: HTMLMediaElement playback is pitch-preserving but less sample-scheduled than AudioBufferSourceNode.
function correctBackingDrift(force = false) {
  if (!isPlaying || !backingTrackAudio || backingTrackAudio.paused || backingTrackAudio.seeking) return;
  const expected = expectedBackingMediaTime(currentPlayhead);
  const loop = backingLoopInfo();
  if (expected === null || !loop) return;

  if (loop.loopLength > 0 && backingTrackAudio.currentTime >= loop.loopEnd - 0.01) {
    backingTrackAudio.currentTime = loop.loopStart;
  }

  const drift = backingTrackAudio.currentTime - expected;
  backingDriftSeconds = Number(drift.toFixed(4));
  if (force || Math.abs(drift) > BACKING_DRIFT_CORRECTION_SECONDS) {
    backingTrackAudio.currentTime = expected;
    backingDriftSeconds = 0;
  }
}

// Purpose: preserve the current playhead when the user changes tempo during playback.
// Warning: call this before replacing activeTempo, or elapsed time will be reinterpreted at the new BPM and jump.
// Why this shape: it keeps visuals, scheduled clicks, and backing playback continuous while allowing live tempo changes.
function reanchorPlaybackClockForTempoChange(nextTempo) {
  if (!isPlaying || !audioContext) {
    activeTempo = nextTempo;
    return;
  }

  const elapsedUnits = (audioContext.currentTime - startedAtAudio) * (activeTempo / 60) * QUARTER_NOTE_UNITS;
  const rawPosition = pausedAt + elapsedUnits;
  currentPlayhead = normalizePlaybackPosition(rawPosition);
  pausedAt = currentPlayhead;
  startedAtAudio = audioContext.currentTime;
  activeTempo = nextTempo;
  if (syncDebug.currentRun) {
    syncDebug.currentRun.startedAtPosition = pausedAt;
  }
  lastMetronomeTickIndex = Math.floor(currentPlayhead / QUARTER_NOTE_UNITS + 0.0001);
  render(currentPlayhead, currentPlayhead);
}

// Purpose: compute equal-power click/backing gains from the one mixer slider.
// Warning: when backing is off or unavailable, click gain returns to 1 so the metronome never disappears.
// Why this shape: a true crossfader feels natural when backing is active while the off toggle remains musically safe.
function equalPowerMixerGains() {
  const position = (Number(mixSlider?.value ?? DEFAULT_MIX_POSITION) || 0) / 100;
  if (!backingToggle?.checked || !isBackingTrackLoaded()) {
    return { position, metronomeGain: 1, backingGain: 0 };
  }

  const angle = position * (Math.PI / 2);
  return {
    position,
    metronomeGain: Math.cos(angle),
    backingGain: Math.sin(angle),
  };
}

// Purpose: refresh mixer gains, visible backing status, and test-readable mixer state.
// Warning: keep the controls interactive even when audio is not loaded; unavailable backing is handled by gain math.
// Why this shape: refactored away from disabling the inputs so users can set their preferred mix before playback loads.
function updateMixerState() {
  const gains = equalPowerMixerGains();
  const context = audioContext;
  const available = Boolean(sourceMetadata.backingTrack?.available && sourceMetadata.backingTrack?.url);
  const loaded = isBackingTrackLoaded();
  const enabled = Boolean(backingToggle?.checked);
  const expectedCurrentTime = expectedBackingMediaTime(currentPlayhead);
  if (!available) backingStatusError = "No backing in source";
  else if (backingStatusError === "No backing in source") backingStatusError = "";

  mixerState = {
    position: gains.position,
    metronomeGain: gains.metronomeGain,
    backingGain: gains.backingGain,
    backingAvailable: available,
    backingEnabled: enabled,
    backingLoaded: loaded,
    backingPlaying: Boolean(backingTrackAudio && !backingTrackAudio.paused),
    backingMuted: Boolean(backingTrackAudio?.muted),
    backingPreservesPitch: available && backingTrackAudio ? backingPitchPreserveEnabled(backingTrackAudio) : false,
    backingTempoRatio: Number(backingTempoRatio().toFixed(4)),
    backingPlaybackRate: Number(backingTempoRatio().toFixed(4)),
    backingSourcePlaybackRate: available && backingTrackAudio
      ? Number(backingTrackAudio.playbackRate.toFixed(4))
      : null,
    backingMediaCurrentTime: backingTrackAudio && loaded
      ? Number(backingTrackAudio.currentTime.toFixed(4))
      : null,
    backingExpectedCurrentTime: expectedCurrentTime,
    backingDriftSeconds,
    backingStartOffsetSeconds: Number(backingStartOffsetSeconds().toFixed(3)),
    lastBackingStart,
  };
  window.__mixerState = mixerState;

  if (metronomeBus && context) {
    metronomeBus.gain.setTargetAtTime(gains.metronomeGain, context.currentTime, 0.01);
  }
  if (backingBus && context) {
    backingBus.gain.setTargetAtTime(gains.backingGain, context.currentTime, 0.01);
  }

  if (backingStatus) backingStatus.textContent = backingStatusError;
}

// Purpose: create the click and backing gain busses once per AudioContext.
// Warning: connect sources to these busses, not directly to destination/debug, or the mixer will be bypassed.
// Why this shape: refactored from a single output helper so the crossfader can control click and backing independently.
function ensureMixerBuses() {
  if (!audioContext) return;
  debugAudioDestination ||= audioContext.createMediaStreamDestination();

  if (!metronomeBus) {
    metronomeBus = audioContext.createGain();
    metronomeBus.connect(audioContext.destination);
    metronomeBus.connect(debugAudioDestination);
  }

  if (!backingBus) {
    backingBus = audioContext.createGain();
    backingBus.connect(audioContext.destination);
    backingBus.connect(debugAudioDestination);
  }

  updateMixerState();
}

// Purpose: create or resume the shared Web Audio context.
// Warning: browsers require this to run from user interaction before audio can play.
// Why this shape: one context drives click audio, backing audio, and debug capture routing.
function ensureAudioContext() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  debugAudioDestination ||= audioContext.createMediaStreamDestination();
  ensureMixerBuses();
  return audioContext;
}

// Purpose: resume Web Audio before binding a run's visual and audio clocks.
// Warning: call from a user gesture; browsers can reject resume attempts outside one.
// Why this shape: refactored from fire-and-forget resume so the first click is scheduled against a running audio clock.
async function resumeAudioContext() {
  const context = ensureAudioContext();
  if (context.state === "suspended") {
    await context.resume();
  }
  return context;
}

// Purpose: route generated audio to the selected mixer bus.
// Warning: only nodes passed through here are captured by startSyncAudioCapture().
// Why this shape: click and backing sources share output plumbing while keeping independent gain control.
function connectToOutputs(node, bus = "metronome") {
  ensureMixerBuses();
  node.connect(bus === "backing" ? backingBus : metronomeBus);
}

// Purpose: stop the currently scheduled or playing backing media element.
// Warning: this pauses the reusable media element but keeps its mixer connection intact.
// Why this shape: pause/restart/toggle-off need deterministic silence without rebuilding the audio graph.
function stopBackingTrack() {
  if (backingStartTimer) {
    window.clearTimeout(backingStartTimer);
    backingStartTimer = 0;
  }
  if (backingTrackAudio) {
    backingTrackAudio.pause();
    backingTrackAudio.muted = false;
  }
  updateMixerState();
}

// Purpose: start the backing media element and capture play() failures as visible mixer status.
// Warning: this must run from a user-gesture-derived playback path or after an already-allowed media play.
// Why this shape: HTMLMediaElement.play() is promise-based and can be rejected by autoplay policy.
async function playBackingAudio(audio) {
  try {
    await audio.play();
    backingStatusError = "";
  } catch (error) {
    console.warn("Backing track could not be played.", error);
    backingStatusError = "Backing unavailable";
  }
  updateMixerState();
}

// Purpose: start backing audio at the playhead-aligned song offset.
// Warning: backing starts at song position 0 but skips exported GP pre-roll before the first playable source measure.
// Why this shape: media-element playback preserves pitch while still following the same visual playhead tempo ratio.
function startBackingTrack(position = currentPlayhead) {
  if (!isPlaying || !backingToggle?.checked || !isBackingTrackLoaded()) {
    updateMixerState();
    return;
  }

  stopBackingTrack();
  const context = ensureAudioContext();
  const audio = ensureBackingAudioElement();
  const songPosition = position < 0 ? 0 : normalizePlaybackPosition(position);
  const loop = backingLoopInfo();
  if (!loop) {
    updateMixerState();
    return;
  }

  const { loopStart, loopEnd, loopLength } = loop;
  let offsetSeconds = loopStart + backingSecondsForPosition(songPosition);
  if (loopLength > 0) offsetSeconds = loopStart + ((offsetSeconds - loopStart) % loopLength);

  enableBackingPitchPreservation(audio);
  audio.playbackRate = backingTempoRatio();
  audio.currentTime = offsetSeconds;

  const scheduledStart = position < 0
    ? scheduledAudioTimeForPosition(0)
    : context.currentTime + 0.005;
  const startDelayMs = Math.max(0, (scheduledStart - context.currentTime) * 1000);
  lastBackingStart = {
    offsetSeconds: Number(offsetSeconds.toFixed(4)),
    loopStart: Number(loopStart.toFixed(4)),
    loopEnd: Number(loopEnd.toFixed(4)),
    tempoRatio: Number(audio.playbackRate.toFixed(4)),
    preservesPitch: backingPitchPreserveEnabled(audio),
    scheduledStart: Number(scheduledStart.toFixed(4)),
  };

  if (startDelayMs > 0) {
    audio.muted = true;
    playBackingAudio(audio);
    backingStartTimer = window.setTimeout(() => {
      backingStartTimer = 0;
      if (!isPlaying || !backingToggle?.checked || !isBackingTrackLoaded()) {
        updateMixerState();
        return;
      }
      audio.currentTime = offsetSeconds;
      audio.muted = false;
      if (audio.paused) playBackingAudio(audio);
      else updateMixerState();
    }, startDelayMs);
  } else {
    audio.muted = false;
    playBackingAudio(audio);
  }
  updateMixerState();
}

// Purpose: apply current tempo to the backing media element while preserving pitch.
// Warning: live tempo changes can create small drift, so this also nudges currentTime back to the playhead-derived position.
// Why this shape: browser media playback gives this static app tempo adjustment without pitch-shifting the backing track.
function updateBackingPlaybackRate() {
  if (!backingTrackAudio) return;
  enableBackingPitchPreservation(backingTrackAudio);
  backingTrackAudio.playbackRate = backingTempoRatio();
  if (backingStartTimer && isPlaying && isBackingTrackLoaded()) {
    startBackingTrack(currentPlayhead);
    return;
  }
  correctBackingDrift(true);
  setTimeout(updateMixerState, 40);
}

// Purpose: fetch the backing track metadata and prepare media-element playback for the active source payload.
// Warning: raw GPIF XML may name an embedded asset without providing bytes; those cases report no loaded backing.
// Why this shape: default JSON URLs and selected GP package object URLs share one pitch-preserving playback path.
async function loadBackingTrack(backingTrack) {
  const token = ++backingTrackLoadToken;
  backingStatusError = "";
  stopBackingTrack();
  backingDriftSeconds = null;
  updateMixerState();

  if (!backingTrack?.available || !backingTrack.url) {
    lastBackingStart = null;
    backingDriftSeconds = null;
    if (backingTrackAudio) {
      backingTrackAudio.pause();
      backingTrackAudio.removeAttribute("src");
      backingTrackAudio.load();
    }
    updateMixerState();
    return;
  }

  try {
    const audio = ensureBackingAudioElement();
    audio.pause();
    audio.src = backingTrack.url;
    enableBackingPitchPreservation(audio);
    audio.playbackRate = backingTempoRatio();
    audio.load();
    await new Promise((resolve, reject) => {
      const onLoaded = () => cleanup(resolve);
      const onError = () => cleanup(() => reject(new Error("Backing metadata could not be loaded.")));
      const cleanup = (done) => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
        done();
      };
      audio.addEventListener("loadedmetadata", onLoaded, { once: true });
      audio.addEventListener("error", onError, { once: true });
      if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) cleanup(resolve);
    });
    if (token !== backingTrackLoadToken) return;
    updateMixerState();
    if (isPlaying) startBackingTrack(currentPlayhead);
  } catch (error) {
    if (token !== backingTrackLoadToken) return;
    console.warn("Backing track could not be loaded.", error);
    backingStatusError = "Backing unavailable";
    if (backingTrackAudio) {
      backingTrackAudio.pause();
      backingTrackAudio.removeAttribute("src");
      backingTrackAudio.load();
    }
    updateMixerState();
  }
}

// Purpose: remember scheduled audio nodes so pause/restart can stop future clicks.
// Warning: only AudioScheduledSourceNode-like objects with ended events should be passed in.
// Why this shape: refactored from fire-and-forget scheduling to prevent clicks after playback pauses.
function trackClickNode(node) {
  scheduledClickNodes.add(node);
  node.addEventListener("ended", () => scheduledClickNodes.delete(node), { once: true });
}

// Purpose: stop any click nodes that were scheduled but have not finished.
// Warning: stopping an already-ended node can throw in browsers, so failures are intentionally ignored.
// Why this shape: pause/restart must silence future scheduled audio without needing a heavier scheduler.
function stopScheduledClicks() {
  for (const node of scheduledClickNodes) {
    try {
      node.stop();
    } catch {
      // The node may already have ended by the time pause/restart is pressed.
    }
  }
  scheduledClickNodes.clear();
}

// Purpose: synthesize the built-in metronome click at a precise Web Audio time.
// Warning: pass an explicit scheduled time for playback sync; the default is only for ad hoc/manual calls.
// Why this shape: Web Audio scheduling is more stable than starting oscillator clicks from animation frames.
function playBuiltInClick(accent = false, when = ensureAudioContext().currentTime) {
  const context = ensureAudioContext();
  const startAt = Math.max(when, context.currentTime + 0.005);
  const oscillator = context.createOscillator();
  const tick = context.createOscillator();
  const gain = context.createGain();
  const accentGain = context.createGain();
  const accentPing = context.createOscillator();
  oscillator.type = "square";
  tick.type = "sine";
  accentPing.type = "triangle";
  oscillator.frequency.value = 1120;
  tick.frequency.value = 560;
  accentPing.frequency.value = 1760;
  gain.gain.setValueAtTime(0.32, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.075);
  oscillator.connect(gain);
  tick.connect(gain);
  connectToOutputs(gain);
  oscillator.start(startAt);
  tick.start(startAt);
  oscillator.stop(startAt + 0.08);
  tick.stop(startAt + 0.08);
  trackClickNode(oscillator);
  trackClickNode(tick);

  if (accent) {
    accentGain.gain.setValueAtTime(0.16, startAt);
    accentGain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.09);
    accentPing.connect(accentGain);
    connectToOutputs(accentGain);
    accentPing.start(startAt);
    accentPing.stop(startAt + 0.1);
    trackClickNode(accentPing);
  }
}

// Purpose: play a decoded user-selected WAV as the metronome click.
// Warning: selected WAV playback uses the original sample; keep files short to avoid overlap.
// Why this shape: one decoded buffer can be replayed reliably on every scheduled tick.
function playSelectedClick(accent = false, when = ensureAudioContext().currentTime) {
  const context = ensureAudioContext();
  const startAt = Math.max(when, context.currentTime + 0.005);
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = metronomeBuffer;
  gain.gain.value = 1;
  source.connect(gain);
  connectToOutputs(gain);
  source.start(startAt);
  trackClickNode(source);

  if (accent) playBuiltInClick(true, startAt);
}

// Purpose: list notes that are scheduled exactly on a metronome position.
// Warning: off-quarter-grid notes are intentionally excluded from a tick's hitNotes.
// Why this shape: refactored from beat naming to whole-note positions so subdivision math stays explicit.
function notesScheduledAtPosition(position) {
  return timelineNotes
    .filter((note) => Math.abs(note.position - position) < 0.001)
    .map((note) => ({
      label: noteLabel(note),
      kind: note.isCount ? "count-in" : "song-note",
      scheduledPosition: note.position,
      durationLabel: durationLabel(note),
    }));
}

// Purpose: log and sound a metronome click for a specific position.
// Warning: scheduledTime should come from scheduledAudioTimeForPosition() during playback.
// Why this shape: the event log and audible click are created together so reports match what was heard.
function playMetronomeClick(position, scheduledTime = ensureAudioContext().currentTime) {
  const tickIndex = Math.round(position / QUARTER_NOTE_UNITS);
  const accent = tickIndex % 4 === 0;
  const metricPosition = timeSignaturePosition(position);
  const hitNoteMetadata = notesScheduledAtPosition(position);
  const hitNotes = hitNoteMetadata.map((note) => note.label);
  syncDebug.metronomeEvents.push({
    ...eventBase(),
    eventType: "metronome-tick",
    position: Number(position.toFixed(6)),
    ...metricPosition,
    accent,
    scheduledAudioContextSeconds: Number(scheduledTime.toFixed(4)),
    bpm: activeTempo,
    sourceFile: sourceMetadata.file || "Fallback demo notes",
    metronomeSound: clickButtonText?.textContent || "Default Click",
    hitNotes,
    hitNoteMetadata,
  });
  updateDebugPanel();
  if (metronomeBuffer) {
    playSelectedClick(accent, scheduledTime);
    return;
  }

  playBuiltInClick(accent, scheduledTime);
}

// Purpose: schedule any quarter-note metronome clicks due within the lookahead window.
// Warning: clicks begin at PLAY_START_POSITION, not START_POSITION, so the player hears time immediately while count blocks travel from the horizon.
// Why this shape: refactored from START_POSITION-only scheduling, which created silence before the visual count-in reached the hit zone.
function updateMetronome(rawPosition) {
  const bpm = activeTempo;
  const lookaheadUnits = METRONOME_LOOKAHEAD_SECONDS * (bpm / 60) * QUARTER_NOTE_UNITS;
  const currentTickIndex = Math.floor((rawPosition + lookaheadUnits) / QUARTER_NOTE_UNITS + 0.0001);
  if (lastMetronomeTickIndex === null) {
    lastMetronomeTickIndex = Math.floor(rawPosition / QUARTER_NOTE_UNITS + 0.0001) - 1;
  }

  while (lastMetronomeTickIndex < currentTickIndex) {
    lastMetronomeTickIndex += 1;
    const tickPosition = Number((lastMetronomeTickIndex * QUARTER_NOTE_UNITS).toFixed(6));
    if (tickPosition >= PLAY_START_POSITION) {
      playMetronomeClick(tickPosition, scheduledAudioTimeForPosition(tickPosition));
    }
  }
}

// Purpose: advance playback from Web Audio time and render the next animation frame.
// Warning: visual position comes from the same elapsed position clock as metronome scheduling.
// Why this shape: using audio time instead of Date/performance deltas keeps visual and click timing aligned.
function tick() {
  const bpm = activeTempo;
  const context = ensureAudioContext();
  const elapsedUnits = (context.currentTime - startedAtAudio) * (bpm / 60) * QUARTER_NOTE_UNITS;
  const rawPosition = pausedAt + elapsedUnits;
  const playhead = normalizePlaybackPosition(rawPosition);
  currentPlayhead = playhead;
  correctBackingDrift();
  render(currentPlayhead, rawPosition);
  updateMetronome(rawPosition);
  rafId = requestAnimationFrame(tick);
}

// Purpose: handle tab/source file selection from the browser picker.
// Warning: PDF selections are acknowledged but not converted into timed notes in-browser.
// Why this shape: refactored from a misleading accept list to real JSON/GPIF/GP parsing plus honest PDF status.
fileInput.addEventListener("change", async () => {
  const selected = fileInput.files?.[0];
  if (!selected) return;
  await handleSelectedSourceFile(selected);
  fileInput.value = "";
  updateDebugPanel();
});

sourceLibrary?.addEventListener("change", async () => {
  const entry = sourceLibraryEntries.find((candidate) => candidate.key === sourceLibrary.value);
  await loadSourceEntry(entry);
});

refreshSources?.addEventListener("click", async () => {
  await loadSourceLibrary();
});

// Purpose: decode a selected WAV for use as the metronome click.
// Warning: decode failures fall back to the built-in click rather than breaking playback.
// Why this shape: one decoded AudioBuffer can be scheduled repeatedly without re-reading the file.
metronomeFile.addEventListener("change", async () => {
  const selected = metronomeFile.files?.[0];
  if (!selected) return;
  const context = ensureAudioContext();
  clickButtonText.textContent = "Loading...";
  try {
    const buffer = await selected.arrayBuffer();
    metronomeBuffer = await context.decodeAudioData(buffer);
    clickButtonText.textContent = "User Click";
  } catch {
    metronomeBuffer = null;
    clickButtonText.textContent = "Default Click";
  }
  updateDebugPanel();
});

// Purpose: toggle playback and bind visual/audio clocks to a new sync run.
// Warning: Count 1 starts at the horizon; metronome clicks begin at PLAY_START_POSITION so there is no silent runway.
// Why this shape: refactored from pinning Count 1 to the hit zone on play back to visual lead-in plus immediate clicks.
playPause.addEventListener("click", async () => {
  isPlaying = !isPlaying;
  playPause.classList.toggle("is-playing", isPlaying);
  playPause.setAttribute("aria-label", isPlaying ? "Pause" : "Play");

  if (isPlaying) {
    const context = await resumeAudioContext();
    if (rafId) cancelAnimationFrame(rafId);
    stopScheduledClicks();
    activeTempo = Number(tempo.value);
    startSyncRun();
    startedAtAudio = context.currentTime;
    lastMetronomeTickIndex = null;
    render(pausedAt, pausedAt);
    updateMetronome(pausedAt);
    startBackingTrack(pausedAt);
    rafId = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(rafId);
    rafId = 0;
    pausedAt = currentPlayhead;
    lastMetronomeTickIndex = null;
    stopScheduledClicks();
    stopBackingTrack();
    render(pausedAt);
  }
});

// Purpose: reset playback to the visual lead-in start.
// Warning: restart also stops scheduled clicks so old audio cannot leak into the new run.
// Why this shape: a single reset path keeps currentPlayhead, pausedAt, and audio schedule aligned.
restart.addEventListener("click", () => {
  pausedAt = PLAY_START_POSITION;
  currentPlayhead = pausedAt;
  stopScheduledClicks();
  stopBackingTrack();
  if (isPlaying) {
    activeTempo = Number(tempo.value);
    startSyncRun();
    startedAtAudio = ensureAudioContext().currentTime;
    lastMetronomeTickIndex = null;
    startBackingTrack(pausedAt);
  }
  render(pausedAt);
});

// Purpose: update BPM display when the tempo slider changes.
// Warning: changing tempo during playback affects future position math immediately.
// Why this shape: the prototype treats tempo as the active playback clock value, not immutable song metadata.
tempo.addEventListener("input", () => {
  setTempoValue(tempo.value, { reanchor: true });
});

// Purpose: block non-numeric characters in the editable BPM control.
// Warning: range clamping still happens on commit because partial typed values can be temporarily out of range.
// Why this shape: it keeps typing natural while still enforcing a numeric tempo field.
tempoValue.addEventListener("beforeinput", (event) => {
  if (event.data && !/^\d+$/.test(event.data)) event.preventDefault();
});

// Purpose: apply typed BPM values once they are inside the supported tempo range.
// Warning: incomplete values are allowed while typing and are clamped on blur or Enter.
// Why this shape: typing "120" should not clamp after the first "1".
tempoValue.addEventListener("input", () => {
  const parsed = Number.parseInt(tempoValue.value, 10);
  if (parsed >= TEMPO_MIN && parsed <= TEMPO_MAX) {
    setTempoValue(parsed, { reanchor: true });
  }
});

// Purpose: commit typed BPM values and clamp them into the supported range.
// Warning: this can rewrite the field when the user leaves an empty or out-of-range value.
// Why this shape: the app always returns to a valid tempo after editing.
tempoValue.addEventListener("change", () => {
  setTempoValue(tempoValue.value, { reanchor: true });
});

// Purpose: let Enter commit the editable BPM field immediately.
// Warning: this intentionally blurs the field so the normal change handler performs clamping.
// Why this shape: keyboard entry should feel like a compact numeric control, not a freeform text field.
tempoValue.addEventListener("keydown", (event) => {
  if (event.key === "Enter") tempoValue.blur();
});

// Purpose: toggle backing playback without changing the user's crossfader position.
// Warning: turning backing off restores click-only gain so the metronome remains audible.
// Why this shape: the binary control is safe for practice while the slider keeps its chosen balance.
backingToggle?.addEventListener("change", () => {
  if (backingToggle.checked) {
    updateMixerState();
    if (isPlaying) startBackingTrack(currentPlayhead);
  } else {
    stopBackingTrack();
    updateMixerState();
  }
});

// Purpose: update the equal-power click/backing crossfade.
// Warning: moving the slider does not start audio by itself; the toggle and play state still control backing playback.
// Why this shape: one slider gives the requested click-vs-backing balance without extra mixer complexity.
mixSlider?.addEventListener("input", () => {
  updateMixerState();
});

// Purpose: render the latest sync report into the permanent debug panel.
// Warning: the report summarizes the current run; generate it after enough playback evidence has accumulated.
// Why this shape: keeping report generation manual avoids noisy per-frame report rebuilding.
generateReport.addEventListener("click", () => {
  debugReport.textContent = buildSyncReport();
});

render();
updateDebugPanel();
updateMixerState();
loadDefaultGpData();
loadSourceLibrary();
