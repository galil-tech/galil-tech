/*
  גדלים למחר — Apps Script Backend (שלב 9ד, MASTER-WORKFLOW.md)
  מקבל POST מהאתר (assets/sheets-sync.js) ושומר/מעדכן שורה בגיליון "students",
  לפי הסכמה שאושרה בעצירה 9ב (docs/data-schema.md).

  הוראות פריסה (חד-פעמי, ע"י בעל/ת חשבון Google — לא ניתן לביצוע מ-Claude Code):
  1. sheets.google.com → גיליון חדש וריק.
  2. תפריט Extensions → Apps Script.
  3. מחקו את התוכן שכבר שם, הדביקו את כל הקובץ הזה במקומו.
  4. שנו את SHARED_SECRET למחרוזת פרטית משלכם (למטה).
  5. Deploy → New deployment → Type: "Web app".
     Execute as: Me. Who has access: Anyone.
  6. לחצו Deploy, אשרו הרשאות לחשבון ה-Google שלכם.
  7. העתיקו את ה-Web app URL שמתקבל בסוף.
  8. שלחו את ה-URL + את המחרוזת שבחרתם ל-SHARED_SECRET — הם יוכנסו ל-data/sheets-config.js באתר.

  אם צריך לעדכן את הקוד בעתיד: ערכו כאן ב-Apps Script, ואז Deploy → Manage deployments →
  ערכו את הפריסה הקיימת ל-"New version" (לא ליצור פריסה חדשה — זה ישנה את ה-URL).

  אימות מדריכים בשרת (חוק יסוד 4) - הוראות מעבר מלאות: docs/teacher-auth-migration.md.
  הסודות נשמרים ב-Project Settings → Script Properties, לא בקובץ הזה (הוא בריפו ציבורי):
    SHARED_SECRET        - ה-token של האתר (זהה ל-data/sheets-config.js)
    TOKEN_SECRET         - נוצר אוטומטית ע"י setupAuth()
    LEGACY_TEACHER_AUTH  - '1' = פעולות מורה בלי כניסה עדיין עובדות (תקופת מעבר) | '0' = סגור
*/

const SHARED_SECRET = 'CHANGE_ME_2026'; // ברירת מחדל בלבד - הערך האמיתי ב-Script Properties
const SHEET_NAME = 'students';
const FIELDS = [
  'track', 'school_id', 'class_id', 'group_name', 'student_name', 'code',
  'ls1', 'ls2', 'ls3', 'ls4', 'ls5', 'ls6', 'ls7', 'ls8', 'ls9', 'ls10',
  'ls11', 'ls12', 'ls13', 'ls14', 'ls15', 'ls16', 'ls17',
  'leaves_spent', 'passport1', 'achievements', 'unlocked_through', 'last_updated',
  'name_by_teacher',
  // מתי מכשיר התלמיד/ה עצמו/ה סנכרן לאחרונה. last_updated משתנה גם בפעולות מדריך/ה (פתיחה,
  // שינוי שם) - לכן "פעיל/ה היום" בדשבורד נקבע לפי last_seen בלבד.
  'last_seen',
];
const KEY_FIELDS = ['track', 'school_id', 'class_id', 'code']; // מזהה ייחודי לשורה (upsert)

// לוח מנהיגות בין-קבוצתי (שלב 9ה) — גיליון נפרד, כי זו רשומה לפי קבוצת-פרויקט ולא לפי תלמיד.
const GROUPS_SHEET_NAME = 'groups';
const GROUPS_FIELDS = ['school_id', 'class_id', 'group_name', 'leaves', 'last_updated'];
const GROUPS_KEY_FIELDS = ['school_id', 'class_id', 'group_name'];

// גלריית אבטיפוסים בין-בית-ספרית (שלב 9ו) — קישור לתמונה חיצונית בלבד (Drive/Photos), לא קובץ
// מאוחסן באתר עצמו (GitHub Pages סטטי, אין אחסון תמונות אמיתי).
const GALLERY_SHEET_NAME = 'gallery';
const GALLERY_FIELDS = ['id', 'school_id', 'class_id', 'group_name', 'title', 'image_url', 'description', 'votes', 'submitted_at'];

// מורה+כיתה (בקשת המשתמש, אחרי שלב 10) — קוד נפרד לכל צירוף מורה+כיתה (מורה שמלמד/ת
// כמה כיתות מקבל/ת כמה קודים, אחד לכל כיתה) - כדי לצפות בהערות האישיות שלו/ה לשיעור
// ובקצב ההתקדמות של הכיתה הספציפית הזו. notes_json = בלוק JSON אחד {"1":"...", "5":"..."}
// (כמו passport1 אצל תלמידים) - לא 17 עמודות נפרדות.
const TEACHERS_SHEET_NAME = 'teachers';
const TEACHERS_FIELDS = ['school_id', 'class_id', 'teacher_name', 'code', 'notes_json', 'last_updated'];
const TEACHERS_KEY_FIELDS = ['school_id', 'class_id', 'code'];

