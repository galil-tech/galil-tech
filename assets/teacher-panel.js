// assets/teacher-panel.js — מצב מדריך/ה: כניסה בסיסמה פעם אחת + פאנל צף "ניהול כיתה".
// הכניסה (teacher-dashboard.html) שומרת את הסיסמה ב-gc_teacher_dash_pw:
//   "זכור במחשב הזה" → localStorage (נשאר גם אחרי סגירת הדפדפן) | אחרת → sessionStorage (הטאב הנוכחי).
// sheets-sync.js טוען את הקובץ הזה אוטומטית בכל דף כשיש סיסמה שמורה - כך המדריך/ה יכול/ה לשנות
// שם, זוג או לפתוח שיעור גם ממחשב של תלמיד/ה, בלי להקליד סיסמה שוב.
// הרשאות: רק כיתות שהמדריך/ה משויך/ת אליהן ב-data/roster.js (GC_ROSTER.findTeacher). כל פעולה
// נכתבת לגיליון דרך GC_SYNC (לא רק localStorage), כי המחשבים בכיתה מתחלפים.
(function () {
  if (window.GC_TPANEL) return;
  const P = (window.GC_TPANEL = {});
  const KEY = 'gc_teacher_dash_pw';
  const ROOT = ((document.currentScript && document.currentScript.src) || '').replace(/assets\/teacher-panel\.js.*$/, '');
  let meta = {}; // "school|class" → display_name (גיליון class_meta)

  function esc(s) { return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])); }
  function store(kind) { try { return kind === 'local' ? localStorage : sessionStorage; } catch (e) { return null; } }
  function syncOn() { return !!(window.GC_SYNC && window.SHEETS_CONFIG && window.SHEETS_CONFIG.enabled); }

  P.ensureRoster = function () {
    if (window.GC_ROSTER) return Promise.resolve();
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = ROOT + 'data/roster.js';
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  };

  // ── כניסה / יציאה ─────────────────────────────────────────────────────────
  P.savedPassword = function () {
    const l = store('local'), s = store('session');
    return (l && l.getItem(KEY)) || (s && s.getItem(KEY)) || '';
  };
  P.isRemembered = function () { const l = store('local'); return !!(l && l.getItem(KEY)); };
  P.session = function () {
    const pw = P.savedPassword();
    return pw && window.GC_ROSTER ? GC_ROSTER.findTeacher(pw) : null;
  };
  P.login = function (pw, remember) {
    const res = window.GC_ROSTER && GC_ROSTER.findTeacher(pw);
    if (!res) return null;
    const l = store('local'), s = store('session');
    if (l) l.removeItem(KEY);
    if (s) s.removeItem(KEY);
    const target = remember ? l : s;
    if (target) target.setItem(KEY, pw);
    mount();
    return res;
  };
  P.logout = function () {
    const l = store('local'), s = store('session');
    if (l) l.removeItem(KEY);
    if (s) s.removeItem(KEY);
    const root = document.getElementById('gc-tp-root');
    if (root) root.remove();
    document.dispatchEvent(new CustomEvent('gc-teacher-logout'));
  };

  // ── שמות כיתה (class_meta) ───────────────────────────────────────────────
  P.loadMeta = function () {
    if (!syncOn() || !GC_SYNC.pullClassMeta) return Promise.resolve(meta);
    return GC_SYNC.pullClassMeta().then((resp) => {
      if (resp && resp.ok) {
        meta = {};
        (resp.rows || []).forEach((r) => { if (r.display_name) meta[r.school_id + '|' + r.class_id] = String(r.display_name); });
      }
      return meta;
    });
  };
  P.classLabel = function (c) {
    const d = meta[c.schoolName + '|' + c.classId];
    return c.schoolName + ' · כיתה ' + (d || c.className);
  };

  // ── פעולות (משותפות לפאנל הצף ולטבלה ב-teacher-dashboard.html) ────────────
  // כל פעולה מחזירה Promise<boolean> - true אם נשמרה בגיליון.
  function errText(resp) {
    if (resp && resp.error === 'server_outdated') return 'צריך קודם לעדכן את ה-Apps Script (Deploy → New version) - הפעולה לא בוצעה.';
    if (resp && resp.error === 'student not found') return 'התלמיד/ה לא נמצא/ה בגיליון (אולי עוד לא סונכרן/ה מהמחשב שלו/ה).';
    return 'הפעולה נכשלה - נסו שוב. (' + ((resp && resp.error) || 'שגיאת רשת') + ')';
  }
  function guard() {
    if (!syncOn()) { alert('הסנכרון לגיליון כבוי במחשב הזה - אי אפשר לשמור שינוי.'); return false; }
    return true;
  }
  function done(resp) {
    if (resp && resp.ok) { document.dispatchEvent(new CustomEvent('gc-teacher-changed')); return true; }
    alert(errText(resp));
    return false;
  }
  // אם התלמיד/ה ששונה/תה הוא/היא זה/זו שמחובר/ת למחשב הזה - לעדכן גם את הזהות המקומית
  function patchLocalIdentity(c, code, patch) {
    const id = window.GC_ID && GC_ID.getIdentity();
    if (id && id.code === code && id.school === c.schoolName && id.className === c.classId) GC_ID.setIdentity(Object.assign({}, id, patch));
  }

  P.renameStudent = function (c, row) {
    if (!guard()) return Promise.resolve(false);
    const v = prompt('שם חדש ל' + row.student_name + ' (קוד ' + row.code + '):', row.student_name || '');
    if (v === null || !v.trim() || v.trim() === row.student_name) return Promise.resolve(false);
    const name = v.trim();
    return GC_SYNC.renameStudent(c.schoolName, c.classId, row.code, name).then((resp) => {
      if (resp && resp.ok) patchLocalIdentity(c, String(row.code), { name: name });
      return done(resp);
    });
  };
  // זוג/קבוצה לתלמיד/ה אחד/ת - שם חדש = מעבר/יצירת זוג, ריק = פיצול (הוצאה מהזוג)
  P.editGroup = function (c, row) {
    if (!guard()) return Promise.resolve(false);
    const v = prompt('זוג / קבוצה של ' + row.student_name + ':\n(שם זהה לתלמיד/ה אחר/ת = אותו זוג. ריק = הוצאה מהזוג)', row.group_name || '');
    if (v === null || v.trim() === String(row.group_name || '')) return Promise.resolve(false);
    return GC_SYNC.setGroupName(c.schoolName, c.classId, String(row.code), v.trim()).then(done);
  };
  // איחוד כמה תלמידים לאותו זוג
  P.mergeGroup = function (c, rows) {
    if (!guard()) return Promise.resolve(false);
    if (rows.length < 2) { alert('סמנו לפחות שני תלמידים לאיחוד לזוג.'); return Promise.resolve(false); }
    const suggested = rows.map((r) => r.group_name).filter(Boolean)[0] || rows.map((r) => r.student_name).join(' + ');
    const v = prompt('שם הזוג / הקבוצה עבור: ' + rows.map((r) => r.student_name).join(', '), suggested);
    if (v === null || !v.trim()) return Promise.resolve(false);
    return GC_SYNC.setGroupName(c.schoolName, c.classId, rows.map((r) => String(r.code)), v.trim()).then(done);
  };
  P.renameClass = function (c) {
    if (!guard()) return Promise.resolve(false);
    const cur = meta[c.schoolName + '|' + c.classId] || c.className;
    const v = prompt('שם תצוגה לכיתה (' + c.schoolName + '):\n(ריק = חזרה לשם המקורי "' + c.className + '")', cur);
    if (v === null || v.trim() === cur) return Promise.resolve(false);
    return GC_SYNC.setClassDisplayName(c.schoolName, c.classId, v.trim()).then((resp) => {
      if (resp && resp.ok) {
        if (v.trim()) meta[c.schoolName + '|' + c.classId] = v.trim();
        else delete meta[c.schoolName + '|' + c.classId];
      }
      return done(resp);
    });
  };
  P.unlockStudent = function (c, row) {
    if (!guard()) return Promise.resolve(false);
    const suggested = Math.min(17, (Number(row.unlocked_through) || 1) + 1);
    const v = prompt('פתיחת שיעור ל' + row.student_name + ' (קוד ' + row.code + ').\nעד איזה שיעור לפתוח? (1–17)', String(suggested));
    if (v === null) return Promise.resolve(false);
    const n = parseInt(v, 10);
    if (!(n >= 1 && n <= 17)) { alert('מספר שיעור בין 1 ל-17'); return Promise.resolve(false); }
    return GC_SYNC.setStudentUnlock(c.schoolName, c.classId, String(row.code), n).then((resp) => {
      if (resp && resp.ok) {
        // המחשב הזה הוא של התלמיד/ה - לפתוח גם מקומית, בלי לחכות לרענון
        const id = window.GC_ID && GC_ID.getIdentity();
        if (id && id.code === String(row.code) && id.school === c.schoolName && id.className === c.classId) {
          const cur = parseInt(localStorage.getItem('gc_unlocked_through') || '1', 10) || 1;
          if (n > cur) localStorage.setItem('gc_unlocked_through', n);
        }
      }
      return done(resp);
    });
  };
  P.unlockClass = function (c, n) {
    if (!guard()) return Promise.resolve(false);
    if (!confirm('כל התלמידים ב' + P.classLabel(c) + ' יוכלו להיכנס לשיעור ' + n + ' גם אם לא סיימו את הקודם.')) return Promise.resolve(false);
    return GC_SYNC.setClassUnlock(c.schoolName, c.classId, n).then(done);
  };

  // ── הפאנל הצף ────────────────────────────────────────────────────────────
  const CSS = `
#gc-tp-fab{position:fixed;bottom:72px;right:10px;z-index:9997;background:#166534;color:#fff;border:0;border-radius:999px;
  padding:10px 16px;font:900 .9rem Heebo,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);cursor:pointer;}
#gc-tp-fab:hover{background:#14532d}
#gc-tp-drawer{position:fixed;top:0;right:0;bottom:0;z-index:9999;width:min(400px,100vw);background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.2);
  display:none;flex-direction:column;font-family:Heebo,sans-serif;color:#1f2937;}
#gc-tp-drawer.open{display:flex}
#gc-tp-drawer header{background:#166534;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px}
#gc-tp-drawer header b{flex:1;font-size:1rem}
#gc-tp-drawer .gc-tp-body{flex:1;overflow-y:auto;padding:12px 14px}
#gc-tp-drawer button{font-family:inherit;cursor:pointer}
#gc-tp-drawer .gc-tp-btn{background:#f3f4f6;border:0;border-radius:10px;padding:5px 9px;font-size:.78rem;font-weight:700}
#gc-tp-drawer .gc-tp-btn:hover{background:#e5e7eb}
#gc-tp-drawer .gc-tp-main{background:#16a34a;color:#fff;border:0;border-radius:10px;padding:7px 12px;font-size:.85rem;font-weight:900}
#gc-tp-drawer select{border:2px solid #e5e7eb;border-radius:10px;padding:6px 8px;font:700 .85rem Heebo,sans-serif;max-width:100%}
#gc-tp-drawer .gc-tp-box{background:#f7fee7;border:2px solid #d9f99d;border-radius:14px;padding:10px;margin:10px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#gc-tp-drawer .gc-tp-row{border-bottom:1px solid #f3f4f6;padding:8px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#gc-tp-drawer .gc-tp-row.me{background:#fef9c3;border-radius:10px;padding:8px 6px}
#gc-tp-drawer .gc-tp-name{font-weight:900;flex:1;min-width:120px}
#gc-tp-drawer .gc-tp-sub{color:#6b7280;font-size:.75rem;font-weight:400}
#gc-tp-drawer .gc-tp-msg{font-size:.8rem;color:#6b7280;margin:8px 0}
@media print{#gc-tp-fab,#gc-tp-drawer{display:none!important}}`;

  let state = { idx: 0, rows: [], classN: 0 };

  function classes() { const s = P.session(); return s ? s.classes : []; }
  function current() { return classes()[state.idx]; }

  function mount() {
    if (document.getElementById('gc-tp-root')) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', mount); return; }
    if (!P.session()) return;
    const root = document.createElement('div');
    root.id = 'gc-tp-root';
    root.innerHTML = '<style>' + CSS + '</style>' +
      '<button type="button" id="gc-tp-fab" aria-haspopup="dialog" aria-controls="gc-tp-drawer">🍎 ניהול כיתה</button>' +
      '<aside id="gc-tp-drawer" dir="rtl" role="dialog" aria-label="ניהול כיתה למדריך/ה">' +
      '<header><b>🍎 ניהול כיתה</b>' +
      '<button type="button" id="gc-tp-close" aria-label="סגירה" style="background:none;border:0;color:#fff;font-size:1.3rem">✕</button></header>' +
      '<div class="gc-tp-body" id="gc-tp-body"></div></aside>';
    document.body.appendChild(root);
    // ברירת מחדל: הכיתה של התלמיד/ה שמחובר/ת למחשב הזה, אם היא מהכיתות של המדריך/ה
    const id = window.GC_ID && GC_ID.getIdentity();
    if (id) {
      const i = classes().findIndex((c) => c.schoolName === id.school && c.classId === id.className);
      if (i !== -1) state.idx = i;
    }
    document.getElementById('gc-tp-fab').onclick = () => {
      document.getElementById('gc-tp-drawer').classList.add('open');
      P.loadMeta().then(refresh);
    };
    document.getElementById('gc-tp-close').onclick = () => document.getElementById('gc-tp-drawer').classList.remove('open');
  }

  function render(msg) {
    const body = document.getElementById('gc-tp-body');
    if (!body) return;
    const s = P.session();
    if (!s) { P.logout(); return; }
    const c = current();
    const me = window.GC_ID && GC_ID.getIdentity();
    let opts = '';
    for (let i = 1; i <= 17; i++) opts += '<option value="' + i + '"' + (i === Math.min(17, state.classN + 1) ? ' selected' : '') + '>שיעור ' + i + '</option>';
    const rowsHtml = !syncOn() ? '<p class="gc-tp-msg">⚠️ הסנכרון לגיליון כבוי במחשב הזה.</p>'
      : msg ? '<p class="gc-tp-msg">' + esc(msg) + '</p>'
      : !state.rows.length ? '<p class="gc-tp-msg">אין עדיין תלמידים בכיתה הזו בגיליון.</p>'
      : state.rows.map((r, i) => {
        const isMe = me && c && me.code === String(r.code) && me.school === c.schoolName && me.className === c.classId;
        return '<div class="gc-tp-row' + (isMe ? ' me' : '') + '">' +
          '<input type="checkbox" data-sel="' + i + '" aria-label="סימון ' + esc(r.student_name) + '">' +
          '<span class="gc-tp-name">' + esc(r.student_name || '—') + (isMe ? ' 📍' : '') +
          '<br><span class="gc-tp-sub">קוד ' + esc(r.code) + ' · ' + (r.group_name ? '👥 ' + esc(r.group_name) : 'בלי זוג') +
          ' · פתוח עד ' + esc(r.unlocked_through || 1) + '</span></span>' +
          '<button type="button" class="gc-tp-btn" data-act="rename" data-i="' + i + '" title="שינוי שם">✏️</button>' +
          '<button type="button" class="gc-tp-btn" data-act="group" data-i="' + i + '" title="זוג / קבוצה">👥</button>' +
          '<button type="button" class="gc-tp-btn" data-act="unlock" data-i="' + i + '" title="פתיחת שיעור">🔓</button></div>';
      }).join('');
    body.innerHTML =
      '<p class="gc-tp-sub" style="margin:0 0 8px">' + esc(s.label) + '</p>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
      '<select id="gc-tp-class" aria-label="בחירת כיתה">' + classes().map((x, i) =>
        '<option value="' + i + '"' + (i === state.idx ? ' selected' : '') + '>' + esc(P.classLabel(x)) + '</option>').join('') + '</select>' +
      '<button type="button" class="gc-tp-btn" id="gc-tp-rename-class" title="שינוי שם הכיתה">✏️ שם כיתה</button>' +
      '<button type="button" class="gc-tp-btn" id="gc-tp-refresh" title="רענון">🔄</button></div>' +
      '<div class="gc-tp-box"><b style="color:#14532d;font-size:.85rem">🔓 פתיחה לכיתה</b>' +
      '<select id="gc-tp-n" aria-label="עד איזה שיעור">' + opts + '</select>' +
      '<button type="button" class="gc-tp-main" id="gc-tp-unlock-class">פתח</button>' +
      '<span class="gc-tp-sub">' + (state.classN ? 'כרגע פתוח עד ' + state.classN : '') + '</span></div>' +
      (state.rows.length ? '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">' +
        '<b style="font-size:.85rem">👥 תלמידים (' + state.rows.length + ')</b>' +
        '<button type="button" class="gc-tp-btn" id="gc-tp-merge">🔗 איחוד המסומנים לזוג</button></div>' : '') +
      rowsHtml +
      '<div style="border-top:2px solid #f3f4f6;margin-top:14px;padding-top:10px;display:flex;flex-wrap:wrap;gap:6px">' +
      '<a href="' + ROOT + 'teacher-dashboard.html" class="gc-tp-btn" style="text-decoration:none;color:inherit">📊 לוח בקרה</a>' +
      '<button type="button" class="gc-tp-btn" id="gc-tp-logout" style="color:#b91c1c">🚪 יציאה ממצב מורה</button></div>' +
      (P.isRemembered() ? '<p class="gc-tp-sub" style="margin-top:6px">הכניסה זכורה במחשב הזה. במחשב של תלמיד/ה - לצאת בסוף השיעור.</p>' : '');

    body.querySelector('#gc-tp-class').onchange = (e) => { state.idx = Number(e.target.value); refresh(); };
    body.querySelector('#gc-tp-refresh').onclick = () => P.loadMeta().then(refresh);
    body.querySelector('#gc-tp-rename-class').onclick = () => P.renameClass(current()).then((ok) => ok && render());
    body.querySelector('#gc-tp-unlock-class').onclick = () =>
      P.unlockClass(current(), Number(body.querySelector('#gc-tp-n').value)).then((ok) => ok && refresh());
    body.querySelector('#gc-tp-logout').onclick = () => { if (confirm('לצאת ממצב מורה במחשב הזה?')) P.logout(); };
    const merge = body.querySelector('#gc-tp-merge');
    if (merge) merge.onclick = () => {
      const sel = Array.from(body.querySelectorAll('[data-sel]:checked')).map((x) => state.rows[Number(x.dataset.sel)]);
      P.mergeGroup(current(), sel).then((ok) => ok && refresh());
    };
    body.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = () => {
        const r = state.rows[Number(b.dataset.i)];
        const fn = { rename: P.renameStudent, group: P.editGroup, unlock: P.unlockStudent }[b.dataset.act];
        fn(current(), r).then((ok) => ok && refresh());
      };
    });
  }

  function refresh() {
    const c = current();
    if (!c || !syncOn()) { state.rows = []; render(); return; }
    render('טוען...');
    GC_SYNC.pullClass(c.schoolName, c.classId).then((resp) => {
      if (current() !== c) return; // הוחלפה כיתה בזמן הטעינה
      if (!resp || !resp.ok) { state.rows = []; render('⚠️ לא הצלחנו לטעון מהגיליון - נסו 🔄.'); return; }
      state.classN = resp.classUnlockedThrough || 0;
      if (resp.classDisplayName) meta[c.schoolName + '|' + c.classId] = resp.classDisplayName;
      state.rows = (resp.rows || []).map((r) => {
        const own = Number(r.unlocked_through) || 1;
        return state.classN > own ? Object.assign({}, r, { unlocked_through: state.classN }) : r;
      }).sort((a, b) => String(a.group_name || '~').localeCompare(String(b.group_name || '~'), 'he') ||
        String(a.student_name || '').localeCompare(String(b.student_name || ''), 'he'));
      render();
    });
  }
  P.refresh = refresh;

  P.ensureRoster().then(mount);
})();
