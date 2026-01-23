// v93B: structural refactor scaffolding (no gameplay changes intended).
// DOM-agnostic card container classes to support future shoe/discard visuals and cleaner state management.

class CardHolder {
  constructor(cards = []) {
    this.cards = Array.isArray(cards) ? cards : [];
  }
  count() { return this.cards.length; }
  clear() { this.cards.length = 0; }
  peekTop() { return this.cards.length ? this.cards[this.cards.length - 1] : null; }
  takeTop() { return this.cards.pop() ?? null; }
  addTop(card) { if (card != null) this.cards.push(card); }
  addMany(cards) {
    if (!Array.isArray(cards)) return;
    for (const c of cards) this.addTop(c);
  }
}

class Shoe extends CardHolder {
  constructor(cards = [], opts = {}) {
    super(cards);
    this.decks = opts.decks ?? null;
    this.cutCardIndex = opts.cutCardIndex ?? null;
  }
  dealOne() { return this.takeTop(); }
  needsShuffle() {
    if (this.cutCardIndex == null) return false;
    return this.count() <= this.cutCardIndex;
  }
}

class DiscardPile extends CardHolder {}

class Hand extends CardHolder {
  constructor(cards = []) {
    super(cards);
    this.bet = 0;
    this.isDone = false;
    this.hasDoubled = false;
  }
}

window.BJ = window.BJ || {};
window.BJ.classes = { CardHolder, Shoe, DiscardPile, Hand };
