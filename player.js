/*
 * Multitrack‑Player für den Browser
 *
 * Dieses Skript verwendet die Web‑Audio‑API, um mehrere Audio‑Dateien
 * synchron abzuspielen. Für jede Spur gibt es Solo‑ und Mute‑Tasten,
 * sodass einzelne Spuren isoliert wiedergegeben oder stummgeschaltet
 * werden können. Pro Song wird eine separate AudioContext‑Instanz
 * verwendet. Das Skript erzeugt die erforderlichen Elemente und
 * Event‑Handler dynamisch anhand der songs‑Konfiguration.
 */

// Konfiguration der Songs. Hier können beliebig viele Songs
// eingetragen werden. Jeder Song benötigt einen Titel und eine
// Liste von Spuren mit Name und Pfad zur Audiodatei.
const songs = [
  {
    title: 'Beispielsong',
    tracks: [
      { name: 'Drums', url: 'audio/song1/drums.wav' },
      { name: 'Gitarre + Piano', url: 'audio/song1/guitars_piano.wav' },
      { name: 'Synth', url: 'audio/song1/synth.wav' },
      { name: 'Gesang', url: 'audio/song1/vocals.wav' },
      { name: 'Streicher & Bläser', url: 'audio/song1/strings_brass.wav' }
    ]
  }
  // Weitere Songs können hier eingetragen werden
];

/**
 * Klasse zum Verwalten und Abspielen einer Sammlung von Audiospuren.
 */
class MultiTrackPlayer {
  /**
   * Erstellt einen neuen Player.
   * @param {HTMLElement} container Das DOM‑Element, in das der Player gerendert wird.
   * @param {Object} song Ein Song‑Objekt mit Titel und Track‑Liste.
   */
  constructor(container, song) {
    this.container = container;
    this.title = song.title;
    this.tracks = song.tracks;
    // Web‑Audio‑Kontext für diesen Player
    this.audioCtx = null;
    // Dekodierte Audiodaten
    this.buffers = new Array(this.tracks.length).fill(null);
    // Aktive BufferSourceNodes (werden bei jedem Play neu erzeugt)
    this.sources = [];
    // GainNodes pro Spur
    this.gainNodes = [];
    // Status pro Spur: mute/solo
    this.trackStates = this.tracks.map(() => ({ mute: false, solo: false }));
    // Wiedergabestatus
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseOffset = 0;
    // Elemente für Buttons, damit sie bei Statusänderung aktualisiert werden können
    this.playButton = null;
    this.pauseButton = null;
    this.stopButton = null;
    this.trackButtons = [];
    // Playeroberfläche erzeugen
    this.render();
    // Audiodaten laden und erst danach die Play‑Buttons aktivieren
    this.loadBuffers().then(() => {
      this.updateButtons();
    }).catch((err) => {
      console.error(err);
      this.showError('Fehler beim Laden der Audiodateien');
    });
  }

  /**
   * Lädt alle Audiodateien für die Spuren und dekodiert sie.
   * Gibt ein Promise zurück, das aufgelöst wird, sobald alle Spuren geladen sind.
   */
  async loadBuffers() {
    // AudioContext erst hier erzeugen, da Safari sonst eine Interaktion verlangt
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const promises = this.tracks.map((track, idx) => {
      return fetch(track.url).then(response => {
        if (!response.ok) {
          throw new Error(`Fehler beim Laden von ${track.url}: ${response.statusText}`);
        }
        return response.arrayBuffer();
      }).then(arrayBuffer => {
        return this.audioCtx.decodeAudioData(arrayBuffer);
      }).then(audioBuffer => {
        this.buffers[idx] = audioBuffer;
      });
    });
    await Promise.all(promises);
  }

