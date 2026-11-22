(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const mm = q => { try { return matchMedia(q).matches; } catch (e) { return false; } };
const UA = navigator.userAgent || '';
const RM = mm('(prefers-reduced-motion: reduce)');
const FINE = mm('(hover: hover) and (pointer: fine)');
// iPadOS reports itself as a Mac; touch points give it away
const IOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ANDROID = /Android/i.test(UA);
// X's in-app browser: "Twitter for iPhone/x.y" (WKWebView) or "TwitterAndroid/x.y" (Android System WebView, "; wv")
const IN_X = /Twitter for iP(hone|ad)|TwitterAndroid/i.test(UA);
const WEBVIEW = IN_X || /; wv\)/.test(UA) || (IOS && !/Safari\//.test(UA));
const LOW = (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4);
const PHONE = /Android|iPhone|iPod/i.test(UA) || (mm('(hover: none)') && innerWidth < 760);
const TABLET = !PHONE && (/iPad|Tablet/i.test(UA) || IOS);
const LITE = ANDROID || LOW; // cheaper compositing on mid-range Android / low-memory devices
const URL_LIVE = 'https://maximusdigitals.github.io/marlowe/';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = document.documentElement;
root.classList.toggle('ios', IOS); root.classList.toggle('inx', IN_X); root.classList.toggle('webview', WEBVIEW); root.classList.toggle('lite', LITE);
try { history.scrollRestoration = 'manual'; } catch (e) {}
scrollTo(0, 0);
// webp everywhere X runs today; jpg twins exist for anything that can't decode it
let EXT = '.webp';
const img = n => 'img/' + n + EXT;
(() => { const t = new Image(); t.onerror = () => { EXT = '.jpg'; root.classList.add('nowebp'); document.querySelectorAll('img').forEach(i => { const a = i.getAttribute('src'); if (a && /\.webp$/.test(a)) i.src = a.replace(/\.webp$/, '.jpg'); }); document.querySelectorAll('[data-img]').forEach(e => e.dataset.img = e.dataset.img.replace(/\.webp$/, '.jpg')); }; t.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='; })();
// house-light colours computed here, so nothing depends on CSS color-mix() (older Android WebViews lack it)
const C0 = { paper: [236, 229, 216], night: [10, 9, 8], ink: [19, 17, 15], bone: [230, 222, 206], ox: [122, 23, 18], ox2: [179, 42, 32] };
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = c => 'rgb(' + c.join(',') + ')';
const themeMeta = document.querySelector('meta[name="theme-color"]');
let lastT = -1;
function paint(t) {
  const q = Math.round(t * 100) / 100; if (q === lastT) return; lastT = q;
  const bg = mix(C0.paper, C0.night, q), fg = mix(C0.ink, C0.bone, q);
  root.style.setProperty('--bg', rgb(bg)); root.style.setProperty('--fg', rgb(fg));
  root.style.setProperty('--mute', rgb(mix(fg, bg, 0.42))); root.style.setProperty('--rule', rgb(mix(fg, bg, 0.7)));
  root.style.setProperty('--accent', rgb(mix(C0.ox, C0.ox2, q)));
  if (themeMeta) themeMeta.setAttribute('content', rgb(bg));
}
paint(0);

let d = 0, maxD = 0, started = false, scared = false, inCor = false;

/* ====================== TIME / DEVICE ====================== */
const pad2 = n => String(n).padStart(2, '0');
const fmt12 = t => { let h = t.getHours() % 12 || 12; return h + ':' + pad2(t.getMinutes()) + (t.getHours() < 12 ? ' am' : ' pm'); };
const dayPart = t => { const h = t.getHours(); return h < 5 ? 'the middle of the night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'; };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const device = PHONE ? 'a phone' : TABLET ? 'a tablet' : 'a computer';
let battery = null;
try { navigator.getBattery && navigator.getBattery().then(b => { battery = b; }).catch(() => {}); } catch (e) {}
function noticeText() {
  const t = new Date();
  $('#ntTime').textContent = "It's " + fmt12(t) + '.';
  let s = `${DAYS[t.getDay()]} ${dayPart(t)}. You're on ${device}`;
  s += PHONE ? ', holding it a little too close to your face.' : ', and the room behind you is darker than your screen.';
  if (battery && !battery.charging) s += ` Your battery is at ${Math.round(battery.level * 100)}%.`;
  else if (battery && battery.charging) s += " You're plugged in. You're not going anywhere.";
  s += ' Nobody knows you are here.';
  $('#ntBody').textContent = s;
}
// header clock; it starts running backwards once the lights are down
let clockBack = 0;
setInterval(() => {
  const t = new Date(Date.now() - clockBack);
  if (maxD > 0.7 && !RM) clockBack += 2000;
  $('#clock').textContent = pad2(t.getHours()) + ':' + pad2(t.getMinutes()) + ':' + pad2(t.getSeconds());
}, 1000);
(() => { const t = new Date(); $('#sumDate').textContent = DAYS[t.getDay()].slice(0, 3) + ' ' + t.getDate() + ' ' + MONTHS[t.getMonth()]; $('#sumTime').textContent = fmt12(t) + ' · now'; })();

/* ====================== AUDIO ====================== */
const A = { on: false };
// silent WAV (0.5 s, 8 kHz, 8-bit) for the iOS <audio> fallback
function silentWav() {
  const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, str) => { for (let i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44); return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
// Must run synchronously inside the tap. Order matters on iOS WebKit / X's WKWebView.
function unlockAudio() {
  // iOS 17+: put Web Audio on the playback channel so the silent switch doesn't mute it
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  audioInit(); const ac = A.ac; if (!ac) return;
  try { const p = ac.resume && ac.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  try { const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) {}
  // older iOS: a playing <audio playsinline> element moves the page to the media channel
  if (IOS && !navigator.audioSession) {
    try { const el = document.createElement('audio'); el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', ''); el.setAttribute('x-webkit-airplay', 'deny'); el.loop = true; el.preload = 'auto'; el.src = silentWav(); const p = el.play(); if (p && p.catch) p.catch(() => {}); A.silent = el; } catch (e) {}
  }
  try { ac.onstatechange = sndState; } catch (e) {}
  setTimeout(sndState, 900);
}
// resume whenever iOS 'interrupted' us (call, Siri, app switch) or Android suspended us
function kick() {
  if (!A.on) return;
  try { if (A.ac.state !== 'running' && A.ac.state !== 'closed') { const p = A.ac.resume(); if (p && p.then) p.then(sndState, () => {}); } } catch (e) {}
  try { if (A.silent && A.silent.paused) { const p = A.silent.play(); if (p && p.catch) p.catch(() => {}); } } catch (e) {}
}
function sndState() { const b = document.getElementById('snd'); if (!b || !A.on) return; b.hidden = !(started && !scared && A.ac.state !== 'running'); }
['touchend', 'pointerup', 'click', 'keydown'].forEach(ev => addEventListener(ev, kick, { passive: true, capture: true }));
addEventListener('pageshow', kick); addEventListener('focus', kick);
function audioInit() {
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  let ac; try { ac = new C({ latencyHint: 'interactive' }); } catch (e) { ac = new C(); }
  A.ac = ac; A.on = true;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6; comp.connect(ac.destination);
  const master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); A.master = master;
  const dl = ac.createDelay(1); dl.delayTime.value = 0.23; const fb = ac.createGain(); fb.gain.value = 0.38;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master); A.verb = dl;
  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const ch = nb.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; A.noise = nb;
  // luxe pad
  A.pad = ac.createGain(); A.pad.gain.value = 0; A.pad.connect(master); A.pad.connect(dl);
  [130.81, 164.81, 196.0, 246.94, 329.63].forEach((f, i) => { const o = ac.createOscillator(); o.frequency.value = f; const g = ac.createGain(); g.gain.value = 0.18 / (i + 1.5); const l = ac.createOscillator(); l.frequency.value = 0.1 + i * 0.03; const lg = ac.createGain(); lg.gain.value = 0.05; l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(A.pad); o.start(); l.start(); });
  // projector hum + clatter
  A.hum = ac.createGain(); A.hum.gain.value = 0; A.hum.connect(master);
  const hl = ac.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 220; hl.connect(A.hum);
  [50, 100.4].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = 0.35; o.connect(g); g.connect(hl); o.start(); });
  const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 3;
  const gate = ac.createGain(); gate.gain.value = 0; const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 24; const lfg = ac.createGain(); lfg.gain.value = 0.5; lfo.connect(lfg); lfg.connect(gate.gain);
  ns.connect(bp); bp.connect(gate); A.clat = ac.createGain(); A.clat.gain.value = 0; gate.connect(A.clat); A.clat.connect(master); ns.start(); lfo.start();
  // drone
  A.drone = ac.createGain(); A.drone.gain.value = 0; A.drone.connect(master); A.drone.connect(dl);
  A.droneLP = ac.createBiquadFilter(); A.droneLP.type = 'lowpass'; A.droneLP.frequency.value = 120; A.droneLP.connect(A.drone);
  [41.2, 41.7, 58.27, 61.74, 87.3].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = 0.2; o.connect(g); g.connect(A.droneLP); o.start(); });
  // wind
  const wn = ac.createBufferSource(); wn.buffer = nb; wn.loop = true; wn.playbackRate.value = 0.5;
  const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.7;
  const wl = ac.createOscillator(); wl.frequency.value = 0.07; const wlg = ac.createGain(); wlg.gain.value = 300; wl.connect(wlg); wlg.connect(wf.frequency); wl.start();
  A.wind = ac.createGain(); A.wind.gain.value = 0; wn.connect(wf); wf.connect(A.wind); A.wind.connect(master); wn.start();
  musicBoxLoop(); whisperLoop();
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
function out(node, pan) {
  if (pan === undefined || !A.ac.createStereoPanner) { node.connect(A.master); return; }
  const p = A.ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(A.master); return p;
}
function blip(type, f, dur, vol, when = 0, slide, pan) {
  if (!A.on) return; const ac = A.ac, t = ac.currentTime + when;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); out(g, pan); g.connect(A.verb); o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(dur, vol, freq = 1800, q = 1, type = 'bandpass', when = 0, pan) {
  if (!A.on) return; const ac = A.ac, t = ac.currentTime + when;
  const s = ac.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = rnd(0.8, 1.2);
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); out(g, pan); s.start(t, rnd(0, 1)); s.stop(t + dur + 0.05);
}
// a whisper: breathy noise through moving formants, syllable-shaped, panned across your head
function whisper(panFrom = -1, panTo = 1, syll = 6, vol = 0.16) {
  if (!A.on) return; const ac = A.ac, t0 = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = A.noise; s.loop = true;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
  const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8;
  const g = ac.createGain(); g.gain.value = 0;
  const mix = ac.createGain();
  s.connect(hp); hp.connect(f1); hp.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(g);
  let pan = null; if (ac.createStereoPanner) { pan = ac.createStereoPanner(); pan.pan.setValueAtTime(panFrom, t0); g.connect(pan); pan.connect(A.master); } else g.connect(A.master);
  g.connect(A.verb);
  let t = t0;
  for (let i = 0; i < syll; i++) {
    const len = rnd(0.12, 0.3), F = [[700, 1200], [400, 2300], [600, 2600], [300, 900], [500, 1800]][Math.floor(Math.random() * 5)];
    f1.frequency.setValueAtTime(F[0] * 2.2, t); f2.frequency.setValueAtTime(F[1] * 1.6, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * rnd(0.6, 1), t + len * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len);
    if (Math.random() < 0.35) { // sibilant
      f1.frequency.setValueAtTime(5200, t + len * 0.6); g.gain.setValueAtTime(vol * 0.5, t + len * 0.6);
      g.gain.linearRampToValueAtTime(0.0001, t + len + 0.12); t += 0.12;
    }
    t += len + rnd(0.03, 0.12);
  }
  if (pan) pan.pan.linearRampToValueAtTime(panTo, t);
  s.start(t0); s.stop(t + 0.2);
}
async function whisperLoop() {
  while (true) {
    await sleep(rnd(6000, 13000) * (1.3 - d));
    if (A.on && started && !scared && d > 0.45) { const l = Math.random() < 0.5; whisper(l ? -1 : 1, l ? -0.3 : 0.3, Math.round(rnd(4, 9)), 0.1 + 0.12 * d); }
  }
}
const MB = [76, 79, 84, 83, 79, 76, 77, 81, 79, 76, 72, 74, 76, 74, 71, 67, 72, 76, 75, 71];
async function musicBoxLoop() {
  let i = 0;
  while (true) {
    const k = d;
    if (A.on && !scared && !inCor && k > 0.26) {
      const f = 440 * Math.pow(2, (MB[i % MB.length] - 69) / 12) * (1 + (Math.random() - 0.5) * 0.04 * k) * (k > 0.7 ? 0.94 : 1);
      const v = 0.05 * clamp((k - 0.26) / 0.3); blip('sine', f, 1.6, v); blip('triangle', f * 2, 0.4, v * 0.25); i++;
      await sleep(330 + 380 * k + (Math.random() < k * 0.3 ? rnd(200, 700) : 0));
    } else await sleep(400);
  }
}
function heartbeat() { if (!A.on) return; blip('sine', 62, 0.22, 0.5, 0, 38); blip('sine', 58, 0.25, 0.4, 0.24, 34); }
function sting(level = 1) {
  if (!A.on) return; const ac = A.ac, t = ac.currentTime;
  A.master.gain.cancelScheduledValues(t); A.master.gain.setValueAtTime(1, t);
  const sh = ac.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) c[i] = Math.tanh((i / 512 - 1) * 6); sh.curve = c;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * level, t + 0.01); g.gain.setTargetAtTime(0.0001, t + 0.8, 0.3);
  sh.connect(g); g.connect(A.master); g.connect(A.verb);
  const base = level > 1 ? [622, 659, 932, 988, 1397, 1480, 1865] : [740, 784, 1046, 1108, 1480, 1568];
  base.forEach((f, i) => {
    const o = ac.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'square';
    o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 1.5);
    const v = ac.createOscillator(); v.frequency.value = 9 + i; const vg = ac.createGain(); vg.gain.value = f * 0.035; v.connect(vg); vg.connect(o.frequency);
    const og = ac.createGain(); og.gain.value = 0.16; o.connect(og); og.connect(sh); o.start(t); v.start(t); o.stop(t + 2); v.stop(t + 2);
  });
  noiseHit(1.3, 1.0, 3000, 0.4, 'highpass'); noiseHit(0.6, 0.9, 400, 0.8, 'lowpass');
  blip('sine', 90, 0.9, 1.0, 0, 28); blip('sawtooth', 220, 1.2, 0.25, 0.02, 60);
}

