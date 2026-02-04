/*
  persistence/ledger.js
  --------------------
  Owns the persisted bankroll ledger (bankroll per hand).

  Stores a rolling window (default 2000 entries) of:
    { i: handIndex, b: bankrollAfter }

  No DOM. No engine imports.
*/
(() => {
  window.BJ = window.BJ || {};
  BJ.persistLedger = BJ.persistLedger || {};

  const DEFAULT_MAX = 2000;

  let _schemaVersion = 1;
  let _maxHands = DEFAULT_MAX;

  let _handCounter = 0;
  let _bankroll = null;
  let _ledger = [];

  function setMaxHands(n){
    const v = Math.max(10, Math.min(10000, Number(n) || DEFAULT_MAX));
    _maxHands = v;
    trim();
  }

  function trim(){
    if(_ledger.length <= _maxHands) return;
    const extra = _ledger.length - _maxHands;
    _ledger.splice(0, extra);
  }

  function reset(){
    _handCounter = 0;
    _bankroll = null;
    _ledger = [];
  }

  function initFromSave(obj){
    reset();
    if(!obj || typeof obj !== 'object') return;

    if(Number(obj.schemaVersion) === _schemaVersion){
      if(Number.isFinite(obj.handCounter)) _handCounter = Math.max(0, Math.floor(obj.handCounter));
      if(Number.isFinite(obj.bankroll)) _bankroll = Number(obj.bankroll);

      if(Array.isArray(obj.ledger)){
        _ledger = obj.ledger
          .filter(e => e && Number.isFinite(e.i) && Number.isFinite(e.b))
          .map(e => ({ i: Math.floor(e.i), b: Number(e.b) }));
        // Keep monotonically increasing i (best-effort)
        _ledger.sort((a,b) => a.i - b.i);
        // If ledger has entries, align handCounter to the last index (unless save has a higher counter)
        if(_ledger.length){
          const last = _ledger[_ledger.length - 1].i;
          if(last > _handCounter) _handCounter = last;
        }
      }
      trim();
    }
  }

  function setBankroll(v){
    if(!Number.isFinite(v)) return;
    _bankroll = Number(v);
  }

  function getBankroll(){
    return _bankroll;
  }

  function getHandCounter(){
    return _handCounter;
  }

  function getLedger(){
    return _ledger.slice();
  }

  function appendBankrollPoint(bankrollAfter){
    if(!Number.isFinite(bankrollAfter)) return null;
    _handCounter += 1;
    const entry = { i: _handCounter, b: Number(bankrollAfter) };
    _ledger.push(entry);
    trim();
    _bankroll = Number(bankrollAfter);
    return entry;
  }

  function getSeries(){
    // For graphing: return arrays of x and y plus the raw points.
    const pts = _ledger.slice();
    const x = pts.map(p => p.i);
    const y = pts.map(p => p.b);
    return { points: pts, x, y, maxHands: _maxHands };
  }

  function toSaveObject(){
    return {
      schemaVersion: _schemaVersion,
      savedAt: Date.now(),
      bankroll: _bankroll,
      handCounter: _handCounter,
      ledger: _ledger.slice(),
    };
  }

  BJ.persistLedger.setMaxHands = setMaxHands;
  BJ.persistLedger.initFromSave = initFromSave;
  BJ.persistLedger.reset = reset;

  BJ.persistLedger.setBankroll = setBankroll;
  BJ.persistLedger.getBankroll = getBankroll;

  BJ.persistLedger.getHandCounter = getHandCounter;
  BJ.persistLedger.getLedger = getLedger;
  BJ.persistLedger.appendBankrollPoint = appendBankrollPoint;
  BJ.persistLedger.getSeries = getSeries;
  BJ.persistLedger.toSaveObject = toSaveObject;
})();
