# מעבר לאימות מדריכים בשרת (חוק יסוד 4)

**מטרה:** סיסמאות המדריכים יוצאות מהקוד הציבורי (`data/roster.js`) לגיליון `teacher_auth` בשרת,
כ-hash. כל פעולת מורה נבדקת בשרת, כולל שהכיתה שייכת למדריך/ה. **בלי לשבור מורים שמלמדים עכשיו.**

## איך זה עובד
- כניסה = `POST type=login` עם סיסמה. השרת מחזיר token חתום (HMAC): 12 שעות, או 14 יום עם "זכור במחשב הזה".
- הלקוח שומר את ה-token ב-`gc_teacher_session` ולא את הסיסמה.
- פעולות מורה (`class_progress`, `teacher_overview`, `class_unlock`, `student_unlock`, `rename_student`,
  `set_group_name`, `class_meta`) שולחות `teacher_token`. השרת בודק תוקף ובעלות על הכיתה.
- `admin_students` (dump מלא) ו-`gallery_delete` מותרים לרכז/ת בלבד (`role=coordinator`).
- כל מה שתלמידים עושים (pullMine, שמירת התקדמות, גלריה, קבוצות) **לא השתנה**.

### גיליון `teacher_auth`
| עמודה | משמעות |
|-------|---------|
| `teacher_id` | מזהה קצר באנגלית (osher, maayan...) |
| `name` | שם לתצוגה |
| `role` | `teacher` · `coordinator` (רואה הכול) · `general` (הסיסמה הכללית: רק פתיחת שיעור ממחשב של תלמיד/ה) |
| `classes_json` | `[{"school":"<school_id כמו בגיליון>","class":"*"}]` (או class ספציפי). לרכז/ת: `"*"` |
| `active` | `1` פעיל · `0` מבוטל (מבטל מיד גם כניסות קיימות) |
| `salt`, `pw_hash` | נכתבים אוטומטית. לא לערוך ידנית |
| `new_password` | **כאן מקלידים סיסמה חדשה**, ואז תפריט 🔐 גדלים למחר → "החלת סיסמאות חדשות". הסיסמה מוצפנת ונמחקת מהתא |
| `last_login` | כניסה אחרונה (לבדיקה) |

הכניסה היא בסיסמה בלבד, בלי שם משתמש. לכן סיסמאות חייבות להיות ייחודיות (ההחלה מסרבת לכפילות) ובאורך 6 תווים לפחות.
החלפת סיסמה מבטלת מיד את הכניסות הקיימות של אותה שורה.

### Script Properties (Project Settings → Script Properties)
| מפתח | ערך |
|------|-----|
| `SHARED_SECRET` | ה-token של האתר, **זהה** ל-`token` ב-`data/sheets-config.js` |
| `TOKEN_SECRET` | נוצר אוטומטית ע"י `setupAuth()`. אין לשתף. החלפה = כל המדריכים נכנסים מחדש |
| `LEGACY_TEACHER_AUTH` | `1` = תקופת מעבר (פעולות מורה בלי כניסה עדיין עובדות) · `0` = סגור |

---

## שלבי המעבר

### שלב א: שרת (לא משנה כלום למורים)
1. בגיליון: Extensions → Apps Script → Project Settings → Script Properties → **Add**:
   `SHARED_SECRET` = הערך של `token` מ-`data/sheets-config.js`.
   *(חובה לפני ההדבקה: הקוד החדש קורא את הסוד משם ולא מהקובץ.)*
2. Editor → להחליף את כל `Code.gs` בגרסה מהריפו → Save.
3. לבחור את הפונקציה `setupAuth` מהרשימה → **Run** → לאשר הרשאות.
   הפעולה יוצרת את `TOKEN_SECRET`, קובעת `LEGACY_TEACHER_AUTH=1`, ויוצרת את הגיליון `teacher_auth` עם המדריכים והסיסמאות **הנוכחיות** (מוצפנות).
4. Deploy → Manage deployments → ✏️ → Version: **New version** → Deploy. ה-URL לא משתנה.
5. בדיקה: לפתוח `<URL>?token=<SHARED_SECRET>&type=features`. צריך להופיע `teacher_auth`.

**הלקוח הישן ממשיך לעבוד כרגיל**, כי `LEGACY_TEACHER_AUTH=1`.

### שלב ב: לקוח (push לאתר, רק אחרי שלב א)
- הכניסה ללוח הבקרה נבדקת בשרת, עם אותה סיסמה כמו היום.
- מחשב שבו נשמרה כניסה ישנה ("זכור") מומר אוטומטית ושקט ל-token בטעינה הראשונה. הסיסמה הגלויה נמחקת ממנו.
- אם token פג באמצע שיעור, קופץ חלון סיסמה קטן והפעולה ממשיכה. הדף לא נטען מחדש.
- הסיסמה הכללית עדיין פותחת שיעור ממחשב של תלמיד/ה ונכנסת ל-`teacher-class.html`.

### שלב ג: מעקב (שבוע עד שבועיים)
- בגיליון `teacher_auth`, עמודת `last_login`: לוודא שכל המדריכים נכנסו לפחות פעם אחת בגרסה החדשה.

### שלב ד: סגירה (בסוף שבוע, עם הודעה מראש למדריכים)
1. **סיסמאות חדשות לכולם**: הסיסמאות הישנות גלויות בהיסטוריית ה-git הציבורית. מקלידים בעמודת `new_password` → תפריט → "החלת סיסמאות חדשות".
2. שורת `general` → `active=0`. הסיסמה הכללית מפסיקה לעבוד.
3. שורת `admin` → `active=0` (הרכז/ת נכנס/ת עם שורת `coordinator`), או סיסמה חדשה.
4. Script Properties → `LEGACY_TEACHER_AUTH` = `0`.
5. מומלץ: להחליף את `SHARED_SECRET` (וגם ב-`data/sheets-config.js`, באותו זמן).
6. בקוד (commit נפרד): למחוק את רשימת ה-seed מ-`setupAuth()` ב-Code.gs, ואת `TEACHER_UNLOCK_PASSWORD` מ-`assets/sheets-sync.js` ומ-`teacher-class.html`.

### חזרה אחורה (אם משהו נשבר)
- Script Properties → `LEGACY_TEACHER_AUTH=1`. פעולות מורה בלי token חוזרות לעבוד מיד, בלי פריסה מחדש.
- לקוח: `git revert` לקומיט של שלב ב + push. השרת החדש תומך גם בלקוח הישן.

## מדריך/ה חדש/ה
שורה חדשה ב-`teacher_auth`: `teacher_id`, `name`, `role=teacher`, `classes_json`, `active=1`, ו-`new_password`. אחר כך תפריט → "החלת סיסמאות חדשות".
בית ספר או כיתה חדשים נכנסים גם ל-`data/roster.js` (`schools`), שם הם מקבלים שם תצוגה ומסלול.

## מה עוד לא מוגן (ידוע)
- `teacher` / `teacher_notes` (הערות מורה ב-`teacher-class.html`) מוגנים בקוד מורה+כיתה בלבד, כמו קודם.
- נתוני תלמיד/ה בודד/ת (pullMine) מוגנים בקוד התלמיד/ה, כמו קודם.