// פתיחת שיעור לכיתה שלמה ע"י המדריך/ה (teacher-dashboard.html) - שורה אחת לכל school+class.
// תלמיד/ה שמצטרף/ת לכיתה אחרי הפתיחה מקבל/ת את הערך הזה ב-pullMine (max עם הערך האישי).
const CLASS_UNLOCKS_SHEET_NAME = 'class_unlocks';
const CLASS_UNLOCKS_FIELDS = ['school_id', 'class_id', 'unlocked_through', 'last_updated'];
const CLASS_UNLOCKS_KEY_FIELDS = ['school_id', 'class_id'];

// שם תצוגה לכיתה שהמדריך/ה בחר/ה (ניהול כיתה). class_id עצמו לא משתנה לעולם - הוא חלק
// מהמפתח של שורות התלמידים; display_name רק מחליף את מה שמוצג.
const CLASS_META_SHEET_NAME = 'class_meta';
const CLASS_META_FIELDS = ['school_id', 'class_id', 'display_name', 'last_updated'];
const CLASS_META_KEY_FIELDS = ['school_id', 'class_id'];

// הצד-לקוח בודק את הרשימה הזו (type=features) לפני ששולח פעולת מדריך/ה -
// כדי שפריסה ישנה (שלא מכירה את הסוגים האלה) לא תיפול ל-upsert של תלמיד ותיצור שורת זבל.
const FEATURES = ['class_unlock', 'student_unlock', 'rename_student', 'set_group_name', 'class_meta',
  'teacher_auth', 'teacher_overview', 'last_seen', 'gallery_delete'];

// ── אימות מדריכים (חוק יסוד 4) ─────────────────────────────────────────────
// שורה לכל סיסמה. אין שם משתמש - הכניסה בסיסמה בלבד (כמו קודם), לכן סיסמאות חייבות להיות
// ייחודיות (applyPendingPasswords בודק). role: teacher | coordinator (הכול) | general (סיסמת
// המורה הכללית - רק פתיחת שיעור ממחשב של תלמיד/ה). classes_json: [{"school":"<school_id>",
// "class":"<class_id>" או "*"}]. new_password = עמודת הקלדה לרכז/ת; מוצפנת ונמחקת ב-applyPendingPasswords.
const AUTH_SHEET_NAME = 'teacher_auth';
const AUTH_FIELDS = ['teacher_id', 'name', 'role', 'classes_json', 'active', 'salt', 'pw_hash', 'new_password', 'last_login'];
const TOKEN_TTL_MS = 12 * 3600 * 1000;               // כניסה רגילה
const TOKEN_TTL_REMEMBER_MS = 14 * 24 * 3600 * 1000; // "זכור במחשב הזה"
const HASH_ROUNDS = 100;

function _props() { return PropertiesService.getScriptProperties(); }
function _sharedSecret() { return _props().getProperty('SHARED_SECRET') || SHARED_SECRET; }
// ברירת מחדל = פתוח (תקופת מעבר). נסגר רק כשהרכז/ת מגדיר/ה במפורש '0'.
function _legacyOn() { return _props().getProperty('LEGACY_TEACHER_AUTH') !== '0'; }
function _authSheet() { return _getSheet(AUTH_SHEET_NAME, AUTH_FIELDS); }
function _isActive(r) { return !/^(0|false|no|לא)$/i.test(String(r.active).trim()); }

function _hash(salt, pw) {
  let h = salt + '|' + pw;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}

function _tokenSecret(create) {
  let s = _props().getProperty('TOKEN_SECRET');
  if (!s && create) {
    s = Utilities.getUuid() + Utilities.getUuid();
    _props().setProperty('TOKEN_SECRET', s);
  }
  return s;
}
function _sign(payload, secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret)).replace(/=+$/, '');
}

function _publicTeacher(r) {
  let classes = [];
  try { classes = JSON.parse(r.classes_json || '[]'); } catch (e) {}
  if (!Array.isArray(classes) && classes !== '*') classes = []; // "*" = כל הכיתות (רכז/ת)
  return { id: String(r.teacher_id), name: String(r.name || ''), role: String(r.role || 'teacher'), classes: classes };
}

// token = teacher_id.exp.hv.sig (hv = תחילת ה-hash של הסיסמה - החלפת סיסמה מבטלת כניסות קודמות)
function _makeToken(r, ttl) {
  const exp = Date.now() + ttl;
  const payload = [r.teacher_id, exp, String(r.pw_hash).slice(0, 10)].join('.');
  return { token: payload + '.' + _sign(payload, _tokenSecret(true)), exp: exp };
}

function _teacherFromToken(token) {
  if (!token) return { error: 'auth_required' };
  const parts = String(token).split('.');
  if (parts.length !== 4) return { error: 'auth_invalid' };
  const secret = _tokenSecret(false);
  if (!secret || _sign(parts.slice(0, 3).join('.'), secret) !== parts[3]) return { error: 'auth_invalid' };
  if (Number(parts[1]) < Date.now()) return { error: 'auth_expired' };
  const row = _rowsAsObjects(_authSheet()).find((r) => String(r.teacher_id) === parts[0]);
  // שורה שבוטלה או סיסמה שהוחלפה = כאילו פג תוקף (הלקוח מבקש כניסה מחדש)
  if (!row || !_isActive(row) || String(row.pw_hash).slice(0, 10) !== parts[2]) return { error: 'auth_expired' };
  return { teacher: _publicTeacher(row) };
}

