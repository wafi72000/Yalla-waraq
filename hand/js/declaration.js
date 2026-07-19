// declaration.js — سباق النزول التصاعدي (العتبة الديناميكية وتجميدها)

export const MINIMUM_FIRST_ENTRY = 91;

export class HandDeclaration {
  constructor() {
    this.declaredTotals = new Map(); // playerID -> total
    this.isThresholdFrozen = false;
    this.frozenThresholdValue = null;
  }

  get currentThreshold() {
    if (this.isThresholdFrozen) return this.frozenThresholdValue;
    if (this.declaredTotals.size === 0) return null;
    return Math.max(...this.declaredTotals.values());
  }

  get hasAnyDeclaration() {
    return this.declaredTotals.size > 0;
  }

  canEnterRace(proposedTotal) {
    const threshold = this.currentThreshold;
    if (threshold === null) return proposedTotal >= MINIMUM_FIRST_ENTRY;
    return proposedTotal > threshold;
  }

  enterRace(playerID, total) {
    if (!this.canEnterRace(total)) return false;
    this.declaredTotals.set(playerID, total);
    return true;
  }

  increaseOwnTotal(playerID, additionalPoints) {
    if (!this.declaredTotals.has(playerID)) return;
    this.declaredTotals.set(playerID, this.declaredTotals.get(playerID) + additionalPoints);
  }

  registerCrossPlayerAddition(adderID, meldOwnerID) {
    if (adderID === meldOwnerID) return;
    if (!this.declaredTotals.has(adderID) || !this.declaredTotals.has(meldOwnerID)) return;
    if (this.isThresholdFrozen) return;
    const currentMax = Math.max(...this.declaredTotals.values()); // لازم تُحسب قبل التجميد
    this.isThresholdFrozen = true;
    this.frozenThresholdValue = currentMax;
  }

  isPlayerInRace(playerID) {
    return this.declaredTotals.has(playerID);
  }

  reset() {
    this.declaredTotals = new Map();
    this.isThresholdFrozen = false;
    this.frozenThresholdValue = null;
  }
}
