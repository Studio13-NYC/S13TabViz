# Lukas+S13

This is a first-screen visual prototype for a Guitar Pro-to-tab animation engine.

Open `index.html` in a browser and press play. The current build defaults to note timing extracted from `data/input/Hand Sync pt1 + BT.gp`; prepared files live in `data/input/processed/`, but GPIF notes remain the timing source.

Put source `.gp` files in `data/input/` and prepared runtime assets in `data/input/processed/`. Run `python tools/extract_gp_notes.py --source data\input\Your Song.gp --out data\input\processed\your-song-notes.json` when you want to pre-process a GP8 package for the picker. Browser uploads can also process GP8 `.gp` packages from their actual file contents; if Azure Blob Storage is configured in `data/input/azure-config.json` or `localStorage`, uploaded source files go to `input/` and prepared JSON/backing assets go to `input/processed/`.

Core visual direction:

- A clean six-string vertical highway inspired by note-lane rhythm games.
- Guitar Pro/GPIF note data is the timing source; backing-track audio is optional playback only.
- Colored string lanes and large fret-number blocks for fast reading.
- Notes fall down their assigned string toward a clearly marked hit zone.
- Note block height is proportional to duration in whole-note units: whole `1`, half `.5`, quarter `.25`, eighth `.125`, and eighth-note triplet `1/12`.
- Measure lines scroll with the note highway so bar boundaries arrive at the hit zone in time.
- Notes and hit targets pulse when the note enters the playable zone.
- Tempo control is expressed in quarter-note BPM while the internal timeline uses whole-note units.
- The metronome clicks immediately when play is pressed, then every quarter-note beat in 4/4, with beat 1 accented.
- Note-hit animation and metronome clicks are driven from the same playhead clock.
- A selected metronome WAV is decoded once and replayed on each beat for reliable repeated clicks.
- The backing toggle enables/disables the backing track, and the mixer slider crossfades between click and backing.
- Backing-track tempo changes use browser media playback with pitch preservation enabled, so practice BPM changes should not transpose the track.
- The default backing MP3 contains one exported GP source measure before the first playable measure, so playback skips that pre-roll when song position `0` starts.
- The count-in is a single measure before the song starts, and the count blocks enter from the horizon.
- Playback starts before Count 1 reaches the hit zone so the player hears clicks immediately and sees the blocks travel in.
- Count-in notes scroll through the transparent hit-zone outlines, then disappear after the song starts.
- The visualization uses the main workspace width so the note highway stays dominant.
- Permanent sync debug captures run settings, metronome ticks, hit-zone note entries, and a generated proof report for timing checks.
- The browser can pick saved sources from `data/input/index.json`, load extracted note JSON, load raw `.gpif` XML, and process packaged GP8 `.gp` files. PDF selections are accepted but require a notation/tab extraction step before timed notes can render.
