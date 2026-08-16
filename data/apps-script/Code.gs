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

  let rows = _rowsAsObjects(_sheet());
  if (p.school) rows = rows.filter((r) => String(r.school_id) === p.school);
  if (p.class) rows = rows.filter((r) => String(r.class_id) === p.class);
  if (p.track) rows = rows.filter((r) => String(r.track) === p.track);
  if (p.code) rows = rows.filter((r) => String(r.code) === p.code);
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

    _upsert(_sheet(), FIELDS, KEY_FIELDS, body, (headers) => headers.map((h) => {
      if (h === 'last_updated') return new Date().toISOString();
      return body[h] !== undefined ? body[h] : '';
    }));
    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
