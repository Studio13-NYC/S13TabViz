const fileInput = document.querySelector("#tabFile");
const fileName = document.querySelector("#fileName");
const metronomeFile = document.querySelector("#metronomeFile");
const metronomeName = document.querySelector("#metronomeName");
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

const START_BEAT = -4;
const HORIZON_BEATS = 4;
const EMPTY_RUNWAY_BEATS = 0.5;
const PLAY_START_BEAT = START_BEAT - HORIZON_BEATS - EMPTY_RUNWAY_BEATS;
const TOP_Y = 9;
const HIT_Y = 82;
const HIT_ZONE_WINDOW_BEATS = 0.1;
const STRIKE_SYNC_WINDOW_BEATS = 0.025;
const QUARTER_NOTE_BEATS = 1;
const EIGHTH_NOTE_BEATS = 0.5;
const TRIPLET_EIGHTH_BEATS = 1 / 3;
const HALF_NOTE_BEATS = 2;
const WHOLE_NOTE_BEATS = 4;
const QUARTER_NOTE_HEIGHT = 46;
const DEFAULT_GP_NOTES_URL = "./data/hand-sync-pt1-notes.json";

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
  1: 26,
  2: 35.6,
  3: 45.2,
  4: 54.8,
  5: 64.4,
  6: 74,
};

const countInNotes = Array.from({ length: 4 }, (_, index) => ({
  isCount: true,
  beat: START_BEAT + index,
  durationBeats: QUARTER_NOTE_BEATS,
  count: (index % 4) + 1,
}));

const fallbackNotes = [
  { string: 3, fret: 5, beat: 0, durationBeats: EIGHTH_NOTE_BEATS },
  { string: 2, fret: 5, beat: 0.5, durationBeats: EIGHTH_NOTE_BEATS },
  { string: 1, fret: 5, beat: 1, durationBeats: EIGHTH_NOTE_BEATS },
  { string: 2, fret: 6, beat: 1.5, durationBeats: EIGHTH_NOTE_BEATS },
  { string: 3, fret: 7, beat: 2, durationBeats: EIGHTH_NOTE_BEATS },
  { string: 4, fret: 7, beat: 2.5, durationBeats: EIGHTH_NOTE_BEATS },
  { string: 5, fret: 8, beat: 3, durationBeats: EIGHTH_NOTE_BEATS },
  { string: 6, fret: 8, beat: 3.5, durationBeats: EIGHTH_NOTE_BEATS },
  { string: 5, fret: 7, beat: 4, durationBeats: QUARTER_NOTE_BEATS },
  { string: 4, fret: 5, beat: 5, durationBeats: TRIPLET_EIGHTH_BEATS },
  { string: 3, fret: 4, beat: 5 + TRIPLET_EIGHTH_BEATS, durationBeats: TRIPLET_EIGHTH_BEATS },
  { string: 2, fret: 5, beat: 5 + TRIPLET_EIGHTH_BEATS * 2, durationBeats: TRIPLET_EIGHTH_BEATS },
  { string: 3, fret: 7, beat: 6, durationBeats: HALF_NOTE_BEATS },
];

let songNotes = [...fallbackNotes];
let timelineNotes = [...countInNotes, ...songNotes];
let songEndBeat = 8;
let sourceMetadata = {
  file: "Hand Sync pt1 + BT.gp",
  title: "Hand Sync pt.1",
  tempo: 120,
  timeSignature: "4/4",
  ignoredBackingTrack: true,
};

let isPlaying = false;
let startedAtAudio = 0;
let pausedAt = PLAY_START_BEAT;
let currentPlayhead = pausedAt;
let rafId = 0;
let metronomeBuffer = null;
let audioContext = null;
let lastMetronomeBeat = null;
let activeHitKeys = new Set();
let activeStrikeKeys = new Set();
let debugAudioDestination = null;
let syncAudioRecorder = null;
let syncAudioChunks = [];

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

function normalizePlaybackBeat(beat) {
  if (beat < songEndBeat) return beat;
  return ((beat % songEndBeat) + songEndBeat) % songEndBeat;
}

function timeSignaturePosition(beat) {
  const beatInBar = ((Math.floor(beat) % 4) + 4) % 4;
  const bar =
    beat < 0
      ? "count-in"
      : Math.floor(Math.floor(beat) / 4) + 1;

  return {
    bar,
    beatInBar: beatInBar + 1,
    timeSignature: "4/4",
  };
}

