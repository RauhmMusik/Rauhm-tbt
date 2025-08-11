# Multitrack‑Player – Auto-Scan (kein Manifest)
- Keine Code‑ oder JSON‑Änderungen nötig.
- Lege einfach Ordner `audio/song-1`, `audio/song-2`, … an.
- In jeden Ordner gehören genau 5 Dateien mit **fixen Namen**:
  - `drums.wav`
  - `guitars_piano.wav`
  - `synth.wav`
  - `vocals.wav`
  - `strings_brass.wav`

Die Seite erkennt beim Laden automatisch vorhandene Songs (scannt `song-1` bis `song-200`).

**Hinweise**
- Pfade/Schreibweise sind case‑sensitive.
- Andere Dateiformate (mp3/ogg) gehen, wenn du die Namen entsprechend anpasst und im Code änderst – für „no‑code“ bleib bei `.wav` und den festen Dateinamen.
- GitHub Pages braucht nach Upload 1–2 Minuten. Danach Seite hart neu laden (Cmd/Ctrl‑Shift‑R).
