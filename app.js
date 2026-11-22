(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(hover: none)').matches;
const URL_LIVE = 'https://maximusdigitals.github.io/marlowe/';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
history.scrollRestoration = 'manual';
scrollTo(0, 0);

let d = 0, maxD = 0, started = false, scared = false, inCor = false;
const root = document.documentElement;

/* ====================== AUDIO ====================== */
const A = { on: false };
function audioInit() {
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  const ac = new C();
  A.ac = ac; A.on = true;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 6;
  comp.connect(ac.destination);
  const master = ac.createGain(); master.gain.value = 0.9; master.connect(comp);
  A.master = master;
  // reverb-ish delay bus
  const dl = ac.createDelay(1); dl.delayTime.value = 0.23;
  const fb = ac.createGain(); fb.gain.value = 0.38;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master);
  A.verb = dl;
  // noise buffer
  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const ch = nb.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  A.noise = nb;

  // --- luxe pad (fades out as dread rises)
  A.pad = ac.createGain(); A.pad.gain.value = 0; A.pad.connect(master); A.pad.connect(dl);
  [130.81, 164.81, 196.0, 246.94, 329.63].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.value = 0.18 / (i + 1.5);
    const l = ac.createOscillator(); l.frequency.value = 0.1 + i * 0.03;
    const lg = ac.createGain(); lg.gain.value = 0.05; l.connect(lg); lg.connect(g.gain);
    o.connect(g); g.connect(A.pad); o.start(); l.start();
  });
  // --- projector hum + film clatter
  A.hum = ac.createGain(); A.hum.gain.value = 0; A.hum.connect(master);
  const hl = ac.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 220; hl.connect(A.hum);
  [50, 100.4].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = 0.35; o.connect(g); g.connect(hl); o.start(); });
  const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 3;
  const gate = ac.createGain(); gate.gain.value = 0;
  const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 24;
  const lfg = ac.createGain(); lfg.gain.value = 0.5; lfo.connect(lfg); lfg.connect(gate.gain);
  ns.connect(bp); bp.connect(gate); A.clat = ac.createGain(); A.clat.gain.value = 0; gate.connect(A.clat); A.clat.connect(master);
  ns.start(); lfo.start();
  // --- drone (rises with dread)
  A.drone = ac.createGain(); A.drone.gain.value = 0; A.drone.connect(master); A.drone.connect(dl);
  A.droneLP = ac.createBiquadFilter(); A.droneLP.type = 'lowpass'; A.droneLP.frequency.value = 120; A.droneLP.connect(A.drone);
  [41.2, 41.7, 58.27, 61.74, 87.3].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = 0.2; o.connect(g); g.connect(A.droneLP); o.start(); });
  // --- wind/breath bed
  const wn = ac.createBufferSource(); wn.buffer = nb; wn.loop = true; wn.playbackRate.value = 0.5;
  const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.7;
  const wl = ac.createOscillator(); wl.frequency.value = 0.07; const wlg = ac.createGain(); wlg.gain.value = 300; wl.connect(wlg); wlg.connect(wf.frequency); wl.start();
  A.wind = ac.createGain(); A.wind.gain.value = 0; wn.connect(wf); wf.connect(A.wind); A.wind.connect(master); wn.start();

  musicBoxLoop();
}
function setG(node, v, t = 0.8) { if (!A.on) return; const n = A.ac.currentTime; node.gain.cancelScheduledValues(n); node.gain.setTargetAtTime(v, n, t / 3); }
function audioDread() {
  if (!A.on || scared) return;
  const k = inCor ? 1 : d;
  setG(A.pad, inCor ? 0 : 0.22 * clamp(1 - k * 2.2));
  setG(A.hum, inCor ? 0 : 0.05 * (1 - k * 0.6));
  setG(A.clat, inCor ? 0 : 0.035 * clamp(1 - k));
  setG(A.drone, inCor ? 0.12 : 0.11 * clamp((k - 0.15) / 0.85));
  setG(A.wind, inCor ? 0.09 : 0.08 * clamp((k - 0.35) / 0.65));
  A.droneLP.frequency.setTargetAtTime(110 + 700 * k, A.ac.currentTime, 0.5);
}
function blip(type, f, dur, vol, when = 0, slide) {
  if (!A.on) return;
  const ac = A.ac, t = ac.currentTime + when;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(A.master); g.connect(A.verb); o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(dur, vol, freq = 1800, q = 1, type = 'bandpass', when = 0) {
  if (!A.on) return;
  const ac = A.ac, t = ac.currentTime + when;
  const s = ac.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = rnd(0.8, 1.2);
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(A.master); s.start(t, rnd(0, 1)); s.stop(t + dur + 0.05);
}
// creepy music box: an original little waltz, detuning and slowing with dread
const MB = [76, 79, 84, 83, 79, 76, 77, 81, 79, 76, 72, 74, 76, 74, 71, 67, 72, 76, 75, 71];
async function musicBoxLoop() {
  let i = 0;
  while (true) {
    const k = d;
    if (A.on && !scared && !inCor && k > 0.26) {
      const midi = MB[i % MB.length];
      const det = 1 + (Math.random() - 0.5) * 0.04 * k;
      const f = 440 * Math.pow(2, (midi - 69) / 12) * det * (k > 0.7 ? 0.94 : 1);
      const v = 0.05 * clamp((k - 0.26) / 0.3);
      blip('sine', f, 1.6, v); blip('triangle', f * 2, 0.4, v * 0.25);
      i++;
      await sleep(330 + 380 * k + (Math.random() < k * 0.3 ? rnd(200, 700) : 0));
    } else await sleep(400);
  }
}
function heartbeat() {
  if (!A.on) return;
  blip('sine', 62, 0.22, 0.5, 0, 38); blip('sine', 58, 0.25, 0.4, 0.24, 34);
}
function sting() {
  if (!A.on) return;
  const ac = A.ac, t = ac.currentTime;
  A.master.gain.cancelScheduledValues(t); A.master.gain.setValueAtTime(1, t);
  const shaper = ac.createWaveShaper(); const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); }
  shaper.curve = curve;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.01); g.gain.setTargetAtTime(0.0001, t + 0.9, 0.35);
  shaper.connect(g); g.connect(A.master); g.connect(A.verb);
  [740, 784, 1046, 1108, 1480, 1568].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'square';
    o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 1.6);
    const v = ac.createOscillator(); v.frequency.value = 9 + i; const vg = ac.createGain(); vg.gain.value = f * 0.03; v.connect(vg); vg.connect(o.frequency);
    const og = ac.createGain(); og.gain.value = 0.16; o.connect(og); og.connect(shaper); o.start(t); v.start(t); o.stop(t + 2.2); v.stop(t + 2.2);
  });
  noiseHit(1.4, 1.0, 3000, 0.4, 'highpass');
  noiseHit(0.6, 0.9, 400, 0.8, 'lowpass');
  blip('sine', 90, 0.9, 1.0, 0, 28); // sub hit
  blip('sawtooth', 220, 1.2, 0.25, 0.02, 60);
}

