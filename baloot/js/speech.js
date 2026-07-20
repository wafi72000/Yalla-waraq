// speech.js — نطق عربي حقيقي عبر Web Speech API المدمجة بالمتصفح (صفر ملفات صوتية، صفر حقوق ملكية)
// المتصفح/الجهاز نفسه هو اللي "يتكلم" - مو تسجيل محفوظ، فما فيه أي إشكال قانوني

let arabicVoice = null;
let voicesReady = false;

function pickArabicVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  voicesReady = true;
  return voices.find((v) => v.lang?.startsWith("ar")) ?? null;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  arabicVoice = pickArabicVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    arabicVoice = pickArabicVoice();
  };
}

/// ينطق نص عربي بصوت حقيقي (لو مدعوم بالجهاز) - لا يفعل شيء بصمت لو غير مدعوم (لا يكسر أي شيء)
export function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel(); // يقطع أي نطق سابق لسه شغّال - يمنع تراكم الطابور وقت اللعب السريع
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    if (arabicVoice) utterance.voice = arabicVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    // بعض المتصفحات/الأجهزة القديمة ما تدعمها - نتجاهل بصمت، الأصوات ميزة إضافية مو أساسية
  }
}

/// كلمات المزايدة والدبل الجاهزة - نفس القائمة المتفق عليها بالضبط
export const BID_SPEECH = {
  ROUND_FIRST: "أول",
  TURN: "دورك",
  ROUND_SECOND: "ثاني",
  SUN: "صن",
  HUKM: "حكم",
  HUKM_FIRST: "حكم أول",
  HUKM_SECOND: "حكم ثاني",
  ASHKAL: "اشكل",
  PASS_ROUND1: "بس",
  PASS_ROUND2: "ولا",
  DOUBLE: "دبل",
  THREE: "ثري",
  FOUR: "فور",
  KAHWA: "خمسة",
};

/// كلمات إعلان المشاريع - كل لاعب ينطق اسم مشروعه بس (بدون كشف الورق)، زي اللعب الحقيقي
export const PROJECT_SPEECH = {
  sira: "سِرا",
  khamseen: "خمسين",
  mia: "مية",
  arbaamia: "أربعمية",
  baloot: "بلوت",
};
