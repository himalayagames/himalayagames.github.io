/*
  core/engine.js
  -------------
  Goal (branch D refactor): introduce a DOM-free "game engine" boundary.

  Step 5 implementation notes:
  - This file is intentionally a *facade* over the existing v142C/v143D script.js
    game flow. It provides a stable API (getState/action/subscribe) WITHOUT
    changing gameplay.
  - In later steps, we'll migrate orchestration logic (deal/hit/stand/etc.) into
    this engine. For now, action() calls through to the existing global
    functions in script.js.

  Not allowed in this file:
  - DOM manipulation (document/querySelector/etc.)
  - CSS class toggles
  - Audio playback
  - Animations

  Public API:
    const game = BJ.engine.createGame();
    game.getState();
    await game.action('HIT');
    const unsubscribe = game.subscribe((state, info) => { ... });

  State shape (minimal for Step 5):
    {
      meta, bankroll, round, dealer, player, shoe
    }
*/

(() => {
  window.BJ = window.BJ || {};
  BJ.engine = BJ.engine || {};

  const ACTIONS = {
    NEW_SHOE: 'NEW_SHOE',
    START_ROUND: 'START_ROUND',
    HIT: 'HIT',
    STAND: 'STAND',
    DOUBLE: 'DOUBLE',
    SPLIT: 'SPLIT',
    SURRENDER: 'SURRENDER',
    INSURANCE_DECISION: 'INSURANCE_DECISION',
  };

  /**
   * Read state from the current (legacy) globals.
   * This keeps the UI and dev tools able to introspect via a single API.
   */
  function snapshotLegacyState() {
    const shoeState = (BJ.shoe && typeof BJ.shoe.getState === 'function')
      ? BJ.shoe.getState()
      : null;

    // These globals exist in the legacy script.js. We guard them so the engine
    // doesn't crash if something is renamed during refactor.
    const safe = (name, fallback) => (typeof window[name] !== 'undefined' ? window[name] : fallback);

    const bankroll = safe('bankroll', null);
    const bet = safe('bet', null);
    const inRound = safe('inRound', false);
    const holeDown = safe('holeDown', false);
    const dealerHand = safe('dealerHand', []);
    const dealerVisibleCount = safe('dealerVisibleCount', null);
    const hands = safe('hands', []);
    const activeHandIndex = safe('activeHandIndex', 0);

    return {
      meta: {
        engine: 'facade',
        refactorBranch: 'D',
      },
      bankroll: {
        bankroll,
        bet,
      },
      round: {
        inRound,
        holeDown,
      },
      dealer: {
        hand: Array.isArray(dealerHand) ? dealerHand.slice() : [],
        visibleCount: dealerVisibleCount,
      },
      player: {
        hands: Array.isArray(hands) ? hands.map(h => ({ ...h, cards: (h.cards || []).slice() })) : [],
        activeHandIndex,
      },
      shoe: shoeState,
    };
  }

  function defaultActionHandlers() {
    // These are the legacy global functions we already have.
    // We do NOT import or reference DOM here; we just call through.
    return {
      [ACTIONS.NEW_SHOE]: async () => {
        if (typeof window.newShoe === 'function') return window.newShoe();
        throw new Error('Engine facade: missing global function newShoe()');
      },
      [ACTIONS.START_ROUND]: async () => {
        if (typeof window.startRound === 'function') return window.startRound();
        throw new Error('Engine facade: missing global function startRound()');
      },
      [ACTIONS.HIT]: async () => {
        if (typeof window.onHit === 'function') return window.onHit();
        throw new Error('Engine facade: missing global function onHit()');
      },
      [ACTIONS.STAND]: async () => {
        if (typeof window.onStand === 'function') return window.onStand();
        throw new Error('Engine facade: missing global function onStand()');
      },
      [ACTIONS.DOUBLE]: async () => {
        if (typeof window.onDouble === 'function') return window.onDouble();
        throw new Error('Engine facade: missing global function onDouble()');
      },
      [ACTIONS.SPLIT]: async () => {
        if (typeof window.onSplit === 'function') return window.onSplit();
        throw new Error('Engine facade: missing global function onSplit()');
      },
      [ACTIONS.SURRENDER]: async () => {
        if (typeof window.onSurrender === 'function') return window.onSurrender();
        throw new Error('Engine facade: missing global function onSurrender()');
      },
      [ACTIONS.INSURANCE_DECISION]: async (payload) => {
        // In v142C this is handled inside the insurance modal handlers. We keep
        // a hook for later; for now this action is optional.
        if (typeof window.onInsuranceDecision === 'function') {
          return window.onInsuranceDecision(payload);
        }
        throw new Error('Engine facade: insurance decision not wired yet');
      },
    };
  }

  BJ.engine.ACTIONS = ACTIONS;

  BJ.engine.createGame = function createGame(config = {}) {
    const listeners = [];
    const adapter = config.adapter || null;
    const handlers = {
      ...defaultActionHandlers(),
      ...(config.handlers || {}),
    };

    function emitRoundSettled(){
      try{
        if(!adapter || typeof adapter.onRoundSettled !== 'function') return;
        const rsb = Number.isFinite(adapter.roundStartBankroll) ? Number(adapter.roundStartBankroll) : null;
        const b = Number.isFinite(adapter.bankroll) ? Number(adapter.bankroll) : null;
        const delta = (Number.isFinite(rsb) && Number.isFinite(b)) ? (b - rsb) : null;
        adapter.onRoundSettled({ bankrollAfter: b, delta });
      }catch(_e){ /* never break gameplay */ }
    }

    /**
     * Step 7A (branch D): DEAL/startRound sequencing begins moving into the engine.
     *
     * Constraints:
     * - Engine file stays DOM-free: it may call adapter hooks, but must not touch
     *   document/querySelector/etc. directly.
     * - No behavior change: we preserve legacy call order/timing.
     */
    async function startRoundInEngine() {
      if (!adapter) {
        // Fallback to legacy global if the host hasn't provided an adapter yet.
        if (typeof window.startRound === 'function') return window.startRound();
        throw new Error('Engine START_ROUND: missing adapter and missing global startRound()');
      }

      const F = adapter.fns || {};
      const UI = adapter.ui || {};

      // Mirror legacy startRound() exactly, but route all reads/writes through adapter.
      if (typeof F.clearHighlights === 'function') F.clearHighlights();
      if (typeof F.hidePopup === 'function') F.hidePopup();
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: init');

      // cancels any prior result-cycling loops
      if (typeof adapter.cycleToken === 'number') adapter.cycleToken++;

      // Clear any prior "continue hand / no new bets" state from a broke decision.
      adapter.noNewBets = false;

      // Reset round-specific state
      adapter.roundPopupOverride = null;
      adapter.insuranceBet = 0;
      adapter.insurancePending = false;
      adapter.insuranceResolve = null;

      adapter.dealerHand = [];
      adapter.holeDown = true;

      // bankroll accounting: commit initial bet immediately
      adapter.roundStartBankroll = adapter.bankroll;

      // Enforce $5 minimum and $5 increments for the main bet.
      if (adapter.bankroll < 5) {
        if (typeof F.showFundsModal === 'function') {
          F.showFundsModal({
            title: 'Insufficient Funds',
            note: 'Minimum bet is $5.',
            allowContinue: false,
          });
          return;
        }
        return;
      }

      // Ensure bet is a multiple of $5 and not above bankroll.
      adapter.bet = Math.max(5, Math.floor(adapter.bet / 5) * 5);
      if (adapter.bet > adapter.bankroll) adapter.bet = Math.floor(adapter.bankroll / 5) * 5;
      adapter.bet = Math.max(5, adapter.bet);

      if (typeof F.roundMoney === 'function') {
        adapter.bankroll = Math.max(0, F.roundMoney(adapter.bankroll - adapter.bet));
      } else {
        adapter.bankroll = Math.max(0, (adapter.bankroll - adapter.bet));
      }
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: bet deducted, about to deal');

      // Opening hand state
      adapter.hands = [{
        cards: [],
        isAceSplit: false,
        done: false,
        outcome: null,
        wager: adapter.bet,
        fromSplit: false,
        acted: false,
        surrendered: false,
      }];
      adapter.activeHandIndex = 0;
      adapter.doubledThisHand = false;
      adapter.inRound = true;

      // Now that the round is officially live, HUD can compute Chips in Action.
      if (typeof F.updateHud === 'function') F.updateHud();

      // Deal pattern: P1, D up, P2, D hole
      const draw = (typeof F.draw === 'function') ? F.draw : (typeof window.draw === 'function' ? window.draw : null);
      if (!draw) throw new Error('Engine START_ROUND: missing draw()');

      const p1 = draw();
      adapter.hands[0].cards.push(p1);

      // v131C: Player total updates only after the new card is flipped/visible
      if (typeof F.beginPlayerTotalHold === 'function') F.beginPlayerTotalHold(adapter.hands[0].cards.length - 1);
      if (typeof F.renderHands === 'function') F.renderHands();
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: renderHands() done');
      if (typeof F.animateLastDealtCard === 'function') await F.animateLastDealtCard(UI.playerLane, true);
      if (typeof F.endPlayerTotalHold === 'function') F.endPlayerTotalHold();
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: player card animated');

      // If we're running insurance tests, force the dealer upcard to an Ace.
      const forceInsurance = !!(adapter.DEV_TOOLS_ENABLED && (adapter.testInsuranceMode === 'bj' || adapter.testInsuranceMode === 'noBj'));
      const drawSpecific = (typeof F.drawSpecific === 'function') ? F.drawSpecific : (typeof window.drawSpecific === 'function' ? window.drawSpecific : null);
      const d1 = (forceInsurance && drawSpecific) ? drawSpecific({ s: 'spades', r: 'A' }) : draw();
      adapter.dealerHand.push(d1);

      if (typeof F.renderHands === 'function') F.renderHands();
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: renderHands() done');
      if (typeof F.animateLastDealtCard === 'function') await F.animateLastDealtCard(UI.dealerLane, true);
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: dealer upcard animated');

      let p2;
      const drawMatching = (typeof F.drawMatching === 'function') ? F.drawMatching : (typeof window.drawMatching === 'function' ? window.drawMatching : null);
      if (adapter.testSplits && drawMatching) {
        p2 = drawMatching(p1);
      } else {
        p2 = draw();
      }
      adapter.hands[0].cards.push(p2);

      if (typeof F.beginPlayerTotalHold === 'function') F.beginPlayerTotalHold(adapter.hands[0].cards.length - 1);
      if (typeof F.renderHands === 'function') F.renderHands();
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: renderHands() done');
      if (typeof F.animateLastDealtCard === 'function') await F.animateLastDealtCard(UI.playerLane, true);
      if (typeof F.endPlayerTotalHold === 'function') F.endPlayerTotalHold();
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: player card animated');

      // For insurance tests, force the dealer hole card.
      const d2 = forceInsurance
        ? (adapter.testInsuranceMode === 'bj'
          ? (drawSpecific ? drawSpecific({ s: 'hearts', r: 'K' }) : draw())
          : (drawSpecific ? drawSpecific({ s: 'hearts', r: '9' }) : draw()))
        : draw();
      adapter.dealerHand.push(d2);

      if (typeof F.renderHands === 'function') F.renderHands();
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: renderHands() done');
      // Dealer hole stays face down.
      if (typeof F.animateLastDealtCard === 'function') await F.animateLastDealtCard(UI.dealerLane, false);
      if (typeof F.dbgStep === 'function') F.dbgStep('startRound: dealer hole animated');
      if (typeof F.pause === 'function') await F.pause(80);

      // Step 7D3: Insurance/peek logic now lives in the engine (DOM-free).
      // UI supplies modal/popup hooks via the adapter.
      const endedEarly = await offerInsuranceAndPeekInEngine();
      if (endedEarly) return;

      if (typeof F.setButtons === 'function') F.setButtons();
    }

    /**
     * Step 7D3: Move insurance + dealer peek + early blackjack settlements into the engine.
     *
     * Returns true if the round ends immediately (dealer blackjack, player blackjack).
     */
    async function offerInsuranceAndPeekInEngine() {
      if (!adapter) return false;
      const F = adapter.fns || {};

      const up = (adapter.dealerHand && adapter.dealerHand[0]) ? adapter.dealerHand[0] : null;
      const h0 = (adapter.hands && adapter.hands[0]) ? adapter.hands[0] : null;
      if (!up || !h0) return false;

      const rules = (window.BJ && BJ.rulesBJ) ? BJ.rulesBJ : null;
      const isBJ = rules && typeof rules.isBlackjack === 'function' ? rules.isBlackjack : null;
      const isTenGroup = rules && typeof rules.isTenGroup === 'function' ? rules.isTenGroup : null;
      if (!isBJ || !isTenGroup) return false;

      const playerBJ = isBJ(h0.cards, !!h0.fromSplit);

      // Offer insurance only if dealer shows Ace.
      if (up.r === 'A') {
        const maxIns = (h0.wager || adapter.bet) / 2;
        const capRaw = Math.max(0, Math.min(maxIns, adapter.bankroll));
        const cap = clampToHalfDollar(capRaw);

        // UI modal returns the chosen insurance amount (0 = decline).
        const awaitInsuranceEngine = (typeof F.awaitInsuranceEngine === 'function')
          ? F.awaitInsuranceEngine
          : null;
        if (awaitInsuranceEngine) {
          const amt = await awaitInsuranceEngine(cap);
          const betAmt = clampToHalfDollar(Math.max(0, Math.min(Number(amt) || 0, Math.min(cap, adapter.bankroll))));
          adapter.insuranceBet = betAmt;
          if (betAmt > 0) {
            if (typeof F.roundMoney === 'function') {
              adapter.bankroll = Math.max(0, F.roundMoney(adapter.bankroll - betAmt));
            } else {
              adapter.bankroll = Math.max(0, (adapter.bankroll - betAmt));
            }
            if (typeof F.updateHud === 'function') F.updateHud();
          }
        } else {
          // Fallback: if no engine-mode modal is provided, use legacy flow.
          const legacy = (typeof F.maybeOfferInsuranceAndPeek === 'function')
            ? F.maybeOfferInsuranceAndPeek
            : (typeof window.maybeOfferInsuranceAndPeek === 'function' ? window.maybeOfferInsuranceAndPeek : null);
          if (legacy) return !!(await legacy());
        }
      }

      // Dealer peeks for blackjack when showing Ace or 10-value.
      const showsAce = (up.r === 'A');
      const showsTen = isTenGroup(up.r);
      if (showsAce || showsTen) {
        const dealerBJ = isBJ([adapter.dealerHand[0], adapter.dealerHand[1]], false);
        if (dealerBJ) {
          await settleDealerBlackjackInEngine(playerBJ);
          return true;
        }
        // If insurance was purchased and dealer does NOT have blackjack, settle insurance now.
        if (showsAce && adapter.insuranceBet > 0) {
          if (typeof F.showInsuranceResultModal === 'function') {
            await F.showInsuranceResultModal('You lose insurance!');
          }
          adapter.insuranceBet = 0;
        }
      }

      // If player has blackjack and dealer does not, pay 3:2 now.
      if (playerBJ) {
        await settlePlayerBlackjackInEngine();
        return true;
      }

      return false;
    }

    function clampToHalfDollar(v) {
      if (!Number.isFinite(v)) return 0;
      const x = Math.round(v * 2) / 2;
      // Avoid floating drift.
      return Math.round(x * 100) / 100;
    }

    async function settleDealerBlackjackInEngine(playerBJ) {
      const F = adapter.fns || {};
      const myToken = adapter.cycleToken;

      // Reveal hole card visually, but delay total update until after the short pause.
      adapter.dealerTotalHold = true;
      adapter.dealerVisibleCount = 1;
      adapter.holeDown = false;
      if (typeof F.renderHands === 'function') F.renderHands();

      if (typeof F.pause === 'function') await F.pause(220);

      adapter.dealerVisibleCount = (adapter.dealerHand || []).length;
      adapter.dealerTotalHold = false;
      if (typeof F.updateLabels === 'function') F.updateLabels();

      // Insurance resolves only on dealer blackjack.
      if (adapter.insuranceBet > 0) {
        const insWin = adapter.insuranceBet * 2;
        if (typeof F.roundMoney === 'function') {
          adapter.bankroll = F.roundMoney(adapter.bankroll + (adapter.insuranceBet * 3));
        } else {
          adapter.bankroll = adapter.bankroll + (adapter.insuranceBet * 3);
        }
        if (typeof F.updateHud === 'function') F.updateHud();
        if (typeof F.showInsuranceResultModal === 'function') {
          await F.showInsuranceResultModal(`You won insurance! You win $${insWin}`);
        }
        adapter.insuranceBet = 0;
      }

      // Main hand outcome
      const h0 = adapter.hands[0];
      if (playerBJ) {
        h0.outcome = 'push';
        if (typeof F.roundMoney === 'function') {
          adapter.bankroll = F.roundMoney(adapter.bankroll + (h0.wager || adapter.bet));
        } else {
          adapter.bankroll = adapter.bankroll + (h0.wager || adapter.bet);
        }
      } else {
        h0.outcome = 'lose';
      }

      if (typeof F.updateHud === 'function') F.updateHud();

      const delta = adapter.bankroll - adapter.roundStartBankroll;
      const label = (delta > 0) ? 'Win' : (delta < 0) ? 'Lose' : 'Push';
      if (typeof F.showResultPopup === 'function') {
        F.showResultPopup(`${label} $${Math.abs(delta)}`);
      }

      adapter.inRound = false;
  emitRoundSettled();
      if (typeof F.updateHud === 'function') F.updateHud();
      if (typeof F.setButtons === 'function') F.setButtons();
      if (typeof F.maybeShowFundsModalWhenBroke === 'function') F.maybeShowFundsModalWhenBroke();

      if (typeof F.applyOutcomeHighlight === 'function') {
        F.applyOutcomeHighlight(playerBJ ? 'push' : 'lose');
      }
      if (typeof F.cycleResults === 'function') {
        F.cycleResults(myToken);
      }
    }

    async function settlePlayerBlackjackInEngine() {
      const F = adapter.fns || {};
      const myToken = adapter.cycleToken;
      const h0 = adapter.hands[0];
      const w = h0.wager || adapter.bet;

      // Player blackjack payout 3:2 (wager already deducted)
      const payout = Math.floor(w * 2.5);
      if (typeof F.roundMoney === 'function') {
        adapter.bankroll = F.roundMoney(adapter.bankroll + payout);
      } else {
        adapter.bankroll = adapter.bankroll + payout;
      }
      h0.outcome = 'win';
      if (typeof F.updateHud === 'function') F.updateHud();

      const delta = adapter.bankroll - adapter.roundStartBankroll;
      if (typeof F.showResultPopup === 'function') {
        F.showResultPopup(`Blackjack! You win $${Math.abs(delta)}`);
      }

      adapter.inRound = false;
  emitRoundSettled();
      if (typeof F.updateHud === 'function') F.updateHud();
      if (typeof F.setButtons === 'function') F.setButtons();
      if (typeof F.maybeShowFundsModalWhenBroke === 'function') F.maybeShowFundsModalWhenBroke();
      if (typeof F.applyOutcomeHighlight === 'function') F.applyOutcomeHighlight('win');
      if (typeof F.cycleResults === 'function') F.cycleResults(myToken);
    }

    /**
     * Step 7B (branch D): HIT sequencing moves into the engine.
     *
     * Constraints:
     * - Engine stays DOM-free (call adapter hooks only).
     * - No behavior change: preserve legacy onHit() flow.
     */
    async function hitInEngine() {
      if (!adapter) {
        if (typeof window.onHit === 'function') return window.onHit();
        throw new Error('Engine HIT: missing adapter and missing global onHit()');
      }

      const F = adapter.fns || {};
      const UI = adapter.ui || {};

      const hands = Array.isArray(adapter.hands) ? adapter.hands : [];
      const idx = Number.isFinite(adapter.activeHandIndex) ? adapter.activeHandIndex : 0;
      const h = hands[idx];
      if (!h) return;
      h.acted = true;

      const draw = (typeof F.draw === 'function') ? F.draw : (typeof window.draw === 'function' ? window.draw : null);
      if (!draw) throw new Error('Engine HIT: missing draw()');

      h.cards = Array.isArray(h.cards) ? h.cards : [];
      h.cards.push(draw());

      if (typeof F.beginPlayerTotalHold === 'function') F.beginPlayerTotalHold(h.cards.length - 1);
      if (typeof F.renderHands === 'function') F.renderHands();
      if (typeof F.animateLastDealtCard === 'function') await F.animateLastDealtCard(UI.playerLane, true);
      if (typeof F.endPlayerTotalHold === 'function') F.endPlayerTotalHold();

      const ht = (window.BJ && BJ.rulesBJ && typeof BJ.rulesBJ.handTotal === 'function')
        ? BJ.rulesBJ.handTotal
        : null;
      const total = ht ? ht(h.cards) : null;

      if (typeof total === 'number' && total > 21) {
        // Bust
        h.outcome = 'lose';
        h.busted = true;
        const w = h.wager || adapter.bet;

        // Immediate bust popup for single-hand rounds (avoid duplicate end-of-round popups).
        if (hands.length === 1) {
          adapter.roundPopupOverride = { type: 'playerBust', amount: Math.abs(w) };
          if (typeof F.showResultPopup === 'function') {
            F.showResultPopup(`Bust! Lose $${Math.abs(w)}`);
          }
        }

        if (typeof F.finishHand === 'function') F.finishHand();
        if (typeof F.setButtons === 'function') F.setButtons();
        await nextHandOrDealerInEngine();
        return;
      }

      // If split aces: should have been auto-stand already; safeguard
      if (typeof F.setButtons === 'function') F.setButtons();
    }

/**
 * Step 7D1 (branch D): DOUBLE sequencing moves into the engine.
 *
 * Constraints:
 * - Engine stays DOM-free (call adapter hooks only).
 * - No behavior change: preserve legacy onDouble() flow.
 */
async function doubleInEngine() {
  if (!adapter) {
    if (typeof window.onDouble === 'function') return window.onDouble();
    throw new Error('Engine DOUBLE: missing adapter and missing global onDouble()');
  }

  const F = adapter.fns || {};
  const UI = adapter.ui || {};

  const hands = Array.isArray(adapter.hands) ? adapter.hands : [];
  const idx = Number.isFinite(adapter.activeHandIndex) ? adapter.activeHandIndex : 0;
  const h = hands[idx];
  if (!h || !Array.isArray(h.cards) || h.cards.length !== 2) return;

  const baseBet = adapter.bet;
  const add = h.wager || baseBet;

  if (adapter.bankroll < add) {
    if (typeof F.showFundsModal === 'function') {
      F.showFundsModal({
        title: 'Insufficient Funds',
        note: 'Add chips to DOUBLE, or continue the hand.',
        allowContinue: true,
        reason: 'action',
        afterAdd: () => {
          // Mirror legacy: retry DOUBLE if still in round.
          try {
            if (adapter.inRound && window.BJ && BJ.game && BJ.engine) {
              BJ.game.action(BJ.engine.ACTIONS.DOUBLE);
            }
          } catch (_e) {}
        },
      });
    }
    return;
  }

  // Action is now committed.
  h.acted = true;

  const roundMoney = (typeof F.roundMoney === 'function')
    ? F.roundMoney
    : (typeof window.roundMoney === 'function' ? window.roundMoney : (x) => x);

  // Deduct additional wager and double the hand wager.
  adapter.bankroll = Math.max(0, roundMoney(adapter.bankroll - add));
  h.wager = (h.wager || baseBet) * 2;

  if (typeof F.updateHud === 'function') F.updateHud();

  adapter.doubledThisHand = true;

  const draw = (typeof F.draw === 'function') ? F.draw : (typeof window.draw === 'function' ? window.draw : null);
  if (!draw) throw new Error('Engine DOUBLE: missing draw()');

  h.cards.push(draw());

  if (typeof F.beginPlayerTotalHold === 'function') F.beginPlayerTotalHold(h.cards.length - 1);
  if (typeof F.renderHands === 'function') F.renderHands();
  if (typeof F.animateLastDealtCard === 'function') await F.animateLastDealtCard(UI.playerLane, true);
  if (typeof F.endPlayerTotalHold === 'function') F.endPlayerTotalHold();

  // Bust handling (match HIT behavior): show immediate bust popup for single-hand rounds
  // so the player gets feedback even when dealer settlement short-circuits.
  const R = _rules();
  const handTotal = (typeof R.handTotal === 'function') ? R.handTotal : (typeof window.handTotal === 'function' ? window.handTotal : null);
  if (handTotal && handTotal(h.cards) > 21) {
    h.outcome = 'lose';
    h.busted = true;
    const w = h.wager || baseBet;

    // Immediate bust popup for single-hand rounds (avoid duplicate end-of-round popups).
    if (hands.length === 1 && typeof F.showResultPopup === 'function') {
      adapter.roundPopupOverride = { type: 'playerBust', amount: Math.abs(w) };
      F.showResultPopup('Bust! Lose $' + Math.abs(w));
    }
  }

  if (typeof F.finishHand === 'function') F.finishHand();
  if (typeof F.setButtons === 'function') F.setButtons();
  await nextHandOrDealerInEngine();
}
// Step 7D2: SPLIT migration (engine owns split state transitions).
async function splitInEngine() {
  if (!adapter) {
    if (typeof window.onSplit === 'function') return window.onSplit();
    throw new Error('Engine SPLIT: missing adapter and missing global onSplit()');
  }

  const F = adapter.fns || {};
  const UI = adapter.ui || {};

  if (!adapter.inRound) return;

  const hands = Array.isArray(adapter.hands) ? adapter.hands : [];
  const idx = Number.isFinite(adapter.activeHandIndex) ? adapter.activeHandIndex : 0;
  const h = hands[idx];
  if (!h || !Array.isArray(h.cards) || h.cards.length !== 2) return;

  // Casino rule: maximum total split hands reached.
  const MAX_SPLIT_HANDS = 4; // matches legacy const in script.js
  if (hands.length >= MAX_SPLIT_HANDS) return;

  const a = h.cards[0];
  const b = h.cards[1];
  const canSplitPair = (window.BJ && BJ.rulesBJ && typeof BJ.rulesBJ.canSplitPair === 'function')
    ? BJ.rulesBJ.canSplitPair
    : null;
  if (!canSplitPair || !canSplitPair(a, b)) return;

  const baseWager = h.wager || adapter.bet;

  if (adapter.bankroll < baseWager) {
    if (typeof F.showFundsModal === 'function') {
      F.showFundsModal({
        title: 'Insufficient Funds',
        note: 'Add chips to SPLIT, or continue the hand.',
        allowContinue: true,
        reason: 'action',
        afterAdd: () => {
          // Mirror legacy: retry SPLIT if still in round.
          try {
            if (adapter.inRound && window.BJ && BJ.game && BJ.engine) {
              BJ.game.action(BJ.engine.ACTIONS.SPLIT);
            }
          } catch (_e) {}
        },
      });
    }
    return;
  }

  // Action is now committed.
  h.acted = true;
  if (typeof F.roundMoney === 'function') {
    adapter.bankroll = Math.max(0, F.roundMoney(adapter.bankroll - baseWager));
  } else {
    adapter.bankroll = Math.max(0, adapter.bankroll - baseWager);
  }
  if (typeof F.updateHud === 'function') F.updateHud();

  const splittingAces = (a && b && a.r === 'A' && b.r === 'A');

  const first  = {cards:[a], isAceSplit:splittingAces, done:false, outcome:null, wager: baseWager, fromSplit:true, acted:false, surrendered:false, needsSplitCard:false};
  const second = {cards:[b], isAceSplit:splittingAces, done:false, outcome:null, wager: baseWager, fromSplit:true, acted:false, surrendered:false, needsSplitCard:true};

  // Replace current hand with two split hands.
  hands.splice(idx, 1, first, second);
  adapter.hands = hands;

  // v140C behavior: deal/animate ONLY the active (first) split hand's next card.
  if (typeof F.draw === 'function') {
    first.cards.push(F.draw());
  }
  if (typeof F.beginPlayerTotalHold === 'function') {
    F.beginPlayerTotalHold(first.cards.length - 1);
  }
  if (typeof F.renderHands === 'function') F.renderHands();
  if (typeof F.animateLastDealtCard === 'function') {
    await F.animateLastDealtCard(UI.playerLane, true);
  }
  if (typeof F.endPlayerTotalHold === 'function') F.endPlayerTotalHold();

  // Splitting aces: each hand gets one card then stands (unless it becomes AA again).
  if (splittingAces && first.cards.length === 2) {
    const firstIsAA = first.cards[0].r === 'A' && first.cards[1].r === 'A';
    if (!firstIsAA) {
      first.done = true;
      first.acted = true;
      if (typeof F.setButtons === 'function') F.setButtons();
      await nextHandOrDealerInEngine();
      return;
    }
  }

  adapter.doubledThisHand = false;
  if (typeof F.renderHands === 'function') F.renderHands();
  if (typeof F.setButtons === 'function') F.setButtons();
}



/**
 * Step 7C (branch D): Round flow moves further into the engine.
 * - Engine owns STAND + advancing between split hands + dealer play + settlement.
 * - UI remains responsible for rendering/animations/popups via adapter hooks.
 *
 * Constraints:
 * - Engine stays DOM-free (call adapter hooks only).
 * - No behavior change intended: preserve legacy sequencing.
 */

function _rules() {
  return (window.BJ && BJ.rulesBJ) ? BJ.rulesBJ : {};
}

async function nextHandOrDealerInEngine() {
  if (!adapter) {
    if (typeof window.nextHandOrDealer === 'function') return window.nextHandOrDealer();
    throw new Error('Engine nextHandOrDealer: missing adapter and missing global nextHandOrDealer()');
  }

  const F = adapter.fns || {};
  const UI = adapter.ui || {};

  const hands = Array.isArray(adapter.hands) ? adapter.hands : [];
  const prevIndex = Number.isFinite(adapter.activeHandIndex) ? adapter.activeHandIndex : 0;
  const prevDone = !!(hands && hands[prevIndex] && hands[prevIndex].done);

  const pause = (typeof F.pause === 'function') ? F.pause : (typeof window.pause === 'function' ? window.pause : null);
  const draw = (typeof F.draw === 'function') ? F.draw : (typeof window.draw === 'function' ? window.draw : null);
  if (!draw) throw new Error('Engine nextHandOrDealer: missing draw()');

  // Find next unfinished hand
  for (let i = 0; i < hands.length; i++) {
    if (!hands[i].done) {
      // Only pause when advancing from a finished hand to a different hand.
      if (hands.length > 1 && prevDone && i !== prevIndex) {
        if (pause) await pause(500);
      }

      adapter.activeHandIndex = i;
      adapter.doubledThisHand = false;

      // If this hand needs its post-split card, deal/animate now.
      if (hands[i].needsSplitCard) {
        hands[i].needsSplitCard = false;
        hands[i].cards = Array.isArray(hands[i].cards) ? hands[i].cards : [];
        hands[i].cards.push(draw());

        if (typeof F.beginPlayerTotalHold === 'function') F.beginPlayerTotalHold(hands[i].cards.length - 1);
        if (typeof F.renderHands === 'function') F.renderHands();
        if (typeof F.animateLastDealtCard === 'function') await F.animateLastDealtCard(UI.playerLane, true);
        if (typeof F.endPlayerTotalHold === 'function') F.endPlayerTotalHold();

        // Splitting aces: each hand receives one card then stands (unless it becomes AA again).
        if (hands[i].isAceSplit && hands[i].cards.length === 2) {
          const aa = hands[i].cards[0].r === 'A' && hands[i].cards[1].r === 'A';
          if (!aa) {
            hands[i].done = true;
            hands[i].acted = true;
            if (typeof F.renderHands === 'function') F.renderHands();
            if (typeof F.setButtons === 'function') F.setButtons();
            // Move immediately to the next hand (or dealer) after auto-standing.
            await nextHandOrDealerInEngine();
            return;
          }
        }
      }

      if (typeof F.renderHands === 'function') F.renderHands();
      if (typeof F.setButtons === 'function') F.setButtons();
      return;
    }
  }

  // All hands done -> dealer plays + settle
  await dealerPlayAndSettleInEngine();
}

async function dealerPlayAndSettleInEngine() {
  if (!adapter) {
    if (typeof window.dealerPlayAndSettle === 'function') return window.dealerPlayAndSettle();
    if (typeof window.dealerPlayAndSettleInEngine === 'function') return window.dealerPlayAndSettleInEngine();
    throw new Error('Engine dealerPlayAndSettle: missing adapter and missing legacy dealerPlayAndSettle()');
  }

  const F = adapter.fns || {};
  const UI = adapter.ui || {};
  const R = _rules();

  const handTotal = (typeof R.handTotal === 'function') ? R.handTotal : (typeof window.handTotal === 'function' ? window.handTotal : null);
  const handTotalDetailed = (typeof R.handTotalDetailed === 'function') ? R.handTotalDetailed : (typeof window.handTotalDetailed === 'function' ? window.handTotalDetailed : null);
  const isBlackjack = (typeof R.isBlackjack === 'function') ? R.isBlackjack : (typeof window.isBlackjack === 'function' ? window.isBlackjack : null);

  const draw = (typeof F.draw === 'function') ? F.draw : (typeof window.draw === 'function' ? window.draw : null);
  if (!draw) throw new Error('Engine dealerPlayAndSettle: missing draw()');

  const pause = (typeof F.pause === 'function') ? F.pause : (typeof window.pause === 'function' ? window.pause : null);
  const updateLabels = (typeof F.updateLabels === 'function') ? F.updateLabels : (typeof window.updateLabels === 'function' ? window.updateLabels : null);
  const animateRevealDealerHoleCard = (typeof F.animateRevealDealerHoleCard === 'function')
    ? F.animateRevealDealerHoleCard
    : (typeof window.animateRevealDealerHoleCard === 'function' ? window.animateRevealDealerHoleCard : null);

  const myToken = adapter.cycleToken;

  // Reveal hole (animate flip; only update totals after the reveal is visibly complete)
  adapter.dealerTotalHold = true;
  adapter.dealerVisibleCount = 1;

  // Keep internal state face-down while we animate, so totals stay frozen to the upcard.
  // We will flip the visual + then commit holeDown=false at the midpoint.
  adapter.holeDown = true;
  if (typeof F.renderHands === 'function') F.renderHands();

  if (animateRevealDealerHoleCard) await animateRevealDealerHoleCard();
  adapter.holeDown = false;

  // Now the 2-card dealer hand is fully visible.
  adapter.dealerVisibleCount = Array.isArray(adapter.dealerHand) ? adapter.dealerHand.length : 0;
  adapter.dealerTotalHold = false;
  if (updateLabels) updateLabels();

  const hands = Array.isArray(adapter.hands) ? adapter.hands : [];

  // v91: If EVERY player hand has already busted, end immediately (dealer does not draw more).
  const allPlayerBusted = (handTotal && hands.length)
    ? hands.every(h => handTotal(h.cards) > 21)
    : false;

  if (allPlayerBusted) {
    for (const h of hands) h.outcome = 'lose';

    if (typeof F.updateHud === 'function') F.updateHud();

    // If this was a split round, legacy behavior is to still show the split-results
    // summary popup, even though dealer settlement short-circuits.
    const dv0 = handTotal ? handTotal(adapter.dealerHand) : 0;
    const delta0 = adapter.bankroll - adapter.roundStartBankroll;
    if (hands.length > 1) {
      if (typeof F.buildSplitResultsNode === 'function' && typeof F.showResultPopupNode === 'function') {
        const node = F.buildSplitResultsNode(dv0, hands, delta0);
        F.showResultPopupNode(node);
      }
    } else {
      // Single-hand rounds likely already showed an immediate bust popup (HIT/DOUBLE).
      // If not, fall back to a generic Lose popup.
      if (!adapter.roundPopupOverride && typeof F.showResultPopup === 'function') {
        const roundTotalsBlock = (typeof F.roundTotalsBlock === 'function')
          ? F.roundTotalsBlock
          : (typeof window.roundTotalsBlock === 'function' ? window.roundTotalsBlock : (() => ''));
        F.showResultPopup(`Lose $${Math.abs(delta0)}` + roundTotalsBlock());
      }
    }

    adapter.inRound = false;
  emitRoundSettled();
    if (typeof F.updateHud === 'function') F.updateHud();
    if (typeof F.setButtons === 'function') F.setButtons();

    if (typeof F.maybeShowFundsModalWhenBroke === 'function') F.maybeShowFundsModalWhenBroke();

    if (typeof F.applyOutcomeHighlight === 'function') F.applyOutcomeHighlight('lose');
    if (typeof F.cycleResults === 'function') await F.cycleResults(myToken);
    return;
  }

  // Dealer hits to 17; soft-17 rule configurable (S17/H17)
  while (true) {
    const dt = handTotalDetailed ? handTotalDetailed(adapter.dealerHand) : null;
    const total = dt ? dt.total : (handTotal ? handTotal(adapter.dealerHand) : 0);
    const soft = dt ? !!dt.soft : false;

    const mustHit = (total < 17) || (window.RULE_HIT_SOFT_17 && total === 17 && soft);
    if (!mustHit) break;

    const prevCount = adapter.dealerHand.length;
    adapter.dealerHand.push(draw());

    // Freeze dealer total until the newly dealt card is fully in place.
    adapter.dealerTotalHold = true;
    adapter.dealerVisibleCount = prevCount;

    if (typeof F.renderHands === 'function') F.renderHands();
    if (typeof F.animateLastDealtCard === 'function') await F.animateLastDealtCard(UI.dealerLane, true);

    adapter.dealerVisibleCount = adapter.dealerHand.length;
    adapter.dealerTotalHold = false;
    if (updateLabels) updateLabels();
  }

  const dv = handTotal ? handTotal(adapter.dealerHand) : 0;

  for (const h of hands) {
    const pv = handTotal ? handTotal(h.cards) : 0;
    const bj = isBlackjack ? isBlackjack(h.cards, !!h.fromSplit) : false;

    let out = 'lose';
    if (pv > 21) out = 'lose';
    else if (dv > 21) out = 'win';
    else if (pv > dv) out = 'win';
    else if (pv < dv) out = 'lose';
    else out = 'push';

    if (out === 'win' && bj) out = 'blackjack';
    h.outcome = out;
  }

  // Settle bankroll (initial wager already deducted at round start)
  for (const h of hands) {
    const w = h.wager || adapter.bet;
    if (h.outcome === 'win') {
      adapter.bankroll = (typeof F.roundMoney === 'function') ? F.roundMoney(adapter.bankroll + (2 * w)) : (adapter.bankroll + (2 * w));
    } else if (h.outcome === 'push') {
      adapter.bankroll = (typeof F.roundMoney === 'function') ? F.roundMoney(adapter.bankroll + w) : (adapter.bankroll + w);
    } else if (h.outcome === 'blackjack') {
      adapter.bankroll = (typeof F.roundMoney === 'function') ? F.roundMoney(adapter.bankroll + (2.5 * w)) : (adapter.bankroll + (2.5 * w));
    }
  }
  if (typeof F.updateHud === 'function') F.updateHud();

  // Popup message (net for the round)
  const delta = adapter.bankroll - adapter.roundStartBankroll;

  // If this was a split round, hold popups until the end and show a single summary.
  if (hands.length > 1) {
    if (typeof F.buildSplitResultsNode === 'function' && typeof F.showResultPopupNode === 'function') {
      const node = F.buildSplitResultsNode(dv, hands, delta);
      F.showResultPopupNode(node);
    }
    adapter.inRound = false;
  emitRoundSettled();
    if (typeof F.updateHud === 'function') F.updateHud();
    if (typeof F.setButtons === 'function') F.setButtons();
    if (typeof F.maybeShowFundsModalWhenBroke === 'function') F.maybeShowFundsModalWhenBroke();
    if (typeof F.cycleResults === 'function') await F.cycleResults(myToken);
    return;
  }

  // Special-case popups to avoid duplicates
  const roundTotalsBlock = (typeof F.roundTotalsBlock === 'function') ? F.roundTotalsBlock : (typeof window.roundTotalsBlock === 'function' ? window.roundTotalsBlock : (() => ''));
  if (dv > 21 && delta > 0) {
    // Dealer bust: show only this message (no generic Win popup)
    adapter.roundPopupOverride = { type: 'dealerBust', amount: Math.abs(delta) };
    if (typeof F.showResultPopup === 'function') {
      F.showResultPopup(`Dealer busts! Win $${Math.abs(delta)}` + roundTotalsBlock());
    }
  } else if (
    adapter.roundPopupOverride &&
    adapter.roundPopupOverride.type === 'playerBust' &&
    hands.length === 1 &&
    delta < 0
  ) {
    // Player bust already showed immediate Lose popup; suppress generic Lose popup.
  } else {
    let label;
    if (hands.length === 1 && hands[0].outcome === 'blackjack' && delta > 0) label = 'Blackjack';
    else if (delta > 0) label = 'Win';
    else if (delta < 0) label = 'Lose';
    else label = 'Push';

    if (typeof F.showResultPopup === 'function') {
      F.showResultPopup(`${label} $${Math.abs(delta)}` + roundTotalsBlock());
    }
  }

  adapter.inRound = false;
  emitRoundSettled();
  if (typeof F.updateHud === 'function') F.updateHud();
  if (typeof F.setButtons === 'function') F.setButtons();
  if (typeof F.maybeShowFundsModalWhenBroke === 'function') F.maybeShowFundsModalWhenBroke();

  if (typeof F.cycleResults === 'function') await F.cycleResults(myToken);
}

async function standInEngine() {
  if (!adapter) {
    if (typeof window.onStand === 'function') return window.onStand();
    throw new Error('Engine STAND: missing adapter and missing global onStand()');
  }

  const F = adapter.fns || {};

  const hands = Array.isArray(adapter.hands) ? adapter.hands : [];
  const idx = Number.isFinite(adapter.activeHandIndex) ? adapter.activeHandIndex : 0;
  const h = hands[idx];
  if (h) h.acted = true;

  if (typeof F.finishHand === 'function') F.finishHand();
  if (typeof F.setButtons === 'function') F.setButtons();
  await nextHandOrDealerInEngine();
}
    // If host provides an adapter and did not override START_ROUND explicitly,
    // use the new engine-owned implementation.
    if (adapter && !Object.prototype.hasOwnProperty.call((config.handlers || {}), ACTIONS.START_ROUND)) {
      handlers[ACTIONS.START_ROUND] = startRoundInEngine;
    }

    // Step 7B: If host provides an adapter and did not override HIT explicitly,
    // use the new engine-owned implementation.
    if (adapter && !Object.prototype.hasOwnProperty.call((config.handlers || {}), ACTIONS.HIT)) {
      handlers[ACTIONS.HIT] = hitInEngine;
    }


// Step 7D1: If host provides an adapter and did not override DOUBLE explicitly,
// use the new engine-owned implementation.
if (adapter && !Object.prototype.hasOwnProperty.call((config.handlers || {}), ACTIONS.DOUBLE)) {
  handlers[ACTIONS.DOUBLE] = doubleInEngine;
}

// Step 7D2: If host provides an adapter and did not override SPLIT explicitly,
// use the new engine-owned implementation.
if (adapter && !Object.prototype.hasOwnProperty.call((config.handlers || {}), ACTIONS.SPLIT)) {
  handlers[ACTIONS.SPLIT] = splitInEngine;
}




// Step 7C: If host provides an adapter and did not override STAND explicitly,
// use the new engine-owned implementation.
if (adapter && !Object.prototype.hasOwnProperty.call((config.handlers || {}), ACTIONS.STAND)) {
  handlers[ACTIONS.STAND] = standInEngine;
}

    function getState() {
      return snapshotLegacyState();
    }

    function subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.push(fn);
      // Immediately emit current state so UI can render on mount.
      try { fn(getState(), { type: 'SUBSCRIBE_INIT' }); } catch (e) {}
      return () => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }

    async function action(type, payload) {
      const h = handlers[type];
      if (!h) throw new Error(`Engine facade: unknown action type: ${type}`);
      const result = await h(payload);
      const state = getState();
      for (const fn of listeners.slice()) {
        try { fn(state, { type, payload }); } catch (e) {}
      }
      return result;
    }

    return {
      getState,
      subscribe,
      action,
      ACTIONS,
    };
  };
})();