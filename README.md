# Anleitung zur Nutzung der Multitrack‑Website

Diese kleine Web‑Anwendung ermöglicht dir, eigene Songs als Sammlung von fünf
Spuren zu präsentieren. Über Solo‑ und Mute‑Schalter kannst du einzelne
Instrumente isoliert anhören oder stumm schalten – ähnlich wie in einer
Digital Audio Workstation.

## Struktur der Website

- `index.html` – Die Startseite der Anwendung.
- `style.css` – Enthält grundlegende Gestaltung für das Layout.
- `player.js` – JavaScript‑Logik zum Laden und Abspielen der Spuren.
- `audio/` – Hier liegen die Audiodateien. Für jeden Song wird ein
  Unterordner angelegt (z.&nbsp;B. `audio/song1/`). In diesem Ordner liegen
  fünf Audiodateien im WAV‑ oder MP3‑Format:

  1. `drums.*` – Schlagzeug
  2. `guitars_piano.*` – Gitarren und Piano
  3. `synth.*` – Synthesizer
  4. `vocals.*` – Gesang
  5. `strings_brass.*` – Streicher und Bläser

- `README.md` – Diese Anleitung.

## Eigene Songs hinzufügen

1. Lege im Verzeichnis `audio/` für jeden neuen Song einen eigenen Ordner
   an (beispielsweise `song2`).
2. Kopiere deine fünf Spuren als WAV‑ oder MP3‑Dateien in diesen Ordner.
   Verwende dabei die gleichen Dateinamen wie im Beispiel (`drums.*`,
   `guitars_piano.*`, `synth.*`, `vocals.*`, `strings_brass.*`).
3. Öffne die Datei `player.js` in einem Texteditor und ergänze im Array
   `songs` einen weiteren Eintrag. Beispiel:

   ```js
   {
     title: 'Mein zweiter Song',
     tracks: [
       { name: 'Drums', url: 'audio/song2/drums.wav' },
       { name: 'Gitarre + Piano', url: 'audio/song2/guitars_piano.wav' },
       { name: 'Synth', url: 'audio/song2/synth.wav' },
       { name: 'Gesang', url: 'audio/song2/vocals.wav' },
       { name: 'Streicher & Bläser', url: 'audio/song2/strings_brass.wav' }
     ]
   }
   ```

   Achte darauf, dass der Dateiname (URL) dem tatsächlichen Pfad entspricht.

4. Speichere die Änderungen und lade die Seite neu. Dein neuer Song
   erscheint nun unter dem Beispiel.

## Hosting ohne monatliche Kosten

Da die Anwendung rein aus statischen Dateien besteht, kann sie problemlos
kostenlos gehostet werden. Zwei einfache Möglichkeiten:

### GitHub Pages

1. Erstelle kostenlos ein Konto bei [GitHub](https://github.com/).
2. Lege ein neues Repository (z.&nbsp;B. `musik-site`) an.
3. Lade alle Dateien aus dem Ordner `music_site/` in dieses Repository hoch.
4. Gehe im Repository zu **Settings → Pages** und wähle den Branch und den
   Ordner (meistens `main` und `/`) aus, der als Quelle dienen soll. Speichere
   diese Einstellung.
5. Nach wenigen Minuten ist deine Website unter der angegebenen GitHub‑Pages‑URL
   erreichbar (z.&nbsp;B. `https://deinname.github.io/musik-site/`).

### Lokaler Webserver

Wenn du die Seite nur lokal testen möchtest, benötigst du einen kleinen
Webserver, weil moderne Browser das Laden lokaler Audiodateien mittels
`fetch` auf `file://` nicht erlauben. Unter macOS, Linux oder Windows mit
Python genügt folgender Befehl im Terminal im Ordner `music_site/`:

```bash
python3 -m http.server 8000
```

Anschließend kannst du die Anwendung im Browser unter
`http://localhost:8000/index.html` öffnen. Zum Beenden des Servers drücke
`Strg`+`C` im Terminal.

## Hinweise

- Die Website nutzt die Web‑Audio‑API. Diese wird von den meisten
  modernen Desktop‑Browsern unterstützt. Auf manchen mobilen Geräten
  oder sehr alten Browsern kann es zu Einschränkungen kommen.
- Die Funktion „Pause“ funktioniert, indem alle Quellen gestoppt und bei
  erneutem „Play“ an der zuletzt abgespielten Position weitergespielt werden.
- Der Code ist bewusst einfach gehalten und kann nach Bedarf erweitert
  werden – etwa um zusätzliche Lautstärkeregler, eigene Farbschemata oder
  weitere Kontrollfunktionen.

Viel Spaß beim Musizieren!