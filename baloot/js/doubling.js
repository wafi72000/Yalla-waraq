// doubling.js — نظام الدبل: سلسلة التصعيد، شرط الـ100 نقطة، خمسة (قهوة) تنهي المباراة فوراً

import { HandRuleError } from "./deal.js";

export const DoubleLevel = {
  NONE: 0,
  DOUBLE: 1,   // دبل - الخصم يبدأ
  THREE: 2,    // ثري - المشتري يرد
  FOUR: 3,     // فور - الخصم يرد
  KAHWA: 4,    // خمسة (قهوة) - المشتري، تنهي المباراة فوراً
};

export const DOUBLE_MULTIPLIER = {
  [DoubleLevel.NONE]: 1,
  [DoubleLevel.DOUBLE]: 2,
  [DoubleLevel.THREE]: 3,
  [DoubleLevel.FOUR]: 4,
  [DoubleLevel.KAHWA]: 5, // بالتسمية بس - عملياً قهوة تنهي المباراة قبل ما يهم المعامل الرقمي
};

/// buyerTeamID / opponentTeamID: معرّفات الفريقين. trumpChoice: هل نوع اللعب "حكم" (الدبل بالحكم فقط)
export class DoublingState {
  constructor(buyerTeamID, opponentTeamID, isHukm, buyerCumulativeScore) {
    this.buyerTeamID = buyerTeamID;
    this.opponentTeamID = opponentTeamID;
    this.isHukm = isHukm;
    this.buyerCumulativeScore = buyerCumulativeScore;
    this.level = DoubleLevel.NONE;
    this.isMatchEndingKahwa = false;
  }

  get multiplier() {
    return DOUBLE_MULTIPLIER[this.level];
  }

  /// هل يصير فتح الدبل من الأساس (شرط الـ100 نقطة + كونها حكم)
  canOpenDouble() {
    return this.isHukm && this.buyerCumulativeScore < 100;
  }

  /// requestingTeamID يطلب المستوى التالي بالسلسلة
  requestNextLevel(requestingTeamID) {
    if (!this.isHukm) {
      throw new HandRuleError("الدبل متاح فقط بنظام الحكم، ما يصير بالصن");
    }
    if (this.level === DoubleLevel.NONE && !this.canOpenDouble()) {
      throw new HandRuleError("ما يصير فتح الدبل - رصيد المشتري وصل 100 أو أكثر");
    }

    const expectedTeam = this._teamAllowedToActNow();
    if (requestingTeamID !== expectedTeam) {
      throw new HandRuleError("مو دورك بسلسلة الدبل - الطرف الثاني هو اللي يرد الحين");
    }

    if (this.level === DoubleLevel.KAHWA) {
      throw new HandRuleError("وصلنا أعلى مستوى (خمسة/قهوة) بالفعل - ما فيه تصعيد أكثر");
    }

    this.level += 1;
    if (this.level === DoubleLevel.KAHWA) {
      this.isMatchEndingKahwa = true;
    }
    return this.level;
  }

  get teamToActNext() {
    return this._teamAllowedToActNow();
  }

  _teamAllowedToActNow() {
    // دبل (مستوى 1): الخصم يبدأ. ثري (2): المشتري يرد. فور (3): الخصم يرد. خمسة (4): المشتري يرد.
    const nextLevel = this.level + 1;
    const isOddLevel = nextLevel % 2 === 1; // 1 (دبل) و3 (فور) = الخصم؛ 2 (ثري) و4 (خمسة) = المشتري
    return isOddLevel ? this.opponentTeamID : this.buyerTeamID;
  }
}
