// assets/questions.js — P2.4 · Question Bank
// Extra questions per lesson — 2 random shown per session (seed from localStorage)
'use strict';

GC.QuestionBank = {

  // ── שיעור 5 ── pH/EC bonus questions ──────────────────────────────────
  5: [
    { q:'מה pH מושלם לחסה בהידרופוניקה?', opts:['4.0-5.0','5.5-6.5','7.0-8.0','8.5-9.5'], ans:1 },
    { q:'EC גבוה מ-2.5 mS/cm אומר:', opts:['הצמח רעב','מינרלים בריכוז גבוה מדי','מים נקיים','מחסור באור'], ans:1 },
    { q:'מה קורה ל-pH כשמוסיפים דשן?', opts:['עולה','יורד','לא משתנה','הופך ניטרלי'], ans:1 },
    { q:'איזה כלי מודד ריכוז מינרלים?', opts:['pH meter','EC meter','מד טמפ\'','מד אור'], ans:1 },
    { q:'pH 4.2 בהידרופוניקה מסמן:', opts:['מצוין','חומציות גבוהה מדי','בסיסיות גבוהה','תקין'], ans:1 },
    { q:'בשביל מה הצמח צריך מינרלים?', opts:['לפוטוסינתזה','לבנות גוף (עלים, שורשים, תאים)','לנשימה בלבד','לספוג אור'], ans:1 },
    { q:'אם EC נמוך מ-1.2 — מה לעשות?', opts:['להוסיף מים נקיים','להוסיף דשן','להוסיף חומצה','לא לעשות כלום'], ans:1 },
  ],

  // ── שיעור 6 ── חיישנים / ארדואינו ──────────────────────────────────
  6: [
    { q:'מה ההבדל בין פין דיגיטלי לאנלוגי?', opts:['דיגיטלי = 0 או 1; אנלוגי = טווח רציף','דיגיטלי = מדויק יותר','אנלוגי = מהיר יותר','אין הבדל'], ans:0 },
    { q:'DHT22 מודד:', opts:['pH ו-EC','טמפרטורה ולחות','אור בלבד','CO₂'], ans:1 },
    { q:'מה עושה הפקודה delay(2000)?', opts:['ממתין 2 שניות','ממתין 2 מיקרושניות','מאפס את הלוח','מסיים את הקוד'], ans:0 },
    { q:'לאיזה פין מחברים DATA של DHT22?', opts:['5V','GND','D2','A0'], ans:2 },
    { q:'BH1750 מודד:', opts:['טמפרטורה','לחות','עוצמת אור (lux)','pH'], ans:2 },
    { q:'מה קורה כשה-Serial.begin לא נמצא ב-setup?', opts:['הקוד נכשל','אין פלט ב-Serial Monitor','הלוח נשרף','לא כלום'], ans:1 },
    { q:'void loop() מתבצעת:', opts:['פעם אחת','כל delay() שניות','לנצח בלי הפסקה','רק כשמדברים עם Serial'], ans:2 },
  ],

  // ── שיעור 7 ── if/else, LED, נגד ────────────────────────────────────
  7: [
    { q:'למה חייבים נגד עם LED?', opts:['לשיפור הצבע','למניעת שריפת LED מעומס זרם','להאיר יותר','לסגירת המעגל בלבד'], ans:1 },
    { q:'הפקודה digitalWrite(9, HIGH) עושה:', opts:['קוראת ערך','שולחת 5V לפין 9','מכבה פין 9','מאפסת פין 9'], ans:1 },
    { q:'מה if (ph < 5.5) בודק?', opts:['אם pH שווה ל-5.5','אם pH קטן מ-5.5','אם pH גדול מ-5.5','אם pH שונה מ-5.5'], ans:1 },
    { q:'else מתבצע:', opts:['תמיד','רק אם if לא התקיים','רק אם if התקיים','פעמיים'], ans:1 },
    { q:'Servo.write(0) עושה:', opts:['סיבוב 180°','סיבוב ל-0° (סגור)','עצירה','ריסט'], ans:1 },
    { q:'מה עדיף — LED אדום + ירוק, או LCD?', opts:['LCD — יותר מידע','LED — פשוט וזול, פועל אוטומטי','שווה לחלוטין','תלוי בתוכנה'], ans:1 },
    { q:'analogRead(A0) מחזיר ערך בטווח:', opts:['0-5','0-100','0-1023','0-255'], ans:2 },
  ],
};