/* ====================== GATE ====================== */
function start(sound) {
  if (started) return; started = true;
  if (sound) { try { audioInit(); } catch (e) {} }
  $('#gate').classList.add('out');
  document.body.classList.remove('locked');
  setTimeout(() => $('#gate').remove(), 1300);
  if (A.on) { const n = A.ac.currentTime; A.pad.gain.setTargetAtTime(0.22, n, 1.2); A.hum.gain.setTargetAtTime(0.05, n, 1.5); A.clat.gain.setTargetAtTime(0.035, n, 1.5); }
  loop();
}
$('#enter').addEventListener('click', () => start(true));
$('#enterQuiet').addEventListener('click', () => start(false));

/* ====================== GRAIN ====================== */
const gc = $('#grain'), gx = gc.getContext('2d');
gc.width = 200; gc.height = 120;
const gimg = gx.createImageData(200, 120);
let gt = 0;
function grain(ts) {
  if (ts - gt > (RM ? 1e9 : 80)) {
    gt = ts;
    const p = gimg.data;
    for (let i = 0; i < p.length; i += 4) { const v = Math.random() * 255; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
    gx.putImageData(gimg, 0, 0);
  }
}

/* ====================== DREAD ====================== */
const secs = $$('[data-d]');
function computeD() {
  const mid = scrollY + innerHeight * 0.5;
  let prev = { y: 0, v: 0 };
  let val = 0;
  for (const s of secs) {
    const y = s.getBoundingClientRect().top + scrollY;
    const v = +s.dataset.d;
    if (mid < y) { const span = y - prev.y || 1; val = prev.v + (v - prev.v) * clamp((mid - prev.y) / span); break; }
    prev = { y, v }; val = v;
  }
  return clamp(val);
}

/* ====================== LOOP ====================== */
let lastBeat = 0;
function loop(ts = 0) {
  if (!scared) {
    const nd = computeD();
    if (Math.abs(nd - d) > 0.002) { d = nd; root.style.setProperty('--d', d.toFixed(3)); audioDread(); }
    if (d > maxD) maxD = d;
    const cor = $('#corridor').getBoundingClientRect();
    const nowCor = cor.top < innerHeight * 0.35 && cor.bottom > 0;
    if (nowCor !== inCor) { inCor = nowCor; document.body.classList.toggle('incor', inCor); audioDread(); }
    if (inCor && A.on && ts - lastBeat > 1050 - 350 * clamp(-cor.top / (cor.height - innerHeight))) { lastBeat = ts; heartbeat(); }
    if (inCor) flashlight(ts);
  }
  grain(ts);
  requestAnimationFrame(loop);
}

/* ====================== HERO ====================== */
let heroFlashed = false;
addEventListener('scroll', () => {
  if (!heroFlashed && scrollY > 160) {
    heroFlashed = true;
    const hd = $('.hero-dark'); hd.style.opacity = 1; setTimeout(() => hd.style.opacity = 0, 140);
  }
  if (maxD > 0.55 && scrollY < innerHeight) { $('.hero-dark').style.opacity = 1; }
}, { passive: true });

/* ====================== WORD SWAPS ====================== */
const swapIO = new IntersectionObserver(es => es.forEach(e => {
  const el = e.target;
  if (!e.isIntersecting || el.classList.contains('done')) return;
  const sec = el.closest('[data-d]'); const at = +(el.dataset.at || (sec && +sec.dataset.d > 0.01 ? sec.dataset.d : 0.55));
  if (maxD + 0.03 < at) return;
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    glitchEl(el, () => { el.textContent = el.dataset.to; el.classList.add('done'); });
  }, rnd(900, 2600));
}), { threshold: 1 });
$$('.swap').forEach(el => swapIO.observe(el));
// re-check swaps periodically (thresholds depend on maxD)
setInterval(() => $$('.swap:not(.done)').forEach(el => { swapIO.unobserve(el); swapIO.observe(el); }), 1500);