function noteLabel(note) {
  return note.isCount ? `Count ${note.count}` : `${laneLabels[note.string]}${note.fret}`;
}

function durationBeats(note) {
  return note.durationBeats || QUARTER_NOTE_BEATS;
}

function durationLabel(note) {
  const beats = durationBeats(note);
  if (Math.abs(beats - WHOLE_NOTE_BEATS) < 0.001) return "whole";
  if (Math.abs(beats - HALF_NOTE_BEATS) < 0.001) return "half";
  if (Math.abs(beats - QUARTER_NOTE_BEATS) < 0.001) return "quarter";
  if (Math.abs(beats - EIGHTH_NOTE_BEATS) < 0.001) return "eighth";
  if (Math.abs(beats - TRIPLET_EIGHTH_BEATS) < 0.001) return "eighth-triplet";
  return `${Number(beats.toFixed(3))} beats`;
}

function noteMetadata(note, playhead, rawBeat, pos) {
  const distance = distanceToNote(note, playhead);
  return {
    key: `${note.isCount ? "count" : "note"}:${note.beat}:${note.string || "all"}:${note.fret || note.count}`,
    label: noteLabel(note),
    kind: note.isCount ? "count-in" : "song-note",
    scheduledBeat: note.beat,
    string: note.isCount ? "all" : laneLabels[note.string],
    fret: note.isCount ? null : note.fret,
    count: note.isCount ? note.count : null,
    durationBeats: Number(durationBeats(note).toFixed(4)),
    durationLabel: durationLabel(note),
    measure: note.measure || null,
    sourceMeasure: note.sourceMeasure || null,
    beatInMeasure: note.beatInMeasure ?? null,
    pickStroke: note.pickStroke || null,
    playhead: Number(playhead.toFixed(4)),
    rawBeat: Number(rawBeat.toFixed(4)),
    distanceToHit: Number(distance.toFixed(4)),
    screenXPercent: Number(pos.x.toFixed(2)),
    screenYPercent: Number(pos.y.toFixed(2)),
  };
}

function runSettings() {
  return {
    sourceFile: fileName.textContent,
    sourceTitle: sourceMetadata.title,
    bpm: Number(tempo.value),
    timeSignature: sourceMetadata.timeSignature || "4/4",
    sourceIgnoredBackingTrack: Boolean(sourceMetadata.ignoredBackingTrack),
    metronomeSound: metronomeName.textContent,
    clickSource: metronomeBuffer ? "selected wav" : "built-in click",
    countInBeats: 4,
    startBeat: START_BEAT,
    playStartBeat: PLAY_START_BEAT,
    horizonBeats: HORIZON_BEATS,
    emptyRunwayBeats: EMPTY_RUNWAY_BEATS,
    hitZoneWindowBeats: HIT_ZONE_WINDOW_BEATS,
    strikeSyncWindowBeats: STRIKE_SYNC_WINDOW_BEATS,
    durationScale: {
      whole: WHOLE_NOTE_BEATS,
      half: HALF_NOTE_BEATS,
      quarter: QUARTER_NOTE_BEATS,
      eighth: EIGHTH_NOTE_BEATS,
      tripletEighth: Number(TRIPLET_EIGHTH_BEATS.toFixed(4)),
    },
    userAgent: navigator.userAgent,
  };
}