function _canAccess(t, school, classId) {
  if (t.role === 'coordinator') return true;
  if (t.role !== 'teacher') return false;
  return Array.isArray(t.classes) && t.classes.some((c) => String(c.school) === String(school) &&
    (String(c.class) === '*' || String(c.class) === String(classId)));
}

// בדיקת הרשאה לפעולת מדריך/ה. מחזיר null = מותר, אחרת אובייקט שגיאה להחזרה ללקוח.
// בלי teacher_token: מותר רק בתקופת המעבר (LEGACY_TEACHER_AUTH != '0') - כך לקוח ישן לא נשבר.
// opts: coordinatorOnly | allowGeneral (סיסמה כללית מותרת, בכל כיתה).
function _guard(req, school, classId, opts) {
  opts = opts || {};
  if (!req.teacher_token) return _legacyOn() ? null : { ok: false, error: 'auth_required' };
  const r = _teacherFromToken(req.teacher_token);
  if (r.error) return { ok: false, error: r.error };
  const t = r.teacher;
  if (opts.coordinatorOnly) return t.role === 'coordinator' ? null : { ok: false, error: 'forbidden' };
  if (t.role === 'general') return opts.allowGeneral ? null : { ok: false, error: 'forbidden' };
  return _canAccess(t, school, classId) ? null : { ok: false, error: 'forbidden' };
}

function _login(body) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('login_fails') || 0);
  if (fails >= 50) return { ok: false, error: 'too_many_attempts' };
  const pw = String(body.password || '');
  const sh = _authSheet();
  const rows = _rowsAsObjects(sh);
  const i = pw ? rows.findIndex((r) => r.pw_hash && _isActive(r) && _hash(String(r.salt), pw) === String(r.pw_hash)) : -1;
  if (i === -1) {
    cache.put('login_fails', String(fails + 1), 600);
    Utilities.sleep(300);
    return { ok: false, error: 'bad_password' };
  }
  const row = rows[i];
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  if (headers.indexOf('last_login') !== -1) sh.getRange(i + 2, headers.indexOf('last_login') + 1).setValue(new Date().toISOString());
  const tk = _makeToken(row, body.remember ? TOKEN_TTL_REMEMBER_MS : TOKEN_TTL_MS);
  return { ok: true, token: tk.token, exp: tk.exp, teacher: _publicTeacher(row) };
}

// ── הפעלה ידנית מעורך ה-Apps Script / מתפריט הגיליון (לא נגיש מהאתר) ─────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🔐 גדלים למחר')
    .addItem('החלת סיסמאות חדשות (עמודת new_password)', 'applyPendingPasswords')
    .addToUi();
}

// מצפין כל סיסמה שהוקלדה בעמודת new_password ומוחק אותה מהגיליון. מסרב לסיסמה קצרה
// מ-6 תווים או כזו שכבר בשימוש אצל שורה אחרת (הכניסה היא בסיסמה בלבד).
function applyPendingPasswords() {
  const sh = _authSheet();
  const data = sh.getDataRange().getValues();
  const h = data[0].map(String);
  const c = (name) => h.indexOf(name);
  const report = [];
  for (let i = 1; i < data.length; i++) {
    const pw = String(data[i][c('new_password')] || '').trim();
    if (!pw) continue;
    const id = data[i][c('teacher_id')];
    if (pw.length < 6) { report.push(id + ': קצרה מדי - לא הוחלה'); continue; }
    const taken = data.some((r, j) => j > 0 && j !== i && r[c('pw_hash')] && _hash(String(r[c('salt')]), pw) === String(r[c('pw_hash')]));
    if (taken) { report.push(id + ': כבר בשימוש אצל שורה אחרת - לא הוחלה'); continue; }
    const salt = Utilities.getUuid();
    const hash = _hash(salt, pw);
    sh.getRange(i + 1, c('salt') + 1).setValue(salt);
    sh.getRange(i + 1, c('pw_hash') + 1).setValue(hash);
    sh.getRange(i + 1, c('new_password') + 1).setValue('');
    data[i][c('salt')] = salt; data[i][c('pw_hash')] = hash;
    report.push(id + ': עודכנה');
  }
  const msg = report.length ? report.join('\n') : 'אין סיסמאות חדשות להחלה.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

// הרצה חד-פעמית (שלב א במעבר): יוצר TOKEN_SECRET, משאיר את תקופת המעבר פתוחה, ומזין את
// המדריכים הקיימים עם הסיסמאות הנוכחיות שלהם (כבר גלויות בהיסטוריית הריפו - מוחלפות בשלב ד,
// ואז הרשימה הזו נמחקת מהקוד). שורה שכבר קיימת לא נדרסת.
function setupAuth() {
  if (!_props().getProperty('SHARED_SECRET')) throw new Error('קודם להגדיר SHARED_SECRET ב-Script Properties (ראו docs/teacher-auth-migration.md)');
  _tokenSecret(true);
  if (_props().getProperty('LEGACY_TEACHER_AUTH') === null) _props().setProperty('LEGACY_TEACHER_AUTH', '1');
  const S = (names) => JSON.stringify(names.map((n) => ({ school: n, class: '*' })));
  const seed = [
    ['osher', 'אושר', 'teacher', S(['חט"ב מנור איילון']), 'osher2026'],
    ['maayan', 'מעין', 'teacher', S(['חט"ב שלומי', 'יסודי שלומי · הרב מימון', 'יסודי שלומי · בן צבי', 'יסודי גוונים']), 'maayan2026'],
    ['shimon', 'שמעון', 'teacher', S(['יסודי נטעים', 'יסודי רגבה', 'חט"ב אופק']), 'shimon2026'],
    ['dvora', 'דבורה', 'teacher', S(['יסודי מעיינות', 'יסודי מעונה']), 'dvora2026'],
    ['coordinator', 'רכז/ת מגמה', 'coordinator', '"*"', 'galil2026'],
    ['admin', 'מנהל/ת (admin-dashboard)', 'coordinator', '"*"', 'galil2026admin'],
    ['general', 'סיסמת מורה כללית', 'general', '[]', 'moradaat2026'],
  ];
  const sh = _authSheet();
  const existing = _rowsAsObjects(sh).map((r) => String(r.teacher_id));
  seed.forEach((s) => {
    if (existing.indexOf(s[0]) !== -1) return;
    const row = AUTH_FIELDS.map((f) => ({ teacher_id: s[0], name: s[1], role: s[2], classes_json: s[3], active: '1', new_password: s[4] }[f] || ''));
    sh.appendRow(row);
  });
  applyPendingPasswords();
}

function _day(v) {
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'Asia/Jerusalem', 'yyyy-MM-dd');
}