/* ====================== GATE ====================== */
function start(sound) {
  if (started) return; started = true;
  if (sound) { try { unlockAudio(); } catch (e) {} }
  scrollTo(0, 0);
  $('#gate').classList.add('out'); document.body.classList.remove('locked'); document.body.classList.add('started');
  setTimeout(() => $('#gate').remove(), 1200);
  if (A.on) { const n = A.ac.currentTime; A.pad.gain.setTargetAtTime(0.22, n, 1.2); A.hum.gain.setTargetAtTime(0.05, n, 1.5); A.clat.gain.setTargetAtTime(0.035, n, 1.5); }
  noticeText(); requestAnimationFrame(loop);
}
// fit the gate wordmark to the full width
function fitWord() { const w = $('.g-word'); if (!w) return; w.style.fontSize = '100px'; const r = w.getBoundingClientRect().width; const target = $('#gate').clientWidth - 2 * parseFloat(getComputedStyle($('#gate')).paddingLeft); w.style.fontSize = Math.min(100 * target / r * 0.995, innerHeight * (innerHeight < 720 ? 0.34 : 0.46)) + "px"; }
document.fonts && document.fonts.ready.then(fitWord); fitWord(); addEventListener('resize', fitWord);
$('#enter').addEventListener('click', () => start(true));
$('#enterQuiet').addEventListener('click', () => start(false));
$('#snd').addEventListener('click', () => { kick(); setTimeout(sndState, 300); });
(() => { const h = $('#hint'); if (!h) return; let t = '';
  if (IOS) t = navigator.audioSession ? 'iPhone: volume up. Headphones if you dare.' : 'iPhone: flip the ringer switch on and turn the volume up.';
  else if (PHONE) t = 'Volume up. Headphones if you dare.';
  if (t) { h.textContent = t; h.hidden = false; } })();