function startSyncRun() {
  const now = new Date();
  syncDebug.currentRun = {
    id: `run-${now.toISOString().replace(/[:.]/g, "-")}`,
    startedAtIso: now.toISOString(),
    startedAtPerformanceMs: Number(performance.now().toFixed(3)),
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

function eventBase() {
  const context = audioContext;
  return {
    runId: syncDebug.currentRun?.id || "no-run",
    timestampIso: new Date().toISOString(),
    performanceMs: Number(performance.now().toFixed(3)),
    audioContextSeconds: context ? Number(context.currentTime.toFixed(4)) : null,
  };
}

function logNoteHit(noteMeta) {
  const event = {
    ...eventBase(),
    eventType: "note-in-hit-zone",
    ...noteMeta,
  };
  syncDebug.noteHitEvents.push(event);
}

function logNoteStrike(noteMeta) {
  const event = {
    ...eventBase(),
    eventType: "note-strike-sync",
    ...noteMeta,
  };
  syncDebug.noteStrikeEvents.push(event);
}

function updateDebugPanel(rawBeat = currentPlayhead) {
  const run = syncDebug.currentRun;
  debugRunLabel.textContent = run
    ? `${run.id} | ${run.settings.sourceFile} | ${run.settings.bpm} BPM`
    : "No run yet";
  debugPlayhead.textContent = `${Number(currentPlayhead.toFixed(3))} beat`;
  const lastTick = syncDebug.metronomeEvents.at(-1);
  debugLastTick.textContent = lastTick
    ? `Beat ${lastTick.beat} (${lastTick.bar}:${lastTick.beatInBar})`
    : "-";
  debugHitNotes.textContent = syncDebug.visibleHitNotes.length
    ? syncDebug.visibleHitNotes.map((note) => note.label).join(", ")
    : "-";
  debugEventCounts.textContent = `${syncDebug.metronomeEvents.length} ticks / ${syncDebug.noteHitEvents.length} hits / ${syncDebug.noteStrikeEvents.length} strikes`;

  const recent = [
    ...syncDebug.metronomeEvents.slice(-4).map((event) => ({
      type: "Tick",
      text: `beat ${event.beat} -> ${event.hitNotes.join(", ") || "no hit"}`,
    })),
    ...syncDebug.noteHitEvents.slice(-4).map((event) => ({
      type: "Hit",
      text: `${event.label} @ beat ${event.scheduledBeat}`,
    })),
    ...syncDebug.noteStrikeEvents.slice(-4).map((event) => ({
      type: "Strike",
      text: `${event.label} @ beat ${event.scheduledBeat}`,
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

function nearestTickForHit(hit) {
  return syncDebug.metronomeEvents.reduce((closest, tick) => {
    const delta = Math.abs(tick.beat - hit.scheduledBeat);
    const timingDeltaMs = tick.performanceMs - hit.performanceMs;
    const score = Math.abs(delta) * 100000 + Math.abs(timingDeltaMs);
    return !closest || score < closest.score
      ? { tick, score, beatDelta: delta, timingDeltaMs }
      : closest;
  }, null);
}

function syncPairs() {
  return syncDebug.noteStrikeEvents.map((hit) => {
    const nearest = nearestTickForHit(hit);
    return {
      hit,
      tick: nearest?.tick || null,
      timingDeltaMs: nearest ? Number(nearest.timingDeltaMs.toFixed(2)) : null,
      beatDelta: nearest ? Number(nearest.beatDelta.toFixed(4)) : null,
    };
  });
}

function isBeatAlignedHit(event) {
  return Math.abs(event.scheduledBeat - Math.round(event.scheduledBeat)) < 0.001;
}

function buildSyncReport() {
  const run = syncDebug.currentRun;
  const settings = run?.settings || runSettings();
  const pairs = syncPairs().filter((pair) => pair.tick);
  const beatAlignedPairs = pairs.filter((pair) => isBeatAlignedHit(pair.hit) && pair.beatDelta === 0);
  const offBeatHits = syncDebug.noteHitEvents.filter((event) => !isBeatAlignedHit(event));
  const tickIntervals = syncDebug.metronomeEvents.slice(1).map((tick, index) => {
    const previous = syncDebug.metronomeEvents[index];
    return tick.performanceMs - previous.performanceMs;
  });
  const averageTickInterval =
    tickIntervals.length > 0
      ? tickIntervals.reduce((sum, value) => sum + value, 0) / tickIntervals.length
      : 0;
  const expectedInterval = 60000 / settings.bpm;
  const maxSyncDelta = beatAlignedPairs.length
    ? Math.max(...beatAlignedPairs.map((pair) => Math.abs(pair.timingDeltaMs)))
    : 0;
  const countHits = syncDebug.noteHitEvents.filter((event) => event.kind === "count-in");
  const summary =
    pairs.length > 0 && beatAlignedPairs.length >= 5
      ? "PASS: metronome ticks and beat-aligned hit-zone entries are driven from the same playhead clock."
      : "CHECK: not enough matched tick/hit evidence has been captured yet.";

  const lines = [
    "# Tab Highway Sync Debug Report",
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
    `- Backing track rendered: ${settings.sourceIgnoredBackingTrack ? "no" : "unknown"}`,
    `- Count-in beats: ${settings.countInBeats}`,
    `- Metronome sound: ${settings.metronomeSound}`,
    `- Click source: ${settings.clickSource}`,
    `- Horizon beats: ${settings.horizonBeats}`,
    `- Empty runway beats: ${settings.emptyRunwayBeats}`,
    `- Hit-zone window beats: ${settings.hitZoneWindowBeats}`,
    `- Strike sync window beats: ${settings.strikeSyncWindowBeats}`,
    "",
    "## Proof Points",
    `- Metronome ticks captured: ${syncDebug.metronomeEvents.length}`,
    `- Hit-zone entries captured: ${syncDebug.noteHitEvents.length}`,
    `- Strike sync entries captured: ${syncDebug.noteStrikeEvents.length}`,
    `- Count-in hits captured: ${countHits.map((event) => event.label).join(", ") || "none"}`,
    `- Expected tick interval: ${expectedInterval.toFixed(2)} ms`,
    `- Average captured tick interval: ${averageTickInterval.toFixed(2)} ms`,
    `- Matched beat-aligned tick/hit pairs: ${beatAlignedPairs.length}`,
    `- Off-beat note entries captured separately: ${offBeatHits.length}`,
    `- Max tick-to-hit timestamp delta among beat-aligned pairs: ${maxSyncDelta.toFixed(2)} ms`,
    "",
    "## Beat-Aligned Tick / Hit Samples",
  ];

  for (const pair of beatAlignedPairs.slice(0, 12)) {
    lines.push(
      `- Beat ${pair.tick.beat}: tick ${pair.tick.timestampIso} | hit ${pair.hit.label} at ${pair.hit.timestampIso} | delta ${pair.timingDeltaMs} ms`
    );
  }

  lines.push("", "## Off-Beat Hit-Zone Entries");
  for (const hit of offBeatHits.slice(0, 12)) {
    lines.push(
      `- ${hit.label} scheduledBeat=${hit.scheduledBeat} time=${hit.timestampIso}`
    );
  }

  lines.push("", "## Recent Metronome Ticks");
  for (const tick of syncDebug.metronomeEvents.slice(-12)) {
    lines.push(
      `- Beat ${tick.beat} (${tick.bar}:${tick.beatInBar}) accent=${tick.accent} hitNotes=${tick.hitNotes.join(", ") || "none"} time=${tick.timestampIso}`
    );
  }

  lines.push("", "## Recent Hit-Zone Entries");
  for (const hit of syncDebug.noteHitEvents.slice(-12)) {
    lines.push(
      `- ${hit.label} kind=${hit.kind} scheduledBeat=${hit.scheduledBeat} rawBeat=${hit.rawBeat} y=${hit.screenYPercent}% time=${hit.timestampIso}`
    );
  }

  lines.push("", "## Recent Strike Sync Entries");
  for (const strike of syncDebug.noteStrikeEvents.slice(-12)) {
    lines.push(
      `- ${strike.label} kind=${strike.kind} scheduledBeat=${strike.scheduledBeat} rawBeat=${strike.rawBeat} y=${strike.screenYPercent}% time=${strike.timestampIso}`
    );
  }

  const report = lines.join("\n");
  syncDebug.latestReport = report;
  window.__latestSyncReport = report;
  return report;
}

window.buildSyncReport = buildSyncReport;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

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

function distanceToNote(note, playhead) {
  if (note.isCount) {
    return playhead < 0 ? note.beat - playhead : Number.POSITIVE_INFINITY;
  }

  let distance = note.beat - playhead;
  if (playhead >= 0 && distance < -songEndBeat / 2) distance += songEndBeat;
  if (playhead >= 0 && distance > songEndBeat / 2) distance -= songEndBeat;
  return distance;
}

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
      ? HIT_Y - distance * ((HIT_Y - TOP_Y) / HORIZON_BEATS)
      : HIT_Y - distance * 22;
  const progress = Math.max(0, Math.min(1, (y - TOP_Y) / (HIT_Y - TOP_Y)));
  const scale = Math.max(0.42, Math.min(1.12, 0.42 + progress * 0.72));
  const x = xFar + (xNear - xFar) * progress;

  return {
    x,
    y,
    scale,
    isVisible:
      distance >= -0.12 &&
      distance <= HORIZON_BEATS &&
      y >= TOP_Y &&
      y < 96,
    isHit: Math.abs(distance) < HIT_ZONE_WINDOW_BEATS,
    isStrike: Math.abs(distance) < STRIKE_SYNC_WINDOW_BEATS,
  };
}

function positionForNote(note, playhead) {
  const distance = distanceToNote(note, playhead);
  const position = positionForDistance(
    distance,
    note.isCount ? 50 : stringPositions[note.string],
    note.isCount ? 50 : stringBackPositions[note.string]
  );
  const baseWidth = note.isCount ? 94 : 64;
  const durationHeight = QUARTER_NOTE_HEIGHT * durationBeats(note) * position.scale;

  return {
    ...position,
    size: baseWidth * position.scale,
    durationHeight,
  };
}

function visibleMeasureLines(playhead) {
  const lines = [];

  for (let beat = 0; beat < songEndBeat; beat += 4) {
    let distance = beat - playhead;
    if (playhead >= 0 && distance < -songEndBeat / 2) distance += songEndBeat;
    if (playhead >= 0 && distance > songEndBeat / 2) distance -= songEndBeat;
    const pos = positionForDistance(distance, 50, 50);
    if (!pos.isVisible) continue;
    const label = beat === 0 ? "Bar 1" : `Bar ${Math.floor(beat / 4) + 1}`;
    lines.push({
      beat,
      label,
      y: pos.y,
      scale: pos.scale,
    });
  }

  return lines;
}

function applySongData(payload) {
  if (!payload?.notes?.length) return;
  sourceMetadata = {
    ...sourceMetadata,
    ...payload.source,
  };
  songNotes = payload.notes.map((note) => ({
    string: note.string,
    fret: note.fret,
    beat: note.beat,
    durationBeats: note.durationBeats,
    sourceMeasure: note.sourceMeasure,
    measure: note.measure,
    beatInMeasure: note.beatInMeasure,
    pickStroke: note.pickStroke,
    gpString: note.gpString,
    midi: note.midi,
  }));
  timelineNotes = [...countInNotes, ...songNotes];
  songEndBeat = Math.max(
    4,
    Math.ceil(Math.max(...songNotes.map((note) => note.beat + durationBeats(note))) / 4) * 4
  );
  fileName.textContent = sourceMetadata.file || "Hand Sync pt1 + BT.gp";
  if (sourceMetadata.tempo) {
    tempo.value = sourceMetadata.tempo;
    tempoValue.textContent = `${tempo.value} BPM`;
  }
  render(pausedAt);
  updateDebugPanel();
}

async function loadDefaultGpData() {
  try {
    const response = await fetch(DEFAULT_GP_NOTES_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    applySongData(await response.json());
  } catch (error) {
    console.warn("Using fallback note data because GP note JSON was not loaded.", error);
  }
}

function activeNote(playhead) {
  return timelineNotes.reduce((closest, note) => {
    const delta = Math.abs(distanceToNote(note, playhead));
    return !closest || delta < closest.delta ? { note, delta } : closest;
  }, null).note;
}

function render(playhead = pausedAt, rawBeat = playhead) {
  notesLayer.innerHTML = "";
  hitTargets.forEach((target) => target.classList.remove("is-active"));
  const active = activeNote(playhead);
  const currentHitKeys = new Set();
  const currentStrikeKeys = new Set();
  const visibleHitNotes = [];

  nowPlaying.textContent =
    playhead < START_BEAT - HORIZON_BEATS
      ? "Ready"
      : active.isCount
        ? `Count-in ${active.count}`
        : `String ${laneLabels[active.string]} - Fret ${active.fret} - ${durationLabel(active)}`;

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
    element.className = `note${note.isCount ? " is-count" : ""}${pos.isHit ? " is-hit" : ""}`;
    if (pos.isHit) {
      if (note.isCount) hitTargets.forEach((target) => target.classList.add("is-active"));
      else hitTargets[note.string - 1]?.classList.add("is-active");
      const meta = noteMetadata(note, playhead, rawBeat, pos);
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
  updateDebugPanel(rawBeat);
}

function ensureAudioContext() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  debugAudioDestination ||= audioContext.createMediaStreamDestination();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function connectToOutputs(node) {
  node.connect(audioContext.destination);
  if (debugAudioDestination) {
    node.connect(debugAudioDestination);
  }
}

function playBuiltInClick(accent = false) {
  const context = ensureAudioContext();
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
  gain.gain.setValueAtTime(0.2, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.075);
  oscillator.connect(gain);
  tick.connect(gain);
  connectToOutputs(gain);
  oscillator.start();
  tick.start();
  oscillator.stop(context.currentTime + 0.08);
  tick.stop(context.currentTime + 0.08);

  if (accent) {
    accentGain.gain.setValueAtTime(0.1, context.currentTime);
    accentGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
    accentPing.connect(accentGain);
    connectToOutputs(accentGain);
    accentPing.start();
    accentPing.stop(context.currentTime + 0.1);
  }
}

function playSelectedClick(accent = false) {
  const context = ensureAudioContext();
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = metronomeBuffer;
  gain.gain.value = 1;
  source.connect(gain);
  connectToOutputs(gain);
  source.start();

  if (accent) playBuiltInClick(true);
}

function playMetronomeClick(beat) {
  const accent = beat % 4 === 0;
  const position = timeSignaturePosition(beat);
  const hitNotes = syncDebug.visibleHitNotes.map((note) => note.label);
  syncDebug.metronomeEvents.push({
    ...eventBase(),
    eventType: "metronome-tick",
    beat,
    ...position,
    accent,
    bpm: Number(tempo.value),
    sourceFile: fileName.textContent,
    metronomeSound: metronomeName.textContent,
    hitNotes,
    hitNoteMetadata: syncDebug.visibleHitNotes,
  });
  updateDebugPanel();
  if (metronomeBuffer) {
    playSelectedClick(accent);
    return;
  }

  playBuiltInClick(accent);
}

function updateMetronome(rawBeat) {
  const currentBeat = Math.floor(rawBeat + 0.0001);
  if (lastMetronomeBeat === null) {
    lastMetronomeBeat = currentBeat - 1;
  }

  while (lastMetronomeBeat < currentBeat) {
    lastMetronomeBeat += 1;
    if (lastMetronomeBeat >= START_BEAT) {
      playMetronomeClick(lastMetronomeBeat);
    }
  }
}

function tick() {
  const bpm = Number(tempo.value);
  const context = ensureAudioContext();
  const elapsedBeats = (context.currentTime - startedAtAudio) * (bpm / 60);
  const rawBeat = pausedAt + elapsedBeats;
  const playhead = normalizePlaybackBeat(rawBeat);
  currentPlayhead = playhead;
  render(currentPlayhead, rawBeat);
  updateMetronome(rawBeat);
  rafId = requestAnimationFrame(tick);
}

fileInput.addEventListener("change", async () => {
  const selected = fileInput.files?.[0];
  if (!selected) return;
  fileName.textContent = selected.name;
  if (selected.name.toLowerCase().endsWith(".json")) {
    try {
      applySongData(JSON.parse(await selected.text()));
    } catch (error) {
      console.warn("Selected JSON was not valid GP note data.", error);
    }
  }
  updateDebugPanel();
});

metronomeFile.addEventListener("change", async () => {
  const selected = metronomeFile.files?.[0];
  if (!selected) return;
  const context = ensureAudioContext();
  metronomeName.textContent = "Loading...";
  try {
    const buffer = await selected.arrayBuffer();
    metronomeBuffer = await context.decodeAudioData(buffer);
    metronomeName.textContent = selected.name;
  } catch {
    metronomeBuffer = null;
    metronomeName.textContent = "Built-in click";
  }
  updateDebugPanel();
});

playPause.addEventListener("click", () => {
  isPlaying = !isPlaying;
  playPause.classList.toggle("is-playing", isPlaying);
  playPause.setAttribute("aria-label", isPlaying ? "Pause" : "Play");

  if (isPlaying) {
    const context = ensureAudioContext();
    if (rafId) cancelAnimationFrame(rafId);
    startSyncRun();
    startedAtAudio = context.currentTime;
    lastMetronomeBeat = null;
    rafId = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(rafId);
    rafId = 0;
    pausedAt = currentPlayhead;
    lastMetronomeBeat = null;
    render(pausedAt);
  }
});

restart.addEventListener("click", () => {
  pausedAt = PLAY_START_BEAT;
  currentPlayhead = pausedAt;
  if (isPlaying) {
    startSyncRun();
    startedAtAudio = ensureAudioContext().currentTime;
    lastMetronomeBeat = null;
  }
  render(pausedAt);
});

tempo.addEventListener("input", () => {
  tempoValue.textContent = `${tempo.value} BPM`;
  updateDebugPanel();
});

generateReport.addEventListener("click", () => {
  debugReport.textContent = buildSyncReport();
});

render();
updateDebugPanel();
loadDefaultGpData();
