// bidding.js — منطق المزايدة: جولتين، ترتيب الدور، صلاحيات كل مقعد، الصكّة الميتة
//
// قاعدة مهمة (الجولة الأولى فقط): شراء "حكم" لا يوقف المزايدة فوراً - يصير "معلّق" (pending)،
// والدور يكمل لبقية اللاعبين بنفس الجولة. أي لاعب لاحق يقدر "يرفعها" لصن/اشكل (يلغي الحكم المعلّق
// ويقفل فوراً)، أو يشتري حكم جديد (يستبدل المعلّق السابق)، أو يمرر. لو انتهت الجولة وحكم معلّق موجود
// بدون ما يُلغى، يصير هو المشتري النهائي. الصن والإشكال يقفلون المزايدة فوراً دائماً، بكلتا الجولتين.

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
  /// teamOfPlayer: دالة (playerID) => "A"|"B" - تلزم لتصفية الأزرار حسب زميل/خصم صاحب الحكم المعلّق
  constructor(seatOrder, flippedSuit, teamOfPlayer) {
    this.seatOrder = seatOrder;
    this.flippedSuit = flippedSuit;
    this.teamOfPlayer = teamOfPlayer;
    this.round = 1; // 1 أو 2
    this.turnIndex = 0;
    this.result = null; // { buyerID, choice, trumpSuit, isAshkal } بعد الشراء النهائي، أو null لسه
    this.isDead = false; // صكّة ميتة (مرّت الجولتان بدون شراء)
    this.pendingHukm = null; // { buyerID, trumpSuit } - حكم معلّق بالجولة الأولى، لسه ما انقفل
  }

  get currentPlayerID() {
    return this.seatOrder[this.turnIndex];
  }

  /// هل هذا اللاعب من آخر اثنين بالدور (يسار الموزّع أو الموزّع نفسه) - المؤهلين لخيار "اشكل"
  isEligibleForAshkal(playerID) {
    const idx = this.seatOrder.indexOf(playerID);
    return idx === 2 || idx === 3; // index 2 = يسار الموزّع، index 3 = الموزّع
  }

  /// الخيارات المتاحة للاعب الحالي بالجولة الحالية - تُفلتر حسب علاقته بصاحب الحكم المعلّق (زميل/خصم) لو موجود
  availableChoices() {
    const playerID = this.currentPlayerID;

    // لو فيه حكم معلّق، الخيارات تختلف جذرياً حسب زميل/خصم صاحبه
    if (this.round === 1 && this.pendingHukm) {
      const isPartner = this.teamOfPlayer(playerID) === this.teamOfPlayer(this.pendingHukm.buyerID);
      if (isPartner) {
        return [BidChoice.SUN, BidChoice.PASS]; // زميل المشتري: يقدر يرفع لصن بس، ما يشوف حكم/اشكل/دبل
      }
      // الخصم: يقدر يرفع لصن، أو يشتري حكم جديد، أو يمرر - وإشكال لو مؤهّل بموقعه (يسار/الموزّع)
      const opponentChoices = [BidChoice.SUN, BidChoice.HUKM, BidChoice.PASS];
      if (this.isEligibleForAshkal(playerID)) opponentChoices.splice(2, 0, BidChoice.ASHKAL);
      return opponentChoices;
    }

    const base = [BidChoice.HUKM, BidChoice.SUN, BidChoice.PASS];
    if (this.round === 1 && this.isEligibleForAshkal(playerID)) {
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
      return this.result; // قد يكون null، أو النتيجة النهائية لو انتهت الجولة وحكم معلّق تحوّل لمشتري نهائي
    }

    if (choice === BidChoice.HUKM) {
      const trumpSuit = this._resolveHukmSuit(trumpSuitForHukm);
      if (this.round === 1) {
        // حكم بالجولة الأولى: يصير معلّق فقط، ما يقفل المزايدة - الدور يكمل لبقية اللاعبين بنفس الجولة
        this.pendingHukm = { buyerID: playerID, trumpSuit };
        this._advanceTurn();
        return null;
      }
      // حكم بالجولة الثانية: يقفل فوراً زي المعتاد
      this._finalize(playerID, BidChoice.HUKM, trumpSuit, false);
      return this.result;
    }

    // صن أو اشكل: يقفل المزايدة فوراً دايماً (يلغي أي حكم معلّق لو موجود)
    this._finalize(playerID, choice, null, choice === BidChoice.ASHKAL);
    return this.result;
  }

  _resolveHukmSuit(trumpSuitForHukm) {
    if (this.round === 1) return this.flippedSuit; // حكم أول = نفس لون المفروشة
    if (!trumpSuitForHukm) throw new HandRuleError("حكم ثاني يتطلب إعلان صريح عن اللون");
    if (trumpSuitForHukm === this.flippedSuit) {
      throw new HandRuleError("حكم ثاني يجب يكون بلون غير لون الورقة المفروشة");
    }
    return trumpSuitForHukm;
  }

  _finalize(buyerID, choice, trumpSuit, isAshkal) {
    this.result = { buyerID, choice, trumpSuit, isAshkal };
    this.pendingHukm = null;
  }

  _advanceTurn() {
    this.turnIndex += 1;
    if (this.turnIndex >= this.seatOrder.length) {
      if (this.round === 1) {
        if (this.pendingHukm) {
          // انتهت الجولة الأولى وفيه حكم معلّق ما انلغى - يصير هو المشتري النهائي
          this._finalize(this.pendingHukm.buyerID, BidChoice.HUKM, this.pendingHukm.trumpSuit, false);
          return;
        }
        this.round = 2;
        this.turnIndex = 0;
      } else {
        this.isDead = true; // صكّة ميتة - مرّت الجولتان بدون شراء
      }
    }
  }
}
