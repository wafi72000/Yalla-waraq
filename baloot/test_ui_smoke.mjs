// يثبّت: تحميل الصفحة، بدء مباراة، والوصول لمرحلة اللعب أو المزايدة عبر الواجهة (بمحاكاة نقرات)
// ملاحظة: الإنسان قد لا يحصل على دور بالمزايدة إطلاقاً لو AI اشترى قبله (سلوك صحيح، مو خلل)
import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf-8");
const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "dangerously", resources: "usable" });
global.window = dom.window;
global.document = dom.window.document;

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

await import("./js/app.js");

document.getElementById("startMatchBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 50));
check("نافذة البداية اختفت بعد الضغط على ابدأ", document.getElementById("startOverlay").classList.contains("hidden"), true);

async function waitForActionableState(maxMs = 10000) {
  let waited = 0;
  while (waited < maxMs) {
    const biddingVisible = !document.getElementById("biddingBar").classList.contains("hidden");
    const turnText = document.getElementById("turnIndicator").textContent;
    const handCardCount = document.querySelectorAll("#handRow .card").length;
    if (biddingVisible) return "human-bidding";
    if (turnText.includes("ميتة")) return "dead";
    if (handCardCount >= 8) return "playing"; // اليد اكتملت (8 ورق) بعد الشراء - تجاوزنا المزايدة، وصلنا للعب الفعلي
    await new Promise((r) => setTimeout(r, 100));
    waited += 100;
  }
  return "timeout";
}

const state = await waitForActionableState();
check("وصلت اللعبة لحالة قابلة للتفاعل خلال 10 ثواني (مو عالقة)", state !== "timeout", true);
console.log(`(الحالة الفعلية: ${state})`);

if (state === "human-bidding") {
  const bidBtns = document.querySelectorAll(".bid-btn");
  check("فيه أزرار مزايدة معروضة لدور الإنسان", bidBtns.length > 0, true);
  bidBtns[bidBtns.length - 1].dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  // ملاحظة: توست AI (مثل "فهد: بس") طبيعي وقد يظهر بنفس التوقيت بالصدفة - نتحقق من نص التوست
  // نفسه (لو ظاهر) يطابق رسالة خطأ حقيقية، بدل نعتبر أي توست ظاهر = خطأ
  const toastText = document.getElementById("toast").textContent || "";
  const looksLikeError = /مو دورك|انتهت بالفعل|صكّة ميتة|غير متاح|يتطلب إعلان|يجب يكون/.test(toastText);
  check("بعد مزايدة الإنسان، ما ظهر خطأ حقيقي بالتوست", looksLikeError, false);

  // لو مزايدة الإنسان أنهت حكم معلّق (بس منه)، ممكن يفتح دور الإنسان بمزايدة الدبل (مو AI) - قد يتكرر أكثر من مرة
  // (دبل الحكم مفتوح دائماً، فممكن يتصاعد لعدة جولات) - نكمّل بالضغط على الخيار "الآمن" كل مرة لحد ما يبدأ اللعب الفعلي
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const doublingVisible = !document.getElementById("doublingBar").classList.contains("hidden");
    const sunDoublingVisible = !document.getElementById("sunDoublingBar").classList.contains("hidden");
    if (doublingVisible) {
      const proceedBtn = [...document.querySelectorAll("#doublingChoices .double-btn")].find((b) => b.textContent.includes("ابدأ اللعب"));
      if (proceedBtn) proceedBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
      else break; // مو دور الإنسان بالضبط (ينتظر AI) - نطلع من الحلقة، الـAI بيكمّل تلقائياً
    } else if (sunDoublingVisible) {
      const normalBtn = [...document.querySelectorAll("#sunDoublingChoices .double-btn")].find((b) => b.textContent.includes("لعب عادي"));
      if (normalBtn) normalBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
      else break;
    } else {
      break; // ما فيه نافذة دبل مفتوحة - انتهينا، أو اللعب بدأ فعلاً
    }
  }
} else if (state === "playing") {
  check("مرحلة اللعب وصلت بنجاح", true, true);
} else if (state === "dead") {
  check("صكّة ميتة اكتُشفت بشكل صحيح", true, true);
}

// ===== نمتد أبعد من المرحلة الأولى: ننتظر وصول دور فعلي للإنسان بالرمي، ونجرّب رمي ورقة فعلياً =====
async function waitForEnabledCard(maxMs = 20000) {
  let waited = 0;
  while (waited < maxMs) {
    const enabledCard = [...document.querySelectorAll("#handRow .card")].find((el) => !el.classList.contains("not-playable"));
    if (enabledCard) return enabledCard;
    await new Promise((r) => setTimeout(r, 150));
    waited += 150;
  }
  return null;
}

const enabledCard = await waitForEnabledCard();
check("توصّلنا لدور فعلي للإنسان بالرمي (ورقة غير معطّلة بيده)", !!enabledCard, true);

if (enabledCard) {
  const cardIdBefore = enabledCard.dataset.cardId;
  const handCountBefore = document.querySelectorAll("#handRow .card").length;
  // الآن يحتاج ضغطتين: الأولى ترفع الورقة (اختيار)، الثانية على نفس الورقة ترميها فعلياً
  enabledCard.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
  enabledCard.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));

  const handCountAfter = document.querySelectorAll("#handRow .card").length;
  check("بعد رمي ورقة، عدد ورق يد الإنسان قلّ بواحد", handCountAfter, handCountBefore - 1);

  const stillThere = [...document.querySelectorAll("#handRow .card")].some((el) => el.dataset.cardId === cardIdBefore);
  check("الورقة المرمية اختفت فعلياً من اليد", stillThere, false);

  await new Promise((r) => setTimeout(r, 3000)); // ننتظر الـAI الثلاثة يكملون الشوط
  check("بعد اكتمال الشوط، ما ظهر خطأ محرك حقيقي بالـtoast", document.getElementById("toast").classList.contains("show"), false);
}

// ===== الدردشة السريعة: زر الدردشة يفتح القائمة، والضغط على عبارة ينشئ فقاعة فوق اليد =====
check("زر الدردشة السريعة موجود بالصفحة", !!document.getElementById("chatToggleBtn"), true);
document.getElementById("chatToggleBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
check("قائمة العبارات تظهر بعد الضغط", !document.getElementById("chatPhrases").classList.contains("hidden"), true);

const phraseBtn = document.querySelector(".chat-phrase-btn");
check("فيه أزرار عبارات بالقائمة", !!phraseBtn, true);
if (phraseBtn) {
  phraseBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  check("فقاعة دردشة ظهرت بعد الضغط على عبارة", document.querySelectorAll(".chat-bubble").length > 0, true);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
