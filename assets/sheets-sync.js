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
  // מוגן בשרת: רק המדריך/ה של הכיתה (teacher_token) - ראה teacherGet למטה.
  GC_SYNC.pullClassProgress = function (school, className) {
    return teacherGet('class_progress', { school: school || '', class: className || '' });
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

  // dump מלא לכל בתי הספר/המסלולים - לרכז/ת המגמה בלבד (השרת דורש teacher_token עם
  // role=coordinator; admin-dashboard.html נכנס דרך teacherLogin).
  GC_SYNC.pullAdminAll = function () {
    return teacherGet('admin_students', {}).then((resp) => Object.assign({ rows: [], groups: [] }, resp));
  };

  // תלמידי כיתה אחת למדריך/ה (class_progress - השרת מסנן ובודק שהכיתה שלו/ה).
  // לא משתמשים יותר ב-admin_students (dump של כל בתי הספר) לצורך הזה.
  GC_SYNC.pullClass = function (school, classId) {
    return GC_SYNC.pullClassProgress(school, classId).then(function (resp) {
      if (!resp || !resp.ok) return resp;
      return Object.assign({}, resp, { rows: resp.rows || [],
        classUnlockedThrough: Number(resp.class_unlocked_through) || 0,
        classDisplayName: resp.display_name || '' });
    });
  };

  // מסך הכרטיסים בדשבורד - סיכום לכל הכיתות בקריאה אחת. classes = [{schoolName, classId}]
  GC_SYNC.pullTeacherOverview = function (classes) {
    const list = (classes || []).map((x) => ({ school: x.schoolName, class: x.classId }));
    return teacherGet('teacher_overview', { classes: JSON.stringify(list) });
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
  // ── כניסת מדריך/ה (חוק יסוד 4: אימות בשרת) ──────────────────────────────────
  // הכניסה (POST type=login) מחזירה token זמני חתום - 12 שעות, או 14 יום עם "זכור במחשב הזה".
  // נשמר ב-gc_teacher_session ({token, exp, teacher}) - localStorage אם "זכור", אחרת sessionStorage.
  // הסיסמה עצמה לא נשמרת. gc_teacher_dash_pw = המפתח הישן (סיסמה גלויה) - מומר אוטומטית
  // ל-session בכניסה הבאה (migrateLegacyTeacher) ונמחק, כך שמדריכים מחוברים לא מרגישים במעבר.
  const SESSION_KEY = 'gc_teacher_session';
  const LEGACY_PW_KEY = 'gc_teacher_dash_pw';
  const AUTH_ERRORS = ['auth_expired', 'auth_invalid', 'auth_required'];
  function store(kind) { try { return kind === 'local' ? localStorage : sessionStorage; } catch (e) { return null; } }
  function clearKey(key) { ['local', 'session'].forEach((k) => { const s = store(k); if (s) s.removeItem(key); }); }
  function readSession(kind) {
    const s = store(kind);
    try { const o = s && JSON.parse(s.getItem(SESSION_KEY) || 'null'); return o && o.token ? o : null; } catch (e) { return null; }
  }
  // session תקף (לא פג) או null. remember = נשמר ב-localStorage.
  GC_SYNC.teacherSession = function () {
    const l = readSession('local'), s = readSession('session');
    const o = (l && l.exp > Date.now()) ? Object.assign({ remember: true }, l)
      : (s && s.exp > Date.now()) ? Object.assign({ remember: false }, s) : null;
    return o;
  };
  GC_SYNC.teacherToken = function () { const s = GC_SYNC.teacherSession(); return s ? s.token : ''; };
  function legacyPassword() {
    const l = store('local'), s = store('session');
    const lp = l && l.getItem(LEGACY_PW_KEY);
    return lp ? { pw: lp, remember: true } : (s && s.getItem(LEGACY_PW_KEY)) ? { pw: s.getItem(LEGACY_PW_KEY), remember: false } : null;
  }

  // כניסה בשרת בלי לשמור session (גם לפתיחת שיעור ממחשב של תלמיד/ה). פריסה ישנה בלי
  // teacher_auth הייתה מפילה type=login ל-upsert של תלמיד - לכן בודקים FEATURES קודם.
  function serverLogin(pw, remember) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, error: 'sync disabled' });
    return GC_SYNC.getFeatures().then(function (features) {
      if (!features.length) return { ok: false, error: 'network' };
      if (features.indexOf('teacher_auth') === -1) return { ok: false, error: 'server_outdated' };
      return fetch(c.url, { method: 'POST', body: JSON.stringify({ token: c.token, type: 'login', password: String(pw || '').trim(), remember: !!remember }) })
        .then((r) => r.json());
    }).catch((err) => ({ ok: false, error: String(err) }));
  }
  // כניסה למצב מורה (לוח הבקרה / חלון "הכניסה פגה"). סיסמת המורה הכללית לא מכניסה למצב מורה.
  GC_SYNC.teacherLogin = function (pw, remember) {
    return serverLogin(pw, remember).then(function (resp) {
      if (!resp || !resp.ok) return resp || { ok: false };
      if (resp.teacher && resp.teacher.role === 'general') return { ok: false, error: 'general_password' };
      clearKey(SESSION_KEY);
      clearKey(LEGACY_PW_KEY);
      const target = store(remember ? 'local' : 'session');
      if (target) target.setItem(SESSION_KEY, JSON.stringify({ token: resp.token, exp: resp.exp, teacher: resp.teacher }));
      return resp;
    });
  };
  GC_SYNC.teacherLogout = function () {
    clearKey(SESSION_KEY);
    clearKey(LEGACY_PW_KEY);
  };
  GC_SYNC.teacherLoginErrorText = function (resp) {
    const e = resp && resp.error;
    if (e === 'bad_password') return 'סיסמה שגויה';
    if (e === 'general_password') return 'זו הסיסמה הכללית - לכניסה למצב מורה צריך את הסיסמה האישית שלך';
    if (e === 'too_many_attempts') return 'יותר מדי ניסיונות שגויים. נסו שוב בעוד 10 דקות.';
    if (e === 'server_outdated') return 'צריך קודם לעדכן את ה-Apps Script (Deploy → New version).';
    if (e === 'sync disabled') return 'הסנכרון לגיליון כבוי במחשב הזה - אי אפשר להיכנס.';
    return 'אין חיבור לשרת - נסו שוב.';
  };
  // המרה שקטה של כניסה ישנה (סיסמה שמורה) ל-session. סיסמה שכבר לא תקפה נמחקת.
  let migratePromise = null;
  GC_SYNC.migrateLegacyTeacher = function () {
    const legacy = legacyPassword();
    if (!legacy) return Promise.resolve(GC_SYNC.teacherSession());
    if (GC_SYNC.teacherSession()) { clearKey(LEGACY_PW_KEY); return Promise.resolve(GC_SYNC.teacherSession()); }
    if (!migratePromise) {
      migratePromise = GC_SYNC.teacherLogin(legacy.pw, legacy.remember).then(function (resp) {
        if (resp && /^(bad_password|general_password)$/.test(resp.error || '')) clearKey(LEGACY_PW_KEY);
        migratePromise = null;
        return GC_SYNC.teacherSession();
      });
    }
    return migratePromise;
  };

  // חלון סיסמה (שדה מוסתר - הסיסמה לא נחשפת על המסך). check(pw) → Promise<{ok, error}>.
  // מחזיר Promise<boolean>: true אחרי בדיקה מוצלחת, false בביטול.
  function passwordModal(title, sub, check) {
    return new Promise(function (resolve) {
      const old = document.getElementById('gc-tu-modal');
      if (old) old.remove();
      const o = document.createElement('div');
      o.id = 'gc-tu-modal';
      o.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
      o.innerHTML = '<form dir="rtl" style="background:white;border-radius:20px;padding:22px;max-width:320px;width:100%;box-sizing:border-box;font-family:Heebo,sans-serif;text-align:center;">' +
        '<p style="font-weight:900;font-size:1.05rem;margin:0 0 4px;color:#166534;"></p>' +
        '<p style="margin:0 0 12px;color:#4b5563;font-size:.85rem;"></p>' +
        '<input id="gc-tu-pw" type="password" autocomplete="off" aria-label="סיסמת מורה" style="width:100%;box-sizing:border-box;border:2px solid #d1d5db;border-radius:12px;padding:8px 10px;font-size:1rem;text-align:center;">' +
        '<p id="gc-tu-err" role="alert" style="display:none;color:#dc2626;font-size:.8rem;margin:6px 0 0;"></p>' +
        '<div style="display:flex;gap:8px;margin-top:14px;">' +
        '<button type="submit" id="gc-tu-ok" style="flex:1;background:#16a34a;color:white;font-weight:900;border:0;border-radius:999px;padding:9px;cursor:pointer;">אישור</button>' +
        '<button type="button" id="gc-tu-cancel" style="flex:1;background:#f3f4f6;font-weight:700;border:0;border-radius:999px;padding:9px;cursor:pointer;">ביטול</button>' +
        '</div></form>';
      const ps = o.querySelectorAll('form > p');
      ps[0].textContent = title;
      ps[1].textContent = sub;
      document.body.appendChild(o);
      const input = o.querySelector('#gc-tu-pw');
      const btn = o.querySelector('#gc-tu-ok');
      const err = o.querySelector('#gc-tu-err');
      input.focus();
      o.querySelector('#gc-tu-cancel').onclick = function () { o.remove(); resolve(false); };
      o.querySelector('form').onsubmit = function (e) {
        e.preventDefault();
        btn.disabled = true; btn.textContent = '...';
        check(input.value).then(function (resp) {
          btn.disabled = false; btn.textContent = 'אישור';
          if (resp && resp.ok) { o.remove(); resolve(true); return; }
          err.textContent = GC_SYNC.teacherLoginErrorText(resp);
          err.style.display = 'block'; input.value = ''; input.focus();
        });
      };
    });
  }
  // הכניסה פגה באמצע עבודה → סיסמה שוב, בלי לאבד את הדף. בקשה אחת בכל רגע.
  let reauthPromise = null;
  GC_SYNC.askTeacherLogin = function () {
    if (!reauthPromise) {
      const remember = !!readSession('local') || !!(legacyPassword() || {}).remember;
      reauthPromise = passwordModal('🔑 הכניסה למצב מורה פגה', 'הקלידו שוב את הסיסמה האישית שלכם',
        (pw) => GC_SYNC.teacherLogin(pw, remember))
        .then(function (ok) { reauthPromise = null; return ok; });
    }
    return reauthPromise;
  };
  function withReauth(run) {
    return run().then(function (resp) {
      if (resp && AUTH_ERRORS.indexOf(resp.error) !== -1 && document.body) {
        return GC_SYNC.askTeacherLogin().then((ok) => (ok ? run() : resp));
      }
      return resp;
    });
  }
  // GET של מדריך/ה עם teacher_token (בלי session: בקשה בלי token - עובד רק בתקופת המעבר).
  function teacherGet(type, params) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, rows: [], skipped: true });
    const run = function () {
      let url = c.url + '?token=' + encodeURIComponent(c.token) + '&type=' + type;
      const tk = GC_SYNC.teacherToken();
      if (tk) url += '&teacher_token=' + encodeURIComponent(tk);
      Object.keys(params || {}).forEach((k) => { url += '&' + k + '=' + encodeURIComponent(params[k]); });
      return fetch(url).then((r) => r.json());
    };
    return withReauth(run).catch((err) => ({ ok: false, error: String(err), rows: [] }));
  }

  // tokenOverride: token מכניסה חד-פעמית (פתיחה ממחשב של תלמיד/ה) - בלי חלון כניסה מחדש.
  function postUnlock(type, payload, tokenOverride) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, error: 'sync disabled' });
    return GC_SYNC.getFeatures().then(function (features) {
      if (features.indexOf(type) === -1) return { ok: false, error: 'server_outdated' };
      const run = function () {
        const body = Object.assign({ token: c.token, type: type }, payload);
        const tk = tokenOverride !== undefined ? tokenOverride : GC_SYNC.teacherToken();
        if (tk) body.teacher_token = tk;
        return fetch(c.url, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
      };
      return tokenOverride !== undefined ? run() : withReauth(run);
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
  // הסיסמה נבדקת בשרת (serverLogin, בלי לשמור session על מחשב התלמיד/ה): סיסמה אישית של
  // מדריך/ה של בית הספר, רכז/ת, או הסיסמה הכללית (role=general - עד שהיא מבוטלת בשלב ד במעבר).
  // הצלחה = gc_unlocked_through עד n מקומית + student_unlock בגיליון (נשמר גם אחרי התנתקות).
  // TEACHER_UNLOCK_PASSWORD: רק כשאין שרת לבדוק מולו (סנכרון כבוי) - נמחק בשלב ד.
  const TEACHER_UNLOCK_PASSWORD = 'moradaat2026';
  GC_SYNC.teacherUnlock = function (n, password) {
    const pw = String(password || '').trim();
    const id = window.GC_ID && GC_ID.getIdentity();
    const c = cfg();
    if (!pw) return Promise.resolve({ ok: false, error: 'bad_password' });
    const check = (!c.enabled || !c.url)
      ? Promise.resolve(pw === TEACHER_UNLOCK_PASSWORD ? { ok: true, token: '' } : { ok: false, error: 'bad_password' })
      : serverLogin(pw, false);
    return check.then(function (resp) {
      if (!resp || !resp.ok) return resp || { ok: false };
      const t = resp.teacher;
      // מדריך/ה של בית ספר אחר - השרת היה דוחה את student_unlock ממילא
      if (t && t.role === 'teacher' && id && id.school &&
          !(t.classes || []).some(function (x) { return x.school === id.school; })) return { ok: false, error: 'bad_password' };
      const cur = parseInt(localStorage.getItem('gc_unlocked_through') || '1', 10) || 1;
      if (n > cur) localStorage.setItem('gc_unlocked_through', n);
      if (!id || !resp.token) return { ok: true };
      const sync = postUnlock('student_unlock', { school_id: id.school || '', class_id: id.className || '',
        code: id.code || '', unlocked_through: n }, resp.token).catch(function () {});
      const timeout = new Promise(function (resolve) { setTimeout(resolve, 4000); });
      return Promise.race([sync, timeout]).then(function () { return { ok: true }; });
    });
  };
  // onOk נקרא אחרי פתיחה מוצלחת.
  GC_SYNC.askTeacherUnlock = function (n, onOk) {
    if (document.getElementById('gc-tu-modal')) return;
    passwordModal('🔑 פתיחת שיעור ' + n, 'המורה מקליד/ה סיסמה', (pw) => GC_SYNC.teacherUnlock(n, pw))
      .then(function (ok) { if (ok && onOk) onOk(); });
  };

  // מחיקה מהגלריה - רכז/ת בלבד (השרת דורש teacher_token עם role=coordinator)
  GC_SYNC.deleteGalleryItem = function (id) {
    return postUnlock('gallery_delete', { id: id });
  };

  // האם מדריך/ה כבר נכנס/ה (teacher-dashboard.html, "זכור במחשב הזה" או הטאב הנוכחי) -
  // דפי מורה אחרים (index.html מצב מורה, teacher-class.html) מדלגים אז על בקשת הסיסמה.
  // כניסה ישנה (סיסמה שמורה) נחשבת עד שהמרתה ל-session מסתיימת (migrateLegacyTeacher).
  GC_SYNC.teacherLoggedIn = function () {
    return !!(GC_SYNC.teacherSession() || legacyPassword());
  };

  // פאנל מדריך/ה צף: נטען בכל דף שיש בו את הקובץ הזה, רק אם מדריך/ה כבר נכנס/ה.
  // כך אפשר לפעול גם ממחשב של תלמיד/ה בלי להקליד סיסמה שוב.
  (function autoloadTeacherPanel() {
    if (window.GC_TPANEL || !ROOT || !GC_SYNC.teacherLoggedIn()) return;
    GC_SYNC.migrateLegacyTeacher().then(function (session) {
      if (!session || window.GC_TPANEL) return;
      const s = document.createElement('script');
      s.src = ROOT + 'assets/teacher-panel.js';
      document.head.appendChild(s);
    });
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
