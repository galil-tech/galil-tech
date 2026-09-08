// data/roster.js — רשימת בתי הספר/הכיתות/המדריכים הפעילים בפועל בשטח.
// זהו המקור היחיד לרשימה הזו — אל תשכפלו אותה בקבצים אחרים. כדי להוסיף בית ספר/כיתה
// חדשים (או להחליף סיסמה), עורכים רק את הקובץ הזה.
window.GC_ROSTER = (function () {
  const COORDINATOR_PASSWORD = 'galil2026';

  const schools = [
    {
      id: 'manor-eilon',
      name: 'חט"ב מנור איילון',
      teacher: { name: 'אושר', password: 'osher2026' },
      // שכבות ח, ט — אין עדיין פירוט לכיתות ספציפיות (ח1/ח2 וכו'); לעדכן כאן כשיתקבל.
      classes: [
        { id: 'ח', name: 'ח' },
        { id: 'ט', name: 'ט' },
      ],
    },
    {
      id: 'galil-maaravi',
      name: 'חט"ב גליל מערבי',
      teacher: { name: 'מעין', password: 'maayan2026' },
      // שכבות ז, ח — אין עדיין פירוט לכיתות ספציפיות (ז1/ז2 וכו'); לעדכן כאן כשיתקבל.
      classes: [
        { id: 'ז', name: 'ז' },
        { id: 'ח', name: 'ח' },
      ],
    },
  ];

  function schoolById(id) {
    return schools.find(function (s) { return s.id === id; }) || null;
  }

  // שם תצוגה לפי מזהה בית ספר; אם לא נמצא — מחזיר את המזהה עצמו כברירת מחדל.
  function schoolName(id) {
    const s = schoolById(id);
    return s ? s.name : id;
  }

  // מאתר מדריך/ה או רכז/ת מגמה לפי סיסמה. מחזיר null אם הסיסמה לא תואמת אף אחד.
  // תוצאה: { role, label, classes:[{schoolId,schoolName,classId,className}] }
  function findTeacher(password) {
    if (!password) return null;
    for (let i = 0; i < schools.length; i++) {
      const s = schools[i];
      if (s.teacher.password === password) {
        return {
          role: 'teacher',
          label: s.teacher.name + ' · ' + s.name,
          classes: s.classes.map(function (c) {
            return { schoolId: s.id, schoolName: s.name, classId: c.id, className: c.name };
          }),
        };
      }
    }
    if (password === COORDINATOR_PASSWORD) {
      const classes = [];
      schools.forEach(function (s) {
        s.classes.forEach(function (c) {
          classes.push({ schoolId: s.id, schoolName: s.name, classId: c.id, className: c.name });
        });
      });
      return { role: 'coordinator', label: 'רכז/ת מגמה', classes: classes };
    }
    return null;
  }

  return { schools: schools, schoolById: schoolById, schoolName: schoolName, findTeacher: findTeacher };
})();
