// assets/sheets-sync.js — סנכרון ל-Google Sheets (שלב 9ד, MASTER-WORKFLOW.md)
// שכבה דקה מעל GC_ID (זהות, שלב 9ג) + מפתחות ls{N}/passport1 הקיימים ב-core.js.
// לא פעיל כברירת מחדל — ראה data/sheets-config.js (enabled=false עד שיש Apps Script פרוס).
(function () {
  const GC_SYNC = (window.GC_SYNC = {});
  let syncTimer = null;

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
      group_name: '',
      student_name: id.name || '',
      code: id.code || '',
      leaves_spent: localStorage.getItem('leaves_spent') || '0',
      passport1: localStorage.getItem('passport1') || '{}',
      achievements: localStorage.getItem('gc_achievements') || '{}',
      // השיעור הגבוה ביותר שמותר לפתוח - רק "משתקף" מהערך המקומי הנוכחי, לעולם לא
      // מחושב-מחדש כאן. החישוב/הקידום קורה אך ורק ב-GC_ID.logout() (identity.js), כדי
      // שסנכרון שוטף באמצע שיעור לא "יקדם" בטעות את הנעילה בלי שהתלמיד/ה התנתק/ה בפועל.
      unlocked_through: localStorage.getItem('gc_unlocked_through') || '1',
    };
    for (let i = 1; i <= 17; i++) payload['ls' + i] = localStorage.getItem('ls' + i) || '0';
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
  // המכשיר הזה "מפגר" אחרי מכשיר אחר של אותו תלמיד/זוג). passport1/achievements
  // מאומצים מהגיליון רק אם המקומי עדיין ריק — כדי לא לדרוס עריכות טריות מהמכשיר הזה.
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
      const localPassport = localStorage.getItem('passport1');
      if ((!localPassport || localPassport === '{}') && row.passport1 && row.passport1 !== '{}') {
        localStorage.setItem('passport1', row.passport1);
      }
      const localAch = localStorage.getItem('gc_achievements');
      if ((!localAch || localAch === '{}') && row.achievements && row.achievements !== '{}') {
        localStorage.setItem('gc_achievements', row.achievements);
      }
      return resp;
    }).catch((err) => ({ ok: false, error: String(err) }));
  };

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
  if (window.GC_ID && GC_ID.getIdentity()) { GC_SYNC.pullMine(); }

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

  GC_SYNC.deleteGalleryItem = function (id) {
    const c = cfg();
    if (!c.enabled || !c.url) return Promise.resolve({ ok: false, skipped: true });
    return fetch(c.url, { method: 'POST', body: JSON.stringify({ token: c.token, type: 'gallery_delete', id: id }) })
      .then((r) => r.json())
      .catch((err) => ({ ok: false, error: String(err) }));
  };
})();