// מחזיר גיליון לפי שם, יוצר אותו אם חסר, ומוסיף לשורת הכותרות עמודות שנוספו לקוד אחרי
// שהגיליון נוצר (למשל unlocked_through). בלי זה, גיליון ותיק לא שומר את השדה החדש בכלל,
// ו-_raiseStudentsUnlock נכשל על עמודה -1 - כך פתיחת שיעור לכיתה החזירה שגיאה.
function _getSheet(name, fields) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(fields);
    return sh;
  }
  const lastCol = sh.getLastColumn();
  const headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  const missing = fields.filter((f) => headers.indexOf(f) === -1);
  if (missing.length) sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
  return sh;
}

function _sheet() { return _getSheet(SHEET_NAME, FIELDS); }
function _groupsSheet() { return _getSheet(GROUPS_SHEET_NAME, GROUPS_FIELDS); }
function _gallerySheet() { return _getSheet(GALLERY_SHEET_NAME, GALLERY_FIELDS); }
function _teachersSheet() { return _getSheet(TEACHERS_SHEET_NAME, TEACHERS_FIELDS); }
function _classUnlocksSheet() { return _getSheet(CLASS_UNLOCKS_SHEET_NAME, CLASS_UNLOCKS_FIELDS); }
function _classMetaSheet() { return _getSheet(CLASS_META_SHEET_NAME, CLASS_META_FIELDS); }

// מעדכן שדות בשורות תלמידים לפי school+class+קוד (codes = רשימת קודים). לא נוגע במפתח.
// מחזיר כמה שורות עודכנו.
function _setStudentFields(school, classId, codes, values) {
  const sh = _sheet();
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const col = (h) => headers.indexOf(h);
  const tsCol = col('last_updated');
  const want = codes.map(String);
  let changed = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col('school_id')]) !== String(school) || String(data[i][col('class_id')]) !== String(classId)) continue;
    if (want.indexOf(String(data[i][col('code')])) === -1) continue;
    Object.keys(values).forEach((h) => { if (col(h) !== -1) sh.getRange(i + 1, col(h) + 1).setValue(values[h]); });
    if (tsCol !== -1) sh.getRange(i + 1, tsCol + 1).setValue(new Date().toISOString());
    changed++;
  }
  return changed;
}

// ערך הפתיחה הכיתתי (0 אם המדריך/ה לא פתח/ה כלום לכיתה הזו)
function _classUnlockValue(school, classId) {
  const row = _rowsAsObjects(_classUnlocksSheet()).find((r) =>
    String(r.school_id) === String(school) && String(r.class_id) === String(classId));
  return row ? Number(row.unlocked_through) || 0 : 0;
}

// מעלה unlocked_through לכל שורות התלמידים שמתאימות ל-match(row) ל-max(הקיים, n).
// לעולם לא מוריד. מחזיר כמה שורות עודכנו בפועל.
function _raiseStudentsUnlock(match, n) {
  const sh = _sheet();
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const col = headers.indexOf('unlocked_through');
  if (col === -1) return 0;
  const tsCol = headers.indexOf('last_updated');
  let changed = 0;
  for (let i = 1; i < data.length; i++) {
    const o = {};
    headers.forEach((h, j) => (o[h] = data[i][j]));
    if (!match(o)) continue;
    const current = Number(data[i][col]) || 0;
    if (n > current) {
      sh.getRange(i + 1, col + 1).setValue(n);
      if (tsCol !== -1) sh.getRange(i + 1, tsCol + 1).setValue(new Date().toISOString());
      changed++;
    }
  }
  return changed;
}

