// assets/core.js — גדלים למחר | תשתית משותפת לכל הלומדות
// גרסה 1.0 | RTL | Vanilla JS | localStorage only
'use strict';

// ── NAMESPACE ──────────────────────────────────────────────────────────────
const GC = window.GC || {};
window.GC = GC;

// ── STATE (set by initLesson) ──────────────────────────────────────────────
GC._steps   = 6;
GC._cur     = 1;
GC._maxR    = 1;   // maxReached
GC._lid     = null; // lessonId
GC._lv      = 0;
GC._mascMsg = {};
GC._cascades= {};
GC._mascTimer = null;

// ── DEFAULTS (overridden by points.config.js if loaded) ───────────────────
if (!GC.LEVELS) GC.LEVELS = [
  [0,'🌱 זרע'],[150,'🌿 שתיל'],[400,'🌳 צמח צעיר'],[700,'🌻 פורח'],[1050,'🏆 חקלאי העתיד'],
];
if (!GC.POINTS) GC.POINTS = { quiz_correct:5 };

// ── MSK (Minimum Sensational Kit) ─────────────────────────────────────────
GC._msk = null;
GC._loadMSK = function() {
  if (GC._msk) return GC._msk;
  try { GC._msk = JSON.parse(localStorage.getItem('gc_msk') || '{"K":0,"S":0,"M":0,"streak":0,"combo":0,"lastLesson":0}'); }
  catch(e) { GC._msk = {K:0,S:0,M:0,streak:0,combo:0,lastLesson:0}; }
  return GC._msk;
};
GC._saveMSK = function() {
  localStorage.setItem('gc_msk', JSON.stringify(GC._msk));
};
GC.trackMSK = function(axis) {
  const m = GC._loadMSK();
  if (axis === 'K' || axis === 'S' || axis === 'M') m[axis] = (m[axis]||0) + 1;
  GC._saveMSK();
};
GC.getMSK = function() { return GC._loadMSK(); };

// ── INIT ───────────────────────────────────────────────────────────────────
GC.initLesson = function(opts) {
  const o = opts || {};
  GC._steps   = o.steps    || 6;
  GC._lid     = o.lessonId || null;
  GC._mascMsg = o.mascotMessages || {};
  GC._cascades= o.cascades || {};
  GC._lv      = GC._lid ? parseInt(localStorage.getItem('ls' + GC._lid) || '0') : 0;

  // Build step dots
  const dotsEl = document.getElementById('dots');
  if (dotsEl) {
    dotsEl.innerHTML = '';
    for (let i = 1; i <= GC._steps; i++) {
      const d = document.createElement('div');
      d.className = 'step-dot' + (i === 1 ? ' current' : '');
      d.title = 'שלב ' + i;
      d.onclick = () => { if (i <= GC._maxR) GC.goTo(i); };
      dotsEl.appendChild(d);
    }
  }

  // Initial display
  GC._syncLeafDisplay();
  GC._updateHeader();
  if (GC._mascMsg[1]) GC.mascotSay(GC._mascMsg[1], '🌱');
};

// ── NAVIGATION ─────────────────────────────────────────────────────────────
GC.goTo = function(n) {
  if (n < 1 || n > GC._steps) return;
  const prev = document.getElementById('step-' + GC._cur);
  if (prev) prev.classList.remove('active');
  GC._cur = n;
  if (GC._cur > GC._maxR) GC._maxR = GC._cur;
  const next = document.getElementById('step-' + GC._cur);
  if (next) next.classList.add('active');
  GC._renderDots();
  GC._updateHeader();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const msg = GC._mascMsg[n];
  if (msg) GC.mascotSay(msg, '🌱');
};

GC._updateHeader = function() {
  const pl = document.getElementById('plabel');
  if (pl) pl.textContent = 'שלב ' + GC._cur + ' מתוך ' + GC._steps;
  const pb = document.getElementById('pbar');
  if (pb) pb.style.width = Math.round((GC._cur / GC._steps) * 100) + '%';
};

