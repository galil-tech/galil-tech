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
})();
