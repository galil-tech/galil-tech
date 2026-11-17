// assets/phase2-lesson.js — גדלים למחר | מנוע לומדות פאזה 2 (אקדמיית הרובוטים, 5.5–8)
// כל לומדה = קובץ HTML קצר עם קונפיגורציה + P2.render(config). המנוע בונה את הדף, משתמש
// ב-GC (עלים, דרכון, מסקוט, סנכרון) ומעניק עלים פעם אחת לכל פריט (passport.p2aw_<lesson>).
// סוגי שלבים: intro · match · sort · order · quiz · wires · lab · checklist · idcard · finish
'use strict';

(function () {
  const P2 = window.P2 = {};
  let C = null;          // config
  let AW = {};           // פריטים שכבר הוענקו עליהם עלים

  // ── עזרים ────────────────────────────────────────────────────────────────
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const say = (m, e) => { try { GC.mascotSay(m, e || '🤖'); } catch (x) {} };
  const sound = (t) => { try { GC.playSound(t); } catch (x) {} };

  function getRobot() { const r = GC.getPassport('robot'); return (r && typeof r === 'object') ? r : {}; }
  function saveRobot(r) { GC.savePassport('robot', r); if (window.GC_SYNC) GC_SYNC.scheduleSync(); }

  // עלים פעם אחת לכל מפתח
  P2.award = function (key, n) {
    if (!n || AW[key]) return false;
    AW[key] = 1;
    GC.savePassport('p2aw_' + C.lesson, AW);
    GC.addLeaves(n, 'S');
    return true;
  };

  // ── CSS ──────────────────────────────────────────────────────────────────
  const CSS = `
  .p2-card{background:#fff;border-radius:24px;box-shadow:0 6px 24px rgba(0,0,0,.07);padding:24px;margin-bottom:20px}
  .p2-chip{display:inline-block;cursor:pointer;user-select:none;border:2px solid #cbd5e1;background:#fff;border-radius:14px;padding:10px 14px;margin:4px;font-weight:700;transition:all .15s;min-height:44px}
  .p2-chip:hover{border-color:#16a34a}
  .p2-chip.sel{border-color:#2563eb;background:#dbeafe;transform:scale(1.04)}
  .p2-chip.ok{border-color:#16a34a;background:#dcfce7;cursor:default}
  .p2-chip.bad{border-color:#dc2626;background:#fee2e2;animation:p2shake .35s}
  .p2-chip.ltr,.p2-ltr{direction:ltr;font-family:Consolas,monospace;text-align:left;white-space:pre;max-width:100%;overflow-x:auto}
  .p2-zone{border:2.5px dashed #94a3b8;border-radius:18px;padding:10px;min-height:110px;cursor:pointer;background:#f8fafc;transition:all .15s}
  .p2-zone:hover{border-color:#16a34a;background:#f0fdf4}
  .p2-zone h4{font-weight:900;margin-bottom:6px}
  .p2-slot{border:2px dashed #94a3b8;border-radius:12px;padding:8px 12px;margin:6px 0;min-height:44px;background:#f8fafc}
  .p2-slot.ok{border-style:solid;border-color:#16a34a;background:#dcfce7}
  .p2-opt{display:block;width:100%;text-align:right;border:2px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin:6px 0;background:#fff;font-weight:600;cursor:pointer}
  .p2-opt:hover{border-color:#16a34a}
  .p2-opt.ok{border-color:#16a34a;background:#dcfce7}
  .p2-opt.bad{border-color:#dc2626;background:#fee2e2}
  .p2-done{background:#dcfce7;border:2px solid #16a34a;color:#14532d;border-radius:16px;padding:10px 14px;font-weight:800;margin-top:14px;display:none}
  .p2-done.show{display:block}
  .p2-why{font-size:.85rem;color:#475569;margin-top:6px;display:none}
  .p2-why.show{display:block}
  .p2-btn{background:#166534;color:#fff;font-weight:900;border-radius:16px;padding:12px 22px;cursor:pointer;border:0;font-size:1rem}
  .p2-btn:hover{background:#15803d}
  .p2-btn.ghost{background:#e2e8f0;color:#334155}
  .p2-goal{display:inline-block;border-radius:999px;padding:4px 12px;margin:3px;font-size:.8rem;font-weight:800;background:#f1f5f9;color:#64748b}
  .p2-goal.ok{background:#dcfce7;color:#166534}
  .p2-check{display:flex;gap:10px;align-items:flex-start;border:2px solid #e2e8f0;border-radius:14px;padding:12px;margin:8px 0;cursor:pointer;background:#fff}
  .p2-check.ok{border-color:#16a34a;background:#f0fdf4}
  .p2-check input{width:22px;height:22px;margin-top:2px;flex-shrink:0}
  .p2-in{width:100%;border:2px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:1rem}
  .p2-in:focus{outline:none;border-color:#16a34a}
  .p2-sentence{background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:18px;padding:10px 16px;font-weight:900;color:#78350f;display:inline-block}
  @keyframes p2shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  .step-panel{display:none}.step-panel.active{display:block;animation:p2up .35s ease}
  @keyframes p2up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  .step-dot{width:13px;height:13px;border-radius:50%;background:#bbf7d0;cursor:pointer;transition:all .3s}
  .step-dot.done{background:#84cc16}.step-dot.current{background:#166534;transform:scale(1.5)}
  .leaf-burst{position:fixed;pointer-events:none;font-size:1.4rem;animation:p2burst .9s ease forwards;z-index:999}
  @keyframes p2burst{to{opacity:0;transform:translate(var(--tx),var(--ty)) scale(.3)}}
  `;

  // ── שלד הדף ──────────────────────────────────────────────────────────────
  function shell() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    document.body.className = 'bg-gradient-to-br from-slate-50 to-emerald-50 min-h-screen';
    const R = C.root;
    const robot = getRobot();
    const elTrack = C.track === 'elementary';
    document.body.insertAdjacentHTML('afterbegin', `
<div class="fixed bottom-24 left-4 z-40 flex items-end gap-3 pointer-events-none" style="max-width:240px">
  <div id="mascot" class="mascot">🤖</div>
  <div id="mascot-bubble" class="hidden bg-white border-2 border-green-300 rounded-2xl px-4 py-3 text-sm font-bold text-green-900 shadow-xl" style="max-width:180px"></div>
</div>
<nav class="bg-green-800 text-white sticky top-0 z-50 shadow-xl">
  <div class="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
    <a href="${R}index.html" class="text-lg font-bold">🌱 גדלים למחר</a>
    <div class="flex gap-4 text-sm">
      <a href="${R}index.html#lessons-section" class="hover:text-lime-300">🌱 שיעורים</a>
      <a href="${R}wall.html" class="hover:text-lime-300">🛠 קיר</a>
      <a href="${R}leaves.html" class="hover:text-lime-300">🏆 עלים</a>
    </div>
  </div>
</nav>
<header class="bg-gradient-to-r from-slate-800 to-emerald-900 text-white pt-8 pb-6 px-4">
  <div class="max-w-4xl mx-auto">
    <div class="flex flex-wrap gap-2 mb-3 text-xs">
      <span class="bg-lime-400 text-lime-900 font-bold px-3 py-1 rounded-full">פאזה 2 · 🤖 אקדמיית הרובוטים ${C.part}/4</span>
      <span class="bg-white/20 px-3 py-1 rounded-full">שיעור ${C.label}</span>
      ${robot.name ? `<span class="bg-white/20 px-3 py-1 rounded-full">הרובוט שלנו: <b>${esc(robot.name)}</b></span>` : ''}
    </div>
    <h1 class="text-3xl md:text-4xl font-black mb-2">${C.emoji} ${C.title}</h1>
    <p class="text-emerald-100">הרובוט מקבל היום: <b>${C.organ}</b></p>
    <p class="mt-2"><span class="p2-sentence">💬 ${C.sentence}</span></p>
    <div class="mt-5">
      <div class="flex justify-between text-sm text-emerald-200 mb-1"><span id="plabel">שלב 1</span><span>🌿 <b id="lc">0</b> עלים</span></div>
      <div class="bg-white/20 rounded-full h-2"><div id="pbar" class="bg-lime-400 h-2 rounded-full transition-all" style="width:0%"></div></div>
      <div id="dots" class="flex gap-2 mt-3 justify-center"></div>
    </div>
  </div>
</header>
<main id="p2-main" class="max-w-4xl mx-auto px-4 py-8"></main>`);
    if (elTrack) document.documentElement.classList.add('p2-el');
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ── בניית שלב ────────────────────────────────────────────────────────────
  function buildStep(s, i, total) {
    const n = i + 1;
    const panel = el('div', 'step-panel' + (n === 1 ? ' active' : ''));
    panel.id = 'step-' + n;
    const card = el('div', 'p2-card');
    const lv = s.leaves ? `<span class="text-sm font-bold text-lime-700 bg-lime-100 rounded-full px-3 py-1">🌿 ${s.leaves}</span>` : '';
    card.innerHTML = `<div class="flex justify-between items-start gap-3 mb-3"><h2 class="text-2xl font-black text-gray-900">${s.title}</h2>${lv}</div>` +
      (s.intro ? `<div class="text-gray-700 mb-4 leading-relaxed">${s.intro}</div>` : '');
    const body = el('div');
    card.appendChild(body);
    const done = el('div', 'p2-done', s.doneText || '✅ מעולה! השלב הושלם.');
    card.appendChild(done);
    panel.appendChild(card);

    const complete = () => {
      if (done.classList.contains('show')) return;
      done.classList.add('show');
      sound('correct');
      if (s.leaves) P2.award('s' + n, s.leaves);
      if (s.mascotDone) say(s.mascotDone, '🎉');
    };

    const T = TYPES[s.type];
    if (T) T(body, s, complete, n);

    if (s.type !== 'finish') {
      const nav = el('div', 'flex justify-between mt-2');
      nav.innerHTML = (n > 1 ? `<button class="p2-btn ghost" type="button">→ חזרה</button>` : '<span></span>') +
        `<button class="p2-btn" type="button">${n === total - 1 ? 'לסיום 🏁' : 'המשך ←'}</button>`;
      const btns = nav.querySelectorAll('button');
      if (n > 1) btns[0].onclick = () => GC.goTo(n - 1);
      btns[btns.length - 1].onclick = () => GC.goTo(n + 1);
      panel.appendChild(nav);
    }
    return panel;
  }

  // ── סוגי שלבים ───────────────────────────────────────────────────────────
  const TYPES = {};

  TYPES.intro = function (body, s, complete) {
    if (s.html) body.insertAdjacentHTML('beforeend', s.html);
    complete();
  };

  // התאמת זוגות: לוחצים על פריט מימין ואז על בן הזוג משמאל
  TYPES.match = function (body, s, complete) {
    const wrap = el('div', 'grid grid-cols-2 gap-4');
    const L = el('div'), Rr = el('div');
    wrap.append(L, Rr); body.appendChild(wrap);
    let sel = null, left = s.pairs.length;
    s.pairs.forEach((p, k) => {
      const a = el('div', 'p2-chip block' + (s.ltrLeft ? ' ltr' : ''), p[0]); a.dataset.k = k;
      a.onclick = () => { if (a.classList.contains('ok')) return; L.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); a.classList.add('sel'); sel = a; };
      L.appendChild(a);
    });
    shuffle(s.pairs.map((p, k) => [p[1], k])).forEach(([txt, k]) => {
      const b = el('div', 'p2-chip block' + (s.ltrRight ? ' ltr' : ''), txt);
      b.onclick = () => {
        if (b.classList.contains('ok')) return;
        if (!sel) { say(s.hint || 'קודם בחרו פריט מהעמודה הימנית 👉', '🤔'); return; }
        if (String(k) === sel.dataset.k) {
          sel.classList.remove('sel'); sel.classList.add('ok'); b.classList.add('ok'); sel = null; sound('correct');
          if (--left === 0) complete();
        } else { b.classList.add('bad'); sound('wrong'); setTimeout(() => b.classList.remove('bad'), 400); }
      };
      Rr.appendChild(b);
    });
  };

  // מיון לעמודות: לוחצים על פריט ואז על העמודה
  TYPES.sort = function (body, s, complete) {
    const pool = el('div', 'mb-4 text-center');
    const cols = el('div', 'grid gap-3 grid-cols-' + s.columns.length);
    body.append(pool, cols);
    let sel = null, left = s.items.length;
    const zones = s.columns.map((c, ci) => {
      const z = el('div', 'p2-zone', `<h4>${c}</h4>`);
      z.onclick = () => {
        if (!sel) { say('קודם בחרו כרטיס 👆', '🤔'); return; }
        if (Number(sel.dataset.c) === ci) {
          sel.classList.remove('sel'); sel.classList.add('ok'); z.appendChild(sel); sel = null; sound('correct');
          if (--left === 0) complete();
        } else {
          const w = sel; w.classList.add('bad'); sound('wrong'); setTimeout(() => w.classList.remove('bad'), 400);
          const why = s.items[Number(w.dataset.i)][2]; if (why) say(why, '💡');
        }
      };
      cols.appendChild(z); return z;
    });
    shuffle(s.items.map((it, ii) => [it, ii])).forEach(([it, ii]) => {
      const c = el('div', 'p2-chip' + (s.ltr ? ' ltr' : ''), s.ltr ? esc(it[0]) : it[0]); c.dataset.c = it[1]; c.dataset.i = ii;
      c.onclick = (e) => { e.stopPropagation(); if (c.classList.contains('ok')) return; pool.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); c.classList.add('sel'); sel = c; };
      pool.appendChild(c);
    });
    void zones;
  };

  // סידור לפי הסדר: לוחצים על הפריטים לפי הסדר הנכון
  TYPES.order = function (body, s, complete) {
    const slots = el('div', 'mb-4'), pool = el('div', 'text-center');
    body.append(slots, pool);
    let next = 0;
    const show = (x) => (s.ltr ? esc(x) : x); // קוד: "<" כטקסט, לא כ-HTML
    const slotEls = s.items.map((_, k) => { const d = el('div', 'p2-slot' + (s.ltr ? ' p2-ltr' : ''), `<span class="text-gray-400">${k + 1}.</span>`); slots.appendChild(d); return d; });
    shuffle(s.items.map((t, k) => [t, k])).forEach(([t, k]) => {
      const c = el('div', 'p2-chip' + (s.ltr ? ' ltr' : ''), show(t));
      c.onclick = () => {
        if (c.classList.contains('ok')) return;
        if (k === next) {
          slotEls[k].innerHTML = show(t); slotEls[k].classList.add('ok'); c.remove(); next++; sound('correct');
          if (next === s.items.length) complete();
        } else { c.classList.add('bad'); sound('wrong'); setTimeout(() => c.classList.remove('bad'), 400); if (s.hints && s.hints[next]) say(s.hints[next], '💡'); }
      };
      pool.appendChild(c);
    });
  };

  // שאלות: אפשר לנסות שוב; השלב מושלם כשכל השאלות נענו נכון
  TYPES.quiz = function (body, s, complete) {
    let left = s.questions.length;
    s.questions.forEach((q) => {
      const box = el('div', 'mb-5');
      box.innerHTML = `<p class="font-bold text-gray-800 mb-2">${q.q}</p>`;
      const why = el('div', 'p2-why', q.why ? '💡 ' + q.why : '');
      let solved = false;
      q.opts.forEach((o, k) => {
        const b = el('button', 'p2-opt' + (q.ltr ? ' p2-ltr' : ''), o); b.type = 'button';
        b.onclick = () => {
          if (solved) return;
          if (k === q.a) { b.classList.add('ok'); solved = true; why.classList.add('show'); sound('correct'); if (--left === 0) complete(); }
          else { b.classList.add('bad'); sound('wrong'); if (q.wrong) say(q.wrong, '🤔'); }
        };
        box.appendChild(b);
      });
      box.appendChild(why);
      body.appendChild(box);
    });
  };

  // חיווט: לכל רגל ברכיב בוחרים לאן היא מתחברת בלוח
  TYPES.wires = function (body, s, complete) {
    const tbl = el('div', 'space-y-3');
    body.appendChild(tbl);
    const state = s.pins.map(() => false);
    s.pins.forEach((p, k) => {
      const row = el('div', 'flex flex-wrap items-center gap-3 p2-slot');
      row.innerHTML = `<span class="font-black min-w-[140px]">${p.part}</span><span>←</span>`;
      const sel = el('select', 'p2-in', '<option value="">בחרו…</option>' + s.board.map((b) => `<option>${b}</option>`).join(''));
      sel.style.width = 'auto';
      const fb = el('span', 'text-sm font-bold');
      sel.onchange = () => {
        if (sel.value === p.answer) { state[k] = true; row.classList.add('ok'); fb.textContent = '✅'; sel.disabled = true; sound('correct'); if (state.every(Boolean)) complete(); }
        else if (sel.value) { fb.textContent = '❌ ' + (p.wrong && p.wrong[sel.value] ? p.wrong[sel.value] : 'לא לשם. נסו שוב.'); sound('wrong'); }
      };
      row.append(sel, fb); tbl.appendChild(row);
    });
  };

  // צ'קליסט מעשי – כל משימה עלים משלה, מסמנים אחרי אישור המדריך/ה
  TYPES.checklist = function (body, s, complete, n) {
    body.insertAdjacentHTML('beforeend', `<p class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2 mb-2">👩‍🏫 מסמנים רק <b>אחרי שהמדריך/ה אישר/ה</b> את המשימה.</p>`);
    let left = s.items.length;
    s.items.forEach((it, k) => {
      const key = 'c' + n + '_' + k;
      const lab = el('label', 'p2-check');
      lab.innerHTML = `<input type="checkbox"><span class="flex-1"><b>${it.text}</b>${it.sub ? `<br><span class="text-sm text-gray-500">${it.sub}</span>` : ''}</span>${it.leaves ? `<span class="text-sm font-bold text-lime-700">🌿 ${it.leaves}</span>` : ''}`;
      const cb = lab.querySelector('input');
      const mark = () => { lab.classList.add('ok'); cb.checked = true; cb.disabled = true; };
      if (AW[key]) { mark(); left--; }
      cb.onchange = () => { if (!cb.checked) return; mark(); P2.award(key, it.leaves || 0); sound('correct'); if (--left === 0) complete(); };
      body.appendChild(lab);
    });
    if (left === 0) setTimeout(complete, 0);
  };

  // תעודת הרובוט + ניחוש + משפט סגירה
  TYPES.idcard = function (body, s, complete, n) {
    const robot = getRobot();
    const lk = 'l' + C.lesson;
    robot[lk] = robot[lk] || {};
    const fields = el('div', 'grid md:grid-cols-2 gap-3 mb-4');
    const inputs = [];
    (s.fields || []).forEach((f) => {
      const shared = f.shared; // נשמר ברמת הרובוט (שם, משימה...) ולא ברמת השיעור
      const cur = shared ? robot[f.key] : robot[lk][f.key];
      const w = el('div', f.wide ? 'md:col-span-2' : '');
      let inp;
      if (f.options) {
        inp = el('select', 'p2-in', '<option value="">בחרו…</option>' + f.options.map((o) => `<option${o === cur ? ' selected' : ''}>${o}</option>`).join(''));
      } else {
        inp = el('input', 'p2-in' + (f.ltr ? ' p2-ltr' : '')); inp.value = cur || ''; inp.placeholder = f.placeholder || '';
        if (f.max) inp.maxLength = f.max;
      }
      inp.oninput = inp.onchange = () => {
        let v = inp.value;
        if (f.ascii) { v = v.replace(/[^A-Za-z0-9 \-]/g, '').toUpperCase(); if (v !== inp.value) inp.value = v; }
        const r = getRobot(); r[lk] = r[lk] || {};
        if (shared) r[f.key] = v; else r[lk][f.key] = v;
        saveRobot(r); check();
      };
      w.innerHTML = `<label class="block text-sm font-bold text-gray-600 mb-1">${f.label}</label>`;
      w.appendChild(inp); fields.appendChild(w); inputs.push(inp);
    });
    body.appendChild(fields);

    let guessed = !!robot[lk].guess;
    if (s.guess) {
      const g = el('div', 'bg-violet-50 border-2 border-violet-200 rounded-2xl p-4 mb-4');
      g.innerHTML = `<p class="font-black text-violet-900 mb-2">🔮 ${s.guess.q}</p><p class="text-xs text-violet-700 mb-2">ניחוש – אין תשובה נכונה עדיין. נגלה בשיעור הבא!</p>`;
      s.guess.opts.forEach((o) => {
        const b = el('button', 'p2-opt' + (robot[lk].guess === o ? ' ok' : ''), o); b.type = 'button';
        b.onclick = () => { g.querySelectorAll('.p2-opt').forEach((x) => x.classList.remove('ok')); b.classList.add('ok'); const r = getRobot(); r[lk] = r[lk] || {}; r[lk].guess = o; saveRobot(r); guessed = true; check(); };
        g.appendChild(b);
      });
      body.appendChild(g);
    }
    const ns = el('div', 'bg-amber-50 border-2 border-amber-200 rounded-2xl p-4');
    ns.innerHTML = `<p class="font-black text-amber-900 mb-2">⭐ משפט סגירה – איך זה רלוונטי לפרויקט שלי?</p>
      <label class="text-sm text-gray-600">היום הרובוט שלנו למד ש…</label>`;
    const a1 = el('input', 'p2-in mb-2'); a1.value = robot[lk].learned || '';
    const l2 = el('label', 'text-sm text-gray-600', 'ובפרויקט שלנו זה יעזור ל…');
    const a2 = el('input', 'p2-in'); a2.value = robot[lk].project || '';
    const upd = () => { const r = getRobot(); r[lk] = r[lk] || {}; r[lk].learned = a1.value; r[lk].project = a2.value; saveRobot(r); check(); };
    a1.oninput = upd; a2.oninput = upd;
    ns.append(a1, l2, a2); body.appendChild(ns);

    function check() {
      const filled = inputs.every((x) => String(x.value || '').trim().length > 0);
      if (filled && (!s.guess || guessed) && a1.value.trim().length >= 3 && a2.value.trim().length >= 3) complete();
    }
    check();
  };

  TYPES.finish = function (body, s) {
    const R = C.root;
    body.insertAdjacentHTML('beforeend', `
      <div class="text-center">
        <div class="text-6xl mb-3">${s.emoji || '🎓'}</div>
        <p class="text-lg text-gray-700 mb-4">${s.html || ''}</p>
        <p class="text-2xl font-black text-green-800 mb-6">🌿 <span id="final-lv">0</span> עלים בשיעור הזה</p>
        <div class="flex flex-wrap gap-3 justify-center">
          <a href="${R}wall.html" class="p2-btn" style="text-decoration:none">📸 לקיר</a>
          <a href="${R}index.html#lessons-section" class="p2-btn ghost" style="text-decoration:none">🌱 לדף השיעורים</a>
        </div>
      </div>`);
  };

  // ── מעבדות (סימולציות) ───────────────────────────────────────────────────
  TYPES.lab = function (body, s, complete) {
    const L = LABS[s.lab];
    if (!L) { body.textContent = 'lab missing: ' + s.lab; return; }
    const goalsBox = el('div', 'mb-3');
    const goals = {};
    (s.goals || []).forEach((g) => { const b = el('span', 'p2-goal', '⬜ ' + g[1]); goals[g[0]] = b; goalsBox.appendChild(b); });
    body.appendChild(goalsBox);
    const stage = el('div'); body.appendChild(stage);
    const hit = (id, msg) => {
      const b = goals[id]; if (!b || b.classList.contains('ok')) return;
      b.classList.add('ok'); b.textContent = '✅ ' + b.textContent.slice(2); sound('correct');
      if (msg) say(msg, '💡');
      if (Object.values(goals).every((x) => x.classList.contains('ok'))) complete();
    };
    L(stage, s, hit);
  };

  const LABS = {};

  // לחץ / וולט: סליידר 0–5, ב-5V הצינור הדק מתפוצץ
  LABS.pressure = function (st, s, hit) {
    st.innerHTML = `
      <div class="text-center mb-2 font-black text-3xl"><span id="pv">0.0</span> V</div>
      <input id="ps" type="range" min="0" max="5" step="0.1" value="0" class="w-full" style="accent-color:#16a34a" dir="ltr">
      <div class="flex justify-between text-xs text-gray-500" dir="ltr"><span>0V</span><span>3.3V</span><span>5V</span></div>
      <div id="pipe" class="mt-4 rounded-2xl p-5 text-center font-black text-lg transition-all">💧</div>`;
    const sl = $('#ps', st), pv = $('#pv', st), pipe = $('#pipe', st);
    const draw = () => {
      const v = Number(sl.value); pv.textContent = v.toFixed(1);
      if (v >= 4.5) { pipe.style.background = '#fee2e2'; pipe.textContent = '💥 הצינור הדק התפוצץ! הפין נשרף'; hit('burst', 'זה מה שקורה לפין עם 5V. לכן החיישן תמיד ל-3V3!'); }
      else if (v >= 3.2 && v <= 3.4) { pipe.style.background = '#dcfce7'; pipe.textContent = '✅ 3.3V – בדיוק מה שהפינים בנויים לו'; hit('safe'); }
      else if (v > 3.4) { pipe.style.background = '#fef3c7'; pipe.textContent = '⚠️ הצינור נמתח… עוד קצת והוא נקרע'; }
      else { pipe.style.background = '#e0f2fe'; pipe.textContent = v < 0.5 ? '💤 אין לחץ – שום דבר לא זורם' : '💧 זורם בעדינות'; }
    };
    sl.oninput = draw; draw();
  };

  // סוללה + נגד + נורית
  LABS.battery = function (st, s, hit) {
    const simple = !!s.simple;
    st.innerHTML = `
      <div class="grid md:grid-cols-2 gap-4 items-center">
        <svg viewBox="0 0 300 200" class="w-full bg-slate-50 rounded-2xl" dir="ltr">
          <rect x="20" y="70" width="40" height="70" rx="6" fill="#334155"/><text x="40" y="66" font-size="14" text-anchor="middle" fill="#334155">🔋</text>
          <text x="40" y="100" font-size="16" fill="#fff" text-anchor="middle">+</text><text x="40" y="132" font-size="16" fill="#fff" text-anchor="middle">−</text>
          <path id="w1" d="M60 90 H130" stroke="#dc2626" stroke-width="5" fill="none"/>
          <rect id="res" x="130" y="80" width="50" height="20" rx="4" fill="#d97706"/>
          <path d="M180 90 H230 V105" stroke="#dc2626" stroke-width="5" fill="none"/>
          <circle id="led" cx="230" cy="125" r="18" fill="#e5e7eb" stroke="#64748b" stroke-width="2"/>
          <text id="ledm" x="230" y="131" font-size="14" text-anchor="middle">+</text>
          <path id="w2" d="M230 143 V170 H40 V140" stroke="#1e293b" stroke-width="5" fill="none"/>
          <circle id="gap" cx="135" cy="170" r="0" fill="#fff"/>
        </svg>
        <div class="space-y-2">
          <button id="b-wire" class="p2-btn w-full" type="button">🔌 נתקו חוט</button>
          ${simple ? '' : `<button id="b-res" class="p2-btn ghost w-full" type="button">🟫 החליפו לנגד גדול</button>
          <button id="b-flip" class="p2-btn ghost w-full" type="button">🔄 הפכו את הנורית</button>`}
          <p id="bmsg" class="text-sm font-bold text-gray-700 pt-2"></p>
        </div>
      </div>`;
    let closed = true, big = false, flipped = false;
    const led = $('#led', st), w2 = $('#w2', st), msg = $('#bmsg', st), res = $('#res', st), ledm = $('#ledm', st);
    const draw = () => {
      w2.setAttribute('stroke-dasharray', closed ? '' : '120 30 400');
      res.setAttribute('width', big ? 50 : 50); res.setAttribute('fill', big ? '#7c2d12' : '#d97706');
      ledm.textContent = flipped ? '−' : '+';
      let on = closed && !flipped;
      led.setAttribute('fill', on ? (big ? '#fde68a' : '#facc15') : '#e5e7eb');
      led.setAttribute('filter', on && !big ? 'drop-shadow(0 0 8px #facc15)' : '');
      if (!closed) { msg.textContent = '⭕ מעגל פתוח – החשמל לא יכול לחזור. כבוי.'; hit('open'); }
      else if (flipped) { msg.textContent = '🚫 הנורית הפוכה – היא כמו שסתום חד-כיווני. כבוי.'; hit('flip'); }
      else if (big) { msg.textContent = '🌙 נגד גדול = צינור צר – עובר פחות, הנורית חלשה.'; hit('dim'); }
      else { msg.textContent = '💡 סגור – החשמל עושה סיבוב שלם. דולק!'; hit('lit'); }
    };
    $('#b-wire', st).onclick = (e) => { closed = !closed; e.target.textContent = closed ? '🔌 נתקו חוט' : '🔌 חברו את החוט'; draw(); };
    if (!simple) {
      $('#b-res', st).onclick = (e) => { big = !big; e.target.textContent = big ? '🟧 החזירו לנגד קטן' : '🟫 החליפו לנגד גדול'; draw(); };
      $('#b-flip', st).onclick = () => { flipped = !flipped; draw(); };
    }
    draw();
  };

  // מעגל עם מתג + "קיצור דרך" (קצר)
  LABS.switch = function (st, s, hit) {
    const water = !!s.water;
    st.innerHTML = `
      <div class="grid md:grid-cols-2 gap-4 items-center">
        <div id="sv" class="rounded-2xl bg-slate-50 p-6 text-center text-5xl" style="min-height:150px">💡</div>
        <div class="space-y-2">
          <button id="b-sw" class="p2-btn w-full" type="button">${water ? '🚰 פתחו את הברז' : '🔘 סגרו את המתג'}</button>
          <button id="b-sc" class="p2-btn ghost w-full" type="button">${water ? '↪️ הוסיפו צינור עוקף' : '↪️ הוסיפו קיצור דרך'}</button>
          <p id="smsg" class="text-sm font-bold text-gray-700 pt-2"></p>
        </div>
      </div>`;
    let on = false, sc = false;
    const sv = $('#sv', st), m = $('#smsg', st);
    const draw = () => {
      if (on && sc) { sv.textContent = '🔥'; sv.style.background = '#fee2e2'; m.textContent = water ? '💥 צינור עוקף! כל המים בורחים בדרך הקצרה ולא מגיעים לנורית. זה קצר – אסור!' : '🔥 קצר! החשמל בורח בדרך הקצרה, מתחמם – והנורית כבויה. אסור!'; hit('short', 'זה קצר: סגור – אבל לא קצר!'); }
      else if (on) { sv.textContent = '💡'; sv.style.background = '#fef9c3'; m.textContent = water ? '💧 המים מסתובבים בצינור – הנורית דולקת. מעגל סגור!' : '✅ מעגל סגור – הנורית דולקת!'; hit('closed'); }
      else { sv.textContent = '⚫'; sv.style.background = '#f1f5f9'; m.textContent = water ? '⭕ הברז סגור – שום דבר לא זורם.' : '⭕ מעגל פתוח – כבוי.'; hit('open'); }
    };
    $('#b-sw', st).onclick = (e) => { on = !on; e.target.textContent = on ? (water ? '🚰 סגרו את הברז' : '🔘 פתחו את המתג') : (water ? '🚰 פתחו את הברז' : '🔘 סגרו את המתג'); draw(); };
    $('#b-sc', st).onclick = (e) => { sc = !sc; e.target.textContent = sc ? '✂️ הסירו אותו' : (water ? '↪️ הוסיפו צינור עוקף' : '↪️ הוסיפו קיצור דרך'); draw(); };
    draw();
  };

  // לחות → מספר. middle: 0–65535 · elementary: 0–100. תמיד גבוה = יבש
  LABS.moisture = function (st, s, hit) {
    const el100 = C.track === 'elementary';
    st.innerHTML = `
      <div class="grid md:grid-cols-2 gap-4 items-center">
        <div class="text-center">
          <div id="soil" class="text-6xl mb-2">🏜️</div>
          <input id="ms" type="range" min="0" max="100" value="0" class="w-full" style="accent-color:#0284c7" dir="ltr">
          <div class="flex justify-between text-xs text-gray-500"><span>יבש לגמרי</span><span>רטוב לגמרי</span></div>
          <p class="text-sm mt-1">💧 משקים ← הזיזו את הסליידר</p>
        </div>
        <div class="bg-slate-900 text-lime-300 rounded-2xl p-5 text-center" dir="ltr">
          <div class="text-xs text-slate-400 mb-1">${el100 ? 'robot number' : 'soil.read_raw()'}</div>
          <div id="mv" class="text-5xl font-black" style="font-family:Consolas,monospace">0</div>
        </div>
      </div>
      <p id="mmsg" class="text-sm font-bold text-gray-700 mt-3 text-center"></p>`;
    const sl = $('#ms', st), mv = $('#mv', st), soil = $('#soil', st), m = $('#mmsg', st);
    const draw = () => {
      const wet = Number(sl.value);
      const raw = Math.round(60000 - wet * 380);
      mv.textContent = el100 ? Math.round(raw * 100 / 65535) : raw;
      soil.textContent = wet < 25 ? '🏜️' : wet < 70 ? '🌱' : '💦';
      if (wet <= 5) { m.textContent = 'יבש – המספר גבוה!'; hit('dry'); }
      else if (wet >= 95) { m.textContent = 'רטוב – המספר נמוך!'; hit('wet', 'גיליתם: אצלנו מספר גבוה = יבש, מספר נמוך = רטוב.'); }
      else m.textContent = 'ככל שמשקים – המספר יורד.';
    };
    sl.oninput = draw; draw();
  };

  // חזק או חלש – הדלקה וכיבוי
  LABS.pwm = function (st, s, hit) {
    st.innerHTML = `
      <div class="grid md:grid-cols-2 gap-4 items-center">
        <div class="text-center"><div id="pl" class="mx-auto rounded-full" style="width:110px;height:110px;background:#facc15;transition:none"></div>
          <div id="bar" class="mt-3 text-xl tracking-widest" dir="ltr"></div></div>
        <div>
          <label class="text-sm font-bold">כמה מהזמן דולק? <span id="dv">50</span>%</label>
          <input id="ds" type="range" min="0" max="100" step="10" value="50" class="w-full" style="accent-color:#ca8a04" dir="ltr">
          <div class="flex gap-2 mt-3"><button id="slow" class="p2-btn ghost flex-1" type="button">🐢 לאט</button><button id="fast" class="p2-btn flex-1" type="button">⚡ מהר מאוד</button></div>
          <p id="pmsg" class="text-sm font-bold text-gray-700 pt-2"></p>
        </div>
      </div>`;
    let duty = 50, fast = true, t = 0;
    const pl = $('#pl', st), dv = $('#dv', st), bar = $('#bar', st), m = $('#pmsg', st);
    const tick = () => {
      if (!st.isConnected) return;
      if (fast) pl.style.opacity = String(0.08 + 0.92 * duty / 100);
      else { t = (t + 1) % 10; pl.style.opacity = t < duty / 10 ? '1' : '0.08'; }
      setTimeout(tick, fast ? 60 : 150);
    };
    const draw = () => {
      dv.textContent = duty;
      bar.textContent = '█'.repeat(duty / 10) + '░'.repeat(10 - duty / 10);
      if (!fast) { m.textContent = '🐢 לאט – רואים דולק, כבוי, דולק, כבוי.'; hit('slow'); }
      else if (duty > 0 && duty <= 30) { m.textContent = '🌙 דולק רק קצת מהזמן – נראה חלש!'; hit('dim'); }
      else if (duty >= 70) { m.textContent = '☀️ דולק רוב הזמן – נראה חזק!'; hit('bright'); }
      else m.textContent = 'מהר מאוד – העין רואה אור קבוע.';
    };
    $('#ds', st).oninput = (e) => { duty = Number(e.target.value); draw(); };
    $('#slow', st).onclick = () => { fast = false; draw(); };
    $('#fast', st).onclick = () => { fast = true; draw(); };
    draw(); tick();
  };

  // סימולטור הרובוט: לחות → נורית + צעקה (2 או 3 מצבים)
  LABS.robot = function (st, s, hit) {
    const three = !!s.three;
    st.innerHTML = `
      <div class="grid md:grid-cols-2 gap-4 items-center">
        <div class="text-center">
          <div id="rl" class="mx-auto rounded-full" style="width:100px;height:100px"></div>
          <div id="rb" class="text-3xl mt-2 h-10"></div>
          <div id="rs" class="font-black text-gray-800" dir="ltr"></div>
        </div>
        <div>
          <label class="text-sm font-bold">כמה רטובה האדמה? <span id="rv">50</span>%</label>
          <input id="rsl" type="range" min="0" max="100" value="50" class="w-full" style="accent-color:#0284c7" dir="ltr">
          <div class="bg-slate-900 text-sky-300 rounded-xl p-3 mt-3 text-xs" dir="ltr" style="font-family:Consolas,monospace;white-space:pre">${three ? 'if moisture < 30:   red + beep\nelif moisture <= 60: yellow\nelse:                green' : 'if moisture < 30:  red + beep\nelse:               green'}</div>
        </div>
      </div>`;
    const rl = $('#rl', st), rb = $('#rb', st), rv = $('#rv', st), rs = $('#rs', st);
    const draw = () => {
      const v = Number($('#rsl', st).value); rv.textContent = v;
      let c = '#22c55e', b = '', word = 'HAPPY';
      if (v < 30) { c = '#ef4444'; b = '🔊 ביפ ביפ ביפ!'; word = 'THIRSTY'; hit('red'); }
      else if (three && v <= 60) { c = '#eab308'; word = 'OK'; hit('yellow'); }
      else hit('green');
      rl.style.background = c; rl.style.boxShadow = '0 0 30px ' + c; rb.textContent = b;
      rs.textContent = C.track === 'elementary' && three ? word : '';
    };
    $('#rsl', st).oninput = draw; draw();
  };

  // ── הדרכה (GC.Tutorial) לממשק החדש – פעם אחת לכל תלמיד/ה ─────────────────
  function tutorial() {
    try {
      GC.Tutorial.start('p2_academy', [
        { target: '#dots', emoji: '🤖', wait: 'next', text: 'ברוכים הבאים לאקדמיית הרובוטים! אלה שלבי השיעור. אפשר לחזור אחורה בכל שלב.' },
        { target: '#lc', emoji: '🌿', wait: 'next', text: 'כל שלב שמסיימים = עלים. מקבלים אותם פעם אחת לכל משימה.' },
        { target: '#step-1 .p2-card', emoji: '👆', wait: 'next', text: 'במשחקים: לוחצים על כרטיס – ואז על המקום שלו. בלי גרירה.' },
      ]);
    } catch (x) {}
  }

  // ── הרצה ─────────────────────────────────────────────────────────────────
  P2.render = function (config) {
    C = config;
    P2._cfg = C; // לבדיקות QA אוטומטיות
    const aw = GC.getPassport('p2aw_' + C.lesson);
    AW = (aw && typeof aw === 'object') ? aw : {};
    shell();
    const main = $('#p2-main');
    const total = C.steps.length;
    C.steps.forEach((s, i) => main.appendChild(buildStep(s, i, total)));
    GC.initLesson({ steps: total, lessonId: String(C.lesson) });
    GC._syncLeafDisplay();
    // 5.5 לא נתפס במעקב ההשלמה של core.js (השם lesson-05-5) – מסמנים כאן
    if (C.lesson === 55) {
      const mark = () => {
        if (!document.getElementById('step-' + total).classList.contains('active')) return;
        localStorage.setItem('lesson55_completed', '1');
        try { const p = JSON.parse(localStorage.getItem('passport1') || '{}') || {}; if (!(p.done && p.done['55'])) { p.done = Object.assign({}, p.done, { 55: 1 }); localStorage.setItem('passport1', JSON.stringify(p)); if (window.GC_SYNC) GC_SYNC.scheduleSync(); } } catch (x) {}
      };
      new MutationObserver(mark).observe(document.getElementById('step-' + total), { attributes: true, attributeFilter: ['class'] });
    }
    // אחרי משיכה מהגיליון: מאחדים את רשימת הפריטים שכבר זיכו בעלים (ממחשב אחר) – בלי זה
    // אפשר היה לקבל שוב עלים על אותו שלב במחשב חדש.
    if (window.GC_SYNC && GC_SYNC.hydrated) GC_SYNC.hydrated.then(() => {
      const remote = GC.getPassport('p2aw_' + C.lesson);
      if (remote && typeof remote === 'object') AW = Object.assign({}, remote, AW);
      GC._lv = parseInt(localStorage.getItem('ls' + C.lesson) || '0', 10); GC._syncLeafDisplay();
    }, () => {});
    if (document.readyState === 'complete') tutorial(); else window.addEventListener('load', tutorial);
  };
})();