/* ====================== GRAIN ====================== */
const GW = LITE ? 128 : 200, GH = LITE ? 80 : 120, GSTEP = RM ? 1e9 : LITE ? 140 : PHONE ? 100 : 80;
const gc = $('#grain'), gx = gc.getContext('2d', { alpha: false }) || gc.getContext('2d'); gc.width = GW; gc.height = GH;
const gimg = gx.createImageData(GW, GH); let gt = 0;
function grain(ts) { if (ts - gt > GSTEP) { gt = ts; const p = gimg.data; for (let i = 0; i < p.length; i += 4) { const v = Math.random() * 255; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; } gx.putImageData(gimg, 0, 0); } }

/* ====================== DREAD ====================== */
const secs = $$('[data-d]');
let secY = []; const measure0 = () => { secY = secs.map(s => ({ y: s.getBoundingClientRect().top + scrollY, v: +s.dataset.d })); };
let trigY = 0;
const measure = () => { measure0(); const t = $('#trigger'); trigY = t.getBoundingClientRect().top + scrollY; };
addEventListener('resize', measure); addEventListener('load', measure); addEventListener('orientationchange', () => setTimeout(measure, 300)); measure(); setInterval(measure, 2000);
function computeD() {
  const mid = scrollY + innerHeight * 0.5; let prev = { y: 0, v: 0 }, val = 0;
  for (const s of secY) { if (mid < s.y) { const span = s.y - prev.y || 1; val = prev.v + (s.v - prev.v) * clamp((mid - prev.y) / span); return clamp(val); } prev = s; val = s.v; }
  return clamp(val);
}
const smooth = x => x * x * (3 - 2 * x);
/* marquee — speeds up and reverses as the night goes on */
const MQ = $('#mq');
const mqA = 'Now booking — Winter season 26/27 — Private hire from $480 — Giggles returns — Twelve seats — One screen — ';
const mqB = 'He returns — He returns — He returns — Please remain seated — He returns — ';
MQ.textContent = mqA.repeat(4); let mqx = 0, mqMode = 0;

