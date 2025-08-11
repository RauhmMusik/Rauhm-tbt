// Multitrack-Player mit Timebar (Web Audio API) – Manifest-Variante
(() => {
  const tracksEl = document.getElementById('tracks');
  const seekEl = document.getElementById('seek');
  const curEl = document.getElementById('cur');
  const durEl = document.getElementById('dur');
  const songSelect = document.getElementById('songSelect');
  const btnPlay = document.getElementById('btnPlay');
  const btnPause = document.getElementById('btnPause');
  const btnStop = document.getElementById('btnStop');

  // Wird aus /audio/manifest.json geladen
  let SONGS = [];

  // --- Player-State ---
  let audioCtx;
  let masterGain;
  let currentSong = null;
  let buffers = [];
  let gains = [];
  let sources = [];
  let muted = [];
  let solo = [];
  let volumes = [];
  let duration = 0;
  let playing = false;
  let startTimestamp = 0;
  let offset = 0;

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
    hardStop();

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

    gains = buffers.map(() => {
      const g = audioCtx.createGain();
      g.gain.value = 1;
      g.connect(masterGain);
      return g;
    });
    volumes = buffers.map(() => 1);
    muted = buffers.map(() => false);
    solo  = buffers.map(() => false);

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
    const now = Math.min(duration, Math.max(0, audioCtx.currentTime - startTimestamp));
    offset = now;
    sources.forEach(s => { try { s.stop(); } catch(e){} });
    sources = [];
    playing = false;
  }

  function stop() { hardStop(); }

  function seekTo(norm01) {
    const newTime = Math.max(0, Math.min(1, norm01)) * duration;
    offset = newTime;
    if (playing) {
      createSources(offset);
    } else {
      curEl.textContent = fmt(offset);
    }
  }

  btnPlay.addEventListener('click', play);
  btnPause.addEventListener('click', pause);
  btnStop.addEventListener('click', stop);
  seekEl.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value) / 100;
    seekTo(v);
  });

  function updateTimeLoop(jump=false) {
    if (!duration) { requestAnimationFrame(() => updateTimeLoop()); return; }
    const t = playing ? (audioCtx.currentTime - startTimestamp) : offset;
    const clamped = Math.max(0, Math.min(duration, t));
    if (document.activeElement !== seekEl || jump) {
      seekEl.value = (clamped / duration) * 100;
    }
    curEl.textContent = fmt(clamped);
    if (playing && clamped >= duration - 0.02) { stop(); }
    requestAnimationFrame(() => updateTimeLoop());
  }

  // Manifest laden und UI füllen
  async function loadManifest() {
    const res = await fetch('audio/manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest.json nicht gefunden');
    const data = await res.json();
    if (!Array.isArray(data.songs)) throw new Error('Ungültiges Manifest');
    SONGS = data.songs.map(s => ({
      id: s.id,
      title: s.title,
      stems: s.stems // Erwartet 5 Objekte mit {name, file}
    }));
  }

  function buildSongSelect() {
    songSelect.innerHTML = '';
    SONGS.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.title;
      songSelect.appendChild(opt);
    });
    songSelect.addEventListener('change', async () => {
      const song = SONGS.find(s => s.id === songSelect.value);
      if (song) await loadSong(song);
    });
    if (SONGS[0]) songSelect.value = SONGS[0].id;
  }

  (async function init() {
    await loadManifest();
    buildSongSelect();
    if (SONGS[0]) await loadSong(SONGS[0]);
  })();
})();