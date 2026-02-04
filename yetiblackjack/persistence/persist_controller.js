/*
  persistence/persist_controller.js
  --------------------------------
  Connects the engine/adapter to persistence/ledger + localStorage.

  Goals:
  - Keep persistence modular (no storage logic in engine or UI)
  - Persist bankroll across reloads
  - Append bankroll point after each settled round (rolling last N hands)

  Persistence policy:
  - We do NOT restore mid-round state.
  - We store only bankroll + ledger points (bankroll-after per hand).
*/
(() => {
  window.BJ = window.BJ || {};
  BJ.persistController = BJ.persistController || {};

  const STORAGE_KEY = 'YBJ_PERSIST_v1';

  let _mounted = false;
  let _alreadyLoggedThisRound = false;
  let _lastInRound = false;

  function loadSave(){
    const S = BJ.persistStorage;
    if(!S || typeof S.getItem !== 'function') return null;
    const raw = S.getItem(STORAGE_KEY);
    if(!raw) return null;
    try{
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : null;
    }catch(_e){
      return null;
    }
  }

  function saveNow(){
    const S = BJ.persistStorage;
    const L = BJ.persistLedger;
    if(!S || !L || typeof S.setItem !== 'function') return false;
    try{
      const obj = L.toSaveObject();
      return S.setItem(STORAGE_KEY, JSON.stringify(obj));
    }catch(_e){
      return false;
    }
  }

  function clear(){
    const S = BJ.persistStorage;
    const L = BJ.persistLedger;
    try{
      if(L && typeof L.reset === 'function') L.reset();
      if(S && typeof S.removeItem === 'function') S.removeItem(STORAGE_KEY);
    }catch(_e){ /* ignore */ }
  }

  function applyLoadedBankrollToGame(adapter){
    const L = BJ.persistLedger;
    if(!adapter || !L) return;

    const savedBankroll = L.getBankroll();
    if(!Number.isFinite(savedBankroll)) return;

    // Only apply on boot / between rounds.
    try{
      if(adapter.inRound) return;
    }catch(_e){ /* ignore */ }

    try{
      adapter.bankroll = Number(savedBankroll);
      // Best-effort UI refresh
      const F = adapter.fns || {};
      if(typeof F.updateHud === 'function') F.updateHud();
      if(typeof F.setButtons === 'function') F.setButtons();
    }catch(_e){ /* ignore */ }
  }

  function logBankrollPoint(bankrollAfter){
    const L = BJ.persistLedger;
    if(!L) return;
    const entry = L.appendBankrollPoint(bankrollAfter);
    if(entry){
      saveNow();
      _alreadyLoggedThisRound = true;
    }
  }

  function onRoundSettledFromEngine(summary, adapter){
    try{
      const b = summary && Number.isFinite(summary.bankrollAfter) ? Number(summary.bankrollAfter)
        : (adapter && Number.isFinite(adapter.bankroll) ? Number(adapter.bankroll) : null);
      if(Number.isFinite(b)) logBankrollPoint(b);
    }catch(_e){ /* ignore */ }
  }

  function mount(opts){
    if(_mounted) return;
    _mounted = true;

    const game = opts && opts.game ? opts.game : null;
    const adapter = opts && opts.adapter ? opts.adapter : null;
    const maxHands = opts && Number.isFinite(opts.maxHands) ? opts.maxHands : 2000;

    const L = BJ.persistLedger;
    if(L && typeof L.setMaxHands === 'function') L.setMaxHands(maxHands);

    // Load existing save
    const existing = loadSave();
    if(L && typeof L.initFromSave === 'function') L.initFromSave(existing);

    // Apply bankroll to the live game between rounds
    applyLoadedBankrollToGame(adapter);

    // Engine hook (preferred): adapter.onRoundSettled(summary)
    if(adapter && typeof adapter === 'object'){
      // Preserve any prior hook (unlikely)
      const prevHook = adapter.onRoundSettled;
      adapter.onRoundSettled = (summary) => {
        try{
          if(typeof prevHook === 'function') prevHook(summary);
        }catch(_e){ /* ignore */ }
        onRoundSettledFromEngine(summary, adapter);
      };
    }

    // Fallback: detect inRound transitions using game.subscribe()
    if(game && typeof game.subscribe === 'function'){
      game.subscribe((state, info) => {
        try{
          const inRound = !!(state && state.round && state.round.inRound);
          const bankroll = (state && state.bankroll) ? state.bankroll.bankroll : null;

          // New round started
          if(!_lastInRound && inRound){
            _alreadyLoggedThisRound = false;
          }

          // Round ended (legacy paths that don't call adapter hook)
          if(_lastInRound && !inRound){
            if(!_alreadyLoggedThisRound && Number.isFinite(bankroll)){
              logBankrollPoint(Number(bankroll));
            }
          }

          _lastInRound = inRound;
        }catch(_e){ /* ignore */ }
      });
    }
  }

  BJ.persistController.mount = mount;
  BJ.persistController.clear = clear;
  BJ.persistController.saveNow = saveNow;
})();
