// תצורת חיבור ל-Google Sheets (שלב 9ד, MASTER-WORKFLOW.md)
// כברירת מחדל enabled=false — שום דבר לא נשלח החוצה עד שממלאים url+token אחרי פריסת
// data/apps-script/Code.gs כ-Web App (ראה הוראות בראש אותו קובץ).
window.SHEETS_CONFIG = {
  enabled: false,
  url: '',   // ה-Web app URL שמתקבל מ-Deploy → New deployment
  token: '', // אותה מחרוזת בדיוק כמו SHARED_SECRET בתוך Code.gs
};