/* ====================== GLITCH ====================== */
const dim = $('#dim');
const GL = 'ΛΞ#%&@$*!?▓░▒█';
function glitchEl(el, after) {
  if (RM) { after && after(); return; }
  const orig = el.textContent;
  el.classList.add('glitch');
  if (A.on) noiseHit(0.12, 0.08 + 0.1 * d, 2400, 2);
  let n = 0;
  const iv = setInterval(() => {
    if (el.children.length === 0) el.textContent = orig.split('').map(c => c !== ' ' && Math.random() < 0.3 ? GL[Math.floor(Math.random() * GL.length)] : c).join('');
    if (++n > 3) { clearInterval(iv); if (el.children.length === 0) el.textContent = orig; el.classList.remove('glitch'); after && after(); }
  }, 60);
}
(async function glitchLoop() {
  while (true) {
    await sleep(Math.max(900, 6000 - 5200 * d) * rnd(0.7, 1.3));
    if (!started || scared || d < 0.22 || RM) continue;
    const pool = $$('h2,h3,.eyebrow,.rev cite,.price').filter(e => { const r = e.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight && e.children.length === 0; });
    if (pool.length) glitchEl(pool[Math.floor(Math.random() * pool.length)]);
    // occasional light dip
    if (d > 0.4 && Math.random() < 0.35) { dim.style.opacity = '.62'; setTimeout(() => dim.style.opacity = '0', 110 + Math.random() * 80); }
  }
})();