GC._renderDots = function() {
  document.querySelectorAll('.step-dot').forEach((d, i) => {
    d.className = 'step-dot' +
      (i + 1 < GC._cur  ? ' done'    : '') +
      (i + 1 === GC._cur ? ' current' : '');
  });
};

// ── LEAVES ─────────────────────────────────────────────────────────────────
GC.addLeaves = function(n, axis) {
  axis = axis || 'K';
  GC._lv += n;
  if (GC._lid) localStorage.setItem('ls' + GC._lid, GC._lv);
  GC._syncLeafDisplay();
  GC._leafBurst(n);
  GC.trackMSK(axis);
};

// Backward compat — called from inline onclick in lesson HTML
function addLv(n) { GC.addLeaves(n, 'K'); }

GC._syncLeafDisplay = function() {
  const lc  = document.getElementById('lc');
  const flv = document.getElementById('final-lv');
  if (lc)  lc.textContent  = GC._lv;
  if (flv) flv.textContent = GC._lv;
};

GC.getLeavesEarned = function() {
  let total = 0;
  for (let i = 1; i <= 17; i++) total += parseInt(localStorage.getItem('ls' + i) || '0');
  return total;
};

GC.getLeavesBalance = function() {
  return Math.max(0, GC.getLeavesEarned() - parseInt(localStorage.getItem('leaves_spent') || '0'));
};

GC._leafBurst = function(n) {
  const count = Math.min(n, 8);
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'leaf-burst';
    el.textContent = '🌿';
    el.style.left = (20 + Math.random() * 60) + 'vw';
    el.style.top  = (15 + Math.random() * 50) + 'vh';
    el.style.setProperty('--tx', (Math.random() * 120 - 60) + 'px');
    el.style.setProperty('--ty', (-80 - Math.random() * 80) + 'px');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }
};

GC.showTotals = function() {
  const earned = GC.getLeavesEarned();
  const lvl = GC.LEVELS.filter(l => earned >= l[0]).pop();
  const elT = document.getElementById('total-leaves-display');
  const elL = document.getElementById('total-level');
  if (elT) elT.textContent = earned;
  if (elL) elL.textContent = lvl[1] + ' (' + earned + ' עלים)';
};

// ── QUIZ ───────────────────────────────────────────────────────────────────
// Called from inline onclick: ansQ(this, true/false, 'qid')
function ansQ(el, correct, qid) {
  const container = document.getElementById(qid);
  if (!container || container.dataset.done) return;
  container.dataset.done = '1';
  container.querySelectorAll('.quiz-opt').forEach(o => o.style.pointerEvents = 'none');
  el.classList.add(correct ? 'correct' : 'wrong');
  if (!correct) {
    const c = container.querySelector('[data-correct="true"]');
    if (c) c.classList.add('correct');
  }
  const fb = document.getElementById('fb-' + qid);
  if (fb) {
    fb.className = 'mt-3 rounded-xl p-4 text-sm ' +
      (correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800');
    fb.textContent = correct ? '✅ מצוין! +5 עלים 🌿' : '❌ לא בדיוק – תשובה נכונה מסומנת בירוק';
    fb.classList.remove('hidden');
  }
  if (correct) GC.addLeaves(GC.POINTS.quiz_correct || 5, 'K');
  // Run lesson-registered cascade
  const casc = GC._cascades[qid];
  if (casc) casc(correct);
}

GC.registerCascades = function(cascadesObj) {
  GC._cascades = Object.assign(GC._cascades, cascadesObj);
};

// ── MASCOT ─────────────────────────────────────────────────────────────────
GC.mascotSay = function(msg, emoji) {
  const m = document.getElementById('mascot');
  const b = document.getElementById('mascot-bubble');
  if (!m || !b) return;
  if (emoji) m.textContent = emoji;
  b.textContent = msg;
  b.classList.remove('hidden');
  m.classList.add('mascot-bounce');
  clearTimeout(GC._mascTimer);
  GC._mascTimer = setTimeout(() => {
    b.classList.add('hidden');
    m.classList.remove('mascot-bounce');
  }, 5000);
};

// ── REVEAL ─────────────────────────────────────────────────────────────────
GC.reveal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
};