  /**
   * Erstellt frische AudioBufferSourceNodes und GainNodes für die Wiedergabe.
   * @param {number} offset Sekunde, ab der die Wiedergabe startet (für Pause/Fortsetzen).
   */
  createSources(offset = 0) {
    // Alte Quellen beenden, falls vorhanden
    this.stopSources();
    this.sources = [];
    this.gainNodes = [];
    for (let i = 0; i < this.buffers.length; i++) {
      const source = this.audioCtx.createBufferSource();
      source.buffer = this.buffers[i];
      source.loop = false;
      const gainNode = this.audioCtx.createGain();
      // Initial gain wird später durch updateGains gesetzt
      gainNode.gain.value = 1;
      source.connect(gainNode).connect(this.audioCtx.destination);
      this.sources.push(source);
      this.gainNodes.push(gainNode);
    }
    this.updateGains();
    // Start der Quellen
    const now = this.audioCtx.currentTime;
    for (let i = 0; i < this.sources.length; i++) {
      try {
        this.sources[i].start(now, offset);
      } catch (err) {
        console.error('Error starting source', err);
      }
    }
  }

  /**
   * Stoppt alle aktuellen AudioBufferSourceNodes.
   */
  stopSources() {
    if (this.sources) {
      this.sources.forEach(source => {
        try {
          source.stop();
        } catch (e) {
          // schon gestoppt
        }
      });
    }
    this.sources = [];
  }

  /**
   * Berechnet die Lautstärken aller Spuren anhand der Solo‑/Mute‑Einstellungen.
   */
  updateGains() {
    // Gibt es mindestens eine Solo‑Spur?
    const anySolo = this.trackStates.some(state => state.solo);
    for (let i = 0; i < this.gainNodes.length; i++) {
      const state = this.trackStates[i];
      let gainValue = 1;
      if (anySolo) {
        // Wenn Solo aktiv, nur Solo‑Spuren abspielen
        gainValue = (state.solo && !state.mute) ? 1 : 0;
      } else {
        // Sonst Mute berücksichtigen
        gainValue = state.mute ? 0 : 1;
      }
      if (this.gainNodes[i]) {
        this.gainNodes[i].gain.setValueAtTime(gainValue, this.audioCtx.currentTime);
      }
    }
  }

  /**
   * Startet die Wiedergabe. Bei erneutem Aufruf wird ab der zuletzt gespeicherten Position weitergespielt.
   */
  play() {
    if (!this.buffers.every(buf => buf)) {
      return;
    }
    if (!this.isPlaying) {
      this.createSources(this.pauseOffset);
      this.startTime = this.audioCtx.currentTime - this.pauseOffset;
      this.isPlaying = true;
      this.updateButtons();
    }
  }

  /**
   * Pausiert die Wiedergabe und speichert die aktuelle Position.
   */
  pause() {
    if (this.isPlaying) {
      this.stopSources();
      this.pauseOffset = this.audioCtx.currentTime - this.startTime;
      this.isPlaying = false;
      this.updateButtons();
    }
  }

  /**
   * Stoppt die Wiedergabe und setzt die Position auf den Anfang zurück.
   */
  stop() {
    // Sowohl playing als auch pausiert: Quellen stoppen
    this.stopSources();
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.updateButtons();
  }

  /**
   * Schaltet den Mute‑Status einer Spur um.
   * @param {number} index Index der Spur im tracks‑Array.
   */
  toggleMute(index) {
    this.trackStates[index].mute = !this.trackStates[index].mute;
    // Wenn eine Spur gemutet wird, evtl. Solo‑Status anpassen?
    this.updateGains();
    this.updateTrackButtons(index);
  }

  /**
   * Schaltet den Solo‑Status einer Spur um.
   * @param {number} index Index der Spur im tracks‑Array.
   */
  toggleSolo(index) {
    this.trackStates[index].solo = !this.trackStates[index].solo;
    this.updateGains();
    // Solo‑Buttons der anderen Spuren aktualisieren, da sich deren Zustand auf die Darstellung auswirken kann
    for (let i = 0; i < this.trackStates.length; i++) {
      this.updateTrackButtons(i);
    }
  }

