// assets/identity.js — זיהוי תלמיד/מורה (שלב 9ג, MASTER-WORKFLOW.md)
// שלב זה הוא localStorage בלבד: אין עדיין חיבור אמיתי ל-Sheets (9ד) ואין אכיפת הרשאות אמיתית.
// המטרה: לתפוס בית-ספר/כיתה/שם/קוד כדי שיהיו מוכנים כשמתחברים לבק-אנד אמיתי, ולתת לתלמיד "קוד אישי"
// כמו שתוכנן ב-CLAUDE.md ("ממשק רב-כיתתי" — קוד 4 ספרות, ללא סיסמה).
(function () {
  const GC_ID = (window.GC_ID = {});
  const KEY_STUDENT = 'gc_identity';
  const KEY_TEACHER = 'gc_teacher_identity';

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function rand4() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  GC_ID.getIdentity = function () {
    try { return JSON.parse(localStorage.getItem(KEY_STUDENT) || 'null'); } catch (e) { return null; }
  };
  GC_ID.setIdentity = function (obj) {
    localStorage.setItem(KEY_STUDENT, JSON.stringify(obj));
  };
  GC_ID.clearIdentity = function () {
    localStorage.removeItem(KEY_STUDENT);
  };

  // מוחק את כל ההתקדמות האישית מהמחשב הזה (עלים, דרכון, הישגים, דגלי-השלמה) —
  // לא את הזהות עצמה (ראה clearIdentity). ההתקדמות האמיתית נשארת בטוחה בגיליון תחת
  // הקוד האישי, ותחזור אוטומטית (GC_SYNC.pullMine) כשמזדהים איתו שוב — גם על מחשב אחר.
  GC_ID.wipeLocalProgress = function () {
    for (let i = 1; i <= 17; i++) {
      localStorage.removeItem('ls' + i);
      localStorage.removeItem('lesson' + i + '_completed');
      localStorage.removeItem('gc_qseed_' + i);
    }
    localStorage.removeItem('passport1');
    localStorage.removeItem('gc_achievements');
    localStorage.removeItem('gc_msk');
    localStorage.removeItem('leaves_spent');
    localStorage.removeItem('studentName');
  };

  // יציאה מלאה מהסשן: מנסה לדחוף סנכרון אחרון (כדי לא לאבד עלים מהרגע האחרון), ואז
  // מנקה זהות+התקדמות ומרענן — כדי שהתלמיד/ה הבא/ה על אותו מחשב יתחיל/תתחיל מדף נקי.
  GC_ID.logout = function () {
    const id = GC_ID.getIdentity();
    const finish = function () {
      GC_ID.clearIdentity();
      GC_ID.wipeLocalProgress();
      location.reload();
    };
    const sync = (window.GC_SYNC && typeof GC_SYNC.pushNow === 'function') ? GC_SYNC.pushNow() : Promise.resolve();
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
    Promise.race([sync, timeout]).then(finish).catch(finish);
  };
  GC_ID.getTeacherIdentity = function () {
    try { return JSON.parse(localStorage.getItem(KEY_TEACHER) || 'null'); } catch (e) { return null; }
  };
  GC_ID.setTeacherIdentity = function (obj) {
    localStorage.setItem(KEY_TEACHER, JSON.stringify(obj));
  };
  GC_ID.clearTeacherIdentity = function () {
    localStorage.removeItem(KEY_TEACHER);
  };

  // ── תג זיהוי קטן בפינת המסך (תלמיד) ──
  function renderBadge() {
    if (!document.body) return; // נקרא לפעמים עוד לפני שה-<body> נטען (ensureStudentIdentity ב-<head>); DOMContentLoaded יקרא שוב בהמשך
    const old = document.getElementById('gc-id-badge');
    if (old) old.remove();
    const id = GC_ID.getIdentity();
    if (!id) return;
    const b = document.createElement('div');
    b.id = 'gc-id-badge';
    b.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:9998;background:white;border:2px solid #d1fae5;border-radius:16px;padding:6px 12px;font-family:Heebo,sans-serif;font-size:.72rem;color:#166534;box-shadow:0 2px 10px rgba(0,0,0,.12);direction:rtl;cursor:pointer;max-width:230px;line-height:1.5;';
    b.innerHTML = '🏫 ' + esc(id.school || '—') + ' · ' + esc(id.className || '—') + '<br><b>' + esc(id.name || 'תלמיד/ה') + '</b> (' + esc(id.code || '----') + ') · <span style="text-decoration:underline">החלף/י</span>';
    b.onclick = function () {
      if (confirm('לסיים ולפנות את המחשב לתלמיד/ה הבא/ה?\nההתקדמות שלכם שמורה בענן תחת הקוד ' + esc(id.code || '----') + ', ותחזור אוטומטית כשתיכנסו איתו שוב (גם ממחשב אחר).')) {
        GC_ID.logout();
      }
    };
    document.body.appendChild(b);
  }

  function esc(s) {
    return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  }

  // ── מודל כניסה לתלמיד/קבוצה ──
  function showStudentModal(prefill) {
    prefill = prefill || {};
    const overlay = document.createElement('div');
    overlay.id = 'gc-id-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Heebo,sans-serif;direction:rtl;';
    overlay.innerHTML =
      '<div style="background:white;border-radius:24px;max-width:420px;width:100%;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:90vh;overflow:auto;">' +
      '<div style="font-size:2rem;text-align:center;margin-bottom:6px;">🌱</div>' +
      '<h2 style="font-weight:900;font-size:1.3rem;text-align:center;color:#166534;margin-bottom:4px;">ברוכים הבאים לגדלים למחר!</h2>' +
      '<p style="font-size:.85rem;color:#666;text-align:center;margin-bottom:18px;">כמה פרטים כדי שנזכור אתכם בפעם הבאה (נשמר במחשב הזה בלבד, בשלב זה)</p>' +
      '<label style="font-size:.8rem;font-weight:700;color:#333;">בית ספר</label>' +
      '<input id="gc-id-school" value="' + esc(prefill.school || '') + '" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:10px;margin:4px 0 12px;font-size:.9rem;box-sizing:border-box;" placeholder="למשל: מעלה">' +
      '<label style="font-size:.8rem;font-weight:700;color:#333;">כיתה</label>' +
      '<input id="gc-id-class" value="' + esc(prefill.className || '') + '" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:10px;margin:4px 0 12px;font-size:.9rem;box-sizing:border-box;" placeholder="למשל: ח1">' +
      '<label style="font-size:.8rem;font-weight:700;color:#333;">שם פרטי (שלכם, או שם פרטי אחד מבני הזוג)</label>' +
      '<input id="gc-id-name" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:10px;margin:4px 0 12px;font-size:.9rem;box-sizing:border-box;" placeholder="למשל: דנה">' +
      '<p style="font-size:.72rem;color:#999;margin:-8px 0 12px;">שם פרטי בלבד מספיק — הקוד האישי הוא מה שבאמת מזהה אתכם</p>' +
      '<div id="gc-id-err" style="display:none;color:#dc2626;font-size:.78rem;margin-bottom:8px;">נא למלא בית ספר, כיתה ושם פרטי לפני שממשיכים</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
      '<button id="gc-id-new" style="flex:1;background:#166534;color:white;border:none;padding:10px;border-radius:10px;font-weight:800;cursor:pointer;">🆕 קבלת קוד חדש</button>' +
      '<button id="gc-id-existing-toggle" style="flex:1;background:#f3f4f6;color:#333;border:none;padding:10px;border-radius:10px;font-weight:800;cursor:pointer;">🔑 יש לי כבר קוד</button>' +
      '</div>' +
      '<div id="gc-id-existing-wrap" style="display:none;margin-bottom:10px;">' +
      '<input id="gc-id-existing-code" maxlength="4" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:10px;font-size:1.2rem;text-align:center;letter-spacing:6px;box-sizing:border-box;" placeholder="1234">' +
      '<button id="gc-id-existing-go" style="width:100%;margin-top:8px;background:#166534;color:white;border:none;padding:10px;border-radius:10px;font-weight:800;cursor:pointer;">המשך/י</button>' +
      '</div>' +
      '<button id="gc-id-skip" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;color:#555;font-size:.8rem;font-weight:700;cursor:pointer;padding:9px;">⏭ אין זמן עכשיו — דלג/י והתחל/י ישר (אפשר למלא בפעם הבאה)</button>' +
      '</div>';
    document.body.appendChild(overlay);

    function fields() {
      return {
        school: document.getElementById('gc-id-school').value.trim(),
        className: document.getElementById('gc-id-class').value.trim(),
        name: document.getElementById('gc-id-name').value.trim(),
      };
    }
    function valid(f) {
      if (!f.school || !f.className || !f.name) {
        document.getElementById('gc-id-err').style.display = 'block';
        return false;
      }
      return true;
    }
    function finish(code) {
      const f = fields();
      if (!valid(f)) return false;
      GC_ID.setIdentity({ school: f.school, className: f.className, name: f.name, code: code, savedAt: Date.now() });
      overlay.remove();
      renderBadge();
      return true;
    }

    document.getElementById('gc-id-new').onclick = function () {
      const code = rand4();
      if (finish(code)) {
        alert('הקוד האישי שלכם הוא: ' + code + '\nתזכרו אותו / תצלמו את המסך!\n(בשלב זה הקוד הוא לזיהוי בלבד — עדיין לא משחזר נתונים במחשב אחר, זה יגיע בהמשך)');
      }
    };
    document.getElementById('gc-id-existing-toggle').onclick = function () {
      document.getElementById('gc-id-existing-wrap').style.display = 'block';
    };
    document.getElementById('gc-id-existing-go').onclick = function () {
      const code = document.getElementById('gc-id-existing-code').value.trim();
      if (!/^\d{4}$/.test(code)) { alert('קוד צריך להיות 4 ספרות'); return; }
      finish(code);
    };
    document.getElementById('gc-id-skip').onclick = function () {
      sessionStorage.setItem('gc_id_skipped', '1');
      overlay.remove();
    };
  }

  GC_ID.ensureStudentIdentity = function () {
    const urlSchool = qs('school'), urlClass = qs('class'), urlStudent = qs('student'), urlName = qs('name');
    if (urlSchool || urlClass || urlStudent) {
      // קישור עם פרמטרים (למשל ששיתפה המורה) — מאמצים ושומרים בלי לשאול שוב
      GC_ID.setIdentity({ school: urlSchool || '', className: urlClass || '', name: urlName || '', code: urlStudent || rand4(), savedAt: Date.now() });
      renderBadge();
      return;
    }
    if (GC_ID.getIdentity()) { renderBadge(); return; }
    if (sessionStorage.getItem('gc_id_skipped') === '1') return;
    const show = function () { showStudentModal(); };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  };

  // ── מורה: זיהוי בית-ספר קליל, לא חוסם (שלב 9ג — הרשאות אמיתיות רק ב-9ד/9ה) ──
  GC_ID.ensureTeacherIdentity = function () {
    const existing = GC_ID.getTeacherIdentity();
    if (existing && existing.school) return existing;
    const school = prompt('לאיזה בית ספר את/ה שייכ/ת? (לתיוג בלבד כרגע — הפרדת הרשאות אמיתית תיבנה בהמשך)');
    if (school && school.trim()) {
      GC_ID.setTeacherIdentity({ school: school.trim(), savedAt: Date.now() });
    }
    return GC_ID.getTeacherIdentity();
  };

  window.addEventListener('DOMContentLoaded', renderBadge);
})();