// ── DRAG-DROP TOUCH UTILS ──────────────────────────────────────────────────
// Attach touch events to all .drag-item elements in the page
// Each lesson registers its own dropFn(e, zone) and dropZone selector
GC.initTouch = function(dragSelector, dropZoneSelector, dropFn) {
  document.addEventListener('dragstart', e => {
    if (e.target.matches(dragSelector)) GC._dragSrc = e.target;
  });

  document.querySelectorAll(dragSelector).forEach(el => {
    el.addEventListener('touchstart', e => {
      GC._touchSrc = e.currentTarget;
      e.currentTarget.style.opacity = '0.6';
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      document.querySelectorAll(dropZoneSelector).forEach(z => z.classList.remove('drag-over'));
      const found = document.elementFromPoint(t.clientX, t.clientY);
      if (found) {
        const z = found.closest(dropZoneSelector);
        if (z) z.classList.add('drag-over');
      }
    }, { passive: false });

    el.addEventListener('touchend', e => {
      if (GC._touchSrc) GC._touchSrc.style.opacity = '';
      const t = e.changedTouches[0];
      const found = document.elementFromPoint(t.clientX, t.clientY);
      const zone = found ? found.closest(dropZoneSelector) : null;
      if (zone && dropFn) dropFn({ preventDefault: () => {} }, zone);
      document.querySelectorAll(dropZoneSelector).forEach(z => z.classList.remove('drag-over'));
      GC._touchSrc = null;
    });
  });
};

GC._dragSrc  = null;
GC._touchSrc = null;

// Generic drop helper — handles drag-over cleanup + correct/wrong visual
GC.handleDrop = function(e, zone, correctVal, onCorrect, onWrong) {
  e.preventDefault();
  zone.classList.remove('drag-over');
  if (zone.dataset.filled) return false;
  const src = GC._dragSrc || GC._touchSrc;
  if (!src) return false;
  const val = src.dataset.val;
  const ok = (val === correctVal) || (typeof correctVal === 'function' && correctVal(val, zone));
  if (ok) {
    zone.dataset.filled = '1';
    zone.classList.add('correct-drop');
    if (onCorrect) onCorrect(src, zone, val);
    src.classList.add('used');
  } else {
    zone.classList.add('wrong-drop');
    setTimeout(() => zone.classList.remove('wrong-drop'), 400);
    if (onWrong) onWrong(src, zone, val);
  }
  GC._dragSrc = null;
  GC._touchSrc = null;
  return ok;
};

// ── PASSPORT ───────────────────────────────────────────────────────────────
GC.savePassport = function(key, data) {
  try {
    const p = JSON.parse(localStorage.getItem('passport1') || '{}');
    p[key] = data;
    localStorage.setItem('passport1', JSON.stringify(p));
  } catch(e) {}
};

GC.getPassport = function(key) {
  try {
    const p = JSON.parse(localStorage.getItem('passport1') || '{}');
    return key !== undefined ? p[key] : p;
  } catch(e) { return key !== undefined ? null : {}; }
};

// Append to array in passport (for measurement history)
GC.pushPassport = function(key, entry) {
  try {
    const p = JSON.parse(localStorage.getItem('passport1') || '{}');
    if (!Array.isArray(p[key])) p[key] = [];
    p[key].push(entry);
    localStorage.setItem('passport1', JSON.stringify(p));
  } catch(e) {}
};

// ── STUDENT NAME ───────────────────────────────────────────────────────────
GC.getStudentName = function() {
  return localStorage.getItem('studentName') || GC.getPassport('name') || 'תלמיד';
};

// ── SHOW / HIDE BUTTON ─────────────────────────────────────────────────────
GC.showBtn = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};
GC.hideBtn = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

// ────────────────────────────────────────────────────────────────────────────
// ██████████████████████████  P H A S E  2  ████████████████████████████████
// ────────────────────────────────────────────────────────────────────────────

