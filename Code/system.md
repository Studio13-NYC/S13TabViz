# Lukas+S13 System

This prototype turns Guitar Pro note data into a Rocksmith-style highway. The current default source is `Hand Sync pt1 + BT.gp`; GPIF score data drives the note highway, and embedded or paired backing audio is optional playback audio.

## Current Source Truth

- Input source folder: `data/input/`
- Default source file: `data/input/Hand Sync pt1 + BT.gp`
- Extracted runtime data: `data/input/processed/hand-sync-pt1-notes.json`
- Input manifest: `data/input/index.json`
- Optional Azure config: `data/input/azure-config.json`
- Extractor: `tools/extract_gp_notes.py`
- App entry point: `index.html`
- Runtime code: `app.js`
- Styling: `styles.css`

The GP file is a GP8 zip package. The extractor reads `Content/score.gpif` for note timing and copies the referenced `Content/Assets/*` backing track into `data/` for optional mixer playback. Browser uploads can also pair a separate audio file with the notation source.

The current extraction confirms:

- 48 playable measures
- 384 notes
- 8 note attacks per measure
- duration value is always `0.125` whole-note units
- every measure is `1.0` whole-note units of eighth notes
- backing metadata points to `data/input/processed/hand-sync-pt1-backing.mp3`

## Data Pipeline

1. `tools/extract_gp_notes.py` opens `Hand Sync pt1 + BT.gp` as a zip by default. It also accepts `--source` and `--out` for other GP8 packages.
2. It reads `Content/score.gpif`.
3. It builds lookup tables for rhythms, notes, beats, voices, and bars.
4. It converts GPIF strings to UI strings where `1` is high e and `6` is low E.
5. It copies the embedded backing audio to `data/input/processed/*-backing.*` when present.
6. It writes prepared notes JSON to `data/input/processed/*-notes.json`.
7. `app.js` loads that JSON from `DEFAULT_GP_NOTES_URL`. The browser file picker can also load extracted JSON, raw `.gpif` XML, or packaged GP8 `.gp` files, and it can pair one source file with one `.mp3`, `.ogg`, `.wav`, or `.m4a` backing audio file selected at the same time.
8. `applySongData()` replaces fallback notes with extracted GP notes and sets tempo/source/backing metadata.
9. `loadSourceLibrary()` reads `data/input/index.json`, optionally merges Azure Blob Storage entries under `input/`, and populates the saved-source picker.
9. `render()` draws the highway from `timelineNotes`.

The JSON payload has:

- `source`: file, title, tempo, time signature, timing-source label, and optional backing-track metadata.
- `summary`: counts and validation facts from extraction.
- `sections`: labels found in GPIF free text.
- `measures`: per-measure duration/count summaries.
- `notes`: the actual renderable notes.

## Runtime Concepts

The system uses whole-note units as the single timing unit. A whole note is `1.0`, so fractional notes keep their literal musical value.

- Whole note: `1`
- Half note: `0.5`
- Quarter note: `0.25`
- Eighth note: `0.125`
- Eighth-note triplet: `1/12` (`0.083333`)
- Sixteenth note: `0.0625`

The metronome clicks on quarter-note grid positions: every `0.25` units. Guitar notes can happen on subdivisions, so for eighth notes the metronome naturally clicks on every other note. For eighth-note triplets, GPIF tuplets are converted with `denominator / numerator`, so an eighth-note triplet is `0.125 * 2 / 3 = 1/12`.

The count-in is four quarter notes from position `-1.0` through `-0.25`. Playback starts at position `-2.0`, so Count 1 appears from the horizon and the first metronome click happens immediately when the user presses play. The song starts at position `0`.

## Main App Functions

`normalizePlaybackPosition(position)`
Loops playback after the extracted song length while preserving negative count-in space.

`timeSignaturePosition(position)`
Converts a position into 4/4 bar and quarter-position metadata for reports and metronome events.

`durationUnits(note)` and `durationLabel(note)`
Normalize note duration and produce labels like `eighth`, `quarter`, or `eighth-triplet`.

`noteMetadata(note, playhead, rawPosition, pos)`
Builds the debug event payload for notes entering the hit zone and strike-sync window.

`runSettings()`
Captures run-level metadata for sync reports: source file, BPM, metronome source, backing state, mixer gains, count-in, hit window, and duration scale.

`startSyncRun()`
Creates a new debug run and clears prior tick/hit/strike events.

`eventBase()`
Adds shared timing metadata to debug events: ISO timestamp, `performance.now()`, and audio context time.

`logNoteHit(noteMeta)`
Records when a note enters the wider hit-zone window.

`logNoteStrike(noteMeta)`
Records when a note enters the tighter strike-sync window used for metronome alignment proof.

`updateDebugPanel()`
Refreshes the permanent in-app sync debug panel.

`nearestTickForHit()`, `syncPairs()`, and `isQuarterAlignedHit()`
Pair strike-sync entries with metronome ticks for timing reports. Off-quarter-grid notes are kept separate so eighth-note passages do not look like failed quarter-note metronome sync.