  /**
   * Aktualisiert die Darstellung der Steuer‑Buttons entsprechend dem Status.
   */
  updateButtons() {
    if (!this.playButton || !this.pauseButton || !this.stopButton) {
      return;
    }
    // Play aktivieren, sobald die Audiodateien geladen sind
    const ready = this.buffers.every(buf => buf);
    this.playButton.disabled = this.isPlaying || !ready;
    this.pauseButton.disabled = !this.isPlaying;
    this.stopButton.disabled = !ready;
  }

  /**
   * Aktualisiert die Darstellung der Solo/Mute‑Buttons für eine Spur.
   * @param {number} index Index der Spur
   */
  updateTrackButtons(index) {
    const state = this.trackStates[index];
    const btns = this.trackButtons[index];
    if (!btns) return;
    // Solo‑Button
    if (state.solo) {
      btns.solo.classList.add('active');
    } else {
      btns.solo.classList.remove('active');
    }
    // Mute‑Button
    if (state.mute) {
      btns.mute.classList.add('active');
    } else {
      btns.mute.classList.remove('active');
    }
  }

  /**
   * Fehlermeldung im Interface anzeigen.
   * @param {string} message
   */
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.background = '#ffcdd2';
    errorDiv.style.color = '#b71c1c';
    errorDiv.style.padding = '1rem';
    errorDiv.style.marginTop = '1rem';
    errorDiv.style.borderRadius = '4px';
    errorDiv.textContent = message;
    this.container.appendChild(errorDiv);
  }

  /**
   * Baut die DOM‑Struktur für den Player auf.
   */
  render() {
    // Hauptcontainer für den Song
    const wrapper = document.createElement('div');
    wrapper.className = 'song-container';
    // Titel
    const titleEl = document.createElement('h2');
    titleEl.className = 'song-title';
    titleEl.textContent = this.title;
    wrapper.appendChild(titleEl);
    // Steuerleiste
    const controls = document.createElement('div');
    controls.className = 'controls';
    // Play
    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => this.play());
    controls.appendChild(playBtn);
    this.playButton = playBtn;
    // Pause
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = 'Pause';
    pauseBtn.addEventListener('click', () => this.pause());
    controls.appendChild(pauseBtn);
    this.pauseButton = pauseBtn;
    // Stop
    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop';
    stopBtn.addEventListener('click', () => this.stop());
    controls.appendChild(stopBtn);
    this.stopButton = stopBtn;
    wrapper.appendChild(controls);
    // Trackliste
    const trackList = document.createElement('div');
    trackList.className = 'track-list';
    this.trackButtons = [];
    for (let i = 0; i < this.tracks.length; i++) {
      const track = this.tracks[i];
      const trackRow = document.createElement('div');
      trackRow.className = 'track';
      // Name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'track-name';
      nameSpan.textContent = track.name;
      trackRow.appendChild(nameSpan);
      // Buttons
      const btnContainer = document.createElement('div');
      btnContainer.className = 'track-buttons';
      // Solo
      const soloBtn = document.createElement('button');
      soloBtn.textContent = 'Solo';
      soloBtn.addEventListener('click', () => {
        this.toggleSolo(i);
      });
      btnContainer.appendChild(soloBtn);
      // Mute
      const muteBtn = document.createElement('button');
      muteBtn.textContent = 'Mute';
      muteBtn.addEventListener('click', () => {
        this.toggleMute(i);
      });
      btnContainer.appendChild(muteBtn);
      trackRow.appendChild(btnContainer);
      trackList.appendChild(trackRow);
      this.trackButtons[i] = { solo: soloBtn, mute: muteBtn };
    }
    wrapper.appendChild(trackList);
    this.container.appendChild(wrapper);
    // Buttons initial deaktivieren, bis Audiodaten geladen sind
    this.updateButtons();
  }
}

// Nach dem Laden des DOM alle Player instanziieren
document.addEventListener('DOMContentLoaded', () => {
  const playersContainer = document.getElementById('players');
  songs.forEach((song, idx) => {
    // Wrapper für jeden Song erzeugen
    const songDiv = document.createElement('div');
    playersContainer.appendChild(songDiv);
    new MultiTrackPlayer(songDiv, song);
  });
});