// ── P2.2 · COMBO MULTIPLIER ────────────────────────────────────────────────
GC._combo = 0;
GC._comboMult = function() {
  if (GC._combo >= 5) return 2;
  if (GC._combo >= 3) return 1.5;
  return 1;
};
GC._showComboToast = function(combo, mult) {
  const msgs = { 3:'🔥 Combo ×3! +50%', 4:'🔥🔥 Combo ×4! +50%', 5:'🚀 Combo ×5! DOUBLE!' };
  const colors = { 3:'#f59e0b', 4:'#ef4444', 5:'#7c3aed' };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);background:${colors[combo]||'#ef4444'};color:white;font-family:Heebo,sans-serif;font-weight:900;font-size:1.1rem;padding:12px 28px;border-radius:24px;z-index:9999;animation:gc-fadeUp .3s ease;box-shadow:0 4px 24px rgba(0,0,0,.25);pointer-events:none;`;
  t.textContent = msgs[combo] || `🔥 Combo ×${combo}! DOUBLE!`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
  GC.playSound('combo');
};

// Override ansQ to apply combo logic
const _ansQBase = ansQ;
ansQ = function(el, correct, qid) {
  // Update combo counter BEFORE base call (which calls addLeaves)
  if (correct) {
    GC._combo++;
    const mult = GC._comboMult();
    // Override points temporarily
    const base = GC.POINTS.quiz_correct || 5;
    const bonus = Math.round(base * mult) - base;
    // Call base — it adds `base` points
    _ansQBase(el, correct, qid);
    // Add bonus on top if combo > 1
    if (bonus > 0) GC.addLeaves(bonus, 'K');
    if (GC._combo >= 3) GC._showComboToast(GC._combo, mult);
  } else {
    GC._combo = 0;
    _ansQBase(el, correct, qid);
  }
  GC._checkAchievements();
};

// ── P2.6 · SOUND (Web Audio API, default OFF) ─────────────────────────────
GC._soundCtx = null;
GC.soundOn = JSON.parse(localStorage.getItem('gc_sound') || 'false');

GC._getAudioCtx = function() {
  if (!GC._soundCtx) {
    try { GC._soundCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return GC._soundCtx;
};

GC.playSound = function(type) {
  if (!GC.soundOn) return;
  const ctx = GC._getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  const now = ctx.currentTime;
  if (type === 'leaf') {
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now); osc.stop(now + 0.25);
  } else if (type === 'combo') {
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(660, now + 0.08);
    osc.frequency.setValueAtTime(880, now + 0.16);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now); osc.stop(now + 0.35);
  } else if (type === 'achievement') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.setValueAtTime(659, now + 0.1);
    osc.frequency.setValueAtTime(784, now + 0.2);
    osc.frequency.setValueAtTime(1047, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.start(now); osc.stop(now + 0.55);
  }
};

GC.toggleSound = function() {
  GC.soundOn = !GC.soundOn;
  localStorage.setItem('gc_sound', GC.soundOn);
  const btn = document.getElementById('gc-sound-btn');
  if (btn) btn.textContent = GC.soundOn ? '🔊' : '🔇';
  if (GC.soundOn) GC.playSound('leaf');
};

GC._initSoundBtn = function() {
  const btn = document.createElement('button');
  btn.id = 'gc-sound-btn';
  btn.textContent = GC.soundOn ? '🔊' : '🔇';
  btn.title = 'הפעל/כבה סאונד';
  btn.style.cssText = 'position:fixed;top:68px;left:12px;z-index:60;background:white;border:2px solid #d1fae5;border-radius:50%;width:36px;height:36px;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.1);';
  btn.onclick = GC.toggleSound;
  document.body.appendChild(btn);
};

// ── P2.5 · ACHIEVEMENTS ────────────────────────────────────────────────────
GC._achievementDefs = {
  'first_correct':  { title:'⭐ תשובה ראשונה נכונה!',      desc:'המסע מתחיל', key:'first_correct' },
  'combo_3':        { title:'🔥 Combo ×3!',                desc:'3 ברצף',      key:'combo_3' },
  'level_2':        { title:'🌿 עלית לרמה: שתיל!',         desc:'150+ עלים',   key:'level_2' },
  'level_3':        { title:'🌳 צמח צעיר!',                desc:'400+ עלים',   key:'level_3' },
  'level_4':        { title:'🌻 פורח!',                    desc:'700+ עלים',   key:'level_4' },
  'level_5':        { title:'🏆 חקלאי העתיד!',             desc:'1050+ עלים',  key:'level_5' },
  'all_steps':      { title:'📌 סיימת את כל השלבים!',      desc:'שיעור מלא',   key:'all_steps' },
};

GC._earnedAchievements = function() {
  return JSON.parse(localStorage.getItem('gc_achievements') || '{}');
};

GC._grantAchievement = function(key) {
  const all = GC._earnedAchievements();
  if (all[key]) return;
  all[key] = Date.now();
  localStorage.setItem('gc_achievements', JSON.stringify(all));
  const def = GC._achievementDefs[key];
  if (!def) return;
  GC._showAchievementToast(def);
  GC.playSound('achievement');
};

GC._showAchievementToast = function(def) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-80px);background:linear-gradient(135deg,#166534,#15803d);color:white;font-family:Heebo,sans-serif;padding:14px 24px;border-radius:20px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.25);text-align:center;min-width:200px;transition:transform .4s cubic-bezier(.34,1.56,.64,1);pointer-events:none;';
  t.innerHTML = `<div style="font-weight:900;font-size:1rem;">${def.title}</div><div style="font-size:.8rem;opacity:.8;margin-top:2px;">${def.desc}</div>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    t.style.transform = 'translateX(-50%) translateY(-80px)';
    setTimeout(() => t.remove(), 400);
  }, 2800);
};

