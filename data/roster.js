// data/roster.js — רשימת בתי הספר/הכיתות הפעילים בפועל בשטח.
// זהו המקור היחיד לרשימה הזו — אל תשכפלו אותה בקבצים אחרים. כדי להוסיף בית ספר/כיתה, עורכים
// רק את הקובץ הזה.
//
// מדריכים, סיסמאות ושיוך כיתות למדריך/ה - **לא כאן** (הקובץ ציבורי). הם בגיליון teacher_auth
// בצד השרת (data/apps-script/Code.gs, docs/teacher-auth-migration.md). הכניסה מחזירה את רשימת
// הכיתות של המדריך/ה, ו-classesFor() כאן רק מעשיר אותה בשדות תצוגה (מסלול, שם כיתה).
// חשוב: school.name הוא מה שנשמר בגיליון כ-school_id (ראה identity.js) - לא לשנות שם של בית
// ספר שכבר יש בו תלמידים, אחרת הם יתנתקו מהשורות הקיימות שלהם.
window.GC_ROSTER = (function () {

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

  // הופך את פרטי המדריך/ה שהשרת החזיר בכניסה ({name, role, classes}) לרשימת כיתות לתצוגה.
  // classes = "*" (רכז/ת) → כל הכיתות; {school, class:"*"} → כל כיתות בית הספר.
  // כיתה שלא מופיעה כאן ברשימה עדיין מוצגת (לפי המזהה) - השרת הוא שקובע מה מותר.
  // תוצאה: { role, label, classes:[{schoolId,schoolName,track,classId,className}] }
  function classesFor(teacher) {
    if (!teacher) return null;
    const classes = [];
    if (teacher.classes === '*') {
      schools.forEach(function (s) {
        s.classes.forEach(function (c) { classes.push(classEntry(s, c)); });
      });
    } else {
      (teacher.classes || []).forEach(function (ref) {
        const s = schoolByName(ref.school);
        if (!s) {
          if (ref.class && ref.class !== '*') classes.push({ schoolId: ref.school, schoolName: ref.school, track: '', classId: ref.class, className: ref.class });
          return;
        }
        s.classes.forEach(function (c) {
          if (ref.class === '*' || ref.class === c.id) classes.push(classEntry(s, c));
        });
        if (ref.class !== '*' && !s.classes.some(function (c) { return c.id === ref.class; })) {
          classes.push({ schoolId: s.id, schoolName: s.name, track: s.track, classId: ref.class, className: ref.class });
        }
      });
    }
    const schoolNames = classes.map(function (c) { return c.schoolName; })
      .filter(function (n, i, arr) { return arr.indexOf(n) === i; });
    const label = teacher.role === 'coordinator' ? (teacher.name || 'רכז/ת מגמה')
      : teacher.name + (schoolNames.length ? ' · ' + schoolNames.join(' · ') : '');
    return { role: teacher.role, label: label, classes: classes };
  }

  return {
    schools: schools,
    schoolById: schoolById, schoolByName: schoolByName, schoolName: schoolName,
    classesFor: classesFor,
  };
})();