// שולף את הגובה הגבוה ביותר (ס"מ) שנמצא בתוך JSON של passport1 - סורק את כל המקומות
// שבהם לומדות שונות שומרות מדידת גובה (lesson4.height, measurements[].height,
// growthData[].height) ומחזיר את המקסימום. מחזיר 0 אם אין שום נתון גובה.
function _maxHeightFromPassport(passportJson) {
  let max = 0;
  try {
    const p = JSON.parse(passportJson || '{}');
    const consider = (v) => { const n = Number(v); if (!isNaN(n) && n > max) max = n; };
    if (p.lesson4) consider(p.lesson4.height);
    if (Array.isArray(p.measurements)) p.measurements.forEach((m) => consider(m && m.height));
    if (Array.isArray(p.growthData)) p.growthData.forEach((m) => consider(m && m.height));
  } catch (e) {}
  return max;
}

function _rowsAsObjects(sh) {
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i]));
    return o;
  });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  // הגנה: קריאה (לא רק כתיבה) דורשת ?token= תואם — בלי זה, כל מי שיש לו את ה-URL
  // (ציבורי מטבעו, כי הצד-לקוח חייב אותו) יכול לקרוא את נתוני כל התלמידים בלי הרשאה.
  if (p.token !== _sharedSecret()) {
    return _json({ ok: false, error: 'unauthorized' });
  }

  if (p.type === 'features') {
    return _json({ ok: true, features: FEATURES });
  }

  if (p.type === 'class_meta') {
    let rows = _rowsAsObjects(_classMetaSheet());
    if (p.school) rows = rows.filter((r) => String(r.school_id) === p.school);
    return _json({ ok: true, rows: rows });
  }

  if (p.type === 'groups') {
    let rows = _rowsAsObjects(_groupsSheet());
    if (p.school) rows = rows.filter((r) => String(r.school_id) === p.school);
    if (p.class) rows = rows.filter((r) => String(r.class_id) === p.class);
    return _json({ ok: true, rows: rows });
  }

  // כל תלמידי כיתה אחת - למדריך/ה של הכיתה בלבד (teacher_token, _guard). בתקופת המעבר גם
  // בלי token (לקוח ישן). מחזיר גם את הפתיחה הכיתתית ושם התצוגה - הדשבורד לא צריך dump מלא.
  if (p.type === 'class_progress') {
    if (!p.school || !p.class) return _json({ ok: false, error: 'school and class parameters required' });
    const denied = _guard(p, p.school, p.class);
    if (denied) return _json(denied);
    const cls = _classUnlockValue(p.school, p.class);
    const rows = _rowsAsObjects(_sheet()).filter((r) =>
      String(r.school_id) === p.school && String(r.class_id) === p.class)
      .map((r) => (cls > (Number(r.unlocked_through) || 0) ? Object.assign({}, r, { unlocked_through: cls }) : r));
    const meta = _rowsAsObjects(_classMetaSheet()).find((r) =>
      String(r.school_id) === p.school && String(r.class_id) === p.class);
    return _json({ ok: true, rows: rows, class_unlocked_through: cls, display_name: (meta && meta.display_name) || '' });
  }

  // מסך הכרטיסים בדשבורד: סיכום לכל כיתה בקריאה אחת. דורש כניסה (endpoint חדש - אין לקוח
  // ישן שתלוי בו). classes = JSON [{school, class}] מהלקוח; השרת מסנן למה שמותר למדריך/ה.
  if (p.type === 'teacher_overview') {
    const r = _teacherFromToken(p.teacher_token);
    if (r.error) return _json({ ok: false, error: r.error });
    if (r.teacher.role === 'general') return _json({ ok: false, error: 'forbidden' });
    let want = [];
    try { want = JSON.parse(p.classes || '[]'); } catch (e) {}
    want = (Array.isArray(want) ? want : []).filter((c) => c && _canAccess(r.teacher, c.school, c.class));
    const students = _rowsAsObjects(_sheet());
    const unlocks = _rowsAsObjects(_classUnlocksSheet());
    const metas = _rowsAsObjects(_classMetaSheet());
    const today = _day(new Date());
    const same = (c) => (x) => String(x.school_id) === String(c.school) && String(x.class_id) === String(c.class);
    const out = want.map((c) => {
      const rows = students.filter(same(c));
      const cu = unlocks.find(same(c));
      const meta = metas.find(same(c));
      const n = cu ? Number(cu.unlocked_through) || 0 : 0;
      const lessonsWithLeaves = (s) => { let k = 0; for (let i = 1; i <= 17; i++) if (Number(s['ls' + i]) > 0) k++; return k; };
      return {
        school: c.school, class: c.class, display_name: (meta && meta.display_name) || '',
        students: rows.length,
        class_unlocked_through: n,
        active_today: rows.filter((s) => s.last_seen && _day(s.last_seen) === today).length,
        // כמה תלמידים כבר אספו עלים בשיעור הפתוח האחרון (lsN > 0 = התחיל/ה, לא בהכרח סיים/ה)
        earned_current: n ? rows.filter((s) => Number(s['ls' + n]) > 0).length : 0,
        avg_lessons: rows.length ? Math.round(rows.reduce((a, s) => a + lessonsWithLeaves(s), 0) / rows.length * 10) / 10 : 0,
      };
    });
    return _json({ ok: true, classes: out });
  }

  // הערות המורה לשיעורים, לצירוף מורה+כיתה ספציפי - דורש code (כמו pullMine של תלמיד/ה),
  // כדי שלא כל מי שמנחש school+class יראה את ההערות האישיות של מורה אחר/ת באותה כיתה.
  if (p.type === 'teacher_notes') {
    if (!p.code) return _json({ ok: false, error: 'code parameter required' });
    let rows = _rowsAsObjects(_teachersSheet()).filter((r) => String(r.code) === p.code);
    if (p.school) rows = rows.filter((r) => String(r.school_id) === p.school);
    if (p.class) rows = rows.filter((r) => String(r.class_id) === p.class);
    return _json({ ok: true, rows: rows });
  }

  // לוח "מי הצמיח הכי גבוה" בין-בית-ספרי (שלב 9ו) - מטבעו גלוי לכולם (כל בתי הספר),
  // ולכן מחזיר רק שדות מצומצמים (לא code, לא passport1 מלא, לא הישגים) - לא dump מלא.
  if (p.type === 'heights') {
    const rows = _rowsAsObjects(_sheet())
      .map((r) => ({
        track: r.track, school_id: r.school_id, class_id: r.class_id,
        name: r.student_name, height: _maxHeightFromPassport(r.passport1),
      }))
      .filter((r) => r.height > 0)
      .sort((a, b) => b.height - a.height)
      .slice(0, 50);
    return _json({ ok: true, rows: rows });
  }

  // גלריית אבטיפוסים (שלב 9ו) - גלויה לכולם, בלי הגנת code (אין בה מידע אישי רגיש).
  if (p.type === 'gallery') {
    const rows = _rowsAsObjects(_gallerySheet()).sort((a, b) => Number(b.votes) - Number(a.votes));
    return _json({ ok: true, rows: rows });
  }

  // dump מלא של כל התלמידים בכל בתי הספר/המסלולים - לרכז/ת המגמה בלבד (teacher_token עם
  // role=coordinator). בתקופת המעבר גם בלי token, כדי ש-admin-dashboard ישן לא יישבר.
  if (p.type === 'admin_students') {
    const denied = _guard(p, '', '', { coordinatorOnly: true });
    if (denied) return _json(denied);
    return _json({ ok: true, rows: _rowsAsObjects(_sheet()), groups: _rowsAsObjects(_groupsSheet()), teachers: _rowsAsObjects(_teachersSheet()), class_unlocks: _rowsAsObjects(_classUnlocksSheet()), class_meta: _rowsAsObjects(_classMetaSheet()) });
  }

  // הגנת פרטיות: קריאת שורות תלמידים (לא לוח קבוצות) דורשת code ספציפי - בלעדיו זו
  // הייתה מחזירה dump מלא של כל תלמידי כל בתי הספר (שמות, דרכונים, הישגים) לכל מי
  // שקורא את ה-URL הציבורי. pullMine() בצד הלקוח כבר תמיד שולח code, אז זה לא שובר כלום.
  if (!p.code) {
    return _json({ ok: false, error: 'code parameter required' });
  }
  let rows = _rowsAsObjects(_sheet());
  rows = rows.filter((r) => String(r.code) === p.code);
  if (p.school) rows = rows.filter((r) => String(r.school_id) === p.school);
  if (p.class) rows = rows.filter((r) => String(r.class_id) === p.class);
  if (p.track) rows = rows.filter((r) => String(r.track) === p.track);
  // פתיחה כיתתית ע"י המדריך/ה: התלמיד/ה מקבל/ת max(הערך האישי, הערך של הכיתה)
  rows = rows.map((r) => {
    const cls = _classUnlockValue(r.school_id, r.class_id);
    const own = Number(r.unlocked_through) || 0;
    return cls > own ? Object.assign({}, r, { unlocked_through: cls }) : r;
  });
  return _json({ ok: true, rows: rows });
}