/* ====================== LOOP ====================== */
let lastDi = -1, lastBeat = 0, cx = innerWidth / 2, cy = innerHeight / 2, gxp = cx, gyp = cy;
function loop(ts = 0) {
  if (!scared) {
    const nd = computeD();
    if (Math.abs(nd - d) > 0.004) { d = nd; root.style.setProperty('--d', d.toFixed(3)); const t = smooth(clamp((d - 0.15) / 0.33)); root.style.setProperty('--t', t.toFixed(3)); paint(t); const di = Math.round(d * 20) / 20; if (di !== lastDi) { lastDi = di; root.style.setProperty('--di', di); } audioDread(); }
    if (d > 0.8) warmScare();
    // scroll-position fallback for the trigger (momentum flings can skip an IntersectionObserver tick)
    if (trigY && scrollY + innerHeight > trigY + 2) { scare(); }
    if (d > maxD) maxD = d;
    const cor = $('#corridor').getBoundingClientRect();
    const nowCor = cor.top < innerHeight * 0.35 && cor.bottom > 0;
    if (nowCor !== inCor) { inCor = nowCor; document.body.classList.toggle('incor', inCor); audioDread(); }
    const corP = clamp(-cor.top / (cor.height - innerHeight));
    if (inCor && A.on && ts - lastBeat > 1050 - 400 * corP) { lastBeat = ts; heartbeat(); }
    if (inCor) { flashlight(ts); if (corP > 0.45) $('.he2').style.opacity = 1; }
    // marquee
    if (maxD > 0.6 && mqMode === 0) { mqMode = 1; MQ.textContent = mqB.repeat(5); }
    if (!RM) { mqx -= (mqMode ? -1.6 : 0.6); const w = MQ.scrollWidth / (mqMode ? 5 : 4); if (mqx < -w) mqx += w; if (mqx > 0) mqx -= w; MQ.style.transform = `translateX(${mqx}px)`; }
    // cursor (lags more as dread rises; a second cursor follows yours)
    if (FINE) {
      const lag = RM ? 1 : clamp(0.55 - 0.47 * d, 0.06, 1);
      cx += (px - cx) * lag; cy += (py - cy) * lag;
      cur.style.transform = `translate(${cx}px,${cy}px)`;
      gxp += (px - gxp) * 0.025; gyp += (py - gyp) * 0.025;
      ghost.style.transform = `translate(${gxp}px,${gyp}px)`;
      ghost.classList.toggle('on', d > 0.62 && !inCor);
    }
  }
  grain(ts);
  requestAnimationFrame(loop);
}