// ── Engine: pick 2 random questions per session (seed-based) ─────────────
GC.getSessionQuestions = function(lessonId, count) {
  count = count || 2;
  const bank = GC.QuestionBank[lessonId];
  if (!bank || !bank.length) return [];
  const seedKey = 'gc_qseed_' + lessonId;
  let seed = parseInt(localStorage.getItem(seedKey) || '0');
  // Advance seed each session
  seed = (seed + 1) % bank.length;
  localStorage.setItem(seedKey, seed);
  const result = [];
  for (let i = 0; i < count && i < bank.length; i++) {
    result.push(bank[(seed + i) % bank.length]);
  }
  return result;
};

// ── Inject random bonus question block into a step ────────────────────────
// Call this in the lesson's init(), passing the target container ID
GC.injectBonusQuestions = function(lessonId, containerId) {
  const questions = GC.getSessionQuestions(lessonId, 2);
  const container = document.getElementById(containerId);
  if (!container || !questions.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'mt-5 space-y-4';
  wrapper.innerHTML = '<p class="font-bold text-sm text-purple-700 mb-3">⚡ שאלות בונוס (מהבנק):</p>';

  questions.forEach((q, qi) => {
    const qid = 'bq_' + lessonId + '_' + qi;
    const block = document.createElement('div');
    block.className = 'bg-purple-50 border-2 border-purple-200 rounded-2xl p-4';
    block.id = qid;
    block.innerHTML = `<p class="font-bold text-sm mb-3">${q.q}</p>
      <div class="grid gap-2">
        ${q.opts.map((opt, oi) =>
          `<div class="quiz-opt p-3 text-sm" onclick="ansQ(this,${oi===q.ans},'${qid}')">
            ${opt}
          </div>`
        ).join('')}
      </div>
      <div id="fb-${qid}" class="hidden mt-2 rounded-xl p-3 text-sm"></div>`;
    wrapper.appendChild(block);
  });

  container.appendChild(wrapper);
};

// ── Side Quest definitions ────────────────────────────────────────────────
GC._ALL_SIDEQUESTS = [
  { id:'sq-05-compare', lessonId:5, title:'השווה גידול אנכי vs. שדה', description:'הצג לכיתה 3 נקודות השוואה שלא הוזכרו בלומדה', reward:15 },
  { id:'sq-06-sensor',  lessonId:6, title:'חסר מד רביעי?', description:'מה עוד הייתם מחברים? רשמו בדרכון', reward:15 },
  { id:'sq-07-servo',   lessonId:7, title:'ברז + אזעקה', description:'כתבו if/else שמפעיל גם Servo וגם Buzzer', reward:15 },
  { id:'sq-09-bird',    lessonId:9, title:'ניצב לגמרי', description:'צלמו את המערכת מלמעלה (ניצב לחלוטין)', reward:15 },
  { id:'sq-13-pov',     lessonId:13, title:'POV של גיבור אמיתי', description:'כתבו POV לחקלאי שפגשתם/שמעתם עליו בתוכנית', reward:20, mandatory:true },
  { id:'sq-15-fix',     lessonId:15, title:'תיעד שיפור על סמך feedback', description:'צלמו "לפני ואחרי" התיקון', reward:20, mandatory:true },
  { id:'sq-16-oneliner',lessonId:16, title:'כתוב One Liner שלך', description:'משפט אחד — מה בניתם ולמה זה חשוב', reward:15 },
  { id:'sq-17-future',  lessonId:17, title:'כתוב לעצמך של עוד 5 שנים', description:'מה תספרו לעצמכם על השנה הזאת', reward:15 },
];

// Auto-register side quest for current lesson
GC._autoRegisterSideQuest = function(lessonId) {
  const sq = GC._ALL_SIDEQUESTS.find(s => s.lessonId === lessonId);
  if (sq) GC.registerSideQuest(sq);
};
