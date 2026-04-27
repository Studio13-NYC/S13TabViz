# Lukas+S13

This is a first-screen visual prototype for a Guitar Pro-to-tab animation engine.

Open `index.html` in a browser and press play. The current build defaults to note timing extracted from `Hand Sync pt1 + BT.gp`; the embedded backing-track MP3 is copied into `data/` for optional playback, but GPIF notes remain the timing source.

Run `python tools/extract_gp_notes.py` after editing the default Guitar Pro file to refresh `data/hand-sync-pt1-notes.json`. To convert another GP8 package, run `python tools/extract_gp_notes.py --source path\to\file.gp --out data\file-notes.json`.

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
- The browser can load extracted note JSON, raw `.gpif` XML, and packaged GP8 `.gp` files. PDF selections are accepted but require a notation/tab extraction step before timed notes can render.
