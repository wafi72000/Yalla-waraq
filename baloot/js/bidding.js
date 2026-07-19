// bidding.js — منطق المزايدة: جولتين، ترتيب الدور، صلاحيات كل مقعد، الصكّة الميتة

import { HandRuleError } from "./deal.js";

export const BidChoice = {
  HUKM: "hukm",   // حكم (أول أو ثاني حسب الجولة)
  SUN: "sun",     // صن
  ASHKAL: "ashkal", // إشكال - نفس الصن، بس الورقة المفروشة تروح لزميل المشتري
  PASS: "pass",   // بس (جولة أولى) أو ولا (جولة ثانية) - نفس المعنى برمجياً
};

export class BiddingState {
  /// seatOrder: مصفوفة player IDs بترتيب المزايدة (يمين، شريك الموزّع، يسار، الموزّع)
  /// flippedSuit: نوع الورقة المفروشة (لتحديد "حكم أول" لاحقاً)
  constructor(seatOrder, flippedSuit) {
    this.seatOrder = seatOrder;
    this.flippedSuit = flippedSuit;
    this.round = 1; // 1 أو 2
    this.turnIndex = 0;
    this.result = null; // { buyerID, choice, trumpSuit } بعد الشراء، أو null لسه
    this.isDead = false; // صكّة ميتة (مرّت الجولتان بدون شراء)
  }

  get currentPlayerID() {
    return this.seatOrder[this.turnIndex];
  }

  /// هل هذا اللاعب من آخر اثنين بالدور (يسار الموزّع أو الموزّع نفسه) - المؤهلين لخيار "اشكل"
  isEligibleForAshkal(playerID) {
    const idx = this.seatOrder.indexOf(playerID);
    return idx === 2 || idx === 3; // index 2 = يسار الموزّع، index 3 = الموزّع
  }

  /// الخيارات المتاحة للاعب الحالي بالجولة الحالية
  availableChoices() {
    const base = this.round === 1
      ? [BidChoice.HUKM, BidChoice.SUN, BidChoice.PASS]
      : [BidChoice.HUKM, BidChoice.SUN, BidChoice.PASS];
    if (this.round === 1 && this.isEligibleForAshkal(this.currentPlayerID)) {
      return [BidChoice.HUKM, BidChoice.SUN, BidChoice.ASHKAL, BidChoice.PASS];
    }
    return base;
  }

  /// يسجّل قرار اللاعب الحالي. trumpSuitForHukm مطلوبة فقط لو choice=HUKM بالجولة الثانية (لازم إعلان صريح)
  submitBid(playerID, choice, trumpSuitForHukm = null) {
    if (this.result) throw new HandRuleError("المزايدة انتهت بالفعل");
    if (this.isDead) throw new HandRuleError("هذي صكّة ميتة، ما فيه مزايدة");
    if (playerID !== this.currentPlayerID) throw new HandRuleError("مو دورك بالمزايدة");
    if (!this.availableChoices().includes(choice)) {
      throw new HandRuleError(choice === BidChoice.ASHKAL
        ? "الإشكال متاح فقط ليسار الموزّع أو الموزّع نفسه، وبالجولة الأولى بس"
        : "خيار غير متاح لك الحين");
    }

    if (choice === BidChoice.PASS) {
      this._advanceTurn();
      return null;
    }

    // تحديد لون الحكم النهائي
    let trumpSuit = null;
    if (choice === BidChoice.HUKM) {
      if (this.round === 1) {
        trumpSuit = this.flippedSuit; // حكم أول = نفس لون المفروشة
      } else {
        if (!trumpSuitForHukm) throw new HandRuleError("حكم ثاني يتطلب إعلان صريح عن اللون");
        if (trumpSuitForHukm === this.flippedSuit) {
          throw new HandRuleError("حكم ثاني يجب يكون بلون غير لون الورقة المفروشة");
        }
        trumpSuit = trumpSuitForHukm;
      }
    }
    // صن/اشكل: trumpSuit تبقى null (لا يوجد لون حكم)

    this.result = {
      buyerID: playerID,
      choice,
      trumpSuit,
      isAshkal: choice === BidChoice.ASHKAL,
    };
    return this.result;
  }

  _advanceTurn() {
    this.turnIndex += 1;
    if (this.turnIndex >= this.seatOrder.length) {
      if (this.round === 1) {
        this.round = 2;
        this.turnIndex = 0;
      } else {
        this.isDead = true; // صكّة ميتة - مرّت الجولتان بدون شراء
      }
    }
  }
}