`buildSyncReport()`
Creates the Markdown report shown in the app and returned to Playwright. It summarizes settings, tick cadence, hit entries, strike entries, and proof samples.

`positionForDistance(distance, xNear, xFar)`
Projects beat distance into the highway perspective. Notes and measure lines both use this math.

`positionForNote(note, playhead)`
Computes x/y position, perspective scale, hit state, strike-sync state, and duration-proportional block height.

`visibleMeasureLines(playhead)`
Creates moving measure-line positions so bar boundaries scroll with notes and arrive at the hit zone in time.

`applySongData(payload)`
Applies extracted GP note JSON to the runtime. This is where fallback demo notes are replaced.

`loadDefaultGpData()`
Fetches `data/input/processed/hand-sync-pt1-notes.json` on startup and points the default backing URL at `data/input/processed/hand-sync-pt1-backing.mp3`.

`parseGpifText(xmlText, fileLabel)`
Parses raw GPIF XML selected in the browser into the same renderable payload shape as the Python extractor.

`parseGpPackage(file)`, `extractZipEntry()`, `inflateZipEntry()`, and `findZipEndOfCentralDirectory()`
Read a selected GP8 `.gp` package, extract `Content/score.gpif`, and pass the score XML through the normal GPIF parser. These helpers were added instead of a JSZip dependency so the static app can support `.gp` input without a build step.

`loadSourceLibrary()`, `loadSourceEntry()`, `handleSelectedSourceFiles()`, and `storeProcessedAssets()`
Manage the saved-source picker, manual source uploads, paired audio uploads, prepared notes/backing assets, and optional Azure Blob Storage persistence. Browser uploads use scoped container SAS URLs when configured; source and audio files are written under `input/` and prepared files under `input/processed/`.

`activeNote(playhead)`
Finds the nearest note for the status display.

`render(playhead, rawPosition)`
The main drawing pass. It clears the notes layer, draws measure lines, draws visible notes, updates hit-zone animation, logs debug events, and refreshes the debug panel.

`ensureAudioContext()`
Creates or resumes Web Audio and creates the internal debug audio destination.

`connectToOutputs(node)`
Routes app-generated audio into the click or backing mixer bus and then to speakers/debug capture.

`ensureMixerBuses()`, `updateMixerState()`, and `equalPowerMixerGains()`
Maintain separate click/backing gain busses and apply the equal-power crossfade. If backing is unavailable or toggled off, click gain returns to `1`.

`loadBackingTrack()`, `startBackingTrack()`, `stopBackingTrack()`, and `updateBackingPlaybackRate()`
Prepare optional backing audio in a reusable `HTMLAudioElement`, enable browser pitch preservation, start it at song position `0` after count-in, skip the exported GP source-measure pre-roll, stop it on pause/restart/toggle-off, and keep the media tempo ratio aligned to the active tempo.

`expectedBackingMediaTime()` and `correctBackingDrift()`
Compare the backing media element's current time against the visual playhead's expected native-tempo media offset, then lightly seek back into alignment if drift becomes meaningful.

`playBuiltInClick(accent, when)`
Generates the built-in metronome click at a scheduled Web Audio time. The first quarter-note position of each bar is accented.

`playSelectedClick(accent, when)`
Plays a user-selected WAV for the metronome click at a scheduled Web Audio time. Accents add the built-in accent layer.

`playMetronomeClick(beat)`
Records the metronome event and plays the click.

`updateMetronome(rawPosition)`
Schedules quarter-note clicks from raw playhead time with a short Web Audio lookahead. This is intentionally independent of note density.

`tick()`
Animation-frame loop. Converts Web Audio elapsed seconds into whole-note units, renders the frame, updates metronome ticks, and schedules the next frame.

## Extractor Functions

`text()` and `child_text()`
Small XML text helpers.

`property_node()` and `int_property()`
Read GPIF `<Property>` values such as string, fret, and MIDI number.

`rhythm_duration_units()`
Converts GPIF rhythm values into whole-note unit lengths. It handles note value, dots, and tuplets.

`main()`
Reads GPIF, builds the renderable note payload, copies optional backing-track audio, writes JSON, and prints the extraction summary.

## Test Infrastructure

The test infrastructure is intentionally file-based and browser-visible.

Primary tools:

- Playwright CLI wrapper: `C:\Users\NickKatsivelos\.codex\skills\playwright\scripts\playwright_cli.sh`
- Local HTTP server: Python `http.server` on `127.0.0.1:8765`
- Runtime artifacts: `output/playwright/`
- PDF inspection artifacts: `output/pdf/`
- FFmpeg for audio capture and muxing
- VB-CABLE for true system/browser audio capture

Important Playwright helper scripts:

- `output/playwright/verify-gp-source.js`
  Confirms the app loads `Hand Sync pt1 + BT.gp`, tempo `120`, 384 notes, all eighth notes, and backing metadata.

- `output/playwright/verify-duration-model.js`
  Verifies duration-to-block-height math at the hit zone.

- `output/playwright/verify-duration-measures.js`
  Verifies count-in/start state and measure lines during playback.

