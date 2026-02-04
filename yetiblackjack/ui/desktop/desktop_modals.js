/*
  ui/desktop/desktop_modals.js
  ---------------------------
  Owns: result popup + split results table rendering.

  Notes:
  - This module intentionally does not own game state.
  - It may call global render/update helpers (renderHands, updateLabels) if present,
    purely to ensure the UI matches what the popup is describing.
  - For backward compatibility during refactor, we publish legacy global function
    names: showResultPopup(), showResultPopupNode(), hidePopup(), buildSplitResultsNode().
*/

(() => {
  window.BJ = window.BJ || {};
  BJ.desktopModals = BJ.desktopModals || {};

  // v92B: Reinstate end-of-hand result popups (v91 disabled in-game messaging).
  const IN_GAME_MESSAGES = true;
  let _lastPopupShownAt = 0;

  function getPopupEls(){
    return {
      overlay: document.getElementById("resultPopup"),
      text: document.getElementById("popupText")
    };
  }

  // v134C/v158D: When an end-of-hand result popup appears, ensure no cards remain face-down.
  // Prefer the canonical end-of-round finalizer when available.
  function revealAllCardsForResultPopup(){
    try{
      if(typeof window.endOfRoundFinalizeOnce === 'function'){
        window.endOfRoundFinalizeOnce('resultPopup');
        return;
      }
      // Fallback: legacy direct manipulation (kept for backward compatibility).
      if(typeof window.holeDown !== 'undefined') window.holeDown = false;
      if(typeof window.dealerHand !== 'undefined' && Array.isArray(window.dealerHand)){
        if(typeof window.dealerVisibleCount !== 'undefined') window.dealerVisibleCount = window.dealerHand.length;
      }
      if(typeof window.dealerTotalHold !== 'undefined') window.dealerTotalHold = false;
      if(typeof window.renderHands === 'function') window.renderHands();
      if(typeof window.updateLabels === 'function') window.updateLabels();
    }catch(_e){ /* safety: never break the end-of-round flow */ }
  }

  function showPopup(msg){
    if(!IN_GAME_MESSAGES) return;
    const {overlay, text} = getPopupEls();
    if(!overlay || !text) return;

    // Ensure any prior split/table styling is cleared.
    const card = overlay.querySelector('.popupCard');
    if(card) card.classList.remove('splitMode');

    text.textContent = msg;
    overlay.classList.remove("hidden");
    _lastPopupShownAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    // Dim cards only (not bottom controls)
    const dealerArea = document.getElementById('dealerArea');
    const playerArea = document.getElementById('playerArea');
    if(dealerArea) dealerArea.classList.add('dim');
    if(playerArea) playerArea.classList.add('dim');

    // Ensure DEAL is visibly ready
    const dealBtn = document.getElementById('dealBtn');
    if(dealBtn){
      dealBtn.disabled = false;
      dealBtn.classList.add("dealReady");
    }
  }

  function showPopupNode(node){
    if(!IN_GAME_MESSAGES) return;
    const {overlay, text} = getPopupEls();
    if(!overlay || !text) return;

    const card = overlay.querySelector('.popupCard');
    if(card) card.classList.add('splitMode');

    text.innerHTML = '';
    if(node) text.appendChild(node);

    overlay.classList.remove('hidden');
    _lastPopupShownAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    const dealerArea = document.getElementById('dealerArea');
    const playerArea = document.getElementById('playerArea');
    if(dealerArea) dealerArea.classList.add('dim');
    if(playerArea) playerArea.classList.add('dim');

    const dealBtn = document.getElementById('dealBtn');
    if(dealBtn){
      dealBtn.disabled = false;
      dealBtn.classList.add('dealReady');
    }
  }

  function showResultPopup(msg){
    revealAllCardsForResultPopup();
    showPopup(msg);
  }

  // v138C: Split-round results use a structured table instead of plain text.
  function showResultPopupNode(node){
    revealAllCardsForResultPopup();
    showPopupNode(node);
  }

  function hidePopup(){
    const {overlay} = getPopupEls();
    if(!overlay) return;
    overlay.classList.add("hidden");

    const dealerArea = document.getElementById('dealerArea');
    const playerArea = document.getElementById('playerArea');
    if(dealerArea) dealerArea.classList.remove('dim');
    if(playerArea) playerArea.classList.remove('dim');

    const dealBtn = document.getElementById('dealBtn');
    if(dealBtn) dealBtn.classList.remove('dealReady');
  }

  function buildSplitResultsNode(dealerTotal, splitHands, roundDelta){
    const fmtMoney = (window.BJ && BJ.utils && BJ.utils.fmtMoney) ? BJ.utils.fmtMoney : (n => `$${Number(n).toFixed(2)}`);
    const handTotal = (window.BJ && BJ.rulesBJ && BJ.rulesBJ.handTotal) ? BJ.rulesBJ.handTotal : (() => 0);

    const wrap = document.createElement('div');
    wrap.className = 'splitResults';

    // Dealer line
    const dealerRow = document.createElement('div');
    dealerRow.className = 'srDealer';
    dealerRow.textContent = `Dealer gets ${dealerTotal}`;
    wrap.appendChild(dealerRow);

    // Per-hand rows
    for(let i=0;i<splitHands.length;i++){
      const h = splitHands[i];
      const w = h.wager || window.bet;
      const pv = handTotal((h && h.cards) ? h.cards : []);
      const busted = (pv > 21) || !!h.busted;

      const row = document.createElement('div');
      row.className = 'srRow';

      const label = document.createElement('div');
      label.className = 'srHandLabel';
      label.textContent = `Hand ${i+1}:`;
      row.appendChild(label);

      const cards = document.createElement('div');
      cards.className = 'srCards';
      for(const c of (h.cards || [])){
        const mc = document.createElement('div');
        mc.className = 'miniCard';
        mc.textContent = (c && c.r) ? String(c.r) : '';
        cards.appendChild(mc);
      }
      row.appendChild(cards);

      const totalEl = document.createElement('div');
      totalEl.className = 'srHandTotal';
      totalEl.textContent = String(pv);
      row.appendChild(totalEl);

      // Outcome + per-hand net
      let labelWord = 'Lose';
      let net = -w;
      if(busted){
        labelWord = 'Bust';
        net = -w;
      }else if(h.outcome === 'push'){
        labelWord = 'Push';
        net = 0;
      }else if(h.outcome === 'win'){
        labelWord = 'Win';
        net = w;
      }else if(h.outcome === 'blackjack'){
        labelWord = 'Blackjack';
        net = 1.5 * w;
      }else if(h.outcome === 'surrender'){
        labelWord = 'Surrender';
        net = -0.5 * w;
      }

      const outcomeEl = document.createElement('div');
      outcomeEl.className = 'srHandOutcome';
      const sign = (net < 0) ? '-' : '';
      outcomeEl.textContent = `${labelWord} ${sign}${fmtMoney(Math.abs(net))}`;
      row.appendChild(outcomeEl);

      wrap.appendChild(row);
    }

    // Total line
    const totalRow = document.createElement('div');
    totalRow.className = 'srTotal';
    const d = roundDelta;
    if(d > 0) totalRow.textContent = `Total: You win ${fmtMoney(d)}`;
    else if(d < 0) totalRow.textContent = `Total: You lose ${fmtMoney(Math.abs(d))}`;
    else totalRow.textContent = 'Total: Push';
    wrap.appendChild(totalRow);

    return wrap;
  }

  BJ.desktopModals.showResultPopup = showResultPopup;
  BJ.desktopModals.showResultPopupNode = showResultPopupNode;
  BJ.desktopModals.showPopup = showPopup;
  BJ.desktopModals.showPopupNode = showPopupNode;
  BJ.desktopModals.hidePopup = hidePopup;
  BJ.desktopModals.buildSplitResultsNode = buildSplitResultsNode;
  BJ.desktopModals.getLastPopupShownAt = () => _lastPopupShownAt;

  // Legacy globals
  window.showResultPopup = showResultPopup;
  window.showResultPopupNode = showResultPopupNode;
  window.showPopup = showPopup;
  window.showPopupNode = showPopupNode;
  window.hidePopup = hidePopup;
  window.buildSplitResultsNode = buildSplitResultsNode;
})();