GC._checkAchievements = function() {
  const earned = GC.getLeavesEarned();
  const lvlIdx = GC.LEVELS.map(l=>l[0]).filter(t=>earned>=t).length - 1;
  const levelKeys = ['','','level_2','level_3','level_4','level_5'];
  if (levelKeys[lvlIdx]) GC._grantAchievement(levelKeys[lvlIdx]);
  if (GC._combo === 1) GC._grantAchievement('first_correct');
  if (GC._combo >= 3) GC._grantAchievement('combo_3');
  GC._checkStreak();
};

// ── P2.5 · STREAK ─────────────────────────────────────────────────────────
// Counts consecutive lessons (1→N) where ls{N} > 0
GC.getStreak = function() {
  let streak = 0;
  for (let i = 1; i <= 17; i++) {
    if (parseInt(localStorage.getItem('ls' + i) || '0') > 0) streak++;
    else break; // consecutive from the start
  }
  return streak;
};

GC._lastStreakBonus = -1;
GC._checkStreak = function() {
  const streak = GC.getStreak();
  // Bonus every 3 consecutive lessons
  const bonus = Math.floor(streak / 3);
  if (bonus > 0 && bonus !== GC._lastStreakBonus) {
    GC._lastStreakBonus = bonus;
    if (streak % 3 === 0) {
      // Just hit a new multiple of 3
      GC._showAchievementToast({
        title: `🔁 ${streak} שיעורים ברצף!`,
        desc: '+10 עלים בונוס'
      });
      // Add bonus directly (not via addLeaves to avoid recursion)
      if (GC._lid) {
        const cur = parseInt(localStorage.getItem('ls' + GC._lid) || '0');
        localStorage.setItem('ls' + GC._lid, cur + 10);
        GC._syncLeafDisplay();
      }
      GC.playSound('achievement');
    }
  }
};

// ── P2.1 · PLANT TWIN ──────────────────────────────────────────────────────
GC._plantEmojis = ['🌱','🌿','🌳','🌻','🌾'];
GC._plantTwinEl = null;
GC._lastInteraction = Date.now();
GC._inactivityTimer = null;

