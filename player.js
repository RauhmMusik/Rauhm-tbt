// Multitrack-Player – Pro: autoscan + title.txt + cover.jpg + meters + shortcuts + persist + export
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const tracksEl = $('#tracks');
  const seekEl = $('#seek');
  const curEl = $('#cur');
  const durEl = $('#dur');
  const songSelect = $('#songSelect');
  const btnPlay = $('#btnPlay');
  const btnPause = $('#btnPause');
  const btnStop = $('#btnStop');
  const btnReset = $('#btnReset');
  const btnExport = $('#btnExport');
  const overlay = $('#overlay');
  const toastEl = $('#toast');
  const coverImg = $('#cover');
  const coverPh = $('#coverPh');
  const themeToggle = $('#themeToggle');

  // user prefs
  (function initTheme(){
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.classList.add('dark');
    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
  })();

  // Scan-Parameter
  const PREFIX = 'song-';
  const MAX_SONGS = 200;
  const STEMS = [
    { name: 'Drums',            file: 'drums.wav' },
    { name: 'Gitarren + Piano', file: 'guitars_piano.wav' },
    { name: 'Synth',            file: 'synth.wav' },
    { name: 'Vocals',           file: 'vocals.wav' },
    { name: 'Streicher & Bläser', file: 'strings_brass.wav' },
  ];

  let SONGS = [];

  // --- Player-State ---
  let audioCtx;
  let masterGain;
  let currentSong = null;
  let buffers = [];
  let gains = [];
  let analysers = [];
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

  function showOverlay(v=true){ overlay.hidden = !v; }
  function toast(msg, ms=2800){
    toastEl.textContent = msg;
    toastEl.hidden = false;
    setTimeout(()=> toastEl.hidden = true, ms);
  }

  function ensureCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(audioCtx.destination);
    }
  }

  async function headOk(url) {
    try { const res = await fetch(url, { headers: { 'Range': 'bytes=0-0' } }); return res.ok; }
    catch { return false; }
  }

  async function readTitle(url, fallback) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return fallback;
      let t = await res.text();
      t = t.replace(/^\ufeff/, '').trim();
      return t || fallback;
    } catch { return fallback; }
  }

  async function tryCover(baseUrl){
    const url = `${baseUrl}/cover.jpg`;
    if (await headOk(url)) return url;
    return null;
  }

  async function autoScanSongs() {
    const found = [];
    for (let i = 1; i <= MAX_SONGS; i++) {
      const id = `${PREFIX}${i}`;
      const baseUrl = `audio/${id}`;
      const testUrl = `${baseUrl}/${STEMS[0].file}`;
      // eslint-disable-next-line no-await-in-loop
      const ok = await headOk(testUrl);
      if (ok) {
        const title = await readTitle(`${baseUrl}/title.txt`, `Song ${i}`);
        const cover = await tryCover(baseUrl);
        found.push({
          id,
          title,
          cover,
          stems: STEMS.map(s => ({ name: s.name, file: `${baseUrl}/${s.file}` }))
        });
      }
    }
    return found;
  }

  function persistKey(songId){ return `mix:${songId}`; }
  function saveState(songId){
    try {
      const data = { volumes, muted, solo };
      localStorage.setItem(persistKey(songId), JSON.stringify(data));
    } catch {}
  }
  function loadState(songId){
    try {
      const raw = localStorage.getItem(persistKey(songId));
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d && Array.isArray(d.volumes) ? d : null;
    } catch { return null; }
  }
  function resetState(){
    volumes = buffers.map(() => 1);
    muted = buffers.map(() => false);
    solo  = buffers.map(() => false);
    updateGainsFromState();
    renderTrackStates();
    saveState(currentSong.id);
  }

  async function loadSong(song) {
    ensureCtx();
    currentSong = song;
    hardStop();
    showOverlay(true);

    // Cover
    if (song.cover) {
      coverImg.src = song.cover;
      coverImg.style.display = 'block';
      coverPh.style.display = 'none';
    } else {
      coverImg.removeAttribute('src');
      coverImg.style.display = 'none';
      coverPh.style.display = 'grid';
    }

    try {
      const decodes = song.stems.map(async stem => {
        const res = await fetch(stem.file);
        if (!res.ok) throw new Error(`Konnte Datei nicht laden: ${stem.file}`);
        const arr = await res.arrayBuffer();
        return await audioCtx.decodeAudioData(arr.slice(0));
      });
      buffers = await Promise.all(decodes);
    } catch (e) {
      showOverlay(false);
      toast('Fehler beim Laden einiger Dateien. Bitte Pfade prüfen.');
      throw e;
    }

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
    analysers = buffers.map(() => {
      const a = audioCtx.createAnalyser();
      a.fftSize = 256;
      return a;
    });

    // State aus Storage
    const st = loadState(song.id);
    if (st) { volumes = st.volumes; muted = st.muted; solo = st.solo; }
    else { resetState(); }
    renderTracksUI();
    updateGainsFromState();
    updateTimeLoop(true);
    showOverlay(false);
  }

  function renderTracksUI() {
    tracksEl.innerHTML = '';
    currentSong.stems.forEach((stem, idx) => {
      const row = document.createElement('div');
      row.className = 'track';
      row.innerHTML = `
        <div class="name">${stem.name}</div>
        <div class="toggles">
          <button class="tbtn solo" data-idx="${idx}" title="Taste ${idx+1}">Solo</button>
          <button class="tbtn mute" data-idx="${idx}" title="Shift+${idx+1}">Mute</button>
        </div>
        <div class="vol">
          <label>Lautstärke</label>
          <input type="range" min="0" max="1" step="0.01" value="${volumes[idx] ?? 1}" data-idx="${idx}" />
        </div>
        <div class="meterwrap">
          <div class="meter"><i id="m${idx}"></i></div>
        </div>
        <div class="state" id="st-${idx}"></div>
      `;
      tracksEl.appendChild(row);
    });

    // Events
    tracksEl.querySelectorAll('.tbtn.solo').forEach(btn => {
      btn.addEventListener('click', () => toggleSolo(+btn.dataset.idx));
    });
    tracksEl.querySelectorAll('.tbtn.mute').forEach(btn => {
      btn.addEventListener('click', () => toggleMute(+btn.dataset.idx));
    });
    tracksEl.querySelectorAll('input[type=range]').forEach(sl => {
      sl.addEventListener('input', () => {
        const i = +sl.dataset.idx;
        volumes[i] = +sl.value;
        updateGainsFromState();
        saveState(currentSong.id);
      });
    });

    renderTrackStates();
  }

  function renderTrackStates(){
    $$('.tbtn.solo').forEach((b,i)=> b.classList.toggle('active', !!solo[i]));
    $$('.tbtn.mute').forEach((b,i)=> b.classList.toggle('active', !!muted[i]));
  }

  function anySolo() { return solo.some(v => v); }

  function updateGainsFromState() {
    const soloActive = anySolo();
    gains.forEach((g, i) => {
      const isAudible = soloActive ? solo[i] : !muted[i];
      const vol = isAudible ? (volumes[i] ?? 1) : 0;
      g.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.005);
      const st = document.getElementById(`st-${i}`);
      if (st) st.textContent = isAudible ? '' : '—';
    });
  }

  function connectChainForSource(src, i){
    // src -> analyser -> gain -> master
    src.connect(analysers[i]);
    analysers[i].connect(gains[i]);
  }

  function createSources(atOffset) {
    sources.forEach(s => { try { s.stop(); } catch(e){} });
    sources = [];
    buffers.forEach((buf, i) => {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      connectChainForSource(src, i);
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

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.isContentEditable)) return;
    if (e.code === 'Space') { e.preventDefault(); if (playing) pause(); else play(); }
    // 1..5 Solo / Shift+1..5 Mute
    const num = parseInt(e.key, 10);
    if (num >=1 && num <=5) {
      e.preventDefault();
      if (e.shiftKey) toggleMute(num-1);
      else toggleSolo(num-1);
    }
  });

  function toggleSolo(i){
    solo[i] = !solo[i];
    renderTrackStates();
    updateGainsFromState();
    saveState(currentSong.id);
  }
  function toggleMute(i){
    muted[i] = !muted[i];
    renderTrackStates();
    updateGainsFromState();
    saveState(currentSong.id);
  }

  // Buttons
  btnPlay.addEventListener('click', play);
  btnPause.addEventListener('click', pause);
  btnStop.addEventListener('click', stop);
  $('#seek').addEventListener('input', (e) => seekTo(parseFloat(e.target.value)/100));
  btnReset.addEventListener('click', () => { resetState(); toast('Mix zurückgesetzt'); });
  btnExport.addEventListener('click', exportMix);

  // Zeit- & Meter-Loop
  function updateTimeLoop(jump=false) {
    if (!duration) { requestAnimationFrame(() => updateTimeLoop()); return; }
    const t = playing ? (audioCtx.currentTime - startTimestamp) : offset;
    const clamped = Math.max(0, Math.min(duration, t));
    if (document.activeElement !== seekEl || jump) {
      seekEl.value = (clamped / duration) * 100;
    }
    curEl.textContent = fmt(clamped);
    if (playing && clamped >= duration - 0.02) { stop(); }

    // meters
    analysers.forEach((an, i) => {
      if (!an) return;
      const arr = new Uint8Array(an.frequencyBinCount);
      an.getByteTimeDomainData(arr);
      // simple peak estimate
      let peak = 0;
      for (let k=0; k<arr.length; k++) {
        const v = (arr[k] - 128) / 128; // -1..1
        const a = Math.abs(v);
        if (a > peak) peak = a;
      }
      const pct = Math.min(1, peak * 1.8) * 100; // scale up a bit
      const bar = document.getElementById(`m${i}`);
      if (bar) bar.style.width = pct.toFixed(1) + '%';
    });

    requestAnimationFrame(() => updateTimeLoop());
  }

  async function exportMix(){
    if (!buffers.length) return;
    try {
      const sr = buffers[0].sampleRate;
      const length = Math.max(...buffers.map(b => b.length));
      const oac = new OfflineAudioContext(2, length, sr);

      // Build chain
      const mixGain = oac.createGain();
      mixGain.gain.value = 1;
      mixGain.connect(oac.destination);

      const soloActive = anySolo();

      buffers.forEach((buf, i) => {
        const audible = soloActive ? solo[i] : !muted[i];
        const vol = audible ? (volumes[i] ?? 1) : 0;
        if (vol <= 0.0001) return;
        const src = oac.createBufferSource();
        src.buffer = buf;
        const g = oac.createGain();
        g.gain.value = vol;
        src.connect(g);
        g.connect(mixGain);
        src.start(0);
      });

      const rendered = await oac.startRendering();
      // to WAV
      const wav = audioBufferToWav(rendered);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = (currentSong?.title || currentSong?.id || 'mix') + '.wav';
      a.href = url; a.download = filename.replace(/[\\/:*?"<>|]+/g,'_');
      a.click();
      setTimeout(()=> URL.revokeObjectURL(url), 10000);
    } catch (e) {
      console.error(e);
      toast('Export fehlgeschlagen (Browser?)');
    }
  }

  // minimal WAV encoder (16-bit PCM)
  function audioBufferToWav(buffer){
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new ArrayBuffer(length);
    const view = new DataView(out);
    // RIFF header
    writeStr(view, 0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * numOfChan * 2, true);
    writeStr(view, 8, 'WAVE');
    writeStr(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * numOfChan * 2, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, 16, true);
    writeStr(view, 36, 'data');
    view.setUint32(40, buffer.length * numOfChan * 2, true);
    // interleave
    let offsetW = 44;
    const channels = [];
    for (let i=0; i<numOfChan; i++) channels.push(buffer.getChannelData(i));
    for (let i=0; i<buffer.length; i++) {
      for (let c=0; c<numOfChan; c++) {
        let s = Math.max(-1, Math.min(1, channels[c][i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offsetW, s, true);
        offsetW += 2;
      }
    }
    return out;
  }
  function writeStr(view, offset, str){ for (let i=0; i<str.length; i++) view.setUint8(offset+i, str.charCodeAt(i)); }

  // Init
  async function init() {
    showOverlay(true);
    const songs = await autoScanSongs();
    SONGS = songs;
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
    if (SONGS[0]) {
      songSelect.value = SONGS[0].id;
      await loadSong(SONGS[0]);
    } else {
      toast('Keine Songs gefunden. Lege Ordner audio/song-1 an.');
    }
    showOverlay(false);
  }

  init();
})();