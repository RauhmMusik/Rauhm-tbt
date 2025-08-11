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

## Hosting
Statisch, daher kostenlos über z. B. GitHub Pages. Lade den **Inhalt** dieses Ordners in dein Repo‑Root hoch (inkl. `audio/`) und aktiviere Pages (Branch: `main`, Folder: `/`).