GC._initPlantTwin = function() {
  const p = GC.getPassport();
  const earned = GC.getLeavesEarned();
  const lvlIdx = Math.min(GC.LEVELS.map(l=>l[0]).filter(t=>earned>=t).length - 1, 4);
  const emoji = GC._plantEmojis[lvlIdx];
  const name = p.plantName || p.name || 'השתיל שלי';

  const wrap = document.createElement('div');
  wrap.id = 'gc-plant-twin';
  wrap.style.cssText = 'position:fixed;bottom:72px;left:8px;z-index:41;';
  wrap.innerHTML = `
    <div id="gc-pt-avatar" style="width:48px;height:48px;border-radius:50%;background:white;border:2.5px solid #d1fae5;display:flex;align-items:center;justify-content:center;font-size:1.6rem;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.1);transition:all .3s;user-select:none;" title="${name}">
      ${emoji}
    </div>
    <div id="gc-pt-tip" style="display:none;position:absolute;bottom:54px;left:0;background:white;border:2px solid #d1fae5;border-radius:14px;padding:10px 14px;min-width:150px;box-shadow:0 4px 20px rgba(0,0,0,.12);font-family:Heebo,sans-serif;">
      <div style="font-weight:900;font-size:.85rem;color:#166534;">${emoji} ${name}</div>
      <div id="gc-pt-earned" style="font-size:.75rem;color:#6b7280;margin-top:4px;">0 עלים 🌿</div>
      <div id="gc-pt-level" style="font-size:.75rem;color:#16a34a;"></div>
    </div>
    <div id="gc-pt-attention" style="display:none;position:absolute;bottom:54px;left:0;background:#fef3c7;border:2px solid #fbbf24;border-radius:12px;padding:8px 12px;min-width:140px;font-family:Heebo,sans-serif;font-size:.75rem;font-weight:700;color:#92400e;">
      💧 הצמח שלך צמא! בוא נמשיך...
    </div>
  `;
  document.body.appendChild(wrap);
  GC._plantTwinEl = wrap;

  const avatar = document.getElementById('gc-pt-avatar');
  const tip = document.getElementById('gc-pt-tip');
  avatar.addEventListener('click', () => {
    const att = document.getElementById('gc-pt-attention');
    if (att) att.style.display = 'none';
    tip.style.display = tip.style.display === 'none' ? 'block' : 'none';
    if (tip.style.display === 'block') GC._updatePlantTwinTip();
  });

  GC._updatePlantTwinTip();
  GC._startInactivityTimer();
};

GC._updatePlantTwinTip = function() {
  const earned = GC.getLeavesEarned();
  const lvlIdx = Math.min(GC.LEVELS.map(l=>l[0]).filter(t=>earned>=t).length - 1, 4);
  const emoji = GC._plantEmojis[lvlIdx];
  const level = GC.LEVELS[lvlIdx];
  const nxt = GC.LEVELS[lvlIdx + 1];

  const av = document.getElementById('gc-pt-avatar');
  if (av) av.textContent = emoji;
  const e = document.getElementById('gc-pt-earned');
  if (e) e.textContent = earned + ' עלים 🌿' + (nxt ? ` · עוד ${nxt[0]-earned} לרמה הבאה` : '');
  const l = document.getElementById('gc-pt-level');
  if (l) l.textContent = level[1];
};

GC._pulsePlantTwin = function() {
  const av = document.getElementById('gc-pt-avatar');
  if (!av) return;
  av.style.transform = 'scale(1.3)';
  av.style.borderColor = '#16a34a';
  setTimeout(() => { av.style.transform = 'scale(1)'; av.style.borderColor = '#d1fae5'; }, 400);
  GC._updatePlantTwinTip();
  GC._lastInteraction = Date.now();
};

GC._startInactivityTimer = function() {
  clearInterval(GC._inactivityTimer);
  GC._inactivityTimer = setInterval(() => {
    if (Date.now() - GC._lastInteraction > 180000) { // 3 minutes
      const att = document.getElementById('gc-pt-attention');
      const tip = document.getElementById('gc-pt-tip');
      if (att && tip && tip.style.display === 'none') {
        att.style.display = 'block';
        setTimeout(() => { if (att) att.style.display = 'none'; }, 5000);
      }
    }
  }, 30000);
};

// ── P2.3 · SIDE QUEST FRAMEWORK ───────────────────────────────────────────
GC._sideQuests = {};

GC.registerSideQuest = function(config) {
  // config: {id, title, description, reward, lessonId}
  GC._sideQuests[config.id] = config;
  const done = GC.getPassport('sideQuests') || {};
  if (!done[config.id]) GC._showSideQuestBanner(config);
};

