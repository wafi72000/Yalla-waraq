// meld.js — البير (Set/Run) ومنطق التحقق منه
// مهم: التحقق من صحة "التسلسل" (Run) مستقل عن ترتيب الورق المُعطى (تصاعدي أو تنازلي أو عشوائي) -
// نحسب التسلسل دايماً من قيم الرتب نفسها، مش من ترتيب الورق على الشاشة.

export const MeldKind = Object.freeze({ SET: "set", RUN: "run" });

export const MIN_MELD_SIZE = 3;
export const MAX_SET_SIZE = 4;

/// قيمة رتبة بترتيب التسلسل: الأص = 1 لو بأول التسلسل (index 0)، أو 14 لو بآخره
/// (تبقى متوفرة للتوافق مع كود قديم يعتمد ترتيب مخزّن مسبقاً بشكل تصاعدي مضبوط)
export function sequenceValue(rank, atIndex) {
  if (rank === 14 /* Ace */) {
    return atIndex === 0 ? 1 : 14;
  }
  return rank;
}

export function isValidSet(cards) {
  if (cards.length < MIN_MELD_SIZE || cards.length > MAX_SET_SIZE) return false;
  const realCards = cards.filter((c) => !c.isJoker);
  if (realCards.length === 0) return false; // ما يجوز بير كله جواكر
  const rank = realCards[0].rank;
  if (!realCards.every((c) => c.rank === rank)) return false;
  const suits = realCards.map((c) => c.suit);
  if (new Set(suits).size !== suits.length) return false; // لا تكرار نوع
  return true;
}

/// يحلل تسلسل البير (Run) بدون أي اعتماد على ترتيب الورق المُعطى - يجرب الأص بقيمة 1 أو 14
/// يتعامل مع الجواكر بحالتين: تعبية فجوة داخلية بين الورق الموجود، أو تمديد التسلسل من طرف خارجي
/// (مثلاً 8-9 + جوكر = صحيح كـ7-8-9 أو 8-9-10، حتى لو الورقتين الحقيقيتين متجاورتين بدون فجوة)
/// ويرجع {min, max, aceValue} لو التسلسل صحيح، أو null لو غير صحيح
export function resolveRunSequence(cards) {
  const jokers = cards.filter((c) => c.isJoker);
  const reals = cards.filter((c) => !c.isJoker);
  if (reals.length === 0) return null; // ما يجوز بير كله جواكر

  const suits = new Set(reals.map((c) => c.suit));
  if (suits.size !== 1) return null; // لازم نفس النوع

  const ranksSeen = new Set();
  for (const c of reals) {
    if (ranksSeen.has(c.rank)) return null; // تكرار رتبة يكسر التسلسل
    ranksSeen.add(c.rank);
  }

  const hasAce = reals.some((c) => c.rank === 14);
  const aceOptions = hasAce ? [1, 14] : [null];
  const jokerCount = jokers.length;

  for (const aceVal of aceOptions) {
    const values = reals.map((c) => (c.rank === 14 ? aceVal : c.rank)).sort((a, b) => a - b);
    const realMin = values[0];
    const realMax = values[values.length - 1];

    const innerSpan = realMax - realMin + 1;
    const innerGapsNeeded = innerSpan - values.length; // جواكر لازمة لتعبية الفجوات بين الورق الموجود
    const remainingJokers = jokerCount - innerGapsNeeded;
    if (remainingJokers < 0) continue; // الجواكر ما تكفي حتى لتعبية الفجوات الداخلية

    // الجواكر الزايدة تمدّد التسلسل من أي طرف - نفضّل اليمين (قيمة أعلى) لو فيه مساحة، والباقي يسار
    const roomLeft = realMin - 1;
    const roomRight = 14 - realMax;
    const rightExt = Math.min(remainingJokers, roomRight);
    const leftExt = remainingJokers - rightExt;
    if (leftExt > roomLeft) continue; // ما فيه مساحة كافية حتى بعد تعظيم الامتداد لليمين

    const min = realMin - leftExt;
    const max = realMax + rightExt;
    if (max - min + 1 !== cards.length) continue; // احتياط نهائي
    if (new Set(values).size !== values.length) continue; // احتياط من تكرار قيمة
    return { min, max, aceValue: aceVal };
  }
  return null;
}

export function isValidRun(cards) {
  if (cards.length < MIN_MELD_SIZE) return false;
  return resolveRunSequence(cards) !== null;
}

/// يرجّع نفس ورق البير بترتيب تصاعدي صحيح (الجواكر بمكانها الصحيح بالفجوات) - يُستخدم وقت التخزين
/// حتى تبقى باقي العمليات (إضافة ورقة، تبديل جوكر، حساب نقاط) قادرة تفترض ترتيب تصاعدي ثابت دايماً
export function canonicalRunOrder(cards) {
  const seq = resolveRunSequence(cards);
  if (!seq) return cards; // احتياط - ما يفترض يصير لو البير سبق وتأكدت صحته

  const jokers = [...cards.filter((c) => c.isJoker)];
  const reals = cards.filter((c) => !c.isJoker);
  const realByValue = new Map(
    reals.map((c) => [c.rank === 14 ? seq.aceValue : c.rank, c])
  );

  const ordered = [];
  let jokerIdx = 0;
  for (let v = seq.min; v <= seq.max; v++) {
    const real = realByValue.get(v);
    ordered.push(real ?? jokers[jokerIdx++]);
  }
  return ordered;
}