/* ====================== SHADOWS ====================== */
const SH = $('#shadows');
const figSVG = '<svg viewBox="0 0 100 300" preserveAspectRatio="xMidYMax meet"><defs><radialGradient id="sg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#000" stop-opacity=".95"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><path fill="url(#sg)" d="M50 18c11 0 18 9 18 21 0 9-4 16-10 19 14 4 24 14 27 32l8 70c1 8-4 11-8 3l-9-40 2 175H62l-6-110h-4l-6 110H30l2-175-9 40c-4 8-9 5-8-3l8-70c3-18 13-28 27-32-6-3-10-10-10-19 0-12 7-21 18-21z"/><circle cx="43" cy="37" r="1.6" fill="#f2e6d8" opacity=".8"/><circle cx="57" cy="37" r="1.6" fill="#f2e6d8" opacity=".8"/></svg>';
function spawnShade() {
  const peek = Math.random() < 0.5;
  const el = document.createElement('div');
  const left = Math.random() < 0.5;
  el.className = 'shade ' + (peek ? 'peek' : 'fig') + (left ? ' l' : '');
  if (peek) { el.style.top = rnd(10, 55) + 'vh'; el.style[left ? 'left' : 'right'] = '-' + rnd(4, 12) + 'vw'; el.style.setProperty('--o', (0.45 + 0.4 * d).toFixed(2)); }
  else { el.innerHTML = figSVG; el.style[left ? 'left' : 'right'] = rnd(-4, 4) + 'vw'; el.style.setProperty('--o', (0.5 + 0.45 * d).toFixed(2)); }
  SH.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  if (A.on) noiseHit(1.6, 0.05, 380, 0.6, 'lowpass');
  const kill = () => { el.classList.add('gone'); setTimeout(() => el.remove(), 400); };
  el._kill = kill;
  setTimeout(kill, rnd(2600, 4200));
}
(async function shadeLoop() {
  while (true) {
    await sleep(Math.max(1800, 9000 - 7000 * d) * rnd(0.6, 1.4));
    if (started && !scared && !inCor && d > 0.3 && SH.children.length < 2) spawnShade();
  }
})();
// shadows vanish when you look at them (cursor or finger comes near)
function nearKill(x, y) {
  $$('.shade', SH).forEach(el => { const r = el.getBoundingClientRect(); const cx = clamp(x, r.left, r.right), cy = clamp(y, r.top, r.bottom); if (Math.hypot(x - cx, y - cy) < 140) el._kill && el._kill(); });
}

/* ====================== POINTER ====================== */
let px = innerWidth / 2, py = innerHeight / 2, lastMove = 0;
addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; lastMove = performance.now(); nearKill(px, py); tiltPosters(); }, { passive: true });
addEventListener('touchstart', e => { const t = e.touches[0]; px = t.clientX; py = t.clientY; lastMove = performance.now(); nearKill(px, py); }, { passive: true });
addEventListener('touchmove', e => { const t = e.touches[0]; px = t.clientX; py = t.clientY; lastMove = performance.now(); }, { passive: true });