/* ====================== HERO ====================== */
let heroFlashed = false;
addEventListener('scroll', () => {
  if (!heroFlashed && scrollY > 160) { heroFlashed = true; const hd = $('.h-img .alt'); hd.style.opacity = 1; setTimeout(() => hd.style.opacity = 0, 130); }
  if (maxD > 0.55 && scrollY < innerHeight) $('.h-img .alt').style.opacity = 1;
}, { passive: true });

/* ====================== WORD SWAPS ====================== */
const swapIO = new IntersectionObserver(es => es.forEach(e => {
  const el = e.target; if (!e.isIntersecting || el.classList.contains('done')) return;
  const sec = el.closest('[data-d]'); const at = +(el.dataset.at || (sec ? sec.dataset.d : 0.5));
  if (maxD + 0.03 < at) return;
  clearTimeout(el._t);
  el._t = setTimeout(() => { const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; glitchEl(el, () => { el.textContent = el.dataset.to; el.classList.add('done'); }); }, rnd(900, 2600));
}), { threshold: 1 });
$$('.swap').forEach(el => swapIO.observe(el));
setInterval(() => $$('.swap:not(.done)').forEach(el => { swapIO.unobserve(el); swapIO.observe(el); }), 1500);

/* ====================== GLITCH ====================== */
const dim = $('#dim');
const GL = '#%&@$*!?/\\|';
function glitchEl(el, after) {
  if (RM) { after && after(); return; }
  const orig = el.textContent; el.classList.add('glitch');
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
    const pool = $$('h2,h3,.rc .lab,.quotes cite,.price,.film .ft').filter(e => { const r = e.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight && e.children.length === 0; });
    if (pool.length) glitchEl(pool[Math.floor(Math.random() * pool.length)]);
    if (d > 0.4 && Math.random() < 0.35) { dim.style.opacity = '.62'; setTimeout(() => dim.style.opacity = '0', 110 + Math.random() * 80); }
  }
})();

/* ====================== SUBLIMINAL FRAMES ====================== */
// three single-frame inserts of his face, spaced far apart, only while scrolling
const SUBS = [0.36, 0.6, 0.86]; let subI = 0, lastSub = 0;
addEventListener('scroll', () => {
  if (RM || scared || subI >= SUBS.length || d < SUBS[subI]) return;
  const now = performance.now(); if (now - lastSub < 4000) return;
  lastSub = now; subI++;
  const s = $('#sub'); s.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove('on'))));
  if (A.on) { noiseHit(0.08, 0.25, 3000, 1); blip('sawtooth', 120, 0.25, 0.15, 0, 50); }
}, { passive: true });

/* ====================== SHADOWS ====================== */
const SH = $('#shadows');
const figSVG = '<svg viewBox="0 0 100 300" preserveAspectRatio="xMidYMax meet"><defs><radialGradient id="sg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#000" stop-opacity=".95"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><path fill="url(#sg)" d="M50 18c11 0 18 9 18 21 0 9-4 16-10 19 14 4 24 14 27 32l8 70c1 8-4 11-8 3l-9-40 2 175H62l-6-110h-4l-6 110H30l2-175-9 40c-4 8-9 5-8-3l8-70c3-18 13-28 27-32-6-3-10-10-10-19 0-12 7-21 18-21z"/><circle cx="43" cy="37" r="1.6" fill="#f2e6d8" opacity=".8"/><circle cx="57" cy="37" r="1.6" fill="#f2e6d8" opacity=".8"/></svg>';
function spawnShade() {
  const peek = Math.random() < 0.5, left = Math.random() < 0.5;
  const el = document.createElement('div'); el.className = 'shade ' + (peek ? 'peek' : 'fig') + (left ? ' l' : '');
  if (peek) { el.style.top = rnd(10, 55) + 'vh'; el.style[left ? 'left' : 'right'] = '-' + rnd(4, 12) + 'vw'; el.style.setProperty('--o', (0.45 + 0.4 * d).toFixed(2)); }
  else { el.innerHTML = figSVG; el.style[left ? 'left' : 'right'] = rnd(-4, 4) + 'vw'; el.style.setProperty('--o', (0.5 + 0.45 * d).toFixed(2)); }
  SH.appendChild(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  if (A.on) { noiseHit(1.6, 0.05, 380, 0.6, 'lowpass', 0, left ? -0.9 : 0.9); if (Math.random() < 0.5) whisper(left ? -1 : 1, left ? -1 : 1, 4, 0.12); }
  const kill = () => { el.classList.add('gone'); setTimeout(() => el.remove(), 400); }; el._kill = kill; setTimeout(kill, rnd(2600, 4200));
}
(async function shadeLoop() { while (true) { await sleep(Math.max(1800, 9000 - 7000 * d) * rnd(0.6, 1.4)); if (started && !scared && !inCor && d > 0.3 && SH.children.length < 2) spawnShade(); } })();
function nearKill(x, y) { $$('.shade', SH).forEach(el => { const r = el.getBoundingClientRect(); if (Math.hypot(x - clamp(x, r.left, r.right), y - clamp(y, r.top, r.bottom)) < 140) el._kill && el._kill(); }); }

/* ====================== POINTER ====================== */
const cur = $('#cur'), ghost = $('#ghost'), prev = $('#preview'), prevImg = $('#preview img');
let px = innerWidth / 2, py = innerHeight / 2, lastMove = 0;
addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; lastMove = performance.now(); nearKill(px, py); tiltPoster(); if (prev.classList.contains('on')) prev.style.left = px + 'px', prev.style.top = py + 'px'; }, { passive: true });
addEventListener('touchstart', e => { const t = e.touches[0]; px = t.clientX; py = t.clientY; lastMove = performance.now(); nearKill(px, py); }, { passive: true });
addEventListener('touchmove', e => { const t = e.touches[0]; px = t.clientX; py = t.clientY; lastMove = performance.now(); }, { passive: true });
// programme rows: floating poster follows the cursor (desktop)
$$('.film').forEach(f => {
  f.addEventListener('pointerenter', e => { if (!FINE) return; prevImg.src = f.id === 'g1' && maxD > 0.72 ? img('giggles3') : f.dataset.img; prev.style.left = e.clientX + 'px'; prev.style.top = e.clientY + 'px'; prev.classList.add('on'); cur.classList.add('big'); });
  f.addEventListener('pointerleave', () => { prev.classList.remove('on'); cur.classList.remove('big'); });
});

