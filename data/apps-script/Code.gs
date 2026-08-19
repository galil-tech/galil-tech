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
*/

const SHARED_SECRET = 'CHANGE_ME_2026'; // חובה לשנות לפני הפריסה בפועל
const SHEET_NAME = 'students';
const FIELDS = [
  'track', 'school_id', 'class_id', 'group_name', 'student_name', 'code',
  'ls1', 'ls2', 'ls3', 'ls4', 'ls5', 'ls6', 'ls7', 'ls8', 'ls9', 'ls10',
  'ls11', 'ls12', 'ls13', 'ls14', 'ls15', 'ls16', 'ls17',
  'leaves_spent', 'passport1', 'achievements', 'last_updated',
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

function _sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(FIELDS);
  }
  return sh;
}

function _groupsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(GROUPS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(GROUPS_SHEET_NAME);
    sh.appendRow(GROUPS_FIELDS);
  }
  return sh;
}

function _gallerySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(GALLERY_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(GALLERY_SHEET_NAME);
    sh.appendRow(GALLERY_FIELDS);
  }
  return sh;
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
  if (p.token !== SHARED_SECRET) {
    return _json({ ok: false, error: 'unauthorized' });
  }

  if (p.type === 'groups') {
    let rows = _rowsAsObjects(_groupsSheet());
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

  // dump מלא של כל התלמידים בכל בתי הספר/המסלולים - למנהל/ת המגמה בלבד. עדיין מוגן רק
  // ב-token (כמו כל שאר ה-endpoint-ים, ראה ההערה למעלה) - לא הגנה אמיתית, רק חסם-כניסה
  // מזדמן. הגישה בפועל למסך הזה מוגנת גם בסיסמת מנהל/ת נפרדת בצד הלקוח (admin-dashboard.html).
  if (p.type === 'admin_students') {
    return _json({ ok: true, rows: _rowsAsObjects(_sheet()), groups: _rowsAsObjects(_groupsSheet()) });
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
    if (body.token !== SHARED_SECRET) {
      return _json({ ok: false, error: 'bad token' });
    }

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
    const LS_FIELDS = FIELDS.filter((h) => /^ls\d+$/.test(h)).concat(['leaves_spent']);
    _upsert(_sheet(), FIELDS, KEY_FIELDS, body, (headers, existing) => headers.map((h, i) => {
      if (h === 'last_updated') return new Date().toISOString();
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