/* ====================== POSTERS ====================== */
const g1 = $('#g1 img'), g2 = $('#g2 img');
function tiltPosters() {
  if (RM) return;
  const el = $('#g2'); const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  const dx = (px - (r.left + r.width / 2)) / innerWidth, dy = (py - (r.top + r.height / 2)) / innerHeight;
  el.style.transform = `perspective(900px) rotateY(${dx * 22}deg) rotateX(${-dy * 16}deg)`;
}
// phones: poster turns to follow scroll position, so it seems to keep facing you
addEventListener('scroll', () => {
  if (!TOUCH || RM) return;
  const el = $('#g2'); const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  const dy = (innerHeight / 2 - (r.top + r.height / 2)) / innerHeight;
  el.style.transform = `perspective(900px) rotateX(${dy * 22}deg)`;
}, { passive: true });
// subliminal: stare at the coming-soon poster and it grins back for a split second
let g1seen = 0, g1done = false;
new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting && !g1done) { g1seen = setTimeout(() => { g1done = true; g1.src = 'img/giggles2.webp'; if (A.on) noiseHit(0.2, 0.06, 900, 1); setTimeout(() => g1.src = 'img/giggles1.webp', 180); }, 3200); }
  else clearTimeout(g1seen);
}), { threshold: 0.7 }).observe($('#g1'));
// when he comes back, look away and he's bleeding
let g2stage = 0;
new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { if (g2stage === 0) { g2stage = 1; setTimeout(() => $('.whisper').classList.add('show'), 2500); } }
  else if (g2stage === 1 && maxD > 0.66) { g2stage = 2; g2.src = 'img/giggles3.webp'; $('#g2 .ribbon').textContent = 'Last showing'; }
}), { threshold: 0.4 }).observe($('#g2'));
setInterval(() => { if (maxD > 0.72) { g1.src = 'img/giggles3.webp'; $('#g1 .ribbon').textContent = 'Now showing'; $('#g1 .ribbon').classList.add('red'); } }, 1000);

/* ====================== EXITS ====================== */
new IntersectionObserver((es, o) => es.forEach(e => {
  if (!e.isIntersecting) return; o.disconnect();
  const b = $('#exitCount');
  setTimeout(() => glitchEl(b, () => { b.textContent = '1'; setTimeout(() => glitchEl(b, () => { b.textContent = '0'; b.classList.add('zero'); }), 1600); }), 2200);
}), { threshold: 1 }).observe($('.exits'));
new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting && maxD > 0.38) { setTimeout(() => $('.late').classList.add('show'), 1500); o.disconnect(); } }), { threshold: 1 }).observe($('.late'));

/* ====================== SEATS ====================== */
const map = $('#seatmap'), msg = $('#seatMsg');
let taken = 'C4', mine = null, tapsTaken = 0;
const order = []; ['B', 'C'].forEach(r => { for (let i = 1; i <= 6; i++) order.push(r + i); });
function renderSeats() {
  map.innerHTML = '';
  order.forEach(id => {
    const b = document.createElement('button'); b.className = 'seat'; b.textContent = id; b.type = 'button';
    if (id === taken) { b.classList.add('taken'); b.setAttribute('aria-label', id + ' taken'); }
    if (id === mine) b.classList.add('mine');
    b.onclick = () => pickSeat(id);
    map.appendChild(b);
  });
}
function say(t, bad) { msg.textContent = t; msg.classList.toggle('bad', !!bad); }
function pickSeat(id) {
  if (id === taken) {
    tapsTaken++;
    const lines = ['Sorry, ' + id + ' is taken.', 'That seat is always taken.', 'Please stop touching his seat.', 'He felt that.'];
    say(lines[Math.min(tapsTaken - 1, lines.length - 1)], tapsTaken > 1);
    if (A.on) blip('sine', 180 - tapsTaken * 20, 0.5, 0.12, 0, 90);
    return;
  }
  mine = id; renderSeats();
  say('Lovely choice. ' + id + ' is yours.');
  if (A.on) blip('sine', 880, 0.5, 0.06);
  setTimeout(() => {
    const i = order.indexOf(id); const row = id[0], n = +id.slice(1);
    const nb = row + (n < 6 ? n + 1 : n - 1);
    taken = nb; renderSeats();
    say('He moved to ' + nb + '. He wants to sit next to you.', true);
    if (A.on) noiseHit(0.5, 0.15, 300, 1, 'lowpass');
  }, 1400);
}
renderSeats();