/* ====================== POSTERS ====================== */
const g1 = $('#g1 img'), g2 = $('#g2 img');
function tiltPoster() {
  if (RM) return; const el = $('#g2'); const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const dx = (px - (r.left + r.width / 2)) / innerWidth, dy = (py - (r.top + r.height / 2)) / innerHeight;
  el.style.transform = `perspective(900px) rotateY(${dx * 24}deg) rotateX(${-dy * 16}deg)`;
}
addEventListener('scroll', () => { if (FINE || RM) return; const el = $('#g2'); const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; el.style.transform = `perspective(900px) rotateX(${(innerHeight / 2 - (r.top + r.height / 2)) / innerHeight * 22}deg)`; }, { passive: true });
let g1seen = 0, g1done = false;
new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting && !g1done) g1seen = setTimeout(() => { g1done = true; g1.src = img('giggles2'); if (A.on) noiseHit(0.2, 0.06, 900, 1); setTimeout(() => g1.src = img('giggles1'), 180); }, 3200);
  else clearTimeout(g1seen);
}), { threshold: 0.6 }).observe($('#g1'));
let g2stage = 0;
new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { if (g2stage === 0) { g2stage = 1; setTimeout(() => $('.whisper').classList.add('show'), 2500); } }
  else if (g2stage === 1 && maxD > 0.66) { g2stage = 2; g2.src = img('giggles3'); $('#g2tag').textContent = 'Last showing'; }
}), { threshold: 0.3 }).observe($('#g2'));
setInterval(() => { if (maxD > 0.72) { g1.src = img('giggles3'); const s = $('#g1 .soon'); if (s) s.textContent = 'now showing'; } }, 1000);

/* ====================== HE APPEARS IN THE ROOMS ====================== */
const heIO = new IntersectionObserver(es => es.forEach(e => {
  const fig = e.target;
  if (e.isIntersecting) fig._t = setTimeout(() => { fig.classList.add('he-on'); if (A.on) whisper(rnd(-1, 1), rnd(-1, 1), 3, 0.08); }, 1800);
  else clearTimeout(fig._t);
}), { threshold: 0.6 });
$$('.room figure').forEach(f => { if (f.querySelector('.he')) heIO.observe(f); });

/* ====================== EXITS / LATE LINES ====================== */
new IntersectionObserver((es, o) => es.forEach(e => {
  if (!e.isIntersecting) return; o.disconnect(); const b = $('#exitCount');
  setTimeout(() => glitchEl(b, () => { b.textContent = '1'; setTimeout(() => glitchEl(b, () => { b.textContent = '0'; b.classList.add('zero'); }), 1600); }), 2200);
}), { threshold: 1 }).observe($('.exits'));
$$('.late').forEach(l => new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting && maxD > 0.3) { setTimeout(() => l.classList.add('show'), 1500); o.disconnect(); } }), { threshold: 1 }).observe(l));
new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) noticeText(); }), { threshold: 0.2 }).observe($('#notice'));

/* ====================== SEATS ====================== */
const map = $('#seatmap'), msg = $('#seatMsg');
let taken = 'C4', mine = null, tapsTaken = 0;
const ROWS = ['B', 'C'];
function renderSeats() {
  map.innerHTML = '';
  ROWS.forEach(r => {
    const l = document.createElement('span'); l.className = 'rowlab'; l.textContent = r; map.appendChild(l);
    for (let i = 1; i <= 6; i++) {
      if (i === 4) map.appendChild(document.createElement('span'));
      const id = r + i, b = document.createElement('button'); b.className = 'seat'; b.textContent = id; b.type = 'button';
      if (id === taken) { b.classList.add('taken'); b.setAttribute('aria-label', id + ' taken'); }
      if (id === mine) b.classList.add('mine');
      b.onclick = () => pickSeat(id); map.appendChild(b);
    }
    const l2 = l.cloneNode(true); map.appendChild(l2);
  });
}
function say(t, bad) { msg.textContent = t; msg.classList.toggle('bad', !!bad); }
function pickSeat(id) {
  if (id === taken) {
    tapsTaken++; const lines = ['Sorry, ' + id + ' is taken.', 'That seat is always taken.', 'Please stop touching his seat.', 'He felt that.'];
    say(lines[Math.min(tapsTaken - 1, lines.length - 1)], tapsTaken > 1); if (A.on) blip('sine', 180 - tapsTaken * 20, 0.5, 0.12, 0, 90); return;
  }
  mine = id; renderSeats(); say('Lovely choice. ' + id + ' is held for you.'); $('#sumSeat').textContent = id;
  if (A.on) blip('sine', 880, 0.5, 0.06);
  setTimeout(() => {
    const row = id[0], n = +id.slice(1); const nb = row + (n < 6 ? n + 1 : n - 1);
    taken = nb; renderSeats(); say('He has moved to ' + nb + '. He wants to sit next to you.', true);
    $('#sumParty').textContent = '1 + 1'; $('#sumSeat').textContent = id + ' (beside ' + nb + ')';
    if (A.on) { noiseHit(0.5, 0.15, 300, 1, 'lowpass'); whisper(0.6, 1, 5, 0.14); }
  }, 1400);
}
renderSeats();

