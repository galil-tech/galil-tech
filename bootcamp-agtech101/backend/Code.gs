// Code.gs — גדלים למחר · אגטק 101 בוטקאמפ · קיר סיעור מוחות + משוב + לומדת שיבוץ-מחדש
//
// פריסה (חד-פעמי, כ-5 דקות):
// 1. צרו Google Sheet חדש (sheets.new)
// 2. תפריט: הרחבות ← Apps Script
// 3. מחקו את הקוד הריק שם, הדביקו את כל הקובץ הזה
// 4. Deploy ← New deployment ← בחרו סוג "Web app"
//    Execute as: Me
//    Who has access: Anyone
//    ולחצו Deploy (יבקש הרשאות בפעם הראשונה — אשרו)
// 5. העתיקו את ה-URL שמתקבל (מסתיים ב-/exec)
// 6. הדביקו אותו כערך BOOTCAMP_API_URL בקובץ config.js שבתיקיית הלומדה
//
// טאבים ייווצרו אוטומטית בגיליון בשימוש ראשון:
//   Ideas      — קיר סיעור מוחות (agtech101.html)
//   Feedback   — משוב (agtech101.html)
//   Pairing    — שיבוץ 5 הזוגות ללומדת shuffle-lomda.html (מוזן ע"י המורה מראש, נדרס בכל שמירה)
//   EventLog   — יומן כל תשובה של כל תלמיד בלומדת shuffle-lomda.html

const IDEAS_SHEET    = 'Ideas';
const FEEDBACK_SHEET = 'Feedback';
const PAIRING_SHEET  = 'Pairing';
const EVENTLOG_SHEET = 'EventLog';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.type === 'idea') {
      const sh = getSheet_(IDEAS_SHEET, ['זמן', 'קבוצה/זוג', 'שלב', 'רעיון']);
      sh.appendRow([new Date(), data.pairName || '', data.step || '', data.idea || '']);

    } else if (data.type === 'feedback') {
      const sh = getSheet_(FEEDBACK_SHEET, ['זמן', 'קבוצה/זוג', 'דירוג הרצאה', 'דירוג לומדה', 'הכי מעניין', 'הכי פחות ברור']);
      sh.appendRow([new Date(), data.pairName || '', data.lectureStars || '', data.lomdaStars || '', data.best || '', data.unclear || '']);

    } else if (data.type === 'pairing') {
      // המורה שומר מחדש את 5 הזוגות — דורס את כל הרשומות הקודמות (זה תמיד השיבוץ "הנוכחי" היחיד)
      const sh = getSheet_(PAIRING_SHEET, ['זמן', 'תלמיד 1', 'תלמיד 2']);
      const lastRow = sh.getLastRow();
      if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, 3).clearContent();
      const pairs = Array.isArray(data.pairs) ? data.pairs : [];
      const now = new Date();
      pairs.forEach(p => {
        if (p && p.a && p.b) sh.appendRow([now, p.a, p.b]);
      });

    } else if (data.type === 'log') {
      // אירוע יחיד מלומדת השיבוץ — שורה אחת ליומן, לא נדרס אף פעם
      const sh = getSheet_(EVENTLOG_SHEET, ['זמן', 'שם תלמיד', 'קבוצה מקורית', 'שלב', 'סוג שדה', 'תוכן התשובה', 'שותף']);
      sh.appendRow([new Date(), data.student || '', data.group || '', data.step || '', data.field || '', data.content || '', data.partner || '']);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || 'ideas';

    if (action === 'pairing') {
      const sh = getSheet_(PAIRING_SHEET, ['זמן', 'תלמיד 1', 'תלמיד 2']);
      const rows = sh.getDataRange().getValues();
      rows.shift();
      const pairs = rows
        .filter(r => r[1] && r[2])
        .map(r => ({ a: String(r[1]), b: String(r[2]) }));
      return ContentService.createTextOutput(JSON.stringify({ ok: true, pairs })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getAnswer') {
      const student = (e.parameter.student || '').trim();
      const field = (e.parameter.field || '').trim();
      const sh = getSheet_(EVENTLOG_SHEET, ['זמן', 'שם תלמיד', 'קבוצה מקורית', 'שלב', 'סוג שדה', 'תוכן התשובה', 'שותף']);
      const rows = sh.getDataRange().getValues();
      rows.shift();
      let content = null;
      // עוברים מהסוף להתחלה כדי למצוא את הרישום העדכני ביותר התואם
      for (let i = rows.length - 1; i >= 0; i--) {
        if (String(rows[i][1]) === student && String(rows[i][4]) === field) {
          content = String(rows[i][5]);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true, content })).setMimeType(ContentService.MimeType.JSON);
    }

    // ברירת מחדל (כולל action=ideas) — התנהגות קיימת, קיר הרעיונות
    const sh = getSheet_(IDEAS_SHEET, ['זמן', 'קבוצה/זוג', 'שלב', 'רעיון']);
    const rows = sh.getDataRange().getValues();
    rows.shift(); // header row
    const ideas = rows
      .filter(r => r[3])
      .slice(-150) // latest 150 ideas
      .reverse()
      .map(r => ({ time: r[0], pairName: r[1], step: r[2], idea: r[3] }));
    return ContentService.createTextOutput(JSON.stringify({ ok: true, ideas })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}