/* ====================== BOOKING ====================== */
let filled = false;
new IntersectionObserver((es, o) => es.forEach(async e => {
  if (!e.isIntersecting || filled) return; filled = true; o.disconnect();
  await sleep(700);
  for (const inp of $$('[data-fill]')) {
    let t = inp.dataset.fill;
    if (t.startsWith('C5') && mine) t = mine + ' · beside him';
    for (const c of t) { inp.value += c; if (A.on) blip('square', rnd(1800, 2400), 0.02, 0.012); await sleep(RM ? 5 : rnd(40, 95)); }
    await sleep(350);
  }
  $('#bookMsg').textContent = 'No need to submit. We already have your seat.';
}), { threshold: 0.35 }).observe($('#bookForm'));
$('#confirm').addEventListener('click', () => {
  $('#confirm').textContent = 'Confirmed. Forever.';
  $('#bookMsg').textContent = 'Please make your way down the corridor.';
  const y = $('#corridor').getBoundingClientRect().top + scrollY;
  scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
});

/* ====================== SCROLL FIGHT ====================== */
let fights = 0, lastY = 0, fightCool = 0;
addEventListener('scroll', () => {
  const y = scrollY; const down = y > lastY; lastY = y;
  if (RM || scared || fights >= 3 || d < 0.8 || !down) return;
  const now = performance.now(); if (now - fightCool < 5000) return;
  if (Math.random() < 0.04) {
    fights++; fightCool = now;
    scrollBy({ top: -(140 + Math.random() * 120), behavior: 'smooth' });
    if (A.on) { blip('sine', 70, 0.4, 0.6, 0, 40); noiseHit(0.3, 0.2, 200, 1, 'lowpass'); }
  }
}, { passive: true });

/* ====================== CORRIDOR / FLASHLIGHT ====================== */
const FL = $('#flashlight');
function flashlight(ts) {
  let x = px, y = py;
  const idle = performance.now() - lastMove > 2500;
  if (idle || RM) { x = innerWidth / 2 + Math.sin(ts / 1400) * innerWidth * 0.18; y = innerHeight * 0.48 + Math.sin(ts / 900) * innerHeight * 0.06; }
  const r = TOUCH ? Math.min(innerWidth * 0.75, 300) : 300;
  const flick = Math.random() < 0.015 ? 0.6 : 1;
  FL.style.setProperty('--fx', x + 'px'); FL.style.setProperty('--fy', y + 'px'); FL.style.setProperty('--r', (r * flick) + 'px');
}

/* ====================== THE SCARE ====================== */
new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !scared) scare(); }), { threshold: 0 }).observe($('#trigger'));
async function scare() {
  scared = true;
  root.classList.add('noscroll');
  // the quiet beat: everything stops, the light dies
  if (A.on) { const n = A.ac.currentTime; [A.pad, A.hum, A.clat, A.drone, A.wind].forEach(g => { g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, 0.08); }); }
  FL.style.transition = 'none';
  const r0 = parseFloat(FL.style.getPropertyValue('--r')) || 200;
  for (let i = 0; i <= 20; i++) { FL.style.setProperty('--r', (r0 * (1 - i / 20)) + 'px'); await sleep(40); }
  await sleep(500);
  if (A.on) blip('sine', 1318.5, 1.4, 0.05); // one music-box note in the dark
  await sleep(1150);
  // HIT
  const sc = $('#scare'); sc.classList.add('go');
  sting();
  if (!RM) { sc.classList.add('shake'); const f = $('#flash'); f.style.transition = 'none'; f.style.opacity = '.55'; requestAnimationFrame(() => { f.style.transition = 'opacity .45s'; f.style.opacity = '0'; }); }
  if (navigator.vibrate) try { navigator.vibrate([350, 80, 250]); } catch (e) {}
  await sleep(1900);
  sc.classList.remove('shake');
  sc.classList.add('out');
  $('#end').classList.add('show');
  await sleep(1200); sc.style.display = 'none';
}

/* ====================== END ====================== */
const shareText = "tried to book a private cinema for date night. the website had other plans 🎟️🤡 (sound on)";
$('#share').href = 'https://x.com/intent/post?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(URL_LIVE);
$('#replay').addEventListener('click', () => { scrollTo(0, 0); location.reload(); });

/* ====================== TITLE ====================== */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && maxD > 0.3) document.title = 'come back to your seat';
  else document.title = maxD > 0.6 ? 'Marlowe — he saved your seat' : 'Marlowe — Private Cinema';
});

// test hook
window.__marlowe = { scare, get d() { return d; } };
})();