GC._showSideQuestBanner = function(config) {
  const banner = document.createElement('div');
  banner.id = 'gc-sq-' + config.id;
  banner.style.cssText = 'position:fixed;bottom:130px;left:12px;z-index:42;background:white;border:2px solid #fbbf24;border-radius:14px;padding:10px 14px;max-width:200px;font-family:Heebo,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.12);cursor:pointer;';
  banner.innerHTML = `<div style="font-weight:900;font-size:.8rem;color:#92400e;">⚡ Side Quest</div><div style="font-size:.8rem;color:#374151;margin-top:2px;">${config.title}</div><div style="font-size:.7rem;color:#6b7280;margin-top:2px;">+${config.reward} עלים</div>`;
  banner.onclick = () => banner.remove();
  document.body.appendChild(banner);
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
};

GC.completeSideQuest = function(id) {
  const done = GC.getPassport('sideQuests') || {};
  if (done[id]) return;
  done[id] = Date.now();
  GC.savePassport('sideQuests', done);
  const config = GC._sideQuests[id];
  if (!config) return;
  GC.addLeaves(config.reward || 15, 'M');
  GC._showAchievementToast({ title:'⚡ Side Quest הושלם!', desc: config.title });
};

// ── HOOK: pulse PlantTwin & play sound on every addLeaves call ─────────────
const _addLeavesBase = GC.addLeaves.bind(GC);
GC.addLeaves = function(n, axis) {
  _addLeavesBase(n, axis);
  GC.playSound('leaf');
  GC._pulsePlantTwin();
  GC._checkAchievements();
  GC._lastInteraction = Date.now();
};

// ── AUTO-INIT P2 on DOMContentLoaded ──────────────────────────────────────
// Called automatically after initLesson; we hook into initLesson
const _initLessonBase = GC.initLesson.bind(GC);
GC.initLesson = function(opts) {
  _initLessonBase(opts);
  // P2 auto-inits (deferred so lesson HTML is fully ready)
  setTimeout(() => {
    GC._initPlantTwin();
    GC._initSoundBtn();
    // Auto-register side quest if questions.js is loaded
    if (typeof GC._autoRegisterSideQuest === 'function') GC._autoRegisterSideQuest(GC._lid);
  }, 100);
};

// ── P3.3 · ACCESSIBILITY — keyboard navigation for quiz options ────────────
// Called once per lesson page load; makes all .quiz-opt keyboard-accessible
GC._initA11y = function() {
  // Set up keyboard handling on existing quiz options
  document.querySelectorAll('.quiz-opt').forEach(el => {
    if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });
  // Watch for new quiz opts added dynamically (e.g., bonus questions)
  const obs = new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      const opts = node.classList && node.classList.contains('quiz-opt') ? [node] : node.querySelectorAll ? node.querySelectorAll('.quiz-opt') : [];
      opts.forEach(el => {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();} });
      });
    }));
  });
  obs.observe(document.body, { childList: true, subtree: true });
  // Sound btn accessibility
  const sndBtn = document.getElementById('gc-sound-btn');
  if (sndBtn) { sndBtn.setAttribute('aria-label', 'הפעל/כבה סאונד'); sndBtn.setAttribute('role', 'button'); }
  // Plant twin accessibility
  const ptAvatar = document.getElementById('gc-pt-avatar');
  if (ptAvatar) ptAvatar.setAttribute('aria-label', 'צמח האווטאר שלי — לחץ לפרטים');
};

// Hook a11y init into initLesson
const _initLessonForA11y = GC.initLesson.bind(GC);
GC.initLesson = function(opts) {
  _initLessonForA11y(opts);
  setTimeout(() => GC._initA11y(), 200);
};

// ── GLOBAL WRAPPERS (backward compat for inline onclick handlers) ──────────
// These allow lesson HTML to keep: onclick="goTo(2)", onclick="mascotSay(...)", etc.
function goTo(n)               { GC.goTo(n); }
function mascotSay(msg, emoji) { GC.mascotSay(msg, emoji); }
// addLv and ansQ are already defined as globals above
