// assets/sheets-sync.js — סנכרון ל-Google Sheets (שלב 9ד, MASTER-WORKFLOW.md)
// שכבה דקה מעל GC_ID (זהות, שלב 9ג) + מפתחות ls{N}/passport1 הקיימים ב-core.js.
// לא פעיל כברירת מחדל — ראה data/sheets-config.js (enabled=false עד שיש Apps Script פרוס).
(function () {
  const GC_SYNC = (window.GC_SYNC = {});
  // שורש האתר, יחסית לקובץ הזה (לטעינת assets/teacher-panel.js מכל עומק תיקייה)
  const ROOT = ((document.currentScript && document.currentScript.src) || '').replace(/assets\/sheets-sync\.js.*$/, '');
  let syncTimer = null;
  // השרת דורס passport1 בכל ערך לא-ריק שמגיע. במכשיר חדש passport1 מקומי עלול להכיל רק
  // resume (core.js) לפני שהמשיכה הסתיימה - לכן לא שולחים passport1 עד pullMine מוצלח בדף
  // הזה (השרת שומר את הקיים כשהשדה חסר). passportHeld = נדחה, לשלוח אחרי המשיכה.
  let pulledOk = false;
  let passportHeld = false;

  function cfg() {
    return window.SHEETS_CONFIG || { enabled: false };
  }

  function collectPayload() {
    const id = window.GC_ID && GC_ID.getIdentity();
    if (!id) return null;
    const payload = {
      token: cfg().token,
      track: 'middle', // המסלול הזה (הראשי/חטיבה) — ראה docs/data-schema.md, "היררכיית ריבוי-מסלולים"
      school_id: id.school || '',
      class_id: id.className || '',
      // group_name לא נשלח - רק המדריך/ה קובע/ת אותו (set_group_name), והשרת שומר את הקיים
      student_name: id.name || '',
      code: id.code || '',
      leaves_spent: localStorage.getItem('leaves_spent') || '0',
      passport1: pulledOk ? (localStorage.getItem('passport1') || '{}') : undefined,
      achievements: localStorage.getItem('gc_achievements') || '{}',
      // השיעור הגבוה ביותר שמותר לפתוח - משתקף מהערך המקומי, שמגיע רק מפתיחת המדריך/ה
      // (pullMine). סיום שיעור לא מקדם אותו. השרת לעולם לא מוריד אותו.
      unlocked_through: localStorage.getItem('gc_unlocked_through') || '1',
    };
    for (let i = 1; i <= 17; i++) payload['ls' + i] = localStorage.getItem('ls' + i) || '0';
    if (!pulledOk) passportHeld = true;
    return payload;
  }

  // שליחה מיידית — מחזיר Promise עם תשובת השרת (או {skipped:true} אם הסנכרון כבוי/אין זהות)
  GC_SYNC.pushNow = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ skipped: true, reason: 'sync disabled' });
    const payload = collectPayload();
    if (!payload) return Promise.resolve({ skipped: true, reason: 'no identity' });
    return fetch(c.url, { method: 'POST', body: JSON.stringify(payload) })
      .then((r) => r.json())
      .catch((err) => ({ ok: false, error: String(err) }));
  };

  // סנכרון מבוזבז (debounced) — נקרא הרבה פעמים (כל addLeaves/savePassport), שולח פעם
  // אחת בפועל אחרי 3 שניות שקט, כדי לא להציף את ה-Apps Script בכל תשובת quiz בודדת.
  GC_SYNC.scheduleSync = function () {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncTimer = null; GC_SYNC.pushNow(); }, 3000);
  };

  // עזיבת דף (ניווט/רענון/סגירה) — מפנה מוקדם רק סנכרון שכבר היה ממתין (syncTimer פעיל),
  // ולא יוצר שליחה חדשה משלו על כל עזיבת דף. חשוב: אם היינו שולחים תמיד, מצב-ביניים ישן
  // שנתפס כאן עלול להגיע לשרת אחרי POST טרי יותר (sendBeacon לא מבטיח סדר הגעה) ולדרוס
  // אותו — "כתיבה אחרונה מנצחת" בשרת. לכן שולחים כאן רק אם יש שינוי אמיתי שממתין.
  window.addEventListener('pagehide', function () {
    if (!syncTimer) return;
    clearTimeout(syncTimer);
    syncTimer = null;
    const c = cfg();
    if (!c.enabled || !c.url) return;
    const payload = collectPayload();
    if (!payload) return;
    try {
      navigator.sendBeacon(c.url, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    } catch (e) {}
  });

  // ── שלב 9ה: משיכת נתונים אמיתיים (לא רק שליחה) ──────────────────────────

  // מושך את השורה האישית של התלמיד/ה (לפי school+class+code) ומאחד לתוך localStorage:
  // per-lesson leaves = מקסימום בין המקומי לזה שבגיליון (אף פעם לא נסוג אחורה, גם אם
  // המכשיר הזה "מפגר" אחרי מכשיר אחר של אותו תלמיד/זוג). achievements מאומצים רק אם המקומי
  // ריק. passport1 ממוזג (mergePassport): שדות מהגיליון שחסרים מקומית נוספים, resume = החדש
  // יותר לפי ts, done = איחוד; ומ-done משוחזרים דגלי lesson{N}_completed.
  GC_SYNC.pullMine = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ skipped: true, reason: 'sync disabled' });
    const id = window.GC_ID && GC_ID.getIdentity();
    if (!id) return Promise.resolve({ skipped: true, reason: 'no identity' });
    const url = c.url + '?token=' + encodeURIComponent(c.token) +
      '&school=' + encodeURIComponent(id.school || '') +
      '&class=' + encodeURIComponent(id.className || '') +
      '&code=' + encodeURIComponent(id.code || '');
    return fetch(url).then((r) => r.json()).then((resp) => {
      if (resp.ok) {
        pulledOk = true;
        if (passportHeld) { passportHeld = false; GC_SYNC.scheduleSync(); }
      }
      if (!resp.ok || !resp.rows || !resp.rows.length) return resp;
      const row = resp.rows[0];
      for (let i = 1; i <= 17; i++) {
        const key = 'ls' + i;
        const local = parseInt(localStorage.getItem(key) || '0');
        const remote = parseInt(row[key] || 0);
        if (remote > local) localStorage.setItem(key, remote);
      }
      const localSpent = parseInt(localStorage.getItem('leaves_spent') || '0');
      const remoteSpent = parseInt(row.leaves_spent || 0);
      if (remoteSpent > localSpent) localStorage.setItem('leaves_spent', remoteSpent);
      const localUnlocked = parseInt(localStorage.getItem('gc_unlocked_through') || '1');
      const remoteUnlocked = parseInt(row.unlocked_through || 1);
      if (remoteUnlocked > localUnlocked) localStorage.setItem('gc_unlocked_through', remoteUnlocked);
      mergePassport(row.passport1);
      // שם שהמדריך/ה שינה/תה בגיליון (rename_student) גובר על השם המקומי
      if (row.student_name && String(row.student_name) !== String(id.name || '')) {
        const cur = GC_ID.getIdentity();
        if (cur && cur.code === id.code) GC_ID.setIdentity(Object.assign({}, cur, { name: String(row.student_name) }));
      }
      const localAch = localStorage.getItem('gc_achievements');
      if ((!localAch || localAch === '{}') && row.achievements && row.achievements !== '{}') {
        localStorage.setItem('gc_achievements', row.achievements);
      }
      return resp;
    }).catch((err) => ({ ok: false, error: String(err) }));
  };

  function mergePassport(remoteRaw) {
    let local = {}, remote = {};
    try { local = JSON.parse(localStorage.getItem('passport1') || '{}') || {}; } catch (e) {}
    try { remote = JSON.parse(remoteRaw || '{}') || {}; } catch (e) {}
    const merged = Object.assign({}, remote, local);
    if (remote.answers || local.answers) merged.answers = Object.assign({}, remote.answers, local.answers);
    const lr = local.resume, rr = remote.resume;
    merged.resume = (rr && (!lr || (rr.ts || 0) > (lr.ts || 0))) ? rr : lr;
    if (!merged.resume) delete merged.resume;
    if (remote.done || local.done) merged.done = Object.assign({}, remote.done, local.done);
    // דגלי completed שכבר קיימים במחשב הזה (מלפני שהיה done) - נכנסים ל-done כדי שיגיעו לגיליון
    for (let i = 1; i <= 17; i++) {
      if (localStorage.getItem('lesson' + i + '_completed') === '1' && !(merged.done && merged.done[i])) {
        merged.done = Object.assign({}, merged.done, { [i]: 1 });
      }
    }
    // תלמידים מלפני resume/done (למשל מי שכבר עשו שיעורים 1-3): אין מיקום שמור ואין דגלים.
    // מסיקים «הושלם» לשיעור עם עלים שלפני gc_unlocked_through (באותה תקופה השיעור הבא נפתח
    // רק בסיום), ושיעור עם עלים בגבול הנעילה = השיעור שבו עצרו. רץ רק כשאין done וגם אין resume.
    if (!merged.done && !merged.resume) {
      const unlocked = parseInt(localStorage.getItem('gc_unlocked_through') || '1', 10) || 1;
      const done = {};
      let lastTouched = 0;
      for (let i = 1; i <= 17; i++) {
        if (parseInt(localStorage.getItem('ls' + i) || '0', 10) > 0) {
          lastTouched = i;
          if (i < unlocked) done[i] = 1;
        }
      }
      if (Object.keys(done).length) merged.done = done;
      if (lastTouched && !done[lastTouched]) merged.resume = { lesson: lastTouched, step: 1, steps: 0, ts: 0 };
    }
    if (Object.keys(merged).length) localStorage.setItem('passport1', JSON.stringify(merged));
    // «הושלם» גם בלי דגל מקומי: done מהגיליון, או resume שהגיע לשלב האחרון ויש בו עלים.
    // לא נוגעים בעלים ולא ב-gc_unlocked_through (הנעילה נשארת של המורה).
    Object.keys(merged.done || {}).forEach(function (k) {
      if (merged.done[k]) localStorage.setItem('lesson' + k + '_completed', '1');
    });
    const r = merged.resume;
    if (r && r.lesson && r.steps && r.step >= r.steps && parseInt(localStorage.getItem('ls' + r.lesson) || '0', 10) > 0) {
      localStorage.setItem('lesson' + r.lesson + '_completed', '1');
    }
  }

  // מושך את לוח המנהיגות בין-קבוצתי (כל הקבוצות באותו school+class) — משותף אמיתי בין
  // כל תלמידי הכיתה, לא רק מה שנשמר בדפדפן הזה.
  GC_SYNC.pullGroups = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, rows: [], skipped: true });
    const id = window.GC_ID && GC_ID.getIdentity();
    if (!id) return Promise.resolve({ ok: false, rows: [], skipped: true });
    const url = c.url + '?token=' + encodeURIComponent(c.token) + '&type=groups' +
      '&school=' + encodeURIComponent(id.school || '') +
      '&class=' + encodeURIComponent(id.className || '');
    return fetch(url).then((r) => r.json()).catch((err) => ({ ok: false, error: String(err), rows: [] }));
  };

  // מוסיף עלים לקבוצת-פרויקט (מצטבר בשרת, לא דורס) — תואם את addToGroup() ב-leaves.html
  GC_SYNC.pushGroup = function (name, addLeaves) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ skipped: true });
    const id = window.GC_ID && GC_ID.getIdentity();
    if (!id) return Promise.resolve({ skipped: true });
    const payload = {
      token: c.token, type: 'group',
      school_id: id.school || '', class_id: id.className || '',
      group_name: name, addLeaves: addLeaves,
    };
    return fetch(c.url, { method: 'POST', body: JSON.stringify(payload) })
      .then((r) => r.json())
      .catch((err) => ({ ok: false, error: String(err) }));
  };

  // הידרציה שקטה בטעינת כל דף שטוען את הקובץ הזה: אם יש זהות וסנכרון פעיל, למשוך את
  // ההתקדמות האישית האמיתית (fire-and-forget - לא חוסם רינדור ראשוני של הדף).
  GC_SYNC.hydrated = (window.GC_ID && GC_ID.getIdentity()) ? GC_SYNC.pullMine() : Promise.resolve({ skipped: true });

  // ── מורה+כיתה: הערות לשיעור + קצב התקדמות (בקשת המשתמש, אחרי שלב 10) ─────
  // notes_json הוא בלוק JSON אחד {"1":"הערה לשיעור 1", "5":"..."} - כמו passport1
  // אצל תלמידים, לא 17 שדות נפרדים. לא נטען אוטומטית בכל דף (בניגוד ל-pullMine למעלה) -
  // רק teacher-class.html קורא ל-pullTeacherMine במפורש, כי זה רלוונטי רק שם.
  let teacherSyncTimer = null;
  function teacherCollectPayload() {
    const t = window.GC_ID && GC_ID.getTeacherClassIdentity && GC_ID.getTeacherClassIdentity();
    if (!t) return null;
    return {
      token: cfg().token, type: 'teacher',
      school_id: t.school || '', class_id: t.className || '',
      teacher_name: t.teacherName || '', code: t.code || '',
      notes_json: localStorage.getItem('gc_teacher_notes') || '{}',
    };
  }
  GC_SYNC.pushTeacherNotesNow = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ skipped: true, reason: 'sync disabled' });
    const payload = teacherCollectPayload();
    if (!payload) return Promise.resolve({ skipped: true, reason: 'no teacher identity' });
    return fetch(c.url, { method: 'POST', body: JSON.stringify(payload) })
      .then((r) => r.json())
      .catch((err) => ({ ok: false, error: String(err) }));
  };
  // סנכרון מבוזבז קצר (1.5 שניות) - קצר יותר מזה של תלמידים (3 שניות) כי הערות טקסט
  // חופשי, לא רוצים לאבד הרבה אם המורה סוגר/ת טאב מהר אחרי הקלדה.
  GC_SYNC.scheduleTeacherSync = function () {
    clearTimeout(teacherSyncTimer);
    teacherSyncTimer = setTimeout(function () { teacherSyncTimer = null; GC_SYNC.pushTeacherNotesNow(); }, 1500);
  };
  GC_SYNC.pullTeacherMine = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ skipped: true, reason: 'sync disabled' });
    const t = window.GC_ID && GC_ID.getTeacherClassIdentity && GC_ID.getTeacherClassIdentity();
    if (!t) return Promise.resolve({ skipped: true, reason: 'no teacher identity' });
    const url = c.url + '?token=' + encodeURIComponent(c.token) + '&type=teacher_notes' +
      '&school=' + encodeURIComponent(t.school || '') +
      '&class=' + encodeURIComponent(t.className || '') +
      '&code=' + encodeURIComponent(t.code || '');
    return fetch(url).then((r) => r.json()).then((resp) => {
      if (!resp.ok || !resp.rows || !resp.rows.length) return resp;
      const row = resp.rows[0];
      const localNotes = localStorage.getItem('gc_teacher_notes');
      if ((!localNotes || localNotes === '{}') && row.notes_json && row.notes_json !== '{}') {
        localStorage.setItem('gc_teacher_notes', row.notes_json);
      }
      return resp;
    }).catch((err) => ({ ok: false, error: String(err) }));
  };

  // קצב התקדמות הכיתה - כל התלמידים/קבוצות ב-school+class הספציפיים, לא רק מה שהמורה
  // שומר/ת מקומית - זו בדיוק הנקודה של הפיצ'ר: לראות את כל הכיתה, לא רק את עצמו/ה.
  GC_SYNC.pullClassProgress = function (school, className) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, rows: [], skipped: true });
    const url = c.url + '?token=' + encodeURIComponent(c.token) + '&type=class_progress' +
      '&school=' + encodeURIComponent(school || '') +
      '&class=' + encodeURIComponent(className || '');
    return fetch(url).then((r) => r.json()).catch((err) => ({ ok: false, error: String(err), rows: [] }));
  };

  // ── שלב 9ו: שיתוף בין כיתות ובתי ספר ────────────────────────────────────

  // לוח "מי הצמיח הכי גבוה" - גלוי לכולם (כל בתי הספר), לא רק לכיתה של המשתמש/ת.
  GC_SYNC.pullHeights = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, rows: [], skipped: true });
    const url = c.url + '?token=' + encodeURIComponent(c.token) + '&type=heights';
    return fetch(url).then((r) => r.json()).catch((err) => ({ ok: false, error: String(err), rows: [] }));
  };

  // גלריית אבטיפוסים - קריאה גלויה לכולם
  GC_SYNC.pullGallery = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, rows: [], skipped: true });
    const url = c.url + '?token=' + encodeURIComponent(c.token) + '&type=gallery';
    return fetch(url).then((r) => r.json()).catch((err) => ({ ok: false, error: String(err), rows: [] }));
  };

  GC_SYNC.submitGallery = function (entry) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, skipped: true });
    const id = window.GC_ID && GC_ID.getIdentity();
    const payload = {
      token: c.token, type: 'gallery_submit',
      school_id: (id && id.school) || '', class_id: (id && id.className) || '',
      group_name: (id && id.name) || '',
      title: entry.title || '', image_url: entry.image_url || '', description: entry.description || '',
    };
    return fetch(c.url, { method: 'POST', body: JSON.stringify(payload) })
      .then((r) => r.json())
      .catch((err) => ({ ok: false, error: String(err) }));
  };

  GC_SYNC.voteGallery = function (id) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, skipped: true });
    return fetch(c.url, { method: 'POST', body: JSON.stringify({ token: c.token, type: 'gallery_vote', id: id }) })
      .then((r) => r.json())
      .catch((err) => ({ ok: false, error: String(err) }));
  };

  // dump מלא לכל בתי הספר/המסלולים - למנהל/ת המגמה בלבד (admin-dashboard.html מפעיל את
  // זה רק אחרי אישור סיסמת מנהל בצד הלקוח, לא נטען אוטומטית בטעינת הקובץ).
  GC_SYNC.pullAdminAll = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, rows: [], groups: [], skipped: true });
    const url = c.url + '?token=' + encodeURIComponent(c.token) + '&type=admin_students';
    return fetch(url).then((r) => r.json()).catch((err) => ({ ok: false, error: String(err), rows: [], groups: [] }));
  };

  // רשימת תלמידי כיתה ספציפית למורה+כיתה מהרשימה (data/roster.js) - מפעיל dump מלא
  // (pullAdminAll, אותו endpoint שמשמש את admin-dashboard.html) ומסנן בצד הלקוח לפי
  // school_id+class_id, בלי לגעת ב-Apps Script.
  GC_SYNC.pullClass = function (school, classId) {
    return GC_SYNC.pullAdminAll().then(function (resp) {
      if (!resp || !resp.ok) return resp;
      const match = function (r) {
        return String(r.school_id) === String(school) && String(r.class_id) === String(classId);
      };
      const rows = (resp.rows || []).filter(match);
      // ערך הפתיחה הכיתתי (0 אם אין / פריסה ישנה בלי class_unlocks)
      const cu = (resp.class_unlocks || []).filter(match)[0];
      const meta = (resp.class_meta || []).filter(match)[0];
      return Object.assign({}, resp, { rows: rows, classUnlockedThrough: cu ? Number(cu.unlocked_through) || 0 : 0,
        classDisplayName: (meta && meta.display_name) || '' });
    });
  };

  // ── פתיחת שיעור ע"י מדריך/ה (teacher-dashboard.html) ──────────────────────
  // קודם בודקים שהפריסה של Apps Script מכירה את class_unlock/student_unlock (type=features).
  // פריסה ישנה הייתה מפילה POST כזה ל-upsert של תלמיד ויוצרת שורת זבל - לכן לא שולחים בלי אישור.
  let featuresPromise = null;
  GC_SYNC.getFeatures = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve([]);
    if (!featuresPromise) {
      featuresPromise = fetch(c.url + '?token=' + encodeURIComponent(c.token) + '&type=features')
        .then((r) => r.json())
        .then((resp) => (resp && resp.ok && Array.isArray(resp.features)) ? resp.features : [])
        .catch(() => { featuresPromise = null; return []; });
    }
    return featuresPromise;
  };
  function postUnlock(type, payload) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, error: 'sync disabled' });
    return GC_SYNC.getFeatures().then(function (features) {
      if (features.indexOf(type) === -1) return { ok: false, error: 'server_outdated' };
      return fetch(c.url, { method: 'POST', body: JSON.stringify(Object.assign({ token: c.token, type: type }, payload)) })
        .then((r) => r.json());
    }).catch((err) => ({ ok: false, error: String(err) }));
  }
  // school = שם בית הספר כפי שנשמר ב-school_id בגיליון (GC_ROSTER schoolName)
  GC_SYNC.setClassUnlock = function (school, classId, n) {
    return postUnlock('class_unlock', { school_id: school, class_id: classId, unlocked_through: n });
  };
  GC_SYNC.setStudentUnlock = function (school, classId, code, n) {
    return postUnlock('student_unlock', { school_id: school, class_id: classId, code: code, unlocked_through: n });
  };

  // ── ניהול כיתה ע"י מדריך/ה (assets/teacher-panel.js + teacher-dashboard.html) ──
  // הכול נכתב לגיליון (המחשבים בכיתה מתחלפים) - לא רק ל-localStorage. עובר דרך postUnlock,
  // כך שפריסת Apps Script ישנה מחזירה server_outdated במקום ליצור שורת זבל.
  GC_SYNC.renameStudent = function (school, classId, code, name) {
    return postUnlock('rename_student', { school_id: school, class_id: classId, code: code, student_name: name });
  };
  // codes = קוד אחד או מערך (איחוד כמה תלמידים לאותו זוג). groupName ריק = פיצול/הסרה.
  GC_SYNC.setGroupName = function (school, classId, codes, groupName) {
    return postUnlock('set_group_name', { school_id: school, class_id: classId,
      codes: [].concat(codes), group_name: groupName || '' });
  };
  // שם תצוגה לכיתה (גיליון class_meta) - class_id עצמו לא משתנה
  GC_SYNC.setClassDisplayName = function (school, classId, displayName) {
    return postUnlock('class_meta', { school_id: school, class_id: classId, display_name: displayName || '' });
  };
  GC_SYNC.pullClassMeta = function () {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, rows: [], skipped: true });
    return fetch(c.url + '?token=' + encodeURIComponent(c.token) + '&type=class_meta')
      .then((r) => r.json()).catch((err) => ({ ok: false, error: String(err), rows: [] }));
  };

  // ── פתיחת שיעור מהמחשב של התלמיד/ה בסיסמת מורה ─────────────────────────────
  // מתקבלות: סיסמת המורה הכללית (זהה ל-TEACHER_PASSWORD ב-index.html / teacher-class.html),
  // סיסמת רכז/ת, או סיסמה אישית של מדריך/ה (data/roster.js) שמדריך/ה את בית הספר של התלמיד/ה.
  // הצלחה = gc_unlocked_through עד n מקומית + student_unlock בגיליון (נשמר גם אחרי התנתקות).
  const TEACHER_UNLOCK_PASSWORD = 'moradaat2026';
  function loadRoster() {
    return (window.GC_ID && typeof GC_ID.loadRoster === 'function') ? GC_ID.loadRoster() : Promise.resolve();
  }
  GC_SYNC.teacherUnlock = function (n, password) {
    return loadRoster().then(function () {
      const pw = String(password || '').trim();
      const id = window.GC_ID && GC_ID.getIdentity();
      let ok = pw === TEACHER_UNLOCK_PASSWORD;
      if (!ok && pw && window.GC_ROSTER) {
        const t = GC_ROSTER.findTeacher(pw);
        ok = !!t && (t.role === 'coordinator' || !id || !id.school ||
          t.classes.some(function (c) { return c.schoolName === id.school; }));
      }
      if (!ok) return false;
      const cur = parseInt(localStorage.getItem('gc_unlocked_through') || '1', 10) || 1;
      if (n > cur) localStorage.setItem('gc_unlocked_through', n);
      if (!id) return true;
      const sync = GC_SYNC.setStudentUnlock(id.school || '', id.className || '', id.code || '', n).catch(function () {});
      const timeout = new Promise(function (resolve) { setTimeout(resolve, 4000); });
      return Promise.race([sync, timeout]).then(function () { return true; });
    });
  };
  // חלון סיסמה (שדה מוסתר - הסיסמה לא נחשפת על מסך התלמיד/ה). onOk נקרא אחרי פתיחה מוצלחת.
  GC_SYNC.askTeacherUnlock = function (n, onOk) {
    if (document.getElementById('gc-tu-modal')) return;
    const o = document.createElement('div');
    o.id = 'gc-tu-modal';
    o.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
    o.innerHTML = '<form dir="rtl" style="background:white;border-radius:20px;padding:22px;max-width:320px;width:100%;box-sizing:border-box;font-family:Heebo,sans-serif;text-align:center;">' +
      '<p style="font-weight:900;font-size:1.05rem;margin:0 0 4px;color:#166534;">🔑 פתיחת שיעור ' + n + '</p>' +
      '<p style="margin:0 0 12px;color:#4b5563;font-size:.85rem;">המורה מקליד/ה סיסמה</p>' +
      '<input id="gc-tu-pw" type="password" autocomplete="off" aria-label="סיסמת מורה" style="width:100%;box-sizing:border-box;border:2px solid #d1d5db;border-radius:12px;padding:8px 10px;font-size:1rem;text-align:center;">' +
      '<p id="gc-tu-err" style="display:none;color:#dc2626;font-size:.8rem;margin:6px 0 0;">סיסמה שגויה</p>' +
      '<div style="display:flex;gap:8px;margin-top:14px;">' +
      '<button type="submit" id="gc-tu-ok" style="flex:1;background:#16a34a;color:white;font-weight:900;border:0;border-radius:999px;padding:9px;cursor:pointer;">פתיחה</button>' +
      '<button type="button" id="gc-tu-cancel" style="flex:1;background:#f3f4f6;font-weight:700;border:0;border-radius:999px;padding:9px;cursor:pointer;">ביטול</button>' +
      '</div></form>';
    document.body.appendChild(o);
    const input = o.querySelector('#gc-tu-pw');
    const btn = o.querySelector('#gc-tu-ok');
    input.focus();
    o.querySelector('#gc-tu-cancel').onclick = function () { o.remove(); };
    o.querySelector('form').onsubmit = function (e) {
      e.preventDefault();
      btn.disabled = true; btn.textContent = '...';
      GC_SYNC.teacherUnlock(n, input.value).then(function (ok) {
        btn.disabled = false; btn.textContent = 'פתיחה';
        if (!ok) { o.querySelector('#gc-tu-err').style.display = 'block'; input.value = ''; input.focus(); return; }
        o.remove();
        if (onOk) onOk();
      });
    };
  };

  GC_SYNC.deleteGalleryItem = function (id) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, skipped: true });
    return fetch(c.url, { method: 'POST', body: JSON.stringify({ token: c.token, type: 'gallery_delete', id: id }) })
      .then((r) => r.json())
      .catch((err) => ({ ok: false, error: String(err) }));
  };

  // האם מדריך/ה כבר נכנס/ה (teacher-dashboard.html, "זכור במחשב הזה" או הטאב הנוכחי) -
  // דפי מורה אחרים (index.html מצב מורה, teacher-class.html) מדלגים אז על בקשת הסיסמה.
  GC_SYNC.teacherLoggedIn = function () {
    let pw = '';
    try { pw = localStorage.getItem('gc_teacher_dash_pw') || sessionStorage.getItem('gc_teacher_dash_pw') || ''; } catch (e) {}
    return !!(pw && window.GC_ROSTER && GC_ROSTER.findTeacher(pw));
  };

  // פאנל מדריך/ה צף: נטען בכל דף שיש בו את הקובץ הזה, רק אם מדריך/ה כבר נכנס/ה
  // (gc_teacher_dash_pw). כך אפשר לפעול גם ממחשב של תלמיד/ה בלי להקליד סיסמה שוב.
  (function autoloadTeacherPanel() {
    if (window.GC_TPANEL || !ROOT) return;
    let saved = null;
    try { saved = localStorage.getItem('gc_teacher_dash_pw') || sessionStorage.getItem('gc_teacher_dash_pw'); } catch (e) {}
    if (!saved) return;
    const s = document.createElement('script');
    s.src = ROOT + 'assets/teacher-panel.js';
    document.head.appendChild(s);
  })();

  // ── נעילת כניסה ישירה ל-URL של לומדה (lessons/ + elementary/lessons/) ─────────
  // שיעור N מוצג רק אם N <= gc_unlocked_through (מה שהמדריך/ה פתח/ה, אחרי pullMine אם יש
  // זהות). שיעור 1 תמיד פתוח; שיעור שכבר הושלם פתוח לחזרה; מצב מורה (index.html) לא ננעל.
  (function lessonGate() {
    const m = location.pathname.match(/\/lessons\/lesson-0*(\d+)\.html$/);
    if (!m) return;
    const n = parseInt(m[1], 10);
    if (n <= 1) return;
    if (sessionStorage.getItem('teacher') === '1' && sessionStorage.getItem('gc_teacher_pw_ok') === '1') return;
    const allowed = function () {
      const u = parseInt(localStorage.getItem('gc_unlocked_through') || '1', 10) || 1;
      return n <= u || localStorage.getItem('lesson' + n + '_completed') === '1';
    };
    if (allowed()) return;
    window.GC_LESSON_LOCKED = true; // core.js לא יסמן completed בזמן ההמתנה
    const hide = document.createElement('style');
    hide.textContent = 'body{visibility:hidden!important}';
    document.head.appendChild(hide);
    const home = (/\/elementary(-bilingual)?\//.test(location.pathname) ? '../../' : '../') + 'index.html#lessons-section';
    const lock = function () {
      document.body.innerHTML =
        '<div dir="rtl" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Heebo,sans-serif;background:#f0fdf4;">' +
        '<div style="background:white;border-radius:20px;padding:28px 24px;max-width:360px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.1);">' +
        '<p style="font-size:2.5rem;margin:0 0 8px;">🔒</p>' +
        '<p style="font-weight:900;font-size:1.15rem;margin:0 0 6px;color:#166534;">השיעור הזה עוד לא נפתח.</p>' +
        '<p style="margin:0 0 18px;color:#4b5563;">המורה פותח אותו.</p>' +
        '<a href="' + home + '" style="display:inline-block;background:#16a34a;color:white;font-weight:900;padding:10px 20px;border-radius:999px;text-decoration:none;">לדף הבית ←</a>' +
        '<p style="margin:16px 0 0;"><button type="button" id="gc-tu-open" style="background:none;border:0;color:#6b7280;font-size:.85rem;text-decoration:underline;cursor:pointer;font-family:inherit;">🔑 מורה? פתיחה בסיסמה</button></p>' +
        '</div></div>';
      hide.remove();
      document.getElementById('gc-tu-open').onclick = function () {
        GC_SYNC.askTeacherUnlock(n, function () { location.reload(); });
      };
    };
    const decide = function () {
      if (allowed()) { window.GC_LESSON_LOCKED = false; hide.remove(); return; }
      if (document.body) lock(); else document.addEventListener('DOMContentLoaded', lock);
    };
    // pullMine רץ כבר למעלה (הידרציה) - כאן מחכים לתוצאה שלו כדי לכלול פתיחה של המורה
    const c = cfg();
    if (window.GC_ID && GC_ID.getIdentity() && c.enabled && c.url) {
      GC_SYNC.hydrated.then(decide, decide);
    } else {
      decide();
    }
  })();
})();