/* ====================== BOOKING ====================== */
let filled = false;
new IntersectionObserver((es, o) => es.forEach(async e => {
  if (!e.isIntersecting || filled) return; filled = true; o.disconnect();
  const t = new Date();
  $('#fDate').dataset.fill = 'tonight. ' + DAYS[t.getDay()] + ' ' + t.getDate() + ' ' + MONTHS[t.getMonth()] + '.';
  $('#fTime').dataset.fill = fmt12(new Date()) + '. that is now.';
  $('#fDev').dataset.fill = device + (PHONE ? ', in your hand' : ', in a dark room');
  if (mine) $('#fSeat').dataset.fill = mine + ' · beside him';
  await sleep(700);
  for (const inp of $$('[data-fill]')) { for (const c of inp.dataset.fill) { inp.value += c; if (A.on) blip('square', rnd(1800, 2400), 0.02, 0.012); await sleep(RM ? 5 : rnd(38, 90)); } await sleep(320); }
  $('#bookMsg').textContent = 'No need to submit. We already have your seat.';
}), { threshold: 0.3 }).observe($('#bookForm'));
$('#confirm').addEventListener('click', () => {
  $('#confirm').textContent = 'Confirmed. Forever.'; $('#bookMsg').textContent = 'Please make your way down the corridor.';
  scrollTo({ top: $('#corridor').getBoundingClientRect().top + scrollY, behavior: RM ? 'auto' : 'smooth' });
});

/* ====================== THE PAGE FIGHTS BACK ====================== */
// 1) once, the wheel goes the wrong way ("please remain seated")
let inverted = false, invUntil = 0;
addEventListener('wheel', e => {
  if (RM || scared) return;
  if (!inverted && d > 0.8 && d < 0.9) { inverted = true; invUntil = performance.now() + 1800; $('#seated').classList.add('on'); if (A.on) { blip('sine', 55, 1.2, 0.6, 0, 30); whisper(-1, 1, 8, 0.2); } setTimeout(() => $('#seated').classList.remove('on'), 1800); }
  if (performance.now() < invUntil) { e.preventDefault(); scrollBy(0, -e.deltaY * 0.9); }
}, { passive: false });
// 2) a few times late on, the page pulls you back up (works on touch too)
let fights = 0, lastY = 0, fightCool = 0;
addEventListener('scroll', () => {
  const y = scrollY, down = y > lastY; lastY = y;
  if (RM || scared || fights >= 3 || d < 0.8 || !down) return;
  const now = performance.now(); if (now - fightCool < 5000 || now < invUntil) return;
  if (Math.random() < 0.04) {
    fights++; fightCool = now; scrollBy({ top: -(160 + Math.random() * 120), behavior: 'smooth' });
    if (!FINE && fights === 1) { $('#seated').classList.add('on'); setTimeout(() => $('#seated').classList.remove('on'), 1400); }
    if (A.on) { blip('sine', 70, 0.4, 0.6, 0, 40); noiseHit(0.3, 0.2, 200, 1, 'lowpass'); }
  }
}, { passive: true });

/* ====================== CORRIDOR ====================== */
const FL = $('#flashlight');
function flashlight(ts) {
  let x = px, y = py; const idle = performance.now() - lastMove > 2500;
  if (idle || RM) { x = innerWidth / 2 + Math.sin(ts / 1400) * innerWidth * 0.18; y = innerHeight * 0.48 + Math.sin(ts / 900) * innerHeight * 0.06; }
  const r = !FINE ? Math.min(innerWidth * 0.75, 300) : 300; const flick = Math.random() < 0.015 ? 0.6 : 1;
  FL.style.setProperty('--fx', x + 'px'); FL.style.setProperty('--fy', y + 'px'); FL.style.setProperty('--r', (r * flick) + 'px');
}

