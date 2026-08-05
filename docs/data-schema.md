# סכמת נתונים – localStorage עכשיו, Google Sheets בהמשך

## הבעיה שמסמך זה פותר
שיעורים 5–7 כתובים עם קריאה/כתיבה ישירה ל-`localStorage` בכל מקום בקוד (`localStorage.getItem(...)`, `localStorage.setItem(...)`). כשנחבר Google Sheets, יהיה צריך לשכתב את כל הלוגיקה הזו בכל קובץ בנפרד.

## העיקרון: שכבת הפשטה אחת
כל שיעור חדש (מ-8 ואילך) צריך לקרוא ולכתוב נתונים **רק** דרך שתי פונקציות עטיפה, לא ישירות מול `localStorage`:

```javascript
// בתחילת כל קובץ שיעור - שכבת הפשטה
async function saveData(key, value, shared = false) {
  // שלב א' (עכשיו): localStorage בלבד
  localStorage.setItem(key, JSON.stringify(value));

  // שלב ב' (בעתיד): הוסף כאן שליחה ל-Google Sheets Apps Script
  // fetch(SHEETS_WEBHOOK_URL, { method: 'POST', body: JSON.stringify({key, value, shared}) });
}

async function loadData(key, fallback = null) {
  const local = localStorage.getItem(key);
  if (local) return JSON.parse(local);
  return fallback;

  // שלב ב' (בעתיד): אם shared=true, קודם לנסות לטעון מ-Google Sheets,
  // ולהשתמש ב-localStorage רק כ-cache/fallback
}
```

## כללי מפתחות (keys) - קונבנציה קבועה
| סוג נתון | פורמט מפתח | משותף בין תלמידים? | דוגמה |
|---|---|---|---|
| עלים אישיים לשיעור | `ls{N}` | לא | `ls7` |
| לידרבורד שיעור (כל הכיתה) | `alv{N}` | כן | `alv7` |
| נתוני קיר (תצפיות) | `cls{N}` | כן | `cls7` |
| שם תלמיד | `studentName` | לא | - |
| קוד תלמיד (עתידי) | `studentCode` | לא | 4 ספרות |
| בית ספר + כיתה (עתידי) | `school`, `classId` | לא | מ-URL params |

## מתי עוברים בפועל ל-Google Sheets
כשמגיע הזמן (לא לפני שיש החלטה סופית על המבנה הרב-כיתתי):
1. בונים Google Apps Script אחד שמקבל POST ושומר לגיליון
2. עדכון יחיד בפונקציות `saveData`/`loadData` בקובץ עזר משותף (`data/sheets-config.js`)
3. **קבצי השיעורים עצמם לא משתנים** - הם כבר קוראים דרך השכבה המופשטת

## נקודת בדיקה לפני שמתחילים שיעור 8
לפני שבונים שיעור 8, להחליט: האם להעביר את שיעורים 5–7 הקיימים לשכבת ההפשטה הזו גם כן (לא חובה אם הם כבר נבדקו ועובדים בכיתה), או רק להתחיל מ-8 ואילך ולהשאיר 5–7 כמו שהם עד שתהיה סיבה ממשית לשנות.
