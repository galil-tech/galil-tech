// data/roster.js — רשימת בתי הספר/הכיתות/המדריכים הפעילים בפועל בשטח.
// זהו המקור היחיד לרשימה הזו — אל תשכפלו אותה בקבצים אחרים. כדי להוסיף בית ספר/כיתה/מדריך
// חדשים (או להחליף סיסמה), עורכים רק את הקובץ הזה.
//
// מבנה: schools[] (בית ספר + כיתות) נפרד מ-teachers[] (מדריך/ה + רשימת כיתות מכמה בתי ספר) -
// כי מדריך/ה אחד/ת מלמד/ת לפעמים בכמה בתי ספר.
// חשוב: school.name הוא מה שנשמר בגיליון כ-school_id (ראה identity.js) - לא לשנות שם של בית
// ספר שכבר יש בו תלמידים, אחרת הם יתנתקו מהשורות הקיימות שלהם.
window.GC_ROSTER = (function () {
  const COORDINATOR_PASSWORD = 'galil2026';

  const schools = [
    { id: 'manor-eilon', name: 'חט"ב מנור איילון', track: 'middle',
      classes: [{ id: 'ח', name: 'ח' }, { id: 'ט', name: 'ט' }] },
    { id: 'shlomi-middle', name: 'חט"ב שלומי', track: 'middle',
      classes: [{ id: 'ח', name: 'ח' }, { id: 'ט', name: 'ט' }] },
    { id: 'ofek', name: 'חט"ב אופק', track: 'middle',
      classes: [{ id: 'ח', name: 'ח' }] },
    { id: 'shlomi-maimon', name: 'יסודי שלומי · הרב מימון', track: 'elementary',
      classes: [{ id: 'ד-ו', name: 'ד׳–ו׳' }] },
    { id: 'shlomi-benzvi', name: 'יסודי שלומי · בן צבי', track: 'elementary',
      classes: [{ id: 'ה1', name: 'ה1' }, { id: 'ה2', name: 'ה2' }] },
    { id: 'gvanim', name: 'יסודי גוונים', track: 'elementary',
      classes: [{ id: 'מצוינות', name: 'מצוינות' }] },
    { id: 'netaim', name: 'יסודי נטעים', track: 'elementary',
      classes: [{ id: 'קבוצה 1', name: 'קבוצה 1' }] },
    { id: 'regba', name: 'יסודי רגבה', track: 'elementary',
      classes: [{ id: 'קבוצה 1', name: 'קבוצה 1' }] },
    { id: 'maayanot', name: 'יסודי מעיינות', track: 'elementary',
      classes: [{ id: 'ה1', name: 'ה1' }, { id: 'ה2', name: 'ה2' }, { id: 'ה3', name: 'ה3' }] },
    { id: 'meona', name: 'יסודי מעונה', track: 'elementary',
      classes: [{ id: 'ה1', name: 'ה1' }, { id: 'ה2', name: 'ה2' }, { id: 'ה3', name: 'ה3' }] },
  ];

  // classes: [{schoolId, classId}] - classId חסר = כל הכיתות של בית הספר.
  const teachers = [
    { id: 'osher', name: 'אושר', password: 'osher2026',
      classes: [{ schoolId: 'manor-eilon' }] },
    { id: 'maayan', name: 'מעין', password: 'maayan2026',
      classes: [{ schoolId: 'shlomi-middle' }, { schoolId: 'shlomi-maimon' }, { schoolId: 'shlomi-benzvi' }, { schoolId: 'gvanim' }] },
    { id: 'shimon', name: 'שמעון', password: 'shimon2026',
      classes: [{ schoolId: 'netaim' }, { schoolId: 'regba' }, { schoolId: 'ofek' }] },
    { id: 'dvora', name: 'דבורה', password: 'dvora2026',
      classes: [{ schoolId: 'maayanot' }, { schoolId: 'meona' }] },
  ];

  function schoolById(id) {
    return schools.find(function (s) { return s.id === id; }) || null;
  }
  function schoolByName(name) {
    return schools.find(function (s) { return s.name === name; }) || null;
  }

  // שם תצוגה לפי מזהה בית ספר; אם לא נמצא — מחזיר את המזהה עצמו כברירת מחדל.
  function schoolName(id) {
    const s = schoolById(id);
    return s ? s.name : id;
  }

  function classEntry(s, c) {
    return { schoolId: s.id, schoolName: s.name, track: s.track, classId: c.id, className: c.name };
  }

  // מאתר מדריך/ה או רכז/ת מגמה לפי סיסמה. מחזיר null אם הסיסמה לא תואמת אף אחד.
  // תוצאה: { role, label, classes:[{schoolId,schoolName,track,classId,className}] } -
  // כל הכיתות של אותו/ה מדריך/ה, מכל בתי הספר.
  function findTeacher(password) {
    if (!password) return null;
    const t = teachers.find(function (x) { return x.password === password; });
    if (t) {
      const classes = [];
      t.classes.forEach(function (ref) {
        const s = schoolById(ref.schoolId);
        if (!s) return;
        s.classes.forEach(function (c) {
          if (!ref.classId || ref.classId === c.id) classes.push(classEntry(s, c));
        });
      });
      const schoolNames = classes.map(function (c) { return c.schoolName; })
        .filter(function (n, i, arr) { return arr.indexOf(n) === i; });
      return { role: 'teacher', label: t.name + ' · ' + schoolNames.join(' · '), classes: classes };
    }
    if (password === COORDINATOR_PASSWORD) {
      const classes = [];
      schools.forEach(function (s) {
        s.classes.forEach(function (c) { classes.push(classEntry(s, c)); });
      });
      return { role: 'coordinator', label: 'רכז/ת מגמה', classes: classes };
    }
    return null;
  }

  return {
    schools: schools, teachers: teachers,
    schoolById: schoolById, schoolByName: schoolByName, schoolName: schoolName,
    findTeacher: findTeacher,
  };
})();
