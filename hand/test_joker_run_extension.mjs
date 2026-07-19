// يثبّت إصلاح: الجوكر يمدّد التسلسل من طرف خارجي (لما الورق الحقيقي متجاور بدون فجوة)، مش يعبّي فجوات داخلية بس
import { isValidRun, resolveRunSequence, canonicalRunOrder } from "./js/meld.js";
import { Suit, makeCard, makeJoker } from "./js/models.js";
import { totalPoints } from "./js/scoring.js";
import { MeldKind } from "./js/meld.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

// ===== 8،9 + جوكر بأي ترتيب - يفترض يصير تسلسل صحيح (يمدّ من طرف، مفيه فجوة داخلية يعبّيها) =====
{
  const eight = makeCard(Suit.SPADES, 8);
  const nine = makeCard(Suit.SPADES, 9);
  const joker = makeJoker();
  for (const [label, order] of [
    ["8،9،جوكر", [eight, nine, joker]],
    ["9،جوكر،8", [nine, joker, eight]],
    ["جوكر،8،9", [joker, eight, nine]],
  ]) {
    check(`تسلسل صحيح بترتيب (${label})`, isValidRun(order), true);
  }
}

// الجوكر يفضّل التمديد لليمين (قيمة أعلى - 10 بدل 7) وقت التساوي - أفيد للاعب نقاطياً
{
  const eight = makeCard(Suit.SPADES, 8);
  const nine = makeCard(Suit.SPADES, 9);
  const joker = makeJoker();
  const seq = resolveRunSequence([eight, nine, joker]);
  check("الجوكر يمدّ لليمين (8-9-10) مش لليسار (7-8-9) عند التساوي", seq, { min: 8, max: 10, aceValue: null });

  const ordered = canonicalRunOrder([eight, nine, joker]);
  check("الترتيب النهائي: 8، 9، جوكر(=10)", ordered.map((c) => c.isJoker ? "J" : c.rank), [8, 9, "J"]);

  const points = totalPoints([eight, nine, joker], MeldKind.RUN);
  check("النقاط: 8+9+10(الجوكر كولد)=27", points, 27);
}

// حتى لو الورق يلامس K، فيه مساحة لليمين كمان (الأص بقيمة 14 بأعلى التسلسل) - فالجوكر يمدّ صح
{
  const twelve = makeCard(Suit.HEARTS, 12);
  const thirteen = makeCard(Suit.HEARTS, 13);
  const joker = makeJoker();
  const seq = resolveRunSequence([twelve, thirteen, joker]);
  check("Q،K + جوكر يمدّ لليمين للأص (Q-K-A)، لأن 14 لسه قيمة صحيحة فوق K", seq, { min: 12, max: 14, aceValue: null });
}

// أما لو الورق يلامس الأص فعلياً (K،A حقيقي) - ما فيه مساحة يمين، يمدّ يسار بالضرورة
{
  const king = makeCard(Suit.HEARTS, 13);
  const ace = makeCard(Suit.HEARTS, 14);
  const joker = makeJoker();
  const seq = resolveRunSequence([king, ace, joker]);
  check("K،A حقيقيين + جوكر - ما فيه مساحة يمين فعلياً، يمدّ يسار (Q-K-A)", seq, { min: 12, max: 14, aceValue: 14 });
}

// جوكرين يمدّون نفس التسلسل المتجاور من الطرفين لو احتاج الأمر
{
  const eight = makeCard(Suit.SPADES, 8);
  const nine = makeCard(Suit.SPADES, 9);
  const j1 = makeJoker(), j2 = makeJoker();
  check("8،9 + جوكرين = تسلسل صحيح (5 ورق، يمتد لليمين أولاً)", isValidRun([eight, nine, j1, j2]), true);
  const seq = resolveRunSequence([eight, nine, j1, j2]);
  check("التمديد بجوكرين: يفضّل اليمين بالكامل لو فيه مساحة (8-9-10-11)", seq, { min: 8, max: 11, aceValue: null });
}

// تسلسل بفجوة داخلية + امتداد خارجي بنفس الوقت (مزيج الحالتين)
{
  // 5، 7 (فجوة بـ6) + 8، 9 (متجاورتين) + جوكرين: واحد يعبّي فجوة 6 الداخلية، والثاني يمدّ لليمين (10)
  const five = makeCard(Suit.CLUBS, 5);
  const seven = makeCard(Suit.CLUBS, 7);
  const eight = makeCard(Suit.CLUBS, 8);
  const nine = makeCard(Suit.CLUBS, 9);
  const j1 = makeJoker(), j2 = makeJoker();
  const cards = [five, seven, eight, nine, j1, j2];
  check("فجوة داخلية (6) + امتداد خارجي بنفس الوقت - صحيح", isValidRun(cards), true);
  const seq = resolveRunSequence(cards);
  check("النطاق الصحيح: 5 إلى 10 (جوكر يعبّي 6، وجوكر يمدّ لـ10)", seq, { min: 5, max: 10, aceValue: null });
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
