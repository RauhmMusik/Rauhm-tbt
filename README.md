# Multitrack‑Player mit Timebar (Seek)
- 5 Spuren je Song (Drums, Gitarren+Piano, Synth, Vocals, Streicher/Bläser)
- Solo/Mute je Spur, Lautstärke je Spur
- **Timebar zum Springen** innerhalb des Songs (vor/zurück)

## Dateien
- `index.html` – UI und Grundgerüst
- `style.css` – schlichtes Dark‑Theme
- `player.js` – Web‑Audio‑Logik (Laden, Play/Pause/Stop, Solo/Mute, Seek)
- `audio/song1/...` – Beispiel‑Ordner; ersetze die Dateien durch deine echten Stems

## Eigene Songs
Lege für jeden Song einen Ordner unter `audio/` mit **genau fünf** Dateien an und passe im `player.js` im `SONGS`‑Array die Pfade an.

## Manifest (keine Code-Änderungen mehr)
Songs werden aus `audio/manifest.json` geladen. Für jeden Song ein Eintrag:
```json
{
  "id": "song2",
  "title": "Mein neuer Song",
  "stems": [
    {"name": "Drums", "file": "audio/song2/drums.wav"},
    {"name": "Gitarren + Piano", "file": "audio/song2/guitars_piano.wav"},
    {"name": "Synth", "file": "audio/song2/synth.wav"},
    {"name": "Vocals", "file": "audio/song2/vocals.wav"},
    {"name": "Streicher & Bläser", "file": "audio/song2/strings_brass.wav"}
  ]
}
```
Einfach Ordner `audio/song2/` mit 5 Dateien anlegen und den Block in `manifest.json` ergänzen – fertig.
