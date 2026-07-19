// escalation.js — تصعيد الجوكر وتحديد طرق الإنهاء المسموحة

export const EndingType = Object.freeze({
  KHALES: 0, // خالص
  HAND: 1,   // هند
  COLOR: 2,  // لون
  QARINQ: 3, // قرينق
});

export class HandEscalation {
  constructor() {
    this.jokersDiscardedCount = 0;
    this.isFrozen = false;
  }

  get minimumAllowedEnding() {
    const n = Math.min(this.jokersDiscardedCount, 3);
    return [EndingType.KHALES, EndingType.HAND, EndingType.COLOR, EndingType.QARINQ][n];
  }

  get isDeclareAllowed() {
    return this.minimumAllowedEnding <= EndingType.KHALES;
  }

  isEndingAllowed(type) {
    return type >= this.minimumAllowedEnding;
  }

  registerJokerDiscarded() {
    if (this.isFrozen) return; // الجوكر صار ورقة عادية بعد التجميد
    this.jokersDiscardedCount += 1;
  }

  freezeAfterFirstDeclaration() {
    this.isFrozen = true;
  }

  reset() {
    this.jokersDiscardedCount = 0;
    this.isFrozen = false;
  }
}
