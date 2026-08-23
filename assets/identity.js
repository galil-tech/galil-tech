// assets/identity.js — זיהוי תלמיד/מורה (שלב 9ג, MASTER-WORKFLOW.md)
// שלב זה הוא localStorage בלבד: אין עדיין חיבור אמיתי ל-Sheets (9ד) ואין אכיפת הרשאות אמיתית.
// המטרה: לתפוס בית-ספר/כיתה/שם/קוד כדי שיהיו מוכנים כשמתחברים לבק-אנד אמיתי, ולתת לתלמיד "קוד אישי"
// כמו שתוכנן ב-CLAUDE.md ("ממשק רב-כיתתי" — קוד 4 ספרות, ללא סיסמה).
(function () {
  const GC_ID = (window.GC_ID = {});
  const KEY_STUDENT = 'gc_identity';
  const KEY_TEACHER = 'gc_teacher_identity';
  // זהות מורה+כיתה עשירה (קוד אישי, בקשת המשתמש אחרי שלב 10) - נפרדת מ-KEY_TEACHER
  // הישן (תיוג בית-ספר קליל בלבד, עדיין בשימוש ב-index.html למעבר "מצב מורה" רגיל).
  // זו רק לגישה ל-teacher-class.html (הערות לשיעור + קצב התקדמות כיתה ספציפית).
  const KEY_TEACHER_CLASS = 'gc_teacher_class_identity';

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

  // מוחק את כל ההתקדמות האישית מהמחשב הזה (עלים, דרכון, הישגים, דגלי-השלמה, נעילת
  // שיעורים) — לא את הזהות עצמה (ראה clearIdentity). ההתקדמות האמיתית נשארת בטוחה
  // בגיליון תחת הקוד האישי, ותחזור אוטומטית (GC_SYNC.pullMine) כשמזדהים איתו שוב.
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
    localStorage.removeItem('gc_unlocked_through');
  };

  // בודק כמה שיעורים "מהשורה" (1,2,3... בלי חורים) הושלמו במלואם - הגיעו לשלב האחרון
  // (lesson{N}_completed) *וגם* צברו את מלוא העלים האפשריים (ls{N} === GC.LESSON_MAX[N] -
  // מובטח שלא לחרוג הודות לחסם ב-core.js). זו הבדיקה "עשה את המקסימום" שביקש המשתמש.
  // תלוי ב-GC.LESSON_MAX (assets/points.config.js) - אם לא טעון בעמוד הזה (לדוגמה
  // wall.html/leaves.html), פשוט לא מקדם את הנעילה, בלי לזרוק שגיאה.
  GC_ID.computeUnlockedThrough = function () {
    const current = parseInt(localStorage.getItem('gc_unlocked_through') || '1', 10);
    if (!window.GC || !GC.LESSON_MAX) return current;
    let n = 1;
    while (n <= 17 && GC.LESSON_MAX[n] &&
      localStorage.getItem('lesson' + n + '_completed') === '1' &&
      parseInt(localStorage.getItem('ls' + n) || '0', 10) >= GC.LESSON_MAX[n]) {
      n++;
    }
    return Math.max(current, n); // n כאן = "השיעור הבא שמותר לפתוח"
  };

  // יציאה מלאה מהסשן: מקדם את הנעילה אם התלמיד/ה עשה/תה את המקסימום (רק כאן, לא
  // בסנכרון שוטף - כדי שלא יהיה מעבר ישיר לשיעור הבא באותו סשן בלי יציאה בפועל),
  // דוחף סנכרון אחרון, ואז מנקה זהות+התקדמות ומרענן.
  GC_ID.logout = function () {
    const id = GC_ID.getIdentity();
    const bumped = GC_ID.computeUnlockedThrough();
    localStorage.setItem('gc_unlocked_through', bumped);
    const finish = function () {
      GC_ID.clearIdentity();
      GC_ID.wipeLocalProgress();
      location.reload();
    };
    const sync = (window.GC_SYNC && typeof GC_SYNC.pushNow === 'function') ? GC_SYNC.pushNow() : Promise.resolve();
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
    return Promise.race([sync, timeout]).then(finish).catch(finish);
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

  GC_ID.getTeacherClassIdentity = function () {
    try { return JSON.parse(localStorage.getItem(KEY_TEACHER_CLASS) || 'null'); } catch (e) { return null; }
  };
  GC_ID.setTeacherClassIdentity = function (obj) {
    localStorage.setItem(KEY_TEACHER_CLASS, JSON.stringify(obj));
  };
  GC_ID.clearTeacherClassIdentity = function () {
    localStorage.removeItem(KEY_TEACHER_CLASS);
    localStorage.removeItem('gc_teacher_notes');
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

  // ── מודל כניסה למורה+כיתה (קוד נפרד לכל צירוף מורה+כיתה - מורה עם 5 כיתות
  // מחזיק/ה 5 קודים שונים, אחד לכל כיתה) - לגישה ל-teacher-class.html בלבד. ──
  function showTeacherClassModal(prefill, onReady) {
    prefill = prefill || {};
    const overlay = document.createElement('div');
    overlay.id = 'gc-tc-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Heebo,sans-serif;direction:rtl;';
    overlay.innerHTML =
      '<div style="background:white;border-radius:24px;max-width:420px;width:100%;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:90vh;overflow:auto;">' +
      '<div style="font-size:2rem;text-align:center;margin-bottom:6px;">🍎</div>' +
      '<h2 style="font-weight:900;font-size:1.3rem;text-align:center;color:#166534;margin-bottom:4px;">הכיתה שלי</h2>' +
      '<p style="font-size:.85rem;color:#666;text-align:center;margin-bottom:18px;">מלמדים כמה כיתות? כל כיתה מקבלת קוד נפרד משלה - כך שההערות והנתונים לא מתערבבים</p>' +
      '<label style="font-size:.8rem;font-weight:700;color:#333;">בית ספר</label>' +
      '<input id="gc-tc-school" value="' + esc(prefill.school || '') + '" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:10px;margin:4px 0 12px;font-size:.9rem;box-sizing:border-box;" placeholder="למשל: מעלה">' +
      '<label style="font-size:.8rem;font-weight:700;color:#333;">כיתה</label>' +
      '<input id="gc-tc-class" value="' + esc(prefill.className || '') + '" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:10px;margin:4px 0 12px;font-size:.9rem;box-sizing:border-box;" placeholder="למשל: ח1">' +
      '<label style="font-size:.8rem;font-weight:700;color:#333;">שם המורה</label>' +
      '<input id="gc-tc-name" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:10px;margin:4px 0 12px;font-size:.9rem;box-sizing:border-box;" placeholder="למשל: רונית">' +
      '<div id="gc-tc-err" style="display:none;color:#dc2626;font-size:.78rem;margin-bottom:8px;">נא למלא בית ספר, כיתה ושם לפני שממשיכים</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
      '<button id="gc-tc-new" style="flex:1;background:#166534;color:white;border:none;padding:10px;border-radius:10px;font-weight:800;cursor:pointer;">🆕 קוד חדש לכיתה הזו</button>' +
      '<button id="gc-tc-existing-toggle" style="flex:1;background:#f3f4f6;color:#333;border:none;padding:10px;border-radius:10px;font-weight:800;cursor:pointer;">🔑 יש לי כבר קוד</button>' +
      '</div>' +
      '<div id="gc-tc-existing-wrap" style="display:none;margin-bottom:10px;">' +
      '<input id="gc-tc-existing-code" maxlength="4" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:10px;font-size:1.2rem;text-align:center;letter-spacing:6px;box-sizing:border-box;" placeholder="1234">' +
      '<button id="gc-tc-existing-go" style="width:100%;margin-top:8px;background:#166534;color:white;border:none;padding:10px;border-radius:10px;font-weight:800;cursor:pointer;">המשך/י</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    function fields() {
      return {
        school: document.getElementById('gc-tc-school').value.trim(),
        className: document.getElementById('gc-tc-class').value.trim(),
        teacherName: document.getElementById('gc-tc-name').value.trim(),
      };
    }
    function valid(f) {
      if (!f.school || !f.className || !f.teacherName) {
        document.getElementById('gc-tc-err').style.display = 'block';
        return false;
      }
      return true;
    }
    function finish(code) {
      const f = fields();
      if (!valid(f)) return false;
      GC_ID.setTeacherClassIdentity({ school: f.school, className: f.className, teacherName: f.teacherName, code: code, savedAt: Date.now() });
      overlay.remove();
      renderTeacherClassBadge();
      return true;
    }

    document.getElementById('gc-tc-new').onclick = function () {
      const code = rand4();
      if (finish(code)) {
        alert('הקוד לכיתה הזו הוא: ' + code + '\nתזכרו אותו - תצטרכו אותו כדי לחזור לאותה כיתה ממחשב אחר, ואם אתם מלמדים כמה כיתות תצטרכו קוד נפרד לכל אחת.');
        if (window.GC_SYNC && typeof GC_SYNC.pushTeacherNotesNow === 'function') GC_SYNC.pushTeacherNotesNow();
        if (onReady) onReady(GC_ID.getTeacherClassIdentity());
      }
    };
    document.getElementById('gc-tc-existing-toggle').onclick = function () {
      document.getElementById('gc-tc-existing-wrap').style.display = 'block';
    };
    document.getElementById('gc-tc-existing-go').onclick = function () {
      const code = document.getElementById('gc-tc-existing-code').value.trim();
      if (!/^\d{4}$/.test(code)) { alert('קוד צריך להיות 4 ספרות'); return; }
      if (finish(code)) {
        if (window.GC_SYNC && typeof GC_SYNC.pullTeacherMine === 'function') GC_SYNC.pullTeacherMine();
        if (onReady) onReady(GC_ID.getTeacherClassIdentity());
      }
    };
  }

  // תג זיהוי מורה+כיתה - נפרד מתג התלמיד/ה (renderBadge), רק בעמוד teacher-class.html.
  function renderTeacherClassBadge() {
    if (!document.body) return;
    const old = document.getElementById('gc-tc-badge');
    if (old) old.remove();
    const t = GC_ID.getTeacherClassIdentity();
    if (!t) return;
    const b = document.createElement('div');
    b.id = 'gc-tc-badge';
    b.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:9998;background:white;border:2px solid #d1fae5;border-radius:16px;padding:6px 12px;font-family:Heebo,sans-serif;font-size:.72rem;color:#166534;box-shadow:0 2px 10px rgba(0,0,0,.12);direction:rtl;cursor:pointer;max-width:230px;line-height:1.5;';
    b.innerHTML = '🍎 ' + esc(t.school || '—') + ' · ' + esc(t.className || '—') + '<br><b>' + esc(t.teacherName || 'מורה') + '</b> (' + esc(t.code || '----') + ') · <span style="text-decoration:underline">להחליף כיתה</span>';
    b.onclick = function () {
      if (confirm('להחליף לכיתה אחרת? (ההערות של הכיתה הנוכחית שמורות בענן תחת הקוד ' + esc(t.code || '----') + ' - יחזרו אם תיכנסו איתו שוב)')) {
        GC_ID.clearTeacherClassIdentity();
        location.reload();
      }
    };
    document.body.appendChild(b);
  }

  // חוסם עד שנבחרה כיתה (בניגוד לתלמיד/ה - אין "דלג/י", כי בלי זהות אין מה להציג בדף
  // הזה בכלל). קורא ל-teacher-class.html בלבד, לא לכל עמוד.
  GC_ID.ensureTeacherClassIdentity = function (onReady) {
    const existing = GC_ID.getTeacherClassIdentity();
    if (existing) { renderTeacherClassBadge(); if (onReady) onReady(existing); return; }
    const show = function () { showTeacherClassModal(null, onReady); };
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
