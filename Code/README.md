# Tab Highway Prototype

This is a first-screen visual prototype for a Guitar Pro-to-tab animation engine.

Open `index.html` in a browser and press play. The current build defaults to note timing extracted from `Hand Sync pt1 + BT.gp`. The embedded backing-track MP3 in the GP package is ignored and is not rendered into the highway.

Run `python tools/extract_gp_notes.py` after editing the Guitar Pro file to refresh `data/hand-sync-pt1-notes.json`.

Core visual direction:

- A clean six-string vertical highway inspired by note-lane rhythm games.
- Guitar Pro/GPIF note data is the timing source; backing-track assets are excluded.
- Colored string lanes and large fret-number blocks for fast reading.
- Notes fall down their assigned string toward a clearly marked hit zone.
- Note block height is proportional to duration in beats: whole, half, quarter, eighth, and triplet eighth values use the same beat scale.
- Measure lines scroll with the note highway so bar boundaries arrive at the hit zone in time.
- Notes and hit targets pulse when the note enters the playable zone.
- Tempo control is expressed in beats per minute.
- The metronome clicks every quarter-note beat in 4/4, with beat 1 accented.
- Note-hit animation and metronome clicks are driven from the same playhead clock.
- A selected metronome WAV is decoded once and replayed on each beat for reliable repeated clicks.
- The count-in is a single measure before the song starts.
- The highway starts empty; count-in and song notes enter from over the horizon after playback begins.
- Count-in notes disappear completely after the song starts.
- The visualization uses the main workspace width so the note highway stays dominant.
- Permanent sync debug captures run settings, metronome ticks, hit-zone note entries, and a generated proof report for timing checks.
