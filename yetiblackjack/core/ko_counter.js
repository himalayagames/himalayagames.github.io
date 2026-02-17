/*
  core/ko_counter.js (v170D)
  -------------------------
  Independent KO counting module.

  - Listens for UI-emitted `cardRevealed` events.
  - Dedupes by cardId (Set) to prevent double-counting.
  - Emits `countUpdated` events with the latest running count.

  Event payloads:
    cardRevealed.detail = { id: string, rank: string }
    countUpdated.detail = { runningCount: number }

  Notes:
  - This module is DOM-agnostic (no direct UI updates).
  - Training Mode (visibility of the count) is owned by the UI.
*/

(() => {
  window.BJ = window.BJ || {};

  const TEN_SET = new Set(['10','J','Q','K']);

  // Normalize rank strings from different UI sources (e.g. "K" vs "KING", "A" vs "ACE").
  function normalizeRank(rank){
    let r = String(rank || '').toUpperCase().trim();
    // Strip non-alphanumeric (handles accidental suit symbols, whitespace, etc.)
    r = r.replace(/[^A-Z0-9]/g, '');

    // Word ranks / alternates
    if(r === 'ACE' || r === '1') r = 'A';
    if(r === 'KING') r = 'K';
    if(r === 'QUEEN') r = 'Q';
    if(r === 'JACK') r = 'J';
    if(r === 'T') r = '10';
    return r;
  }

  function koTagForRank(rank){
    const r = normalizeRank(rank);
    if(r === 'A' || TEN_SET.has(r)) return -1;
    if(r === '8' || r === '9') return 0;
    if(r === '2' || r === '3' || r === '4' || r === '5' || r === '6' || r === '7') return +1;
    return 0; // defensive default
  }

  function koIrcForDecks(decks){
    const d = Number(decks);
    if(!Number.isFinite(d) || d <= 1) return 0;
    return -4 * (Math.round(d) - 1);
  }

  function createKOCounter(){
    let runningCount = 0;
    const countedIds = new Set();

    function reset(decks){
      runningCount = koIrcForDecks(decks);
      countedIds.clear();
      emitCountUpdated();
      return runningCount;
    }

    function getRunningCount(){ return runningCount; }

    function observeCardReveal(detail){
      try{
        const id = detail && detail.id ? String(detail.id) : '';
        const rank = detail && detail.rank ? String(detail.rank) : '';
        if(!id || !rank) return;
        if(countedIds.has(id)) return;
        countedIds.add(id);
        runningCount += koTagForRank(rank);
        emitCountUpdated();
      }catch(_e){ /* ignore */ }
    }

    function emitCountUpdated(){
      try{
        const ev = new CustomEvent('countUpdated', {
          detail: { runningCount }
        });
        document.dispatchEvent(ev);
      }catch(_e){ /* ignore */ }
    }

    // Public API
    return {
      reset,
      getRunningCount,
      _debug: {
        get countedIdsSize(){ return countedIds.size; }
      },
      _handleCardRevealed: observeCardReveal
    };
  }

  // Singleton
  const counter = createKOCounter();
  BJ.koCounter = counter;

  // Listen for UI reveal events.
  document.addEventListener('cardRevealed', (e)=>{
    counter._handleCardRevealed(e && e.detail ? e.detail : null);
  });
})();
