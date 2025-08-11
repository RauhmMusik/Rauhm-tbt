// Multitrack-Player mit Timebar (Web Audio API)
(() => {
  const tracksEl = document.getElementById('tracks');
  const seekEl = document.getElementById('seek');
  const curEl = document.getElementById('cur');
  const durEl = document.getElementById('dur');
  const songSelect = document.getElementById('songSelect');
  const btnPlay = document.getElementById('btnPlay');
  const btnPause = document.getElementById('btnPause');
  const btnStop = document.getElementById('btnStop');

  // --- Songs konfigurieren (einfach erweiterbar) ---
  // Ersetze die .wav/.mp3-Dateien durch deine echten Stems.
  const SONGS = [
    {
      id: 'song1',
      title: 'Beispiel‑Song 1',
      // Reihenfolge und Beschriftung fix gemäß Wunsch
      stems: [
        { name: 'Drums',           file: 'audio/song1/drums.wav' },
        { name: 'Gitarren + Piano',file: 'audio/song1/guitars_piano.wav' },
        { name: 'Synth',           file: 'audio/song1/synth.wav' },
        { name: 'Vocals',          file: 'audio/song1/vocals.wav' },
        { name: 'Streicher & Bläser', file: 'audio/song1/strings_brass.wav' },
      ]
    }
  ];

  // --- Player-State ---
  let audioCtx;                   // AudioContext
  let masterGain;                 // Master-Gain (für künftige Erweiterungen)
  let currentSong = null;         // Objekt aus SONGS
  let buffers = [];               // AudioBuffer je Spur
  let gains = [];                 // GainNode je Spur
  let sources = [];               // laufende BufferSourceNodes
  let muted = [];                 // booleans
  let solo = [];                  // booleans
  let volumes = [];               // 0..1

  let duration = 0;               // Sekunden
  let playing = false;
  let startTimestamp = 0;         // audioCtx.currentTime zum Start
  let offset = 0;                 // aktuelle Startposition beim (Re)Start

  // --- Hilfsfunktionen ---
  const fmt = (sec) => {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  function ensureCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(audioCtx.destination);
    }
  }

  async function loadSong(song) {
    ensureCtx();
    currentSong = song;
    // Stop evtl. laufende Wiedergabe
    hardStop();

    // Laden
    buffers = [];
    const decodes = song.stems.map(async stem => {
      const res = await fetch(stem.file);
      if (!res.ok) throw new Error(`Konnte Datei nicht laden: ${stem.file}`);
      const arr = await res.arrayBuffer();
      return await audioCtx.decodeAudioData(arr.slice(0));
    });
    buffers = await Promise.all(decodes);
    duration = Math.max(...buffers.map(b => b.duration));
    durEl.textContent = fmt(duration);
    offset = 0;
    seekEl.value = 0;

    // Gains / States initialisieren
    gains = buffers.map(() => {
      const g = audioCtx.createGain();
      g.gain.value = 1;
      g.connect(masterGain);
      return g;
    });
    volumes = buffers.map(() => 1);
    muted = buffers.map(() => false);
    solo  = buffers.map(() => false);

    // UI bauen
    renderTracksUI();
    updateGainsFromState();
    updateTimeLoop(true);
  }

  function renderTracksUI() {
    tracksEl.innerHTML = '';
    currentSong.stems.forEach((stem, idx) => {
      const row = document.createElement('div');
      row.className = 'track';
      row.innerHTML = `
        <div class="name">${stem.name}</div>
        <div class="toggles">
          <button class="tbtn solo" data-idx="${idx}">Solo</button>
          <button class="tbtn mute" data-idx="${idx}">Mute</button>
        </div>
        <div class="vol">
          <label>Lautstärke</label>
          <input type="range" min="0" max="1" step="0.01" value="1" data-idx="${idx}" />
        </div>
        <div class="state" id="st-${idx}"></div>
      `;
      tracksEl.appendChild(row);
    });

    // Events
    tracksEl.querySelectorAll('.tbtn.solo').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.idx;
        solo[i] = !solo[i];
        btn.classList.toggle('active', solo[i]);
        updateGainsFromState();
      });
    });
    tracksEl.querySelectorAll('.tbtn.mute').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.idx;
        muted[i] = !muted[i];
        btn.classList.toggle('active', muted[i]);
        updateGainsFromState();
      });
    });
    tracksEl.querySelectorAll('input[type=range]').forEach(sl => {
      sl.addEventListener('input', () => {
        const i = +sl.dataset.idx;
        volumes[i] = +sl.value;
        updateGainsFromState();
      });
    });
  }

  function anySolo() { return solo.some(v => v); }

  function updateGainsFromState() {
    const soloActive = anySolo();
    gains.forEach((g, i) => {
      const isAudible = soloActive ? solo[i] : !muted[i];
      const vol = isAudible ? volumes[i] : 0;
      g.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.005);
      const st = document.getElementById(`st-${i}`);
      if (st) st.textContent = isAudible ? '' : '—';
    });
  }

  function createSources(atOffset) {
    // Vorhandene Quellen stoppen
    sources.forEach(s => { try { s.stop(); } catch(e){} });
    sources = [];
    buffers.forEach((buf, i) => {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(gains[i]);
      const when = 0;
      const off = Math.min(buf.duration - 0.0001, Math.max(0, atOffset));
      src.start(when, off);
      sources.push(src);
    });
    startTimestamp = audioCtx.currentTime - atOffset;
  }

  function hardStop() {
    sources.forEach(s => { try { s.stop(); } catch(e){} });
    sources = [];
    playing = false;
    offset = 0;
    seekEl.value = 0;
    curEl.textContent = fmt(0);
  }

  function play() {
    if (!currentSong || !buffers.length) return;
    if (playing) return;
    audioCtx.resume();
    createSources(offset);
    playing = true;
  }

  function pause() {
    if (!playing) return;
    // aktuelle Zeit ermitteln
    const now = Math.min(duration, Math.max(0, audioCtx.currentTime - startTimestamp));
    offset = now;
    sources.forEach(s => { try { s.stop(); } catch(e){} });
    sources = [];
    playing = false;
  }

  function stop() {
    hardStop();
  }

  function seekTo(norm01) {
    const newTime = Math.max(0, Math.min(1, norm01)) * duration;
    offset = newTime;
    if (playing) {
      createSources(offset);
    } else {
      // nur Anzeige aktualisieren
      curEl.textContent = fmt(offset);
    }
  }

  // UI-Events
  btnPlay.addEventListener('click', play);
  btnPause.addEventListener('click', pause);
  btnStop.addEventListener('click', stop);

  seekEl.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value) / 100;
    seekTo(v);
  });

  // Zeit-UI Loop
  function updateTimeLoop(jump=false) {
    if (!duration) {
      requestAnimationFrame(() => updateTimeLoop());
      return;
    }
    const t = playing ? (audioCtx.currentTime - startTimestamp) : offset;
    const clamped = Math.max(0, Math.min(duration, t));
    if (jump) {
      // initiales Setzen
      seekEl.value = (clamped / duration) * 100;
    } else {
      // vermeide Rücksprung, wenn der Nutzer gerade zieht -> wir sind im 'input' Event schon aktiv
      if (document.activeElement !== seekEl) {
        seekEl.value = (clamped / duration) * 100;
      }
    }
    curEl.textContent = fmt(clamped);
    // Auto-Stopp am Ende
    if (playing && clamped >= duration - 0.02) {
      stop();
    }
    requestAnimationFrame(() => updateTimeLoop());
  }

  // Song-Auswahl aufbauen
  function buildSongSelect() {
    SONGS.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.title;
      songSelect.appendChild(opt);
    });
    songSelect.addEventListener('change', async () => {
      const song = SONGS.find(s => s.id === songSelect.value);
      if (song) await loadSong(song);
    });
    // ersten Song laden
    songSelect.value = SONGS[0].id;
  }

  // Start
  (async function init() {
    buildSongSelect();
    await loadSong(SONGS[0]);
  })();
})();