- `output/playwright/verify-duration-scale.js`
  Samples visible notes later in playback to compare displayed duration sizes.

- `output/playwright/capture-sync-browser-result.js`
  Runs playback, captures in-app audio, returns the sync report and event counts.

- `output/playwright/record-pause-audio-check.cjs`
  Runs a headed 10-second playback, pauses, keeps recording briefly, and writes video/audio/report artifacts for checking click timing and pause behavior.

- `output/playwright/list-audio-outputs.js`
  Lists browser audio input/output devices to confirm VB-CABLE availability.

- `output/playwright/play-tone-to-vbcable.js`
  Routes a browser tone to `CABLE Input` so FFmpeg can prove capture from `CABLE Output`.

- `output/playwright/play-tab-highway-short.js`
  Plays a short app run while system audio capture is active.

## Test Methodology

### Static Checks

Run JavaScript syntax check:

```powershell
node --check .\app.js
```

Refresh GP note data:

```powershell
python .\tools\extract_gp_notes.py
```

Extract another GP8 package:

```powershell
python .\tools\extract_gp_notes.py --source "..\Another Song.gp" --out ".\data\another-song-notes.json"
```

Expected extractor summary:

```json
{
  "measures": 48,
  "notes": 384,
  "firstPlayableSourceMeasure": 2,
  "durationValues": [0.125],
  "allEighthNotes": true,
  "allMeasuresEightNotes": true
}
```

### Visible Browser Testing

Open or reuse a headed browser:

```powershell
bash /mnt/c/Users/NickKatsivelos/.codex/skills/playwright/scripts/playwright_cli.sh -s=syncdebug open http://127.0.0.1:8765/index.html --headed
```

Confirm the session is headed:

```powershell
bash /mnt/c/Users/NickKatsivelos/.codex/skills/playwright/scripts/playwright_cli.sh list
```

Run GP source verification:

```powershell
bash /mnt/c/Users/NickKatsivelos/.codex/skills/playwright/scripts/playwright_cli.sh --raw -s=syncdebug run-code --filename output/playwright/verify-gp-source.js
```

Expected facts:

- label is `Hand Sync pt1 + BT.gp`
- tempo is `120`
- notes are `384`
- `allEighthNotes` is `true`
- `backingTrack.available` is `true`
- visible note durations are `eighth`

### Sync Debug Testing

The permanent sync debug panel records:

- run settings
- metronome tick events
- note hit-zone entries
- note strike-sync entries
- current visible hit-zone notes
- mixer/backing settings
- generated Markdown report

The report intentionally separates off-beat notes from beat-aligned proof points. In eighth-note material, off-beat notes are expected between metronome clicks.

### VB-CABLE Audio Testing

Use FFmpeg to list DirectShow devices and confirm:

```text
CABLE Output (VB-Audio Virtual Cable)
```

The proven route is:

```text
browser audio -> CABLE Input -> FFmpeg records CABLE Output
```

The tone proof artifact is:

```text
output/playwright/vbcable-browser-tone-capture.wav
```

The app proof artifact is:

```text
output/playwright/sync-debug-vbcable-system-audio.wav
```

The muxed video proof is:

```text
output/playwright/sync-debug-vbcable-headed-run-with-system-audio.webm
```

### Visual Artifacts

Useful current artifacts:

- `output/playwright/gp-source-eighth-notes.png`
- `output/playwright/duration-measure-lines.png`
- `output/playwright/sync-debug-vbcable-headed-run-with-system-audio.webm`
- `output/playwright/sync-debug-vbcable-report.md`

PDF render artifacts from the earlier sheet inspection:

- `output/pdf/hand-sync-pt1-render/page-1.png`
- `output/pdf/hand-sync-pt1-render/page-2.png`
- `output/pdf/hand-sync-pt1-render/page-3.png`

## Known Rules

- Do not render backing-track audio into the note highway.
- Use GPIF note timing as the authoritative source.
- Backing audio is optional playback through the mixer and begins at song position `0`, after count-in.
- The metronome clicks immediately on play, then quarter notes in 4/4.
- Eighth-note passages should show notes between metronome clicks.
- Measure lines scroll with the same projection math as notes.
- Note block height represents duration in whole-note units.

## Current Limitations

- The app loads pre-extracted JSON, raw `.gpif` XML, and packaged GP8 `.gp` files in the browser. The package path extracts `Content/score.gpif` and referenced embedded audio when available. A separate audio file can be selected with the source file during upload and is used as the backing track.
- Azure Blob Storage requires a container SAS URL with read/list/create/write permissions and CORS allowing the local and deployed app origins. The app deliberately does not store Azure account keys.
- GP5 binary files are visible as unsupported if selected, but the browser parser currently supports GP8 `.gp` packages, GPIF/XML, and prepared JSON.
- PDF selection is acknowledged, but timed note extraction from PDF tab/notation still needs a dedicated parser/OCR path before rendering.
- The extractor currently targets GP8 package shape and the primary guitar track.
- The UI is still a prototype and does not yet expose track selection or correction tools.
- Duration rendering is unit-proportional, but long sustained notes may need a more refined tail/hold visual later.