function _upsert(sh, fields, keyFields, body, buildRow) {
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const keyIdx = keyFields.map((k) => headers.indexOf(k));

  let sheetRow = -1; // 1-based שורת גיליון, לא אינדקס מערך
  let existing = null;
  for (let i = 1; i < data.length; i++) {
    const match = keyIdx.every((colIdx, j) => String(data[i][colIdx]) === String(body[keyFields[j]] || ''));
    if (match) { sheetRow = i + 1; existing = data[i]; break; }
  }

  const rowValues = buildRow(headers, existing);
  if (sheetRow === -1) {
    sh.appendRow(rowValues);
  } else {
    sh.getRange(sheetRow, 1, 1, headers.length).setValues([rowValues]);
  }
  return rowValues;
}

function doPost(e) {
  // נעילה: שני doPost שמגיעים כמעט בו-זמנית (למשל שני תלמידים באותה קבוצה לוחצים "הוסף"
  // יחד) יכולים לקרוא את הגיליון לפני ששניהם כתבו - בלי נעילה זה יוצר שתי שורות נפרדות
  // באותו מפתח במקום שורה אחת מעודכנת (נצפה בפועל בבדיקה, שלב 9ה). הנעילה מבטיחה שרק
  // doPost אחד בכל רגע נתון קורא+כותב לגיליון.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== _sharedSecret()) {
      return _json({ ok: false, error: 'bad token' });
    }

    // כניסת מדריך/ה: סיסמה → token זמני (POST בלבד, כדי שהסיסמה לא תופיע ב-URL)
    if (body.type === 'login') return _json(_login(body));

    if (body.type === 'gallery_submit') {
      const sh = _gallerySheet();
      const id = 'g' + Date.now() + Math.floor(Math.random() * 1000);
      sh.appendRow([
        id, body.school_id || '', body.class_id || '', body.group_name || '',
        body.title || '', body.image_url || '', body.description || '', 0,
        new Date().toISOString(),
      ]);
      return _json({ ok: true, id: id });
    }

    if (body.type === 'gallery_vote') {
      const sh = _gallerySheet();
      const data = sh.getDataRange().getValues();
      const idCol = GALLERY_FIELDS.indexOf('id');
      const votesCol = GALLERY_FIELDS.indexOf('votes');
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idCol]) === String(body.id)) {
          const newVotes = (Number(data[i][votesCol]) || 0) + 1;
          sh.getRange(i + 1, votesCol + 1).setValue(newVotes);
          return _json({ ok: true, votes: newVotes });
        }
      }
      return _json({ ok: false, error: 'gallery id not found' });
    }

    // מחיקת פריט גלריה - למנהל/ת המגמה בלבד (admin-dashboard.html), כדי לאפשר הסרת תוכן
    // בעייתי שהגיע דרך טופס ההגשה הציבורי (endpoint פתוח בריפו ציבורי, ראה הערת doGet).
    if (body.type === 'gallery_delete') {
      const denied = _guard(body, '', '', { coordinatorOnly: true });
      if (denied) return _json(denied);
      const sh = _gallerySheet();
      const data = sh.getDataRange().getValues();
      const idCol = GALLERY_FIELDS.indexOf('id');
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idCol]) === String(body.id)) {
          sh.deleteRow(i + 1);
          return _json({ ok: true });
        }
      }
      return _json({ ok: false, error: 'gallery id not found' });
    }

    // הערות מורה לצירוף מורה+כיתה - upsert, לא דורסים notes_json קיים במשהו ריק/חסר
    // שמגיע ממכשיר שעוד לא הספיק להתעדכן (אותו עיקרון הגנה כמו passport1/achievements).
    if (body.type === 'teacher') {
      _upsert(_teachersSheet(), TEACHERS_FIELDS, TEACHERS_KEY_FIELDS, body, (headers, existing) => headers.map((h, i) => {
        if (h === 'last_updated') return new Date().toISOString();
        if (h === 'notes_json' && existing) {
          const incoming = body[h];
          const current = existing[i];
          if ((incoming === undefined || incoming === '' || incoming === '{}') && current) return current;
        }
        return body[h] !== undefined ? body[h] : '';
      }));
      return _json({ ok: true });
    }

    // מדריך/ה פותח/ת שיעור לכל הכיתה (teacher-dashboard.html): שומר ערך כיתתי (לתלמידים
    // שיצטרפו בהמשך) ומעלה את כל שורות התלמידים הקיימות באותו school+class. לעולם לא מוריד.
    if (body.type === 'class_unlock') {
      const n = Math.min(17, Number(body.unlocked_through) || 0);
      if (!body.school_id || !body.class_id || n < 1) return _json({ ok: false, error: 'school_id, class_id, unlocked_through required' });
      const denied = _guard(body, body.school_id, body.class_id);
      if (denied) return _json(denied);
      const rowValues = _upsert(_classUnlocksSheet(), CLASS_UNLOCKS_FIELDS, CLASS_UNLOCKS_KEY_FIELDS, body, (headers, existing) => headers.map((h, i) => {
        if (h === 'last_updated') return new Date().toISOString();
        if (h === 'unlocked_through') return Math.max(n, existing ? Number(existing[i]) || 0 : 0);
        return body[h] !== undefined ? body[h] : '';
      }));
      const updated = _raiseStudentsUnlock((r) =>
        String(r.school_id) === String(body.school_id) && String(r.class_id) === String(body.class_id), n);
      return _json({ ok: true, unlocked_through: rowValues[CLASS_UNLOCKS_FIELDS.indexOf('unlocked_through')], students_updated: updated });
    }

    // פתיחת שיעור לתלמיד/ה בודד/ת (לפי school+class+code) - אותו עיקרון, רק שורה אחת.
    if (body.type === 'student_unlock') {
      const n = Math.min(17, Number(body.unlocked_through) || 0);
      if (!body.school_id || !body.class_id || !body.code || n < 1) return _json({ ok: false, error: 'school_id, class_id, code, unlocked_through required' });
      // allowGeneral: סיסמת המורה הכללית פותחת ממחשב של תלמיד/ה (עד שהיא מבוטלת בשלב ד)
      const denied = _guard(body, body.school_id, body.class_id, { allowGeneral: true });
      if (denied) return _json(denied);
      const updated = _raiseStudentsUnlock((r) =>
        String(r.school_id) === String(body.school_id) && String(r.class_id) === String(body.class_id) &&
        String(r.code) === String(body.code), n);
      return _json({ ok: true, students_updated: updated });
    }

    // ── ניהול כיתה ע"י המדריך/ה (assets/teacher-panel.js) ──
    // שינוי שם תלמיד/ה: מסמן name_by_teacher כדי שמכשיר התלמיד/ה לא ידרוס את השם בחזרה
    // בסנכרון הבא (upsert רגיל משאיר את השם הקיים כשהדגל דולק; pullMine מאמץ אותו מקומית).
    if (body.type === 'rename_student') {
      const name = String(body.student_name || '').trim();
      if (!body.school_id || !body.class_id || !body.code || !name) return _json({ ok: false, error: 'school_id, class_id, code, student_name required' });
      const denied = _guard(body, body.school_id, body.class_id);
      if (denied) return _json(denied);
      const updated = _setStudentFields(body.school_id, body.class_id, [body.code], { student_name: name, name_by_teacher: '1' });
      return _json(updated ? { ok: true, students_updated: updated } : { ok: false, error: 'student not found' });
    }

    // שיוך לזוג/קבוצה: codes = כל התלמידים שמקבלים את אותו group_name (איחוד), או קוד יחיד
    // עם group_name חדש/ריק (פיצול). תלמידים לא שולחים group_name - רק המדריך/ה קובע/ת.
    if (body.type === 'set_group_name') {
      const codes = Array.isArray(body.codes) ? body.codes : (body.code ? [body.code] : []);
      if (!body.school_id || !body.class_id || !codes.length) return _json({ ok: false, error: 'school_id, class_id, code(s) required' });
      const denied = _guard(body, body.school_id, body.class_id);
      if (denied) return _json(denied);
      const updated = _setStudentFields(body.school_id, body.class_id, codes, { group_name: String(body.group_name || '').trim() });
      return _json(updated ? { ok: true, students_updated: updated } : { ok: false, error: 'student not found' });
    }

    // שם תצוגה לכיתה - שורה אחת ל-school+class בגיליון class_meta
    if (body.type === 'class_meta') {
      if (!body.school_id || !body.class_id) return _json({ ok: false, error: 'school_id, class_id required' });
      const denied = _guard(body, body.school_id, body.class_id);
      if (denied) return _json(denied);
      _upsert(_classMetaSheet(), CLASS_META_FIELDS, CLASS_META_KEY_FIELDS, body, (headers) => headers.map((h) => {
        if (h === 'last_updated') return new Date().toISOString();
        if (h === 'display_name') return String(body.display_name || '').trim();
        return body[h] !== undefined ? body[h] : '';
      }));
      return _json({ ok: true });
    }

    if (body.type === 'group') {
      // addLeaves מתווסף לסכום הקיים של הקבוצה (לא דורס) - תואם את addToGroup() ב-leaves.html
      const add = Number(body.addLeaves) || 0;
      const rowValues = _upsert(_groupsSheet(), GROUPS_FIELDS, GROUPS_KEY_FIELDS, body, (headers, existing) => {
        const currentLeaves = existing ? Number(existing[headers.indexOf('leaves')]) || 0 : 0;
        return headers.map((h) => {
          if (h === 'last_updated') return new Date().toISOString();
          if (h === 'leaves') return currentLeaves + add;
          return body[h] !== undefined ? body[h] : '';
        });
      });
      return _json({ ok: true, leaves: rowValues[GROUPS_FIELDS.indexOf('leaves')] });
    }

    // מיזוג בטוח בצד השרת - לא רק בצד הלקוח (pullMine): אם לתלמיד/זוג שני מכשירים ומכשיר
    // "מפגר" שולח POST אחרי שמכשיר אחר כבר עדכן את השרת לערך גבוה יותר, בלי המיזוג הזה
    // השורה הייתה נדרסת אחורה. נצפה כתרחיש אמיתי בבדיקת הפאנל - לא רק תיאורטי.
    // unlocked_through (השיעור הגבוה ביותר שמותר לתלמיד/ה לפתוח) מתנהג באותו אופן -
    // לעולם לא נסוג אחורה, גם אם מכשיר ישן שולח ערך נמוך יותר בטעות.
    const LS_FIELDS = FIELDS.filter((h) => /^ls\d+$/.test(h)).concat(['leaves_spent', 'unlocked_through']);
    _upsert(_sheet(), FIELDS, KEY_FIELDS, body, (headers, existing) => headers.map((h, i) => {
      if (h === 'last_updated') return new Date().toISOString();
      if (h === 'last_seen') return new Date().toISOString(); // רק כאן - סנכרון ממכשיר התלמיד/ה
      // שדות שרק המדריך/ה משנה (rename_student / set_group_name) - מכשיר התלמיד/ה לא דורס.
      if (existing && h === 'name_by_teacher') return existing[i];
      if (existing && h === 'student_name' && String(existing[headers.indexOf('name_by_teacher')]) === '1') return existing[i];
      if (existing && h === 'group_name' && !body.group_name) return existing[i];
      if (LS_FIELDS.indexOf(h) !== -1) {
        const incoming = Number(body[h]) || 0;
        const current = existing ? Number(existing[i]) || 0 : 0;
        return Math.max(incoming, current);
      }
      if ((h === 'passport1' || h === 'achievements') && existing) {
        const incoming = body[h];
        const current = existing[i];
        // לא דורסים בלוב תוכן קיים במשהו ריק/חסר שמגיע ממכשיר שעוד לא הספיק להתעדכן
        if ((incoming === undefined || incoming === '' || incoming === '{}') && current) return current;
      }
      return body[h] !== undefined ? body[h] : '';
    }));
    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
