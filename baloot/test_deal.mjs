import { dealInitial, completeDealAfterPurchase } from "./js/deal.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

const seatOrder = ["right", "partner_dealer", "left", "dealer"]; // يمين، شريك الموزّع، يسار، الموزّع نفسه
function partnerOf(id) {
  const map = { right: "left", left: "right", partner_dealer: "dealer", dealer: "partner_dealer" };
  return map[id];
}

// ===== التوزيع الأول: كل لاعب 5 ورقات، ورقة مفروشة، الباقي بالدستة =====
{
  const { hands, flippedCard, remainingDeck } = dealInitial(seatOrder);
  for (const id of seatOrder) {
    check(`${id} معه 5 ورقات بعد التوزيع الأول`, hands.get(id).length, 5);
  }
  check("فيه ورقة مفروشة", !!flippedCard, true);
  check("الدستة الباقية = 32 - (5*4) - 1(مفروشة) = 11", remainingDeck.length, 11);
}

// ===== إكمال التوزيع - شراء عادي (حكم/صن): المشتري ياخذ المفروشة + ورقتين، الباقي 3 =====
{
  const state = dealInitial(seatOrder);
  const buyerID = "left";
  const result = completeDealAfterPurchase(state, seatOrder, buyerID, false, partnerOf);
  check("المشتري (شراء عادي) معه 5+1(مفروشة)+2=8", result.hands.get("left").length, 8);
  check("الباقين معهم 5+3=8", result.hands.get("right").length, 8);
  check("الباقين معهم 5+3=8 (الموزّع)", result.hands.get("dealer").length, 8);
  check("الباقين معهم 5+3=8 (شريك الموزّع)", result.hands.get("partner_dealer").length, 8);
  check("الدستة صفرت (11 - 2 - 3*3 = 0)", result.remainingDeck.length, 0);
}

// ===== إكمال التوزيع - إشكال: زميل المشتري ياخذ المفروشة، المشتري نفسه ياخذ 3 كاملة =====
{
  const state = dealInitial(seatOrder);
  const buyerID = "left"; // اشترى بإشكال - زميله right
  const result = completeDealAfterPurchase(state, seatOrder, buyerID, true, partnerOf);
  check("المشتري بالإشكال معه 5+3=8 (ما أخذ المفروشة)", result.hands.get("left").length, 8);
  check("زميل المشتري (right) معه 5+2+1(مفروشة)=8", result.hands.get("right").length, 8);
  check("الباقين (partner_dealer/dealer) معهم 5+3=8", result.hands.get("dealer").length, 8);
  check("الدستة صفرت", result.remainingDeck.length, 0);
}

// ===== إشكال بالموزّع نفسه - الورقة تروح لشريكه (partner_dealer) =====
{
  const state = dealInitial(seatOrder);
  const buyerID = "dealer";
  const result = completeDealAfterPurchase(state, seatOrder, buyerID, true, partnerOf);
  check("الموزّع (اشتراه بإشكال) معه 5+3=8", result.hands.get("dealer").length, 8);
  check("شريك الموزّع (partner_dealer) معه 5+2+1=8 (استلم المفروشة)", result.hands.get("partner_dealer").length, 8);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
