/*
  core/rules_blackjack.js (v143D Step 4)
  ------------------------------------
  Owns:
    - Pure blackjack rule helpers (no DOM)
    - Hand totals (including multiple-ace handling)
    - Ten-value group logic
    - Blackjack detection
    - Split eligibility helper

  Does NOT:
    - Touch the DOM (no document/window sizing/layout)
    - Play sounds or trigger animations
    - Read or write UI state (buttons, modals, etc.)

  Why this exists:
    This is the first chunk of the "Model" layer. Desktop + Phone UIs should
    call these helpers instead of re-implementing them.
*/

(() => {
  window.BJ = window.BJ || {};
  BJ.rulesBJ = BJ.rulesBJ || {};

  const TEN_VALUE = new Set(["10", "J", "Q", "K"]);

  /** Returns the blackjack value for a single card (A=11, 10/J/Q/K=10). */
  function cardValue(c) {
    if (!c) return 0;
    if (c.r === "A") return 11;
    if (TEN_VALUE.has(c.r)) return 10;
    return Number(c.r);
  }

  /** True if rank is any 10-value card (10, J, Q, K). */
  function isTenGroup(r) {
    return TEN_VALUE.has(r);
  }

  /**
   * Computes the best blackjack total for a hand.
   * Aces are treated as 11 then reduced to 1 as needed.
   */
  function handTotal(hand) {
    let total = 0;
    let aces = 0;
    for (const c of (hand || [])) {
      if (c.r === "A") {
        aces++;
        total += 11;
      } else if (TEN_VALUE.has(c.r)) {
        total += 10;
      } else {
        total += Number(c.r);
      }
    }
    while (total > 21 && aces) {
      total -= 10;
      aces--;
    }
    return total;
  }

  /** Returns { total, soft } where soft indicates an Ace counted as 11. */
  function handTotalDetailed(hand) {
    let total = 0;
    let aces = 0;
    for (const c of (hand || [])) {
      if (c.r === "A") {
        aces++;
        total += 11;
      } else if (TEN_VALUE.has(c.r)) {
        total += 10;
      } else {
        total += Number(c.r);
      }
    }

    let reduced = 0;
    while (total > 21 && aces) {
      total -= 10;
      aces--;
      reduced++;
    }
    const soft = (reduced === 0) && (hand || []).some(c => c && c.r === "A") && total <= 21;
    return { total, soft };
  }

  /** Blackjack = exactly two cards totaling 21, except hands created from a split. */
  function isBlackjack(cards, fromSplit = false) {
    if (fromSplit) return false;
    if (!cards || cards.length !== 2) return false;
    const a = cards[0], b = cards[1];
    return (cardValue(a) + cardValue(b)) === 21;
  }

  /**
   * Split eligibility by VALUE (10-group rule):
   * - Any two 10-value cards are splittable (10/J/Q/K)
   * - Otherwise ranks must match.
   */
  function canSplitPair(a, b) {
    if (!a || !b) return false;
    const aTen = isTenGroup(a.r);
    const bTen = isTenGroup(b.r);
    if (aTen && bTen) return true;
    return a.r === b.r;
  }

  // Export
  BJ.rulesBJ.TEN_VALUE = TEN_VALUE;
  BJ.rulesBJ.cardValue = cardValue;
  BJ.rulesBJ.isTenGroup = isTenGroup;
  BJ.rulesBJ.handTotal = handTotal;
  BJ.rulesBJ.handTotalDetailed = handTotalDetailed;
  BJ.rulesBJ.isBlackjack = isBlackjack;
  BJ.rulesBJ.canSplitPair = canSplitPair;
})();