/* ====================== THE SCARE ====================== */
new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !scared) scare(); }), { threshold: 0 }).observe($('#trigger'));
addEventListener('scroll', () => { if (started && !scared && trigY && scrollY + innerHeight > trigY + 2) scare(); }, { passive: true });
// decode the two faces long before they're needed, so the hit never shows a blank frame
let warmed = false;
function warmScare() {
  if (warmed) return; warmed = true;
  const sc = $('#scare');
  $$('img', sc).forEach(i => { try { i.loading = 'eager'; i.decoding = 'sync'; } catch (e) {} });
  [img('clown'), img('clown-close'), img('corridor'), img('corridor-he')].forEach(src => { const i = new Image(); i.src = src; if (i.decode) i.decode().catch(() => {}); });
  sc.classList.add('warm');
  $$('img', sc).forEach(i => { if (i.decode) i.decode().catch(() => {}); });
}
const noTouch = e => { if (e.cancelable && !e.target.closest('#end')) e.preventDefault(); };
let reloadHit = null;
$('#reload').addEventListener('click', () => reloadHit && reloadHit());
async function scare() {
  if (scared || !started) return;
  scared = true; root.classList.add('noscroll'); warmScare(); kick(); sndState();
  // iOS WebKit ignores overflow:hidden for touch scrolling, so stop momentum by hand
  try { addEventListener('touchmove', noTouch, { passive: false }); } catch (e) {}
  ghost.classList.remove('on');
  if (A.on) { const n = A.ac.currentTime; [A.pad, A.hum, A.clat, A.drone, A.wind].forEach(g => { g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, 0.05); }); }
  // the light dies
  const r0 = parseFloat(FL.style.getPropertyValue('--r')) || 260;
  for (let i = 0; i <= 16; i++) { FL.style.setProperty('--r', (r0 * (1 - i / 16)) + 'px'); await sleep(35); }
  await sleep(700);
  // fake-out: the site "breaks". people relax here.
  const off = $('#offline'); off.classList.add('on'); document.title = 'marlowe.cinema';
  cur.style.display = 'none'; document.body.style.cursor = 'default';
  await new Promise(res => { reloadHit = res; setTimeout(res, 4200); });
  reloadHit = null;
  const code = $('#offCode'); code.textContent = 'ERR_HE_IS_BEHIND_YOU'; code.classList.add('he');
  if (A.on) whisper(1, 0.2, 5, 0.22);
  await sleep(850);
  // HIT ONE
  off.classList.remove('on');
  const sc = $('#scare'); if (innerHeight > innerWidth) { sc.classList.add('portrait'); sc.querySelector('.s2').src = img('clown'); } sc.classList.add('go'); sting(1);
  if (!RM) { sc.classList.add('shake'); const f = $('#flash'); f.style.transition = 'none'; f.style.opacity = '.55'; requestAnimationFrame(() => { f.style.transition = 'opacity .45s'; f.style.opacity = '0'; }); }
  if (navigator.vibrate && !RM) try { navigator.vibrate([300, 60, 200, 60, 500]); } catch (e) {}
  await sleep(620);
  // HIT TWO: closer
  sc.classList.add('two'); sting(1.6);
  await sleep(1400);
  sc.classList.remove('shake');
  // black, breathing, then the thank-you
  sc.classList.add('out'); if (A.on) { noiseHit(1.2, 0.08, 500, 0.7, 'lowpass', 0.3, -0.6); noiseHit(1.2, 0.08, 500, 0.7, 'lowpass', 1.8, 0.6); }
  await sleep(1500);
  $('#end').classList.add('show'); document.title = 'Thank you — Marlowe';
  await sleep(1000); sc.style.display = 'none'; cur.style.display = ''; document.body.style.cursor = '';
}

/* ====================== END ====================== */
const shareText = "tried to book a private cinema for date night. the website had other plans (sound on)";
$('#share').href = 'https://x.com/intent/post?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(URL_LIVE);
if (PHONE || WEBVIEW) $$('a[target="_blank"]').forEach(a => a.removeAttribute('target'));
$('#replay').addEventListener('click', () => { scrollTo(0, 0); location.reload(); });

/* ====================== TAB TITLE / FAVICON ====================== */
const fav = $('#favicon'), favOrig = fav.href;
const favEye = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23000'/%3E%3Cellipse cx='16' cy='16' rx='12' ry='7' fill='%23e8dccb'/%3E%3Ccircle cx='16' cy='16' r='4.5' fill='%237a1712'/%3E%3Ccircle cx='16' cy='16' r='1.6' fill='%23000'/%3E%3C/svg%3E";
let hiddenAt = 0;
function cameBack() {
  if (!started || scared || maxD < 0.25) return;
  const el = $('#seated'), old = el.textContent;
  el.textContent = maxD > 0.6 ? 'He kept your seat warm' : 'You left. He didn\u2019t.'; el.classList.add('on');
  if (A.on) { whisper(-1, 1, 6, 0.2); blip('sine', 55, 1.2, 0.4, 0, 30); }
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.textContent = old, 300); }, 2200);
}
addEventListener('pagehide', () => { hiddenAt = performance.now(); });
addEventListener('pageshow', e => { if (e.persisted) cameBack(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = performance.now();
  else { kick(); if (hiddenAt && performance.now() - hiddenAt > 1200) cameBack(); }
  if (scared) return;
  if (document.hidden && maxD > 0.25) { document.title = maxD > 0.6 ? 'he is in your seat' : 'come back'; fav.href = favEye; }
  else { document.title = maxD > 0.6 ? 'Marlowe — he saved your seat' : 'Marlowe — Private Cinema'; fav.href = maxD > 0.6 ? favEye : favOrig; if (!document.hidden && maxD > 0.25 && A.on) whisper(-0.2, 0.2, 4, 0.18); }
});

window.__marlowe = { get d() { return d; }, build: 'v3-x-inapp', env: { IOS, ANDROID, IN_X, WEBVIEW, LOW, LITE, PHONE }, get audio() { return A.on ? A.ac.state : 'off'; }, get warmed() { return warmed; } };
})();
