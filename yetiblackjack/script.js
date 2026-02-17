
/*** Utilities (moved to core/utils.js in v143D) ***/
const {
  pause,
  max0,
  intMs,
  nextFrame,
  roundMoney,
  fmtMoney,
  clampToHalfDollar,
  digitsOnly,
  snapToNearest5,
  formatUSD0
} = (window.BJ && BJ.utils) ? BJ.utils : {};

/*** Blackjack rule helpers (moved to core/rules_blackjack.js in v143D Step 4) ***/
const {
  cardValue,
  isTenGroup,
  handTotal,
  handTotalDetailed,
  isBlackjack,
  canSplitPair
} = (window.BJ && BJ.rulesBJ) ? BJ.rulesBJ : {};

/*** Audio ***/
// Extracted to ui/desktop/desktop_audio.js (v152D cleanup)

/**
 * DEV_TOOLS_ENABLED
 * -----------------
 * Dev/QA-only helper controls for forcing rare game states (insurance, splits).
 * Keep FALSE for production/shipping builds.
 */
// v139C: Enable dev/test controls so Split testing is easy.
const DEV_TOOLS_ENABLED = false;
// v175D: DEV_TOOLS_ENABLED controls all dev/debug UI (single flag).

// Casino rule: allow at most 4 total hands after splitting.
const MAX_SPLIT_HANDS = 4;


// Settings (mutable from gear modal)
let RULE_NUM_DECKS = 4;          // 2,4,6,8
// v88 defaults: casino-typical table rules
// - Hit on Soft 17: YES
// - Stand/Stay on Soft 17: NO
// - Surrender: NO
let RULE_HIT_SOFT_17 = true;     // false => S17, true => H17
let RULE_SURRENDER = false;      // surrender toggle

// v133C: Info-only display preference (can be changed anytime, even mid-hand)
// "Hide Hand Totals" setting:
// - YES => totals are hidden during play (default)
// - NO  => totals are shown during play
// PLAYER/DEALER labels always remain visible.
// Internally we store the inverse as SHOW_HAND_TOTALS for simpler rendering.
let SHOW_HAND_TOTALS = false; // default: hidden (Hide Hand Totals = YES)
// v134C: Reset default to YES (hidden totals) regardless of older saved prefs by using a new storage key.
const SHOW_HAND_TOTALS_STORAGE_KEY = 'yetiShowHandTotals_v2';

function loadShowHandTotals(){
  try{
    const ls = localStorage.getItem(SHOW_HAND_TOTALS_STORAGE_KEY);
    if(ls !== null){
      SHOW_HAND_TOTALS = (ls === '1');
      return;
    }
    // First run on this version: keep default (hidden), and persist it.
    SHOW_HAND_TOTALS = false;
    localStorage.setItem(SHOW_HAND_TOTALS_STORAGE_KEY, '0');
  }catch(_e){ /* ignore */ }
}

function applyShowHandTotals(){
  try{
    // Reuse CSS hook: when class is present, totals are hidden.
    document.body.classList.toggle('hideHandTotals', !SHOW_HAND_TOTALS);
  }catch(_e){ /* ignore */ }
}
function setShowHandTotals(v){
  SHOW_HAND_TOTALS = !!v;
  try{ localStorage.setItem(SHOW_HAND_TOTALS_STORAGE_KEY, SHOW_HAND_TOTALS ? '1' : '0'); }catch(_e){ /* ignore */ }
  // Also write old key for legacy reads (optional)
  try{ localStorage.setItem('yetiHideHandTotals', SHOW_HAND_TOTALS ? '0' : '1'); }catch(_e){ /* ignore */ }
  applyShowHandTotals();
}


// -----------------
// Training Mode (KO Running Count) (v162D)
// -----------------
let TRAINING_MODE = false; // default NO
let COUNT_REVEALED = false; // UI reveal state (hover/tap)
const TRAINING_MODE_STORAGE_KEY = 'yetiTrainingMode_v1';

function loadTrainingMode(){
  try{
    const ls = localStorage.getItem(TRAINING_MODE_STORAGE_KEY);
    if(ls !== null){
      TRAINING_MODE = (ls === '1');
      return;
    }
    TRAINING_MODE = false;
    localStorage.setItem(TRAINING_MODE_STORAGE_KEY, '0');
  }catch(_e){ /* ignore */ }
}

function applyTrainingMode(){
  try{
    const box = document.getElementById('countBox');
    if(box){
      box.style.display = (TRAINING_MODE || DEV_TOOLS_ENABLED === true) ? 'flex' : 'none';
    }
    // Hide count whenever training mode is turned off.
    if(!TRAINING_MODE && DEV_TOOLS_ENABLED !== true) COUNT_REVEALED = false;
    if(DEV_TOOLS_ENABLED === true) COUNT_REVEALED = true;
    updateCountPill();
  }catch(_e){ /* ignore */ }
}

function setTrainingMode(on){
  TRAINING_MODE = !!on;
  try{ localStorage.setItem(TRAINING_MODE_STORAGE_KEY, TRAINING_MODE ? '1' : '0'); }catch(_e){ /* ignore */ }
  applyTrainingMode();
}

function canDeviceHover(){
  try{
    return !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);
  }catch(_e){
    return false;
  }
}

function formatCount(n){
  const v = Number(n) || 0;
  if(v > 0) return `+${v}`;
  return String(v);
}

function updateCountPill(){
  try{
    const amt = document.getElementById('countAmt');
    if(!amt) return;
    const box = document.getElementById('countBox');

    if(!(TRAINING_MODE || DEV_TOOLS_ENABLED === true)){
      amt.textContent = '';
      if(box) box.classList.remove('revealed');
      return;
    }
    // In dev tools mode, keep the running count continuously visible for easier verification.
    const revealNow = (DEV_TOOLS_ENABLED === true) ? true : COUNT_REVEALED;

    if(!revealNow){
      amt.textContent = '';
      if(box) box.classList.remove('revealed');
      return;
    }
    const _ko = (window.BJ && window.BJ.koCounter) ? window.BJ.koCounter : null;
    const rc = (_ko && typeof _ko.getRunningCount === 'function') ? _ko.getRunningCount() : 0;
    amt.textContent = formatCount(rc);
    if(box) box.classList.add('revealed');
  }catch(_e){ /* ignore */ }
}

function wireCountPillInteractions(){
  const box = document.getElementById('countBox');
  if(!box) return;

  // Avoid duplicate bindings if called more than once.
  if(box.__countWired) return;
  box.__countWired = true;

  const hoverCapable = canDeviceHover();

  if(hoverCapable){
    box.addEventListener('pointerenter', ()=>{
      if(!TRAINING_MODE) return;
      COUNT_REVEALED = true;
      updateCountPill();
    });
    box.addEventListener('pointerleave', ()=>{
      COUNT_REVEALED = false;
      updateCountPill();
    });
  }else{
    // Touch devices: tap toggles reveal.
    box.addEventListener('pointerdown', (e)=>{
      if(!TRAINING_MODE) return;
      // Prevent focus/selection side effects.
      try{ e.preventDefault(); }catch(_){}
      COUNT_REVEALED = !COUNT_REVEALED;
      updateCountPill();
    });
  }
}



// v171D: KO count is event-driven.
// - UI emits `cardRevealed` when a face-down card becomes visible.
// - BJ.koCounter listens and emits `countUpdated`.
// - UI listens for `countUpdated` to refresh the pill when appropriate.
document.addEventListener('countUpdated', (_e)=>{
  try{
    if(DEV_TOOLS_ENABLED === true) updateCountPill();
    else if(TRAINING_MODE && COUNT_REVEALED) updateCountPill();
  }catch(_err){ /* ignore */ }
});


/*** Deck ***/
// NOTE: Card drawing / shoe building has moved to core/shoe.js.
// SUIT_CHAR is still used by the desktop renderer for pips/corners.
const SUIT_CHAR = {spades:"♠", hearts:"♥", diamonds:"♦", clubs:"♣"};


// -----------------
// Sound settings (v111B)
// -----------------
let GAME_SOUNDS_ON = true;      // controls SFX only
let SOUNDTRACK_ON = false;    // default OFF (mobile-friendly)     // controls background soundtrack on/off
let SOUNDTRACK_VOL = 0.25;      // 0..1 soundtrack volume
let soundtrackAudio = null;
let soundtrackStarted = false;


// -----------------
// Responsive UI scale + landscape prompt (v120B)
// -----------------
function applyUIScale(){
  try{
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    // Landscape-only UX: if portrait, show a rotate prompt and block taps.
    const portrait = vh > vw;
    const rot = document.getElementById('rotateOverlay');
    if(rot){
      rot.classList.toggle('hidden', !portrait);
      rot.style.pointerEvents = portrait ? 'auto' : 'none';
    }
    document.body.classList.toggle('portrait', portrait);

    // UI scale is driven by the playfield/controls transform system.
// Keep CSS uiScale pinned at 1.0 so we don't "double scale" cards/lanes on resize.
    const s = 1.0;
    document.documentElement.style.setProperty('--uiScale', String(Number(s).toFixed(3)));
  }catch(e){
    // no-op
  }
}
window.addEventListener('resize', applyUIScale);
window.addEventListener('orientationchange', applyUIScale);

// -----------------
// Shoe state
// -----------------
let shufflePending = false; // v94: set true when cut card is reached mid-hand; shuffle after hand completes

// v86 Shoe-size guardrail:
// - The number of decks (shoe size) may be changed ONLY before the first draw of a shoe.
// - Once any card has been dealt/drawn (shoePos > 0), decks are locked until a shuffle/new shoe.
function isShoeSizeLocked(){
  const s = (BJ.shoe && BJ.shoe.getState) ? BJ.shoe.getState() : null;
  return !!(s && typeof s.shoePos === 'number' && s.shoePos > 0);
}

// v88 Table-rule guardrail:
// - Table rules (decks, H17/S17, surrender) cannot change mid-shoe.
// - Bankroll remains editable.
function areTableRulesLocked(){
  return isShoeSizeLocked();
}

// v157: Cut card policy (random vs deterministic penetration)
const CUT_RANDOM_STORAGE_KEY = 'yetiRandomCutCard';
const CUT_PEN_STORAGE_KEY    = 'yetiDeckPenetration';

// Defaults per v157 spec:
// - Random cut card: NO
// - Manual penetration: 75%
let CUT_RANDOM_CUT_CARD = false;
let CUT_PENETRATION_PERCENT = 75;

function loadCutPolicyFromStorage(){
  try{
    const rc = localStorage.getItem(CUT_RANDOM_STORAGE_KEY);
    if(rc === '1' || rc === '0') CUT_RANDOM_CUT_CARD = (rc === '1');
  }catch(_e){ /* ignore */ }
  try{
    const p = localStorage.getItem(CUT_PEN_STORAGE_KEY);
    const n = p != null ? parseInt(String(p), 10) : NaN;
    if(Number.isFinite(n)){
      // clamp + snap
      let v = Math.max(65, Math.min(90, n));
      v = Math.round(v / 5) * 5;
      v = Math.max(65, Math.min(90, v));
      CUT_PENETRATION_PERCENT = v;
    }
  }catch(_e){ /* ignore */ }

  // Push into the core shoe module (owned boundary).
  try{
    if(BJ && BJ.shoe && typeof BJ.shoe.setCutPolicy === 'function'){
      BJ.shoe.setCutPolicy({
        randomCutCard: CUT_RANDOM_CUT_CARD,
        penetrationPercent: CUT_PENETRATION_PERCENT
      });
    }
  }catch(_e){ /* ignore */ }
}

function saveCutPolicyToStorage(){
  try{ localStorage.setItem(CUT_RANDOM_STORAGE_KEY, CUT_RANDOM_CUT_CARD ? '1' : '0'); }catch(_e){ }
  try{ localStorage.setItem(CUT_PEN_STORAGE_KEY, String(CUT_PENETRATION_PERCENT)); }catch(_e){ }
}


/*** Shoe / deck logic extracted to core/shoe.js (v143D Step 3)
 *  ----------------------------------------------------------------
 *  IMPORTANT:
 *  - BJ.shoe is the source of truth for shoe state.
 *  - core/shoe.js is DOM-free (no overlays, no deck viewer updates, no icon updates).
 *  - This file keeps thin wrappers with the old function names so the rest of v142C UI code
 *    remains unchanged during the refactor.
 */

function newShuffledShoe(decks){
  BJ.shoe.newShuffledShoe(decks);
  try{ if(window.BJ && BJ.koCounter && typeof BJ.koCounter.reset === 'function'){ BJ.koCounter.reset(decks); } }catch(_e){}
  // UI reactions (DEV viewer + icons) remain in the UI layer for now.
  updateDeckViewer();
  updateShoeDiscardIcons();
}

function shoeTotalCards(){ return BJ.shoe.shoeTotalCards(); } // excludes cut marker
function shoeArrayLength(){ return BJ.shoe.shoeArrayLength(); } // includes cut marker
function cardsRemaining(){ return BJ.shoe.cardsRemaining(); }
function discardCount(){ return BJ.shoe.discardCount(); }
function cardsUntilCut(){ return BJ.shoe.cardsUntilCut(); }

function cardToText(c){
  if(!c) return '?';
  if(c.cut) return '[CUT]';
  return `${c.r}${SUIT_CHAR[c.s] || ''}`;
}

function draw(){
  const res = BJ.shoe.draw({ decks: RULE_NUM_DECKS, inRound: !!inRound });

  // Mirror the legacy global used by UI/round flow.
  if(res && res.shufflePending === true) shufflePending = true;

  // If the shoe module performed an immediate reshuffle (only allowed when NOT inRound),
  // preserve the legacy visual behavior.
  if(res && res.shuffledNow){
    triggerShuffleOverlay();
  }

  updateDeckViewer();
  updateShoeDiscardIcons();
  return res.card;
}

function drawSpecific(target){
  const res = BJ.shoe.drawSpecific({ decks: RULE_NUM_DECKS, target, inRound: !!inRound });
  if(res && res.shufflePending === true) shufflePending = true;
  if(res && res.shuffledNow) triggerShuffleOverlay();
  updateDeckViewer();
  updateShoeDiscardIcons();
  return res.card;
}

function drawMatching(firstCard){
  const res = BJ.shoe.drawMatching({ decks: RULE_NUM_DECKS, firstCard, inRound: !!inRound });
  if(res && res.shufflePending === true) shufflePending = true;
  if(res && res.shuffledNow) triggerShuffleOverlay();
  updateDeckViewer();
  updateShoeDiscardIcons();
  return res.card;
}

// Initialize first shoe (delegated to BJ.shoe)
loadCutPolicyFromStorage();
newShuffledShoe(RULE_NUM_DECKS);


// -----------------
// Deck viewer (dev only)
// -----------------
let _deckWin = null;
// NOTE: use `var` so it is hoisted and safe to reference during early init
// (Safari/Chrome will throw if a `let` binding is referenced before its declaration).
var _deckViewerOn = false;

function buildDeckViewerText(){
  const s = (BJ.shoe && BJ.shoe.getState) ? BJ.shoe.getState() : {
    shoe: [],
    discardPile: [],
    shoePos: 0,
    cutIndex: -1,
    shoeId: 0,
    totalCards: 52 * RULE_NUM_DECKS,
    shoeArrayLength: 0,
    cardsRemaining: 0,
    discardCount: 0,
    cardsUntilCut: null
  };

  const lines = [];
  lines.push('Yeti Blackjack — Deck Viewer');
  lines.push('');
  lines.push(`Shoe ID: ${s.shoeId}`);
  lines.push(`Decks: ${RULE_NUM_DECKS}`);
  lines.push(`Total cards (no cut): ${s.totalCards}`);
  lines.push(`Shoe array length (with cut marker): ${s.shoeArrayLength}`);
  lines.push(`Draw position (shoePos): ${s.shoePos}`);
  lines.push(`Cut marker index (cutIndex): ${s.cutIndex}`);
  lines.push(`Cards until cut: ${s.cardsUntilCut}`);
  lines.push(`Cards remaining: ${s.cardsRemaining}`);
  lines.push(`Discard count: ${s.discardCount}`);
  lines.push('');

  lines.push('--- SHOE (remaining, in draw order) ---');
  let n=0;
  for(let i=s.shoePos;i<(s.shoe||[]).length;i++){
    const c = s.shoe[i];
    lines.push(String(++n).padStart(4,' ') + '. ' + cardToText(c));
  }
  lines.push('');
  lines.push('--- DISCARD (in draw order) ---');
  for(let i=0;i<(s.discardPile||[]).length;i++){
    lines.push(String(i+1).padStart(4,' ') + '. ' + cardToText(s.discardPile[i]));
  }

  return lines.join('\n');
}

function ensureDeckViewerWindow(){
  // If the window already exists, try to coerce it back to the desired size.
  if(_deckWin && !_deckWin.closed){
    try{
      const availW = (window.screen && (window.screen.availWidth || window.screen.width)) ? (window.screen.availWidth || window.screen.width) : 1200;
      const availH = (window.screen && (window.screen.availHeight || window.screen.height)) ? (window.screen.availHeight || window.screen.height) : 800;
      const wPx = Math.max(260, Math.floor(availW * 0.20));
      const hPx = Math.max(360, Math.floor(availH * 0.80));
      const left = Math.max(0, availW - wPx - 20);
      const top  = 20;
      if(typeof _deckWin.resizeTo === 'function') _deckWin.resizeTo(wPx, hPx);
      if(typeof _deckWin.moveTo === 'function') _deckWin.moveTo(left, top);
    }catch(_e){}
    return _deckWin;
  }

  // Size the popup to ~20% of available screen width (requested), with a sensible minimum.
  // Note: Some browsers may ignore requested geometry on an existing named window; we also
  // attempt to resize/move after opening.
  const availW = (window.screen && (window.screen.availWidth || window.screen.width)) ? (window.screen.availWidth || window.screen.width) : 1200;
  const availH = (window.screen && (window.screen.availHeight || window.screen.height)) ? (window.screen.availHeight || window.screen.height) : 800;
  const wPx = Math.max(260, Math.floor(availW * 0.20));
  const hPx = Math.max(360, Math.floor(availH * 0.80));
  const left = Math.max(0, availW - wPx - 20);
  const top  = 20;

  _deckWin = window.open('', 'YetiDeckViewer', `width=${wPx},height=${hPx},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  if(!_deckWin) return null;

  // Best-effort enforce the geometry even if the browser chose something else.
  try{ _deckWin.resizeTo(wPx, hPx); }catch(_e){}
  try{ _deckWin.moveTo(left, top); }catch(_e){}

  _deckWin.document.open();
  _deckWin.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Deck Viewer</title>
    <style>body{margin:0;padding:12px;background:#fff;color:#000;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
    pre{white-space:pre-wrap;word-break:break-word;}</style>
  </head><body><pre id="dv"></pre></body></html>`);
  _deckWin.document.close();

  return _deckWin;
}

function updateDeckViewer(){
  if(!DEV_TOOLS_ENABLED) return;
  if(!_deckViewerOn) return;
  const w = ensureDeckViewerWindow();
  if(!w || w.closed) return;
  const pre = w.document.getElementById('dv');
  if(!pre) return;
  pre.textContent = buildDeckViewerText();
}

// v99B: Update Shoe + Discard UI icons (read-only; no game logic changes)
function updateShoeDiscardIcons(){
  const shoeEl = getEl('shoeIcon');
  const discEl = getEl('discardIcon');
  if(!shoeEl || !discEl) return;

  const shoeState = BJ.shoe.getState ? BJ.shoe.getState() : null;
  const total = shoeState ? shoeState.totalCards : (52 * RULE_NUM_DECKS);
  const drawn = shoeState ? shoeState.discardCount : 0;
  const remaining = shoeState ? shoeState.cardsRemaining : Math.max(0, total - drawn);
  const cutIdx = shoeState ? shoeState.cutIndex : -1;


  // Pixel mapping based on TOTAL so the icon doesn't wobble as it shrinks.
  const usable = shoeEl.querySelector('.usable') || shoeEl;
  const usableH = Math.max(1, (usable.clientHeight || usable.offsetHeight || 1));
  const pxPerCard = total > 0 ? (usableH / total) : 0;

  // Shoe fill in px (fills from bottom).
  const shoeFillPx = remaining * pxPerCard;

  // Discard fill in px (fills upward).
  const discardFillPx = Math.min(drawn, total) * pxPerCard;

  // --- Cut card visual (v105B): fixed relationship to the TOP (last card), while dealing from the BOTTOM ---
  // placeCutMarker() inserts the cut marker at cutIndex in the *deal stream* (from the bottom/deal mouth).
  // The number of cards ABOVE the cut marker up to the last card is invariant:
  //   cardsAboveCut = total - cutIndex
  // As we deal from the bottom, remaining shrinks, and the cut marker moves toward the bottom at the same rate.
  let cutPxFromBottom = 0;
  if(typeof cutIdx === 'number' && cutIdx >= 0 && total > 0){
    const cardsAboveCut = Math.max(0, total - cutIdx);     // invariant distance to top
    const cutFromBottom = remaining - cardsAboveCut;         // 0 => cut at the deal mouth (shuffle trigger)
    cutPxFromBottom = cutFromBottom * pxPerCard;
  }else{
    cutPxFromBottom = 0;
  }

  // Clamp cut line to inside the visible shoe stack.
  cutPxFromBottom = Math.max(0, Math.min(shoeFillPx, cutPxFromBottom));

  shoeEl.style.setProperty('--shoeFillPx', String(shoeFillPx));
  shoeEl.style.setProperty('--cutPx', String(cutPxFromBottom));
  discEl.style.setProperty('--discardFillPx', String(discardFillPx));
}


function toggleDeckViewer(){
  if(!DEV_TOOLS_ENABLED) return;
  _deckViewerOn = !_deckViewerOn;
  if(deckViewerBtn) deckViewerBtn.textContent = `Deck Viewer: ${_deckViewerOn ? 'ON' : 'OFF'}`;
  if(_deckViewerOn){
    ensureDeckViewerWindow();
    updateDeckViewer();
  updateShoeDiscardIcons();
  }else{
    if(_deckWin && !_deckWin.closed) _deckWin.close();
  }
}

function deckDebugSnapshot(){
  const s = (BJ.shoe && BJ.shoe.getState) ? BJ.shoe.getState() : {};
  return {
    decks: RULE_NUM_DECKS,
    totalCards: s.totalCards ?? (52 * RULE_NUM_DECKS),
    cardsRemaining: s.cardsRemaining ?? 0,
    discardCount: s.discardCount ?? 0,
    cutIndex: s.cutIndex ?? -1,
    cardsUntilCut: s.cardsUntilCut ?? null,
    shoePos: s.shoePos ?? 0,
    shoeId: s.shoeId ?? 0
  };
}

/*** UI refs ***/
const dealerArea = document.getElementById("dealerArea");
const playerArea = document.getElementById("playerArea");
const dealerLane = document.getElementById("dealerLane");
const playerLane = document.getElementById("playerLane");

const dealerLabel = document.getElementById("dealerLabel");
const dealerValue = document.getElementById("dealerValue");
const playerLabel = document.getElementById("playerLabel");
const playerValue = document.getElementById("playerValue");

const dealBtn = document.getElementById("dealBtn");

// --- Debug helper (v54) ---
const debugBar = document.getElementById('debugBar');
let _dbgEnabled = false;
let _dbgLastStep = '';
function dbgStep(msg){
  _dbgLastStep = String(msg || '');
  if(!_dbgEnabled || !debugBar) return;
  debugBar.textContent = _dbgLastStep;
  debugBar.classList.remove('hidden');
}
function dbgError(err, context){
  _dbgEnabled = true;
  if(!debugBar) return;
  const e = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
  const ctx = context ? String(context) : 'Error';
  debugBar.textContent = ctx + "\n" + (_dbgLastStep ? ("Last step: " + _dbgLastStep + "\n") : "") + e;
  debugBar.classList.remove('hidden');
}
function dbgHide(){
  if(!debugBar) return;
  debugBar.classList.add('hidden');
}
const hitBtn = document.getElementById("hitBtn");
const standBtn = document.getElementById("standBtn");
const doubleBtn = document.getElementById("doubleBtn");
const splitBtn = document.getElementById("splitBtn");
const surrenderBtn = document.getElementById("surrenderBtn");
const gearBtn = document.getElementById("gearBtn");
const helpBtn = document.getElementById("helpBtn");
const devToolsRow = document.getElementById("devToolsRow");
const devBadge = document.getElementById("devBadge");
const testSplitsBtn = document.getElementById("testSplitsBtn");
const testInsBJBtn = document.getElementById("testInsBJBtn");
const testInsNoBJBtn = document.getElementById("testInsNoBJBtn");
const deckViewerBtn = document.getElementById("deckViewerBtn");
const forcePlayerBJBtn = document.getElementById("forcePlayerBJBtn");
const forceDealerBJBtn = document.getElementById("forceDealerBJBtn");

// Insurance modal refs (these nodes are declared AFTER the main script in the HTML)
// so we must lazily resolve them after DOM is available.
let insuranceModal = null;
let insYesBtn = null;
let insNoBtn = null;
let insAmt = null;
let insConfirmBtn = null;
let insCancelBtn = null;
let insuranceBetRow = null;
let insuranceChoiceRow = null;
let insuranceMaxNote = null;

// Insurance result modal refs (dev/test + gameplay confirmation)
let insuranceResultModal = null;
let insuranceResultText = null;
let insResultOkBtn = null;
let insuranceResultResolve = null;
let insuranceResultHandlersBound = false;

function ensureInsuranceResultRefs(){
  if(insuranceResultModal) return true;
  insuranceResultModal = document.getElementById("insuranceResultModal");
  insuranceResultText = document.getElementById("insuranceResultText");
  insResultOkBtn = document.getElementById("insResultOkBtn");
  return !!insuranceResultModal;
}

function hideInsuranceResultModal(){
  if(!ensureInsuranceResultRefs()) return;
  insuranceResultModal.classList.add("hidden");
  insuranceResultModal.style.display = "none";
  dealerArea.classList.remove("dim");
  playerArea.classList.remove("dim");
}

function bindInsuranceResultHandlers(){
  if(insuranceResultHandlersBound) return;
  if(!ensureInsuranceResultRefs()) return;
  insuranceResultHandlersBound = true;
  insResultOkBtn.onclick = () => {
    hideInsuranceResultModal();
    const r = insuranceResultResolve;
    insuranceResultResolve = null;
    if(typeof r === "function") r();
  };
}

function showInsuranceResultModal(msg){
  if(!ensureInsuranceResultRefs()){
    return Promise.resolve();
  }
  bindInsuranceResultHandlers();
  insuranceResultText.textContent = msg;
  dealerArea.classList.add("dim");
  playerArea.classList.add("dim");
  insuranceResultModal.classList.remove("hidden");
  insuranceResultModal.style.display = "flex";
  insuranceResultModal.style.pointerEvents = "auto";
  requestAnimationFrame(()=>{ try{ insResultOkBtn.focus(); }catch(_e){} });
  return new Promise((resolve)=>{ insuranceResultResolve = resolve; });
}


function ensureInsuranceRefs(){
  if(insuranceModal) return true;
  insuranceModal = document.getElementById("insuranceModal");
  insYesBtn = document.getElementById("insYesBtn");
  insNoBtn = document.getElementById("insNoBtn");
  insAmt = document.getElementById("insAmt");
  insConfirmBtn = document.getElementById("insConfirmBtn");
  insCancelBtn = document.getElementById("insCancelBtn");
  insuranceBetRow = document.getElementById("insuranceBetRow");
  insuranceChoiceRow = document.getElementById("insuranceChoiceRow");
  insuranceMaxNote = document.getElementById("insuranceMaxNote");
  return !!insuranceModal;
}

const bankrollAmt = document.getElementById("bankrollAmt");
const betAmt = document.getElementById("betAmt");
const actionAmt = document.getElementById("actionAmt");
const betDown = document.getElementById("betDown");
const betUp = document.getElementById("betUp");
const bankrollBox = document.getElementById("bankrollBox");

// Result popup helpers extracted to ui/desktop/desktop_modals.js (v152D cleanup)

// Result popup helpers are implemented in ui/desktop/desktop_modals.js (v152D cleanup)

/*** Game Over (Leave Table) ***/
let gameOver = false;
function showEndModal(){
  const m = document.getElementById('endModal');
  if(!m) return;
  m.classList.remove('hidden');
}
function hideEndModal(){
  const m = document.getElementById('endModal');
  if(!m) return;
  m.classList.add('hidden');
}
function endGame(){
  // Terminal: no more interaction, no more dealing.
  gameOver = true;
  // Close any money modal and any result popup.
  hideFundsModal();
  hidePopup();
  uiLocked = true;
  // Disable all gameplay interaction (buttons + table hover/clicks)
  document.body.classList.add('gameOver');
  showEndModal();
  setButtons();
}

// Dismiss popup when the user clicks the popup overlay (or its contents).
// Guard: ignore the same click gesture that caused the popup to appear.
document.addEventListener('click', (e)=>{
  const overlay = document.getElementById('resultPopup');
  if(!overlay) return;
  if(overlay.classList.contains('hidden')) return;

  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const lastShown = (window.BJ && BJ.desktopModals && typeof BJ.desktopModals.getLastPopupShownAt === 'function')
    ? BJ.desktopModals.getLastPopupShownAt()
    : 0;
  if(now - lastShown < 250) return;

  // v136C: Only dismiss when clicking *the popup card itself* (not the full-screen overlay).
  // This prevents accidental dismissal when clicking outside the popup.
  const card = overlay.querySelector('.popupCard');
  if(card && card.contains(e.target)){
    hidePopup();
  }
});


// v143D Step 6: Enter-to-Deal wiring moved to ui/desktop/desktop_ui.js

/*** Money state ***/
// Default bankroll for "Reload Bankroll".
const DEFAULT_BANKROLL = 500.00;

let bankroll = 500.00;
let bet = 25.00;
let roundStartBankroll = 500.00;
let cycleToken = 0;


// v158D: Canonical end-of-round finalizer gate.
// We key off cycleToken (incremented at the start of each round) so finalize runs once per round.
let _roundFinalizedToken = -1;
// Sound toggle (UI may be added later). Keep resilient:
// - respects window.SOUNDS_ENABLED / window.soundsEnabled
// - respects localStorage key 'yetiSounds' ('1' / '0')
let _soundsEnabled = true;
function getSoundsEnabled(){
  try{
    if(typeof window.SOUNDS_ENABLED === 'boolean') return window.SOUNDS_ENABLED;
    if(typeof window.soundsEnabled === 'boolean') return window.soundsEnabled;
    const ls = localStorage.getItem('yetiSounds');
    if(ls !== null) return ls === '1';
  }catch(_e){ /* ignore */ }
  return _soundsEnabled;
}
window.setSoundsEnabled = (v)=>{ _soundsEnabled = !!v; };

// Bankroll bust-out modal state
let brokeModalShown = false;
let uiLocked = false;
let noNewBets = false;
let pendingFundsAction = null;
// Context for the funds modal so "Continue Hand" can behave differently for insurance.
// Values: 'insurance' | 'action' | 'broke' | null
let fundsModalReason = null;
let insuranceCapCurrent = 0;

let _wahCtx = null;
function playWahWah(){
  if(!getSoundsEnabled()) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if(!AudioCtx) return;
  try{
    if(!_wahCtx) _wahCtx = new AudioCtx();
    // Some browsers start suspended until a gesture; try to resume.
    if(_wahCtx.state === 'suspended') _wahCtx.resume().catch(()=>{});

    const ctx = _wahCtx;
    const now = ctx.currentTime;
    const dur = 1.05;

    // "Sad trombone" vibe: two detuned saw waves through a lowpass with an envelope.
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.linearRampToValueAtTime(700, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    // Descending slide
    o1.frequency.setValueAtTime(240, now);
    o1.frequency.exponentialRampToValueAtTime(92, now + dur);
    o2.frequency.setValueAtTime(360, now);
    o2.frequency.exponentialRampToValueAtTime(138, now + dur);
    o2.detune.setValueAtTime(6, now);

    // Tiny vibrato / wobble (trombone-ish)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(6.2, now);
    lfoGain.gain.setValueAtTime(18, now);
    lfo.connect(lfoGain);
    lfoGain.connect(o1.detune);
    lfoGain.connect(o2.detune);

    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    o1.start(now);
    o2.start(now);
    lfo.start(now);
    o1.stop(now + dur + 0.05);
    o2.stop(now + dur + 0.05);
    lfo.stop(now + dur + 0.05);
  }catch(_e){
    // If audio fails for any reason, fail silently.
  }
}

function showFundsModal(opts = {}){
  // opts: { title, note, allowContinue, allowLeave, afterAdd }
  if(brokeModalShown) return;
  const modal = document.getElementById('brokeModal');
  if(!modal) return;

  // Track why we opened the modal so "Continue Hand" can make the right choice.
  fundsModalReason = opts.reason || null;

  const titleEl = document.getElementById('fundsTitle');
  const noteEl = document.getElementById('fundsNote');
  const choiceRow = document.getElementById('fundsChoiceRow');
  const addRow = document.getElementById('fundsAddRow');
  const continueBtn = document.getElementById('continueHandBtn');
  const leaveBtn = document.getElementById('leaveTableBtn');
  const amt = document.getElementById('fundsAmt');

  if(titleEl) titleEl.textContent = opts.title || 'Insufficient Funds';
  if(noteEl) noteEl.textContent = opts.note || "You don't have enough bankroll.";

  // Continue Hand only makes sense while a hand is in progress.
  const allowContinue = !!opts.allowContinue;
  if(continueBtn){
    continueBtn.style.display = allowContinue ? '' : 'none';
  }

  // Leave Table is only shown when the player is broke BETWEEN hands.
  const allowLeave = !!opts.allowLeave;
  if(leaveBtn){
    leaveBtn.style.display = allowLeave ? '' : 'none';
  }

  // Reset add flow
  if(choiceRow) choiceRow.style.display = '';
  if(addRow) addRow.style.display = 'none';
  if(amt){
    amt.value = '';
    // Suggest a reasonable top-up
    amt.placeholder = '100';
  }

  brokeModalShown = true;
  uiLocked = true;

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.style.pointerEvents = 'auto';

  // Dim cards only (not bottom controls)
  dealerArea.classList.add('dim');
  playerArea.classList.add('dim');

  playWahWah();
  setButtons();

  // store callback for after a successful add
  pendingFundsAction = typeof opts.afterAdd === 'function' ? opts.afterAdd : null;
}

function hideFundsModal(){
  const modal = document.getElementById('brokeModal');
  if(!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
  modal.style.pointerEvents = 'none';
  dealerArea.classList.remove('dim');
  playerArea.classList.remove('dim');
  brokeModalShown = false;
  uiLocked = false;
  pendingFundsAction = null;
  fundsModalReason = null;
  setButtons();
}

function ensureFundsModalHandlers(){
  const addBtn = document.getElementById('addFundsBtn');
  const continueBtn = document.getElementById('continueHandBtn');
  const leaveBtn = document.getElementById('leaveTableBtn');
  const choiceRow = document.getElementById('fundsChoiceRow');
  const addRow = document.getElementById('fundsAddRow');
  const cancelBtn = document.getElementById('fundsCancelBtn');
  const confirmBtn = document.getElementById('fundsConfirmBtn');
  const amt = document.getElementById('fundsAmt');

  if(addBtn && !addBtn.dataset.bound){
    addBtn.dataset.bound = '1';
    addBtn.addEventListener('click', ()=>{
      // Open Add Chips modal (virtual chips)
      showAddChipsModal();
    });
  }

  if(cancelBtn && !cancelBtn.dataset.bound){
    cancelBtn.dataset.bound = '1';
    cancelBtn.addEventListener('click', ()=>{
      if(addRow) addRow.style.display = 'none';
      if(choiceRow) choiceRow.style.display = '';
    });
  }

  if(confirmBtn && !confirmBtn.dataset.bound){
    confirmBtn.dataset.bound = '1';
    confirmBtn.addEventListener('click', ()=>{
      let v = Number(amt?.value || amt?.placeholder || '0');
      if(!Number.isFinite(v)) v = 0;
      v = clampToHalfDollar(v);
      v = roundMoney(v);
      if(v <= 0) return;

      bankroll = roundMoney(bankroll + v);
      // If the user adds funds, bets are allowed again.
      noNewBets = false;
      updateHud();

      // Close modal first, then optionally retry the blocked action.
      const after = pendingFundsAction;
      hideFundsModal();
      if(typeof after === 'function'){
        // run on next tick so UI is settled
        setTimeout(()=>{ after(); }, 0);
      }
    });
  }

  if(continueBtn && !continueBtn.dataset.bound){
    continueBtn.dataset.bound = '1';
    continueBtn.addEventListener('click', ()=>{
      // Continue current hand. If this modal was opened for Split/Double (or bust-out),
      // disallow any new bets for the rest of the hand. But if this was for INSURANCE,
      // declining funds here should not disable Split/Double later.
      if(fundsModalReason !== 'insurance'){
        noNewBets = true;
      }

      // If we were in the insurance flow, treat this like declining insurance.
      if(insurancePending){
        insuranceBet = 0;
        hideInsuranceModal();
        const r = insuranceResolve;
        insuranceResolve = null;
        if(typeof r === 'function') r();
      }

      hideFundsModal();
    });
  }

  if(leaveBtn && !leaveBtn.dataset.bound){
    leaveBtn.dataset.bound = '1';
    leaveBtn.addEventListener('click', ()=>{
      endGame();
    });
  }
}

function maybeShowFundsModalWhenBroke(){
  if(bankroll > 0) return;
  const chipsActive = computeChipsInAction();
  const betweenHandsBroke = (!inRound && chipsActive === 0);
  // If a hand is currently in progress, allow continuing it.
  showFundsModal({
    title: 'W-w-wah…',
    note: "You're out of money.",
    allowContinue: inRound,
    allowLeave: betweenHandsBroke,
    reason: 'broke'
  });
}

// NOTE: wiring for the funds modal buttons is handled via delegated listeners (see bottom of script)


/***********************
 * Add Chips Modal + Settings Modal
 ***********************/
function filterBankrollField(inputEl){
  if(!inputEl) return;
  // Allow free typing; strip non-digits only.
  // Snapping to nearest $5 happens on ACCEPT/SAVE (not per-keystroke).
  const d = digitsOnly(inputEl.value);
  inputEl.value = d;
}

// Add Chips modal refs (resolved dynamically; robust to re-renders)
function getEl(id){
  return document.getElementById(id);
}

function showAddChipsModal(){
  const addChipsModal = getEl('addChipsModal');
  if(!addChipsModal) return;
  addChipsModal.classList.remove('hidden');
  addChipsModal.style.display = 'flex';
  addChipsModal.style.pointerEvents = 'auto';

  const addChipsAmt = getEl('addChipsAmt');
  if(addChipsAmt){
    // Default to $0 (display) but let typing be digits-only.
    addChipsAmt.value = formatUSD0(0);
    addChipsAmt.placeholder = formatUSD0(0);
    // Do NOT auto-focus. If we focus immediately, our focusin handler switches
    // the formatted "$0" into raw digits ("0"), which looks like the currency
    // formatting is missing.
  }
}

function hideAddChipsModal(){
  const addChipsModal = getEl('addChipsModal');
  if(!addChipsModal) return;
  addChipsModal.classList.add('hidden');
  addChipsModal.style.display = 'none';
  addChipsModal.style.pointerEvents = 'none';
}

// (Button/input handlers for this modal are wired via a delegated document listener below.)

// Settings modal refs (resolved dynamically; robust to re-renders)
function showSettingsModal(){
  const settingsModal = getEl('settingsModal');
  if(!settingsModal) return;

  const settingsBankroll = getEl('settingsBankroll');
  const hideTotalsYes = getEl('hideTotalsYes');
  const hideTotalsNo  = getEl('hideTotalsNo');
  const settingsDecks = getEl('settingsDecks');
  const randomCutYes = getEl('randomCutYes');
  const randomCutNo  = getEl('randomCutNo');
  const settingsPenetration = getEl('settingsPenetration');
  const hitSoft17Yes = getEl('hitSoft17Yes');
  const hitSoft17No = getEl('hitSoft17No');
  const staySoft17Yes = getEl('staySoft17Yes');
  const staySoft17No = getEl('staySoft17No');
  const surrenderYes = getEl('surrenderYes');
  const surrenderNo = getEl('surrenderNo');

  // populate
  if(settingsBankroll){
    // Display as USD currency (input still accepts digits-only; we parse on save)
    settingsBankroll.value = formatUSD0(snapToNearest5(Math.round(bankroll)));
  }

  // v133C: Hide Hand Totals (info-only; can be changed anytime)
  // YES => hide totals (SHOW_HAND_TOTALS = false)
  // NO  => show totals (SHOW_HAND_TOTALS = true)
  if(hideTotalsYes && hideTotalsNo){
    hideTotalsYes.checked = !SHOW_HAND_TOTALS;
    hideTotalsNo.checked  = !!SHOW_HAND_TOTALS;
  }
  const rulesLocked = areTableRulesLocked();

  if(settingsDecks){
    settingsDecks.value = String(RULE_NUM_DECKS);
    // v88: table rules are locked once the first card is dealt until the next shuffle/new shoe.
    // NOTE: Keep the control *present* so we can show an explanatory popup on attempt.
    settingsDecks.disabled = false;
    settingsDecks.classList.toggle('lockedSelect', rulesLocked);
    settingsDecks.setAttribute('aria-disabled', rulesLocked ? 'true' : 'false');
    settingsDecks.title = rulesLocked ? 'Table rules are locked until the next shuffle/new shoe.' : '';
    settingsDecks.dataset.prevDecks = String(RULE_NUM_DECKS);
  }
  // v157: Cut card policy UI
  const settingsPenLabel = getEl('settingsPenetrationLabel');
  if(randomCutYes && randomCutNo){
    randomCutYes.checked = !!CUT_RANDOM_CUT_CARD;
    randomCutNo.checked  = !CUT_RANDOM_CUT_CARD;
  }
  if(settingsPenetration){
    // Slider shows 75% and is disabled when random is ON.
    const v = CUT_RANDOM_CUT_CARD ? 75 : CUT_PENETRATION_PERCENT;
    settingsPenetration.value = String(v);
    if(settingsPenLabel) settingsPenLabel.textContent = String(v) + '%';

    const disableForRandom = !!CUT_RANDOM_CUT_CARD;
    const disableForLock = !!rulesLocked;
    settingsPenetration.disabled = disableForRandom || disableForLock;
    settingsPenetration.setAttribute('aria-disabled', (disableForRandom || disableForLock) ? 'true' : 'false');
  }

  // Mark cut policy radios as locked visually when table rules are locked
  try{
    const td = randomCutYes?.closest?.('td');
    if(td) td.classList.toggle('lockedRadios', rulesLocked);
    [randomCutYes, randomCutNo].forEach(inp=>{
      if(!inp) return;
      inp.setAttribute('aria-disabled', rulesLocked ? 'true' : 'false');
    });
  }catch(_e){ }

  // soft17 rows (mutually exclusive)
  if(RULE_HIT_SOFT_17){
    if(hitSoft17Yes) hitSoft17Yes.checked = true;
    if(hitSoft17No) hitSoft17No.checked = false;
    if(staySoft17Yes) staySoft17Yes.checked = false;
    if(staySoft17No) staySoft17No.checked = true;
  }else{
    if(hitSoft17Yes) hitSoft17Yes.checked = false;
    if(hitSoft17No) hitSoft17No.checked = true;
    if(staySoft17Yes) staySoft17Yes.checked = true;
    if(staySoft17No) staySoft17No.checked = false;
  }

  if(RULE_SURRENDER){
    if(surrenderYes) surrenderYes.checked = true;
    if(surrenderNo) surrenderNo.checked = false;
  }else{
    if(surrenderYes) surrenderYes.checked = false;
    if(surrenderNo) surrenderNo.checked = true;
  }

  // v88: Lock all rule controls (except bankroll) mid-shoe.
  // Visually dim ONLY the table-rule radio groups; interaction is intercepted to show a popup.
  try{
    const tds = [];
    const a = hitSoft17Yes?.closest?.('td');
    const b = staySoft17Yes?.closest?.('td');
    const c = surrenderYes?.closest?.('td');
    if(a) tds.push(a);
    if(b) tds.push(b);
    if(c) tds.push(c);
    tds.forEach(td => td.classList.toggle('lockedRadios', rulesLocked));

    // Mark individual inputs for accessibility
    [hitSoft17Yes, hitSoft17No, staySoft17Yes, staySoft17No, surrenderYes, surrenderNo].forEach(inp=>{
      if(!inp) return;
      inp.setAttribute('aria-disabled', rulesLocked ? 'true' : 'false');
    });
  }catch(_){ }

  // v113B: Audio settings (staged; applied on ACCEPT)
  const gameSoundsYes = getEl('gameSoundsYes');
  const gameSoundsNo  = getEl('gameSoundsNo');
  const soundtrackYes = getEl('soundtrackYes');
  const soundtrackNo  = getEl('soundtrackNo');
  const trainingModeYes = getEl('trainingModeYes');
  const trainingModeNo  = getEl('trainingModeNo');
if(GAME_SOUNDS_ON){
    if(gameSoundsYes) gameSoundsYes.checked = true;
    if(gameSoundsNo) gameSoundsNo.checked = false;
  }else{
    if(gameSoundsYes) gameSoundsYes.checked = false;
    if(gameSoundsNo) gameSoundsNo.checked = true;
  }
  if(soundtrackYes && soundtrackNo){
    soundtrackYes.checked = !!SOUNDTRACK_ON;
    soundtrackNo.checked  = !SOUNDTRACK_ON;
    if(trainingModeYes && trainingModeNo){
    trainingModeYes.checked = !!TRAINING_MODE;
    trainingModeNo.checked  = !TRAINING_MODE;
  }
}
settingsModal.classList.remove('hidden');
  settingsModal.style.display = 'flex';
  settingsModal.style.pointerEvents = 'auto';
}

function hideSettingsModal(){
  const settingsModal = getEl('settingsModal');
  if(!settingsModal) return;
  settingsModal.classList.add('hidden');
  settingsModal.style.display = 'none';
  settingsModal.style.pointerEvents = 'none';
}

function showAboutModal(){
  const aboutModal = getEl('aboutModal');
  const aboutText = getEl('aboutText');
  if(!aboutModal || !aboutText) return;

  aboutText.textContent = (
`Yeti Blackjack\n\n`+
`Sound credits / attribution\n`+
`---------------------------\n`+
`Deal/flip sound: ZapSplat (licensed, paid).\n`+
`File: sounds/deal_flip.wav\n\n`+
`Riffle shuffle sound: Pixabay (royalty-free).\n`+
`Riffle shuffle sound: \'Riffle Card Shuffle\' by Kodack (Freesound), via Pixabay.\n`+
`Pixabay item: riffle-card-shuffle-104313\n`+
`File: sounds/riffle.mp3\n`
  );

  aboutModal.classList.remove('hidden');
  aboutModal.style.display = 'flex';
  aboutModal.style.pointerEvents = 'auto';
}

function hideAboutModal(){
  const aboutModal = getEl('aboutModal');
  if(!aboutModal) return;
  aboutModal.classList.add('hidden');
  aboutModal.style.display = 'none';
  aboutModal.style.pointerEvents = 'none';
}



// Help Scroll Modal (Story & Instructions)
function showHelpScroll(){
  const helpModal = getEl('helpModal');
  if(!helpModal) return;

  helpModal.classList.remove('hidden');
  helpModal.style.display = 'flex';
  helpModal.style.pointerEvents = 'auto';

  // Trigger CSS transition
  requestAnimationFrame(()=> helpModal.classList.add('open'));
}

function hideHelpScroll(){
  const helpModal = getEl('helpModal');
  if(!helpModal) return;

  helpModal.classList.remove('open');

  // After transition, hide completely
  window.setTimeout(()=>{
    helpModal.classList.add('hidden');
    helpModal.style.display = 'none';
    helpModal.style.pointerEvents = 'none';
  }, 460);
}

let _shuffleOverlayActive = false;
function playRiffleOnceAwaitEnd(){
  // NOTE (v156): riffleSfxBase used to be a legacy global, but audio ownership
  // moved into ui/desktop/desktop_audio.js. Accessing an undeclared identifier
  // here can throw and wedge the shuffle overlay (UI stays locked).
  // Create a fresh Audio instance for the riffle and always resolve.
  return new Promise((resolve)=>{
    // Respect the current SFX toggle.
    try{
      if(typeof GAME_SOUNDS_ON !== 'undefined' && !GAME_SOUNDS_ON){ resolve(); return; }
    }catch(_e){ /* ignore */ }
    if(typeof window.GAME_SOUNDS_ON !== 'undefined' && !window.GAME_SOUNDS_ON){ resolve(); return; }

    const a = new Audio('sounds/riffle.mp3');
    a.preload = 'auto';
    a.volume = 0.9;
    a.currentTime = 0;

    let done = false;
    const finish = ()=>{
      if(done) return;
      done = true;
      a.removeEventListener('ended', finish);
      a.removeEventListener('error', finish);
      resolve();
    };

    a.addEventListener('ended', finish);
    a.addEventListener('error', finish);

    // Safety fallback if ended doesn't fire (Safari quirks / failed load).
    const d = Math.max(0.05, Number(riffleSfxDur) || 0.7);
    setTimeout(finish, Math.floor(d * 1000) + 100);

    a.play().catch(()=>finish());
  });
}

async function playRiffleThreeTimes(){
  // Fixed-count riffle/bridge: exactly 3 plays.
  for(let i=0;i<3;i++){
    await playRiffleOnceAwaitEnd();
  }
}

function runShuffleOverlayCycle(overlay){
  // Pattern:
  //  - visible 1.0s
  //  - fade to 0 over 0.5s
  //  - stay hidden 0.25s
  //  - fade to 1 over 0.5s
  //  - visible 1.0s
  const box = overlay.querySelector('.shuffleBox');
  if(!box) return Promise.resolve();

  const showMs = 1000;
  const fadeMs = 500;
  const hiddenMs = 250;

  // Ensure transition is correct for this cycle.
  box.style.transition = `opacity ${fadeMs}ms ease-in-out`;

  return (async ()=>{
    // Fully visible
    box.style.opacity = '1';
    await pause(showMs);

    // Fade out
    box.style.opacity = '0';
    await pause(fadeMs);

    // Stay hidden
    await pause(hiddenMs);

    // Fade in
    box.style.opacity = '1';
    await pause(fadeMs);

    // Stay visible
    await pause(showMs);
  })();
}


// v172D: Training-mode end-of-shoe modal that shows final running count before reset/shuffle.
let _finalCountModalActive = false;

function showFinalCountModal(){
  const modal = getEl('finalCountModal');
  const valEl = getEl('finalCountValue');
  const okBtn = getEl('finalCountOkBtn');

  // If markup is missing for any reason, fall back to immediate shuffle.
  if(!modal || !valEl || !okBtn){
    return false;
  }

  // Read current running count from KO counter (training mode uses KO).
  let rc = 0;
  try{
    const _ko = (window.BJ && BJ.koCounter) ? BJ.koCounter : null;
    rc = (_ko && typeof _ko.getRunningCount === 'function') ? _ko.getRunningCount() : 0;
  }catch(_e){ rc = 0; }

  valEl.textContent = formatCount(rc);

  _finalCountModalActive = true;

  // Hard lock the UI until dismissed.
  uiLocked = true;
  setButtons();

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.style.pointerEvents = 'auto';

  // Focus OK for keyboard users.
  try{ okBtn.focus(); }catch(_e){ /* ignore */ }
  return true;
}

function hideFinalCountModal(){
  const modal = getEl('finalCountModal');
  if(modal){
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modal.style.pointerEvents = 'none';
  }
  _finalCountModalActive = false;
}

function performBetweenHandsShuffle(){
  shufflePending = false;
  newShuffledShoe(RULE_NUM_DECKS);
  triggerShuffleOverlay();
}
function triggerShuffleOverlay(){
  const overlay = getEl('shuffleOverlay');
  if(!overlay) return;
  if(_shuffleOverlayActive) return;
  _shuffleOverlayActive = true;

  // Lock UI during shuffle overlay.
  uiLocked = true;
  setButtons();

  // Show overlay
  overlay.classList.remove('hidden');
  overlay.classList.remove('blink');
  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'auto';

  const box = overlay.querySelector('.shuffleBox');
  if(box){
    // Start from visible immediately.
    box.style.opacity = '1';
  }

  let stopRequested = false;

  // Cycle overlay while audio plays 3 times.
  (async ()=>{
    try{
      // Start overlay cycle loop.
      const cycleLoop = (async ()=>{
        while(true){
          await runShuffleOverlayCycle(overlay);
          if(stopRequested) break;
        }
      })();

      // Play riffle sound exactly 3 times.
      await playRiffleThreeTimes();
      stopRequested = true;

      // Wait for overlay to finish its current cycle.
      await cycleLoop;
    }catch(err){
      // If anything goes wrong, never leave the UI locked.
      console.error('shuffle overlay failed', err);
    }finally{
      // Hide overlay and unlock UI.
      if(box){ box.style.opacity = '0'; }
      overlay.classList.add('hidden');
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
      _shuffleOverlayActive = false;
      uiLocked = false;
      setButtons();
    }
  })();
}

function applySettingsFromModal(){
  const settingsBankroll = getEl('settingsBankroll');
  const hideTotalsYes = getEl('hideTotalsYes');
  const hideTotalsNo  = getEl('hideTotalsNo');
  const settingsDecks = getEl('settingsDecks');
  const randomCutYes = getEl('randomCutYes');
  const randomCutNo  = getEl('randomCutNo');
  const settingsPenetration = getEl('settingsPenetration');
  const hitSoft17Yes = getEl('hitSoft17Yes');
  const staySoft17Yes = getEl('staySoft17Yes');
  const surrenderYes = getEl('surrenderYes');

  const gameSoundsYes = getEl('gameSoundsYes');
  const soundtrackYes = getEl('soundtrackYes');
  const soundtrackNo  = getEl('soundtrackNo');
  const trainingModeYes = getEl('trainingModeYes');
  const trainingModeNo  = getEl('trainingModeNo');
const rulesLocked = areTableRulesLocked();

  // Bankroll entry snapped to nearest $5, no decimals
  if(settingsBankroll){
    const d = digitsOnly(settingsBankroll.value);
    let n = d ? parseInt(d,10) : 0;
    n = snapToNearest5(n);
    bankroll = roundMoney(n);
  }

  // v133C: Hide Hand Totals (apply even mid-hand)
  // YES => hide totals (show = false)
  // NO  => show totals (show = true)
  if(hideTotalsYes || hideTotalsNo){
    const show = !!(hideTotalsNo && hideTotalsNo.checked);
    setShowHandTotals(show);
  }

  // Decks (shoe size)
  const prevDecks = RULE_NUM_DECKS;
  let decksChanged = false;
  if(settingsDecks){
    const v = parseInt(settingsDecks.value,10);
    if([2,4,6,8].includes(v) && v !== prevDecks){
      if(rulesLocked){
        // Guardrail: cannot change table rules mid-shoe.
        settingsDecks.value = String(prevDecks);
        showPopup('Table rules cannot be changed in the middle of a shoe.');
      }else{
        RULE_NUM_DECKS = v;
        decksChanged = true;
      }
    }
  }

  // v157: Cut card policy (table rule)
  const prevRandomCut = !!CUT_RANDOM_CUT_CARD;
  const prevPen = Number(CUT_PENETRATION_PERCENT) || 75;
  let cutChanged = false;

  if(!rulesLocked){
    // Determine new policy from modal.
    const wantRandom = !!(randomCutYes && randomCutYes.checked);
    let wantPen = prevPen;
    if(wantRandom){
      wantPen = 75;
    }else if(settingsPenetration){
      const n = parseInt(String(settingsPenetration.value), 10);
      if(Number.isFinite(n)) wantPen = n;
    }
    // Clamp + snap
    wantPen = Math.max(65, Math.min(90, wantPen));
    wantPen = Math.round(wantPen / 5) * 5;
    wantPen = Math.max(65, Math.min(90, wantPen));

    if(wantRandom !== prevRandomCut || wantPen !== prevPen){
      CUT_RANDOM_CUT_CARD = wantRandom;
      CUT_PENETRATION_PERCENT = wantPen;
      cutChanged = true;
      saveCutPolicyToStorage();
      try{ BJ.shoe && typeof BJ.shoe.setCutPolicy === 'function' && BJ.shoe.setCutPolicy({ randomCutCard: CUT_RANDOM_CUT_CARD, penetrationPercent: CUT_PENETRATION_PERCENT }); }catch(_e){}
    }
  }

  // H17/S17 + Surrender are table rules; lock mid-shoe.
  if(!rulesLocked){
    // H17/S17 (mutually exclusive UI)
    const hitYes = !!(hitSoft17Yes && hitSoft17Yes.checked);
    const stayYes = !!(staySoft17Yes && staySoft17Yes.checked);
    RULE_HIT_SOFT_17 = hitYes && !stayYes;

    // Surrender
    RULE_SURRENDER = !!(surrenderYes && surrenderYes.checked);
  }

  // v113B: Audio settings (apply even when table rules are locked)
  if(gameSoundsYes){
    setGameSoundsOn(!!gameSoundsYes.checked);
  }
  if(soundtrackYes || soundtrackNo){
    // Background soundtrack on/off
    const on = !!(soundtrackYes && soundtrackYes.checked);
    setSoundtrackOn(on);
  // v162D: Training Mode
  if(trainingModeYes || trainingModeNo){
    const on = !!(trainingModeYes && trainingModeYes.checked);
    setTrainingMode(on);
  }
  }
// v86: Only rebuild the shoe when decks actually changed (and only when allowed).
  if(decksChanged || cutChanged){
    newShuffledShoe(RULE_NUM_DECKS);
  }

  updateHud();
  setButtons();
}

// Settings modal: ACCEPT should be the default action.
function handleSettingsSave(){
  applySettingsFromModal();
  hideSettingsModal();
}

// Add Chips modal: apply exactly once.
let _addChipsOriginBroke = false;
let _addChipsAfterAction = null;
function handleAddChipsOk(){
  const okBtn = getEl('addChipsOkBtn');
  if(okBtn && okBtn.disabled) return;
  if(okBtn) okBtn.disabled = true;

  try{
    const addChipsAmt = getEl('addChipsAmt');
    const d = digitsOnly(addChipsAmt?.value || addChipsAmt?.placeholder || '0');
    let n = d ? parseInt(d,10) : 0;
    n = snapToNearest5(n);
    if(n <= 0) return;

    bankroll = roundMoney(bankroll + n);
    noNewBets = false;
    updateHud();

    const after = _addChipsAfterAction || pendingFundsAction;
    _addChipsAfterAction = null;
    pendingFundsAction = null;
    hideAddChipsModal();

    // If we came from the broke modal, it was hidden before opening Add Chips.
    _addChipsOriginBroke = false;

    if(typeof after === 'function') setTimeout(()=>after(), 0);
  }finally{
    // Re-enable on next tick so rapid clicks can't double-apply.
    setTimeout(()=>{ if(okBtn) okBtn.disabled = false; }, 0);
  }
}

function isModalVisible(id){
  const el = getEl(id);
  if(!el) return false;
  return !el.classList.contains('hidden') && el.style.display !== 'none';
}

// Keep the H17/S17 rows mutually exclusive (they are separate radio groups)
function enforceSoft17Mutual(changedId){
  const hitYes  = getEl('hitSoft17Yes');
  const hitNo   = getEl('hitSoft17No');
  const stayYes = getEl('staySoft17Yes');
  const stayNo  = getEl('staySoft17No');

  // If either "Yes" is selected, force the other row to "No".
  if(changedId === 'hitSoft17Yes' && hitYes?.checked){
    if(stayYes) stayYes.checked = false;
    if(stayNo) stayNo.checked = true;
  }
  if(changedId === 'staySoft17Yes' && stayYes?.checked){
    if(hitYes) hitYes.checked = false;
    if(hitNo) hitNo.checked = true;
  }
  // If either "No" is selected, force the other row to "Yes" (so exactly one rule is active).
  if(changedId === 'hitSoft17No' && hitNo?.checked){
    if(stayYes) stayYes.checked = true;
    if(stayNo) stayNo.checked = false;
  }
  if(changedId === 'staySoft17No' && stayNo?.checked){
    if(hitYes) hitYes.checked = true;
    if(hitNo) hitNo.checked = false;
  }
}

// (Delegated wiring consolidated below)

// Insurance state (kept separate from the main wager)
let insurancePending = false;
let insuranceBet = 0;   // dollars (can be in $0.50 increments)
let insuranceMax = 0;   // dollars
let insuranceResolve = null;
let insuranceHandlersBound = false;
// Step 7D3: When insurance is engine-owned, the modal resolves to a chosen amount
// without directly mutating bankroll/insuranceBet. The engine applies the wager.
let insuranceEngineMode = false;
let insuranceEngineBetTemp = 0;


// Round-level popup overrides to prevent duplicate outcome popups
// Example: player bust shows an immediate popup; we suppress the generic end-of-round popup.
let roundPopupOverride = null; // { type: 'playerBust'|'dealerBust', amount: number }

/*** Game state ***/
let dealerHand = [];
let holeDown = true;
// v94: keep dealer total frozen to upcard while the hole card flip animation plays
let dealerTotalHold = false;
// Number of dealer cards whose positions/animations are complete (used to delay total updates)
let dealerVisibleCount = 0;

// v131C: keep player total frozen until the newly dealt card is flipped and visible
let playerTotalHold = false;
let playerVisibleCount = 0;

// Split-hand model: array of hands, play one at a time
let hands = []; // [{cards:[], isAceSplit:false, done:false, outcome:null}]
let activeHandIndex = 0;
let inRound = false;
let doubledThisHand = false;
let testSplits = false;

// Dev-only insurance forcing:
//  - 'bj'   => Dealer shows Ace + 10-value (blackjack)
//  - 'noBj' => Dealer shows Ace + 9 (no blackjack)
let testInsuranceMode = null;

// v173D: One-shot debug helpers for forcing initial blackjacks.
let forcePlayerBlackjackNext = false;
let forceDealerBlackjackNext = false;


/*** Rendering ***/
// ---------------------------------------------------------------------------
// SAFARI POST-FLIP "1 CARD HEIGHT DROP" BUG (historic, fixed in v84)
// ---------------------------------------------------------------------------
// Symptom (Safari only): right after a facedown card reveals its face, the card
// visually drops downward by EXACTLY one card height for a single frame.
//
// What made it hard to kill:
//  - We tried many flip styles (rotateY, scaleX mirror, squeeze flip, front/back
//    stacks, single-element swaps). The drop persisted.
//  - It was NOT JS timing, Y math, translateY, or reflow from our game logic.
//
// Root cause (Safari/WebKit compositor):
//  - Applying transforms (translate3d) to an ABSOLUTE/POSITIONED layout element
//    that participates in the lane layout causes Safari to briefly re-anchor the
//    element against the wrong vertical containing block when the card face DOM
//    changes (mid-flip paint). That re-anchoring manifests as a 1-card-height
//    jump.
//
// Architectural rule going forward (DO NOT VIOLATE):
//  - NO transforms on positioned/layout elements (.cardShell, .cardAnchor, lane
//    wrappers, etc.).
//  - Transforms ONLY on inner animation-only elements:
//      * .cardMover  => slide / deal translate3d(x,y,0)
//      * .cardVisual => flip (squeeze) scaleX(...) and midpoint face swap
//
// Additional gotcha we hit:
//  - v82 contained BOTH a legacy inline script in index.html and a newer
//    external script.js. Safari was running the legacy inline path, so fixes
//    in script.js did "nothing". v84 removed the inline legacy script and
//    ensured index.html uses ONLY <script src="script.js">.
//
// If the Safari drop ever comes back, the first things to check are:
//  1) Did someone reintroduce a transform on .cardAnchor / .cardShell?
//  2) Did index.html accidentally regain an inline legacy script?
// ---------------------------------------------------------------------------

// v82: Safari-first flip stability
// Use a single visual element per dealt card and swap its content at the flip midpoint.
// This avoids Safari compositor glitches seen with two-face front/back stacks.
const CARD_FRONT_HTML = new WeakMap(); // shell -> front innerHTML
const CARD_FRONT_IS_ART = new WeakMap(); // shell -> boolean


function dispatchCardRevealedFromShell(shell){
  try{
    if(!shell || !shell.dataset) return;
    const id = shell.dataset.cardId;
    const rank = shell.dataset.rank;
    if(!id || !rank) return;
    const ev = new CustomEvent('cardRevealed', { detail: { id: String(id), rank: String(rank) } });
    document.dispatchEvent(ev);
  }catch(_e){ /* ignore */ }
}

function makeCardEl(){
  const d=document.createElement("div");
  d.className="card";
  return d;
}

function renderCardShell(card, faceUp=true, artOnly=false){
  const shell = document.createElement('div');
  shell.className = 'cardShell';
  // Desired final state (used by animation + debug logging)
  shell.dataset.faceUp = faceUp ? '1' : '0';
  try{
    if(card && card.id) shell.dataset.cardId = String(card.id);
    if(card && card.r) shell.dataset.rank = String(card.r);
  }catch(_e){}

  // Stable shell + anchor + mover + stage + ONE visual element.
  // IMPORTANT:
  //   - .cardShell and .cardAnchor are positioned/layout elements and MUST NEVER be transformed.
  //   - .cardMover is the ONLY owner of slide translate3d(x,y,0).
  //   - .cardVisual is the ONLY owner of flip transforms (scaleX squeeze).
  const anchor = document.createElement('div');
  anchor.className = 'cardAnchor';

  const mover = document.createElement('div');
  mover.className = 'cardMover';

  const stage = document.createElement('div');
  stage.className = 'cardStage';

  const visual = makeCardEl();
  visual.classList.add('cardVisual');

  // Prebuild front markup once and store it for midpoint swap.
  const frontEl = renderCard(card, false, artOnly);
  CARD_FRONT_HTML.set(shell, frontEl.innerHTML);
  CARD_FRONT_IS_ART.set(shell, !!artOnly);

  if(faceUp){
    visual.classList.remove('back');
    visual.innerHTML = frontEl.innerHTML;
    // v171D: count systems need to see initially face-up cards too
    // (initial deal upcards were previously not emitting `cardRevealed`).
    dispatchCardRevealedFromShell(shell);
  }else{
    visual.classList.add('back');
    visual.innerHTML = '';
  }

  stage.appendChild(visual);
  mover.appendChild(stage);
  anchor.appendChild(mover);
  shell.appendChild(anchor);
  return shell;
}
function faceImageName(card){
  const s = card.s;
  if(card.r==="J") return `${s}_jack.png`;
  if(card.r==="Q") return `${s}_queen.png`;
  if(card.r==="K") return `${s}_king.png`;
  if(card.r==="A" && s==="spades") return `spades_ace.png`;
  return null;
}

const PIP_POS = {
  "A": [[50,50,"large"]],
  "2": [[50,22],[50,78]],
  "3": [[50,22],[50,50],[50,78]],
  "4": [[35,24],[65,24],[35,76],[65,76]],
  "5": [[35,24],[65,24],[50,50],[35,76],[65,76]],
  "6": [[35,24],[65,24],[35,50],[65,50],[35,76],[65,76]],
  // Bicycle-style 7–10: smaller center pips, more breathing room, clear stacking symmetry
  "7": [[35,18],[65,18],[50,33],[35,50],[65,50],[35,74],[65,74]],
  "8": [[35,18],[65,18],[50,32],[35,46],[65,46],[50,60],[35,74],[65,74]],
  "9": [[35,16],[65,16],[35,32],[65,32],[50,46],[35,62],[65,62],[35,78],[65,78]],
  // Ten: five pips per side with a centered pair (classic casino layout)
  "10":[[35,14],[65,14],[35,28],[65,28],[35,42],[65,42],[35,58],[65,58],[35,72],[65,72]],
};

function renderCard(card, facedown=false, artOnly=false){
  const el = makeCardEl();

  if(facedown){
    el.classList.add("back");
    return el;
  }

  if(artOnly){
    const art=document.createElement("div");
    art.className="artOnly";
    const img=document.createElement("img");
    img.src = `images/${faceImageName(card)}`;
    img.alt = `${card.r} of ${card.s}`;
    art.appendChild(img);
    el.appendChild(art);
    return el;
  }

  // pip card
  const isRed = (card.s==="hearts" || card.s==="diamonds");
  const cornerTop=document.createElement("div");
  cornerTop.className = "corner " + (isRed ? "red":"black");
  cornerTop.innerHTML = `<div class="rank">${card.r}</div><div class="suit">${SUIT_CHAR[card.s]}</div>`;
  const cornerBot=cornerTop.cloneNode(true);
  cornerBot.classList.add("bottom");

  const frame=document.createElement("div");
  frame.className="inner-frame";

  const area=document.createElement("div");
  area.className="pip-area " + (isRed ? "red":"black") + " suit-" + card.s + " rank-" + card.r;

  const positions = PIP_POS[card.r] || PIP_POS["A"];
  for(const p of positions){
    const [x,y,sz]=p;
    const pip=document.createElement("div");
    pip.className="pip" + (sz ? (" "+sz):"");
    pip.textContent = SUIT_CHAR[card.s];
    pip.style.left = x+"%";
    pip.style.top  = y+"%";
    if(y>50 && card.r!=="A") pip.style.transform = "translate(-50%,-50%) rotate(180deg)";
    area.appendChild(pip);
  }

  el.appendChild(cornerTop);
  el.appendChild(cornerBot);
  el.appendChild(frame);
  el.appendChild(area);
  return el;
}

function clearHighlights(){
  dealerArea.classList.remove("winGlow","dim");
  playerArea.classList.remove("winGlow","dim");
}


function computeChipsInAction(){
  if(!inRound) return 0;
  let total = 0;
  if(Array.isArray(hands)){
    for(const h of hands){
      const w = (h && typeof h.wager === 'number') ? h.wager : 0;
      total = roundMoney(total + w);
    }
  }
  if(typeof insuranceBet === 'number' && insuranceBet > 0){
    total = roundMoney(total + insuranceBet);
  }
  return total;
}

function updateHud(){
  // Enforce chip denominations: $0.50 increments, $5 minimum, and never exceed bankroll.
  bet = clampToHalfDollar(bet);
  bet = Math.max(5, bet);
  // Only clamp the bet to bankroll when we're NOT in a round.
  // During a round the wager is tracked per-hand (h.wager), and bankroll can be 0.
  if(!inRound){
    bet = Math.min(bet, bankroll);
  }
  bankrollAmt.textContent = fmtMoney(bankroll);
  betAmt.textContent = fmtMoney(bet);
  if(actionAmt) actionAmt.textContent = fmtMoney(computeChipsInAction());

    updateCountPill();

  setButtons();
}

function totalDisplay(hand){
  if(!hand || !hand.length) return "";
  // v140C: show only ONE total — the best playable total (highest <= 21).
  // (No more "low / high" soft-hand display.)
  const clean = hand.filter(Boolean);
  if(!clean.length) return "";
  return String(handTotal(clean));
}

function visibleDealerCards(){
  if(!inRound) return dealerHand;
  // During dealer animations, freeze the displayed total to the cards that are fully in place.
  if(dealerTotalHold){
    const n = Math.max(1, Math.min(dealerHand.length, dealerVisibleCount || 1));
    return dealerHand.slice(0, n);
  }
  if(holeDown) return [dealerHand[0]]; // only the upcard is visible
  return dealerHand;
}

function visiblePlayerCards(){
  const ch = currentHand();
  const cards = (ch && Array.isArray(ch.cards)) ? ch.cards : [];
  if(!inRound) return cards;
  if(playerTotalHold){
    const n = Math.max(0, Math.min(cards.length, playerVisibleCount || 0));
    return cards.slice(0, n);
  }
  return cards;
}

function beginPlayerTotalHold(visibleCount){
  playerTotalHold = true;
  playerVisibleCount = Math.max(0, Number(visibleCount) || 0);
}
function endPlayerTotalHold(){
  playerTotalHold = false;
  playerVisibleCount = 0;
  updateLabels();
}

function currentHand(){
  return hands[activeHandIndex] || {cards:[]};
}

function updateLabels(){
  // Dealer
  const dv = totalDisplay(visibleDealerCards());
  dealerLabel.textContent = "DEALER";
  dealerValue.textContent = dv;

  // Player label depends on split state
  const multi = hands.length > 1;
  if(multi){
    playerLabel.textContent = `PLAYER – HAND ${activeHandIndex+1}`;
  }else{
    playerLabel.textContent = "PLAYER";
  }
  const pv = totalDisplay(visiblePlayerCards());
  playerValue.textContent = pv;
}

function roundTotalsBlock(){
  // Only show these lines when totals were hidden during play.
  if(SHOW_HAND_TOTALS) return '';
  const d = totalDisplay(dealerHand || []);
  let p = '';
  if(Array.isArray(hands) && hands.length > 1){
    p = hands.map(h=>totalDisplay((h && h.cards) ? h.cards : [])).join(' | ');
  }else{
    const h0 = (hands && hands[0]) ? hands[0] : {cards:[]};
    p = totalDisplay(h0.cards || []);
  }
  return `\nDealer: ${d}\nPlayer: ${p}`;
}

function layoutLaneCards(laneEl){
  try{
    if(!laneEl) return;

    // v60: cards are absolutely positioned inside the lane so they never re-enter flex layout
    // after animation cleanup (this prevents the post-flip vertical "drop").
    laneEl.style.position = 'relative';
    laneEl.style.display = 'block';

    const cs = getComputedStyle(document.documentElement);
    const cardW = parseFloat(cs.getPropertyValue('--cardW')) || 204;
    const gap = 14;
    const overlap = laneEl.classList.contains('overlap');
    const step = overlap ? (cardW * 0.5 + gap) : (cardW + gap);

    const kids = Array.from(laneEl.children);
    for(let i=0;i<kids.length;i++){
      const shell = kids[i];
      const left = Math.round(i * step);
      shell.style.position = 'absolute';
      shell.style.top = '0px';
      shell.style.left = left + 'px';
      shell.style.marginLeft = '0px';
    }
  }catch(_e){}
}

function renderHands(){
  try{
    if(!dealerLane || !playerLane){
      dbgError(new Error('dealerLane/playerLane not found in DOM'), 'renderHands');
      return;
    }

    // Build desired render lists (in order).
    const dealerDesired = [];
    for(let i=0;i<(dealerHand||[]).length;i++){
      const c = dealerHand[i];
      if(!c || c.cut) continue;
      const facedown = (i===1 && holeDown);
      const faceUp = !facedown;
      const art = faceUp && !!faceImageName(c) && (c.r!=="A" || c.s==="spades");
      dealerDesired.push({card:c, faceUp, art});
    }

    const playerDesired = [];
    const ch = currentHand();
    for(let i=0;i<((ch.cards)||[]).length;i++){
      const c = ch.cards[i];
      if(!c || c.cut) continue;
      const art = !!faceImageName(c) && (c.r!=="A" || c.s==="spades");
      playerDesired.push({card:c, faceUp:true, art});
    }

    // overlap >4 cards
    dealerLane.classList.toggle("overlap", dealerDesired.length > 4);
    playerLane.classList.toggle("overlap", playerDesired.length > 4);

    // Helper: extract current shell children
    const shellsOf = (lane)=> Array.from(lane.children).filter(el=>el && el.classList && el.classList.contains('cardShell'));

    // v64 FIX: Never clear and rebuild whole lanes during dealing/flip.
    // Replacing DOM nodes was causing the visible "drop" (old animated node removed,
    // new node inserted at a slightly different baseline). Instead, we reconcile in place:
    //   - keep existing .cardShell nodes
    //   - update their contents/state as needed
    //   - append missing nodes
    //   - remove extras from the end

    const updateCardShellInPlace = (shell, card, faceUp, artOnly)=>{
      try{
        if(!shell) return;
        shell.dataset.faceUp = faceUp ? '1' : '0';
        try{
          if(card && card.id) shell.dataset.cardId = String(card.id);
          if(card && card.r) shell.dataset.rank = String(card.r);
        }catch(_e){}
  try{
    if(card && card.id) shell.dataset.cardId = String(card.id);
    if(card && card.r) shell.dataset.rank = String(card.r);
  }catch(_e){}

        // v73/v83: Ensure a dedicated cardAnchor (layout only) and cardMover (slide transforms) exist.
        // Shell & anchor stay purely layout/positioning; mover owns translate3d; stage is perspective only.
        let anchor = shell.querySelector(":scope > .cardAnchor");
        if(!anchor){
          anchor = document.createElement("div");
          anchor.className = "cardAnchor";
          // Move any existing stage/flip content under the new anchor.
          const legacyStage = shell.querySelector(":scope > .cardStage");
          const legacyFlip = shell.querySelector(":scope > .cardFlip");
          shell.appendChild(anchor);
          if(legacyStage) anchor.appendChild(legacyStage);
          if(legacyFlip) anchor.appendChild(legacyFlip);
        }



        // v83: Ensure a dedicated cardMover exists under the anchor.
        // Anchor remains untransformed; mover receives all slide translate3d.
        let mover = anchor.querySelector(":scope > .cardMover");
        if(!mover){
          mover = document.createElement("div");
          mover.className = "cardMover";
          while(anchor.firstChild){ mover.appendChild(anchor.firstChild); }
          anchor.appendChild(mover);
        }

        let stage = mover.querySelector(":scope > .cardStage");
        if(!stage){
          stage = document.createElement("div");
          stage.className = "cardStage";
          mover.appendChild(stage);
        }

        // v82: Single visual element (no front/back face stack)
        let visual = stage.querySelector('.cardVisual');
        if(!visual){
          // Remove any legacy flip structure (from older versions) to prevent Safari
          // compositor confusion.
          while(stage.firstChild){ stage.removeChild(stage.firstChild); }
          visual = makeCardEl();
          visual.classList.add('cardVisual');
          stage.appendChild(visual);
        }

        // Prebuild front markup and store it for midpoint swapping.
        const frontEl = renderCard(card, false, artOnly);
        CARD_FRONT_HTML.set(shell, frontEl.innerHTML);
        CARD_FRONT_IS_ART.set(shell, !!artOnly);

        const wasBack = visual.classList.contains('back');
        if(faceUp){
          visual.classList.remove('back');
          visual.innerHTML = frontEl.innerHTML;
          // v171D: if a previously face-down shell becomes visible via in-place sync
          // (e.g., dealer blackjack immediate reveal), emit cardRevealed now.
          if(wasBack) dispatchCardRevealedFromShell(shell);
        }else{
          visual.classList.add('back');
          visual.innerHTML = '';
        }
      }catch(_e){}
    };

    const lockShellVertical = (s)=>{
      try{
        s.style.top = '0px';
        s.style.marginTop = '0px';
        s.style.alignSelf = 'flex-start';

        // v80: Never use the individual `translate:` property on Safari.
        // Keep the shell completely out of any transform pipeline.
        s.style.transform = 'none';
        s.style.willChange = 'auto';
        // Clear any legacy per-element translate usage.
        s.style.translate = '';
      }catch(_e){}
    };

    const syncLane = (lane, desired)=>{
      const shells = shellsOf(lane);

      // Update / create shells to match desired list
      for(let i=0;i<desired.length;i++){
        const d = desired[i];
        let s = shells[i];
        if(!s){
          s = renderCardShell(d.card, d.faceUp, d.art);
          lane.appendChild(s);
        }else{
          updateCardShellInPlace(s, d.card, d.faceUp, d.art);
        }
        s.style.zIndex = String(i+1);
        lockShellVertical(s);
      }

      // Remove any extra shells from the end (do NOT clear the whole lane)
      if(shells.length > desired.length){
        for(let i=shells.length-1;i>=desired.length;i--){
          try{ shells[i].remove(); }catch(_e){}
        }
      }

      // Position cards horizontally
      layoutLaneCards(lane);

      // Re-lock vertical post-layout (belt + suspenders)
      for(const s of shellsOf(lane)) lockShellVertical(s);
    };

    syncLane(dealerLane, dealerDesired);
    syncLane(playerLane, playerDesired);

    updateLabels();
  }catch(err){
    dbgError(err, 'renderHands');
    // keep UI from wedging: leave lanes as-is but do not throw
  }
}

async function animateLastDealtCard(laneEl, reveal=true){
  // IMPORTANT: This must never be allowed to throw. If animation fails for any reason,
  // we still want the round logic to continue.
  try{
    if(!laneEl) return;
    const shell = laneEl.lastElementChild;
    if(!shell) return;
    const visual = shell.querySelector('.cardVisual');
    if(!visual) return;

    // v73/v83: slide should happen on cardMover (transform-only), not on shell/anchor.
    let anchor = shell.querySelector(':scope > .cardAnchor') || shell.querySelector('.cardAnchor');
    if(!anchor){
      anchor = document.createElement('div');
      anchor.className = 'cardAnchor';
      while(shell.firstChild){ anchor.appendChild(shell.firstChild); }
      shell.appendChild(anchor);
    }

    // v83: Ensure slide mover exists under the anchor and owns ALL translate3d.
    let mover = anchor.querySelector(':scope > .cardMover') || anchor.querySelector('.cardMover');
    if(!mover){
      mover = document.createElement('div');
      mover.className = 'cardMover';
      while(anchor.firstChild){ mover.appendChild(anchor.firstChild); }
      anchor.appendChild(mover);
    }

    // ------------------------------
    // Animation debug logging (off by default)
    // ------------------------------
    // Enable by setting `window.YBJ_ANIM_DEBUG = true` in the console.
    const DEBUG_ANIM = (typeof window !== 'undefined') && !!window.YBJ_ANIM_DEBUG;

    // Flattened snapshots (easy to paste, easy to read)
    const tagEl = (el)=>{
      try{
        if(!el) return '';
        const id = el.id ? `#${el.id}` : '';
        const cls = (el.className && typeof el.className==='string' && el.className.trim()) ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
        return `${el.tagName.toLowerCase()}${id}${cls}`;
      }catch(_e){ return ''; }
    };

    const rectTop = (el)=>{ try{ return Math.round(el.getBoundingClientRect().top); }catch(_e){ return 0; } };
    const rectLeft= (el)=>{ try{ return Math.round(el.getBoundingClientRect().left); }catch(_e){ return 0; } };
    const rectW   = (el)=>{ try{ return Math.round(el.getBoundingClientRect().width); }catch(_e){ return 0; } };
    const rectH   = (el)=>{ try{ return Math.round(el.getBoundingClientRect().height); }catch(_e){ return 0; } };
    const cstyle  = (el)=>{ try{ return getComputedStyle(el); }catch(_e){ return {}; } };

    const snap = (tag, extra={})=>{
      try{
        if(!DEBUG_ANIM) return;
        const shellParent = shell.parentElement;
        const lane = laneEl;
        const laneParent = lane ? lane.parentElement : null;
        const table = laneParent ? laneParent.parentElement : null;

        const shellCS = cstyle(shell);
        const visCS  = cstyle(visual);

        console.log(`[YBJ v97B] ${tag}` , {
          lane: lane && lane.id ? lane.id : (lane && lane.className ? lane.className : '(lane)'),
          reveal: !!reveal,
          wantFaceUp: shell && shell.dataset ? (shell.dataset.faceUp || '') : '',

          shellParentExists: !!shellParent,
          shellTop: rectTop(shell),
          shellLeft: rectLeft(shell),
          shellW: rectW(shell),
          shellH: rectH(shell),
          shellPos: shellCS.position || '',
          shellCT: shellCS.transform || '',
          shellTranslate: (shell && shell.style ? (shell.style.translate||'') : ''),

          visualTop: rectTop(visual),
          visualLeft: rectLeft(visual),
          visualW: rectW(visual),
          visualH: rectH(visual),
          visualCT: visCS.transform || '',
          visualCls: (visual && visual.className) ? visual.className : '',

          laneTop: rectTop(lane),
          laneH: rectH(lane),
          laneCT: lane ? (cstyle(lane).transform || '') : '',
          laneCls: lane ? (lane.className || '') : '',

          laneParentTop: rectTop(laneParent),
          laneParentH: rectH(laneParent),
          laneParentCls: laneParent ? (laneParent.className || '') : '',

          tableTop: rectTop(table),
          tableH: rectH(table),
          tableCls: table ? (table.className || '') : '',

          ...extra,
        });
      }catch(_e){}
    };

    // Mutation tripwire: flattened
    let ybjObs = null;
    const startMutationTripwire = ()=>{
      try{
        if(!DEBUG_ANIM) return;
        const targets = [shell, shell.parentElement, laneEl, laneEl && laneEl.parentElement].filter(Boolean);
        ybjObs = new MutationObserver((muts)=>{
          try{
            for(const m of muts){
              if(m.type !== 'attributes') continue;
              const t = m.target;
              console.log('[YBJ v97B] MUTATION', {
                attr: m.attributeName,
                target: tagEl(t),
                old: m.oldValue || '',
                nowClass: (t.className && typeof t.className==='string') ? t.className : '',
                nowStyle: (t.getAttribute && t.getAttribute('style')) ? t.getAttribute('style') : ''
              });
            }
          }catch(_e){}
        });
        for(const t of targets){
          ybjObs.observe(t, { attributes:true, attributeFilter:['class','style'], attributeOldValue:true });
        }
        setTimeout(()=>{ try{ ybjObs && ybjObs.disconnect(); }catch(_e){} }, 700);
      }catch(_e){}
    };
    // v82: Safari-first animation pipeline
    // - Slide uses ONLY transform: translate3d on the cardMover (no `translate:` property)
    // - Flip uses ONLY transform: scaleX on the single cardVisual (no stacked faces)

    // Sync slide + flip timing to the deal/flip audio clip (preserves overall feel).
    const total = Math.max(0.20, Number(dealFlipSfxDur) || 0.50);
    const slideDur = Math.max(0.12, total * 0.72);
    const flipDur  = Math.max(0.08, total - slideDur);
    const slideMs = intMs(slideDur);
    const flipMs  = intMs(flipDur);
    const halfFlipMs = Math.max(1, Math.floor(flipMs / 2));

    // Start fully off-screen to the right (viewport-based, not lane-based).
    const vw = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
    const startX = Math.max(600, vw + 240);

    shell.style.alignSelf = 'flex-start';
    shell.style.marginTop = '0px';

    // Ensure known starting state.
    visual.style.willChange = 'transform';

    snap('A_before');
    startMutationTripwire();

    // If this card should end face-up, begin the animation sequence face-down.
    // (Flip happens after slide.)
    if(reveal){
      // Start face-down visually, regardless of final state.
      visual.style.transition = 'none';
      visual.style.transform = 'translate3d(0px, 0px, 0px) scaleX(1)';
      visual.classList.add('back');
      visual.innerHTML = '';
      void visual.offsetWidth;
    }

    // Stage 1: place offscreen (X only), no transitions yet
    anchor.style.transition = 'none';
    mover.style.transform = `translate3d(${startX}px, 0px, 0px)`;

    // Force style flush
    void anchor.offsetWidth;

    // Stage 2: slide to rest using transform only (X only)
    mover.style.transition = `transform ${slideMs}ms ease-out`;
    mover.style.transform = 'translate3d(0px, 0px, 0px)';

    // Start SFX at the same moment slide begins (preserves existing behavior).
    playDealFlip();

    await pause(slideMs);
    mover.style.transition = 'none';
    mover.style.transform = 'translate3d(0px, 0px, 0px)';
    void anchor.offsetWidth;
    snap('B_afterSlide');

    // Stage 3: flip (squeeze -> swap -> expand)
    if(reveal){
      // Squeeze
      visual.style.transition = `transform ${halfFlipMs}ms ease-in`;
      visual.style.transform = 'translate3d(0px, 0px, 0px) scaleX(0.02)';
      await pause(halfFlipMs);

      // Swap content at the midpoint (while nearly zero-width)
      visual.classList.remove('back');
      visual.innerHTML = CARD_FRONT_HTML.get(shell) || '';
      // v171D: announce reveal to counting systems
      dispatchCardRevealedFromShell(shell);
      void visual.offsetWidth;

      // Expand
      const remain = Math.max(1, flipMs - halfFlipMs);
      visual.style.transition = `transform ${remain}ms ease-out`;
      visual.style.transform = 'translate3d(0px, 0px, 0px) scaleX(1)';
      await pause(remain);
    }

    // Cleanup: keep everything explicitly at rest to avoid compositor relayering.
    mover.style.transition = 'none';
    mover.style.transform = 'translate3d(0px, 0px, 0px)';
    visual.style.transition = '';
    visual.style.transform = 'translate3d(0px, 0px, 0px) scaleX(1)';

    snap('D_afterCleanup');

    requestAnimationFrame(()=>{
      try{ snap('E_rAF1'); }catch(_e){}
      requestAnimationFrame(()=>{
        try{ snap('F_rAF2'); }catch(_e){}
      });
    });
    setTimeout(()=>{ try{ snap('G_250ms'); }catch(_e){} }, 250);

  }catch(err){
    console.error('animateLastDealtCard failed', err);
  }

}

// Reveal the dealer's hole card with the same squeeze-flip used for dealt cards,
// without re-sliding the card (it is already in position).
async function animateRevealDealerHoleCard(){
  try{
    if(!dealerLane) return;
    const shells = Array.from(dealerLane.children).filter(el=>el && el.classList && el.classList.contains('cardShell'));
    const holeShell = shells[1];
    if(!holeShell) return;

    const visual = holeShell.querySelector('.cardVisual');
    if(!visual) return;

    // Use the same audio-derived timing as a normal deal/flip, but only the flip portion.
    const total = Math.max(0.20, Number(dealFlipSfxDur) || 0.50);
    const flipDur = Math.max(0.12, total * 0.52);
    const flipMs = intMs(flipDur);
    const halfFlipMs = Math.max(1, Math.floor(flipMs / 2));

    // Ensure starting (face-down) state.
    visual.style.willChange = 'transform';
    visual.style.transition = 'none';
    visual.style.transform = 'translate3d(0px, 0px, 0px) scaleX(1)';
    visual.classList.add('back');
    visual.innerHTML = '';
    void visual.offsetWidth;

    // Squeeze
    visual.style.transition = `transform ${halfFlipMs}ms ease-in`;
    visual.style.transform = 'translate3d(0px, 0px, 0px) scaleX(0.02)';
    await pause(halfFlipMs);

    // Midpoint swap: face-up content
    visual.classList.remove('back');
    visual.innerHTML = CARD_FRONT_HTML.get(holeShell) || '';
    // v171D: announce reveal to counting systems
    dispatchCardRevealedFromShell(holeShell);
    void visual.offsetWidth;

    // Expand
    const remain = Math.max(1, flipMs - halfFlipMs);
    visual.style.transition = `transform ${remain}ms ease-out`;
    visual.style.transform = 'translate3d(0px, 0px, 0px) scaleX(1)';
    await pause(remain);

    visual.style.transition = '';
    visual.style.transform = 'translate3d(0px, 0px, 0px) scaleX(1)';
  }catch(_e){}
}



function showInsuranceModal(maxBet){
  insuranceCapCurrent = Number(maxBet) || 0;
  if(!ensureInsuranceRefs()){
    // If modal markup isn't in the DOM yet (or is missing), don't freeze the round.
    insurancePending = false;
    insuranceBet = 0;
    const r = insuranceResolve;
    insuranceResolve = null;
    if(typeof r === 'function') r();
    return;
  }
  insurancePending = true;
  insuranceBet = 0;
  insuranceMax = Math.max(0, Number(maxBet) || 0);

  // Dim cards only (not controls)
  dealerArea.classList.add('dim');
  playerArea.classList.add('dim');

  const maxDisp = clampToHalfDollar(insuranceMax);

  insuranceChoiceRow.style.display = '';
  insuranceBetRow.style.display = 'none';
  insAmt.min = '0';
  insAmt.step = '0.5';
  insAmt.max = String(maxDisp.toFixed(2));
  // Default to max (common UX) but allow $0.50 increments
  insAmt.value = String(maxDisp.toFixed(2));
  insuranceMaxNote.textContent = `Max insurance: $${maxDisp.toFixed(2)}`;

  insuranceModal.classList.remove('hidden');
  insuranceModal.style.display = 'flex';
  insuranceModal.style.pointerEvents = 'auto';

  // Safety: ensure the modal is actually visible; if not, force it visible so the game can't stall.
  requestAnimationFrame(()=>{
    try{
      if(!insurancePending) return;
      insuranceModal.classList.remove('hidden');
      if(getComputedStyle(insuranceModal).display === 'none'){
        insuranceModal.style.display = 'flex';
      }
      // Put focus on a choice button so keyboard users can act immediately.
      if(insYesBtn) insYesBtn.focus();
    }catch(_e){
      // If something goes sideways, don't let the round freeze waiting for insurance.
      hideInsuranceModal();
      const r = insuranceResolve;
      insuranceResolve = null;
      if(typeof r === 'function') r();
    }
  });
}

function hideInsuranceModal(){
  if(!ensureInsuranceRefs()) { insurancePending = false; return; }
  insuranceModal.classList.add('hidden');
  // IMPORTANT: The modal is shown via an inline style (display:flex). A class alone may not override
  // it, which can leave an invisible overlay blocking clicks and make the game feel "frozen".
  insuranceModal.style.display = 'none';
  insuranceModal.style.pointerEvents = 'none';
  insurancePending = false;
  // Always reset insurance UI for next time
  insuranceChoiceRow.style.display = '';
  insuranceBetRow.style.display = 'none';
  insAmt.value = '';
  // Remove dim; gameplay will re-apply outcome dimming later
  dealerArea.classList.remove('dim');
  playerArea.classList.remove('dim');
}

// Insurance button handlers (bound once)
function bindInsuranceHandlers(){
  if(insuranceHandlersBound) return;
  if(!ensureInsuranceRefs()) return;
  insuranceHandlersBound = true;
  insYesBtn.onclick = () => {
    // If there's no bankroll available for insurance, offer to add funds.
    if(insuranceCapCurrent <= 0){
      hideInsuranceModal();
      showFundsModal({
        title: 'Insufficient Funds',
        note: 'Add chips to place INSURANCE, or continue the hand.',
        allowContinue: true,
        reason: 'insurance',
        afterAdd: ()=>{
          // Recompute cap and re-show the insurance modal (same pending promise).
          const player0 = hands[0];
          const maxIns = (player0.wager || bet) / 2;
          const cap = clampToHalfDollar(Math.max(0, Math.min(maxIns, bankroll)));
          showInsuranceModal(cap);
        }
      });
      return;
    }

    insuranceChoiceRow.style.display = 'none';
    insuranceBetRow.style.display = '';
    insAmt.focus();
    insAmt.select();
  };

  function resolveInsurance(){
    const r = insuranceResolve;
    insuranceResolve = null;
    if(typeof r === 'function'){
      // In engine-mode, resolve with the chosen bet amount.
      if(insuranceEngineMode){
        const amt = insuranceEngineBetTemp;
        insuranceEngineBetTemp = 0;
        insuranceEngineMode = false;
        r(amt);
      }else{
        r();
      }
    }
  }

  insNoBtn.onclick = () => {
    if(insuranceEngineMode){
      insuranceEngineBetTemp = 0;
    }else{
      insuranceBet = 0;
    }
    // Reset UI state
    insuranceChoiceRow.style.display = '';
    insuranceBetRow.style.display = 'none';
    insAmt.value = '';
    hideInsuranceModal();
    resolveInsurance();
  };

  insCancelBtn.onclick = () => {
    if(insuranceEngineMode){
      insuranceEngineBetTemp = 0;
    }else{
      insuranceBet = 0;
    }
    // Cancel means: no insurance bet placed, resume play immediately
    insuranceChoiceRow.style.display = '';
    insuranceBetRow.style.display = 'none';
    insAmt.value = '';
    hideInsuranceModal();
    resolveInsurance();
  };

  insConfirmBtn.onclick = () => {
    const maxBet = Number(insAmt.max || '0');
    let v = Number(insAmt.value);
    if(!Number.isFinite(v)) v = 0;
    v = clampToHalfDollar(v);

    // Clamp to max insurance and available bankroll
    const maxAllowed = Math.max(0, Math.min(maxBet, bankroll));
    v = Math.max(0, Math.min(v, maxAllowed));
    // Avoid floating drift
    v = roundMoney(v);

    if(insuranceEngineMode){
      // Engine will apply bankroll changes; we only return the chosen amount.
      insuranceEngineBetTemp = v;
    }else{
      insuranceBet = v;
      bankroll = Math.max(0, roundMoney(bankroll - insuranceBet));
      updateHud();
    }

    hideInsuranceModal();
    resolveInsurance();
  };
}

function awaitInsurance(maxBet){
  return new Promise((resolve)=>{
    insuranceResolve = resolve;
    showInsuranceModal(maxBet);
  });
}

// Step 7D3: Engine-owned insurance.
// Shows the same insurance modal, but resolves with the chosen amount (0 = decline)
// and does NOT mutate bankroll/insuranceBet directly.
function awaitInsuranceEngine(maxBet){
  return new Promise((resolve)=>{
    insuranceEngineMode = true;
    insuranceEngineBetTemp = 0;
    insuranceResolve = resolve;
    showInsuranceModal(maxBet);
  });
}

async function maybeOfferInsuranceAndPeek(){
  const up = dealerHand[0];
  const player0 = hands[0];
  const playerBJ = isBlackjack(player0.cards, !!player0.fromSplit);

  // Offer insurance only if dealer shows Ace
  if(up && up.r === 'A'){
    const maxIns = (player0.wager || bet) / 2;
    // Insurance is up to half the main wager, in $0.50 increments
    const cap = clampToHalfDollar(Math.max(0, Math.min(maxIns, bankroll)));

    // Always show modal (even if cap==0); player can decline
    await awaitInsurance(cap);
  }

  // Dealer peeks for blackjack if showing Ace or 10-value
  const showsAce = up && up.r === 'A';
  const showsTen = up && isTenGroup(up.r);
  if(showsAce || showsTen){
    const dealerBJ = isBlackjack([dealerHand[0], dealerHand[1]], false);
    if(dealerBJ){
      await settleDealerBlackjack(playerBJ);
      return true;
    }
    // If player bought insurance and dealer does NOT have blackjack, settle insurance now
    if(showsAce && insuranceBet > 0){
      await showInsuranceResultModal("You lose insurance!");
      // bankroll already deducted when insurance was placed
      // Clear it so it cannot affect later settlement / UI for this round.
      insuranceBet = 0;
    }
  }

  // If player has blackjack and dealer does not, pay 3:2 now
  if(playerBJ){
    await settlePlayerBlackjack();
    return true;
  }

  return false;
}

async function settleDealerBlackjack(playerBJ){
  const myToken = cycleToken;
  // Reveal the hole card visually, but delay the total update until the reveal completes
  dealerTotalHold = true;
  dealerVisibleCount = 1;

  holeDown = false;
  renderHands();
  // (Dealer blackjack path uses a short pause instead of the full flip animation.)
  await pause(220);

  dealerVisibleCount = dealerHand.length;
  dealerTotalHold = false;
  updateLabels();

  // Insurance resolves only on dealer blackjack
  if(insuranceBet > 0){
    const insWin = insuranceBet * 2; // profit at 2:1
    bankroll = roundMoney(bankroll + (insuranceBet * 3)); // return + 2:1 profit (bet was already deducted)
    updateHud();
    await showInsuranceResultModal(`You won insurance! You win $${insWin}`);
    // Clear after settlement so it can't bleed into later calculations.
    insuranceBet = 0;
  }

  // Main hand outcome
  const h0 = hands[0];
  if(playerBJ){
    h0.outcome = 'push';
    bankroll = roundMoney(bankroll + (h0.wager || bet));
  }else{
    h0.outcome = 'lose';
  }

  updateHud();

  const delta = bankroll - roundStartBankroll;
  let label = (delta > 0) ? 'Win' : (delta < 0) ? 'Lose' : 'Push';
  showResultPopup(`${label} $${Math.abs(delta)}`);

  inRound = false;
  updateHud();
  setButtons();

  // If the player is out of money, show bust-out modal.
  maybeShowFundsModalWhenBroke();

  // Highlight dealer as winner unless push
  if(playerBJ){
    applyOutcomeHighlight('push');
  }else{
    applyOutcomeHighlight('lose');
  }

  cycleResults(myToken);
}

async function settlePlayerBlackjack(){
  const myToken = cycleToken;

  // Player blackjack payout 3:2 (wager already deducted)
  const h0 = hands[0];
  const w = h0.wager || bet;
  bankroll = roundMoney(bankroll + (Math.floor(w * 2.5)));
  h0.outcome = 'win';
  updateHud();

  const delta = bankroll - roundStartBankroll;
  showResultPopup(`Blackjack! You win $${Math.abs(delta)}`);

  inRound = false;
  updateHud();
  setButtons();

  // If the player is out of money, show bust-out modal.
  maybeShowFundsModalWhenBroke();

  applyOutcomeHighlight('win');
  cycleResults(myToken);
}
/*** Rules: split eligibility by VALUE (10-group) ***/
function canSplitCurrent(){
  const h = currentHand();
  if(!inRound) return false;
  // Casino rule: maximum total split hands reached
  if(hands && hands.length >= MAX_SPLIT_HANDS) return false;
  if(!h || !h.cards || h.cards.length !== 2) return false;
  const a = h.cards[0], b = h.cards[1];
  const aTen = isTenGroup(a.r);
  const bTen = isTenGroup(b.r);
  if(aTen && bTen) return true;
  return a.r === b.r;
}

/*** Round flow ***/
function setButtons(){
  // Terminal end state: everything disabled.
  if(gameOver){
    hitBtn.disabled = true;
    standBtn.disabled = true;
    doubleBtn.disabled = true;
    splitBtn.disabled = true;
    surrenderBtn.disabled = true;
    dealBtn.disabled = true;
    betDown.disabled = true;
    betUp.disabled = true;
    if(gearBtn) gearBtn.disabled = true;
    if(actionAmt) actionAmt.textContent = fmtMoney(computeChipsInAction());
    return;
  }
  const h = currentHand();
  const canAct = inRound && !insurancePending && !uiLocked && h && !h.done;
  hitBtn.disabled = !canAct;
  standBtn.disabled = !canAct;

  // Doubling / splitting are allowed only if it's a valid situation AND the user hasn't chosen
  // to continue the hand with no new bets.
  doubleBtn.disabled = !canAct || (h.cards.length !== 2) || doubledThisHand || noNewBets;
  splitBtn.disabled  = !canAct || !canSplitCurrent() || noNewBets;
  // Surrender: only on original 2-card hand, before any action, if enabled in settings.
  surrenderBtn.disabled = !canAct || !canSurrenderCurrent();

  // If surrender is disabled in Settings, hide the button entirely.
  surrenderBtn.style.display = RULE_SURRENDER ? '' : 'none';

  // Deal only when not in a round and bankroll can cover at least the $5 minimum.
  dealBtn.disabled = inRound || uiLocked || bankroll < 5;

  // Bet arrows only make sense pre-round.
  betDown.disabled = inRound || uiLocked;
  betUp.disabled   = inRound || uiLocked;

  // Keep Chips in Action HUD in sync even when rounds end without calling updateHud().
  if(actionAmt) actionAmt.textContent = fmtMoney(computeChipsInAction());

  // v94: If a shuffle was queued by reaching the cut card mid-hand, perform it now (between hands).
  if(!inRound && !gameOver && shufflePending && !_shuffleOverlayActive){
    // v172D: In Training Mode, show a blocking modal with the final running count before reset.
    if(TRAINING_MODE){
      if(!_finalCountModalActive){
        // If the modal can't be shown for some reason, fall back to immediate shuffle.
        const shown = showFinalCountModal();
        if(!shown){
          performBetweenHandsShuffle();
        }
      }
    }else{
      performBetweenHandsShuffle();
    }
  }

}



async function startRound(){
  clearHighlights();
  hidePopup();            // popup disappears when Deal is pressed
  dbgStep('startRound: init');
  cycleToken++;           // cancels any prior result-cycling loops

  // New round: clear any "continue hand / no new bets" state from a prior broke decision.
  // IMPORTANT: We do NOT auto-disable Double/Split just because the opening wager takes
  // bankroll to $0. Double/Split remain eligible and will prompt to add funds only if
  // the player actually attempts them.
  noNewBets = false;

  // Reset round-specific state
  roundPopupOverride = null;
  insuranceBet = 0;
  insurancePending = false;
  insuranceResolve = null;

  dealerHand = [];
  holeDown = true;

  // bankroll accounting: commit initial bet immediately
  roundStartBankroll = bankroll;

  // Enforce $5 minimum and $5 increments for the main bet.
  if(bankroll < 5){
    // No hand can be dealt; ask for funds.
    showFundsModal({
      title: "Insufficient Funds",
      note: "Minimum bet is $5.",
      allowContinue: false
    });
    return;
  }
  // Ensure bet is a multiple of $5 and not above bankroll.
  bet = Math.max(5, Math.floor(bet / 5) * 5);
  if(bet > bankroll) bet = Math.floor(bankroll / 5) * 5;
  bet = Math.max(5, bet);

  bankroll = Math.max(0, roundMoney(bankroll - bet));
  dbgStep('startRound: bet deducted, about to deal');

  // If the opening wager empties the bankroll, don't interrupt the deal with a modal.
  // NOTE: Double/Split are still allowed to be clicked (they will prompt for funds).

  hands = [{cards:[], isAceSplit:false, done:false, outcome:null, wager: bet, fromSplit:false, acted:false, surrendered:false}];
  activeHandIndex = 0;
  doubledThisHand = false;
  inRound = true;

  // Now that the round is officially live (hands + inRound), HUD can compute Chips in Action.
  updateHud();

  // Deal pattern: P1, D up, P2, D hole
  const _forcePlayerBJ = (DEV_TOOLS_ENABLED === true && forcePlayerBlackjackNext);
  const _forceDealerBJ = (DEV_TOOLS_ENABLED === true && forceDealerBlackjackNext);
  // One-shot: consume flags immediately so re-click is required for subsequent hands.
  forcePlayerBlackjackNext = false;
  forceDealerBlackjackNext = false;

  const p1 = _forcePlayerBJ ? drawSpecific({s:"spades", r:"A"}) : draw();
  hands[0].cards.push(p1);

  // v131C: Player total updates only after the new card is flipped/visible
  beginPlayerTotalHold(hands[0].cards.length - 1);
  renderHands();
  dbgStep('startRound: renderHands() done');
  await animateLastDealtCard(playerLane, true);
  endPlayerTotalHold();
  dbgStep('startRound: player card animated');

  // If we're running insurance tests, force the dealer upcard to an Ace.
  // v173D: Force Dealer Blackjack piggybacks on the same insurance/peek pipeline.
  const forceInsurance = (DEV_TOOLS_ENABLED && (testInsuranceMode === 'bj' || testInsuranceMode === 'noBj')) || _forceDealerBJ;
  const d1 = forceInsurance ? drawSpecific({s:"spades", r:"A"}) : draw();
  dealerHand.push(d1);

  renderHands();
  dbgStep('startRound: renderHands() done');
  await animateLastDealtCard(dealerLane, true);
  dbgStep('startRound: dealer upcard animated');

  let p2;
  if(_forcePlayerBJ){
    p2 = drawSpecific({s:"hearts", r:"K"});
  }else if(testSplits){
    p2 = drawMatching(p1);
  }else{
    p2 = draw();
  }
  hands[0].cards.push(p2);

  beginPlayerTotalHold(hands[0].cards.length - 1);
  renderHands();
  dbgStep('startRound: renderHands() done');
  await animateLastDealtCard(playerLane, true);
  endPlayerTotalHold();
  dbgStep('startRound: player card animated');

  // For insurance tests, force the dealer hole card:
  //  - bj   => 10-value (dealer blackjack)
  //  - noBj => 9 (dealer NOT blackjack)
  const d2 = forceInsurance
    ? (_forceDealerBJ ? drawSpecific({s:"hearts", r:"K"}) : (testInsuranceMode === 'bj' ? drawSpecific({s:"hearts", r:"K"}) : drawSpecific({s:"hearts", r:"9"})))
    : draw();
  dealerHand.push(d2);

  renderHands();
  dbgStep('startRound: renderHands() done');
  // Dealer hole stays face down.
  await animateLastDealtCard(dealerLane, false);
  dbgStep('startRound: dealer hole animated');
  await pause(80);

  const endedEarly = await maybeOfferInsuranceAndPeek();
  if(endedEarly){
    return;
  }

  setButtons();
}

function finishHand(){
  const h = currentHand();
  h.done = true;
}

async function nextHandOrDealer(){
  // v142C: Add a brief pause between split hands so the player can see
  // the transition (final card, updated totals) before the next hand begins.
  const prevIndex = activeHandIndex;
  const prevDone  = !!(hands && hands[prevIndex] && hands[prevIndex].done);

  // Find next unfinished hand
  for(let i=0;i<hands.length;i++){
    if(!hands[i].done){
      // Only pause when advancing from a finished hand to a different hand.
      if(hands.length > 1 && prevDone && i !== prevIndex){
        await pause(500);
      }

      activeHandIndex = i;
      doubledThisHand = false;
      // v140C: If this hand was created by a split and still needs its post-split card,
      // deal/animate that card now, then let the player act.
      if(hands[i].needsSplitCard){
        hands[i].needsSplitCard = false;
        hands[i].cards.push(draw());
        beginPlayerTotalHold(hands[i].cards.length - 1);
        renderHands();
        await animateLastDealtCard(playerLane, true);
        endPlayerTotalHold();
        // Splitting aces: each hand receives one card and then stands (unless it becomes AA again).
        if(hands[i].isAceSplit && hands[i].cards.length === 2){
          const aa = hands[i].cards[0].r === 'A' && hands[i].cards[1].r === 'A';
          if(!aa){
            hands[i].done = true;
            hands[i].acted = true;
            renderHands();
            setButtons();
            // Move immediately to the next hand (or dealer) after auto-standing.
            await nextHandOrDealer();
            return;
          }
        }
      }

      renderHands();
      setButtons();
      return;
    }
  }
  // All hands done -> dealer plays
  await dealerPlayAndSettle();
}

async function dealerPlayAndSettle(){
  const myToken = cycleToken;

  // Reveal hole (animate flip; only update totals after the reveal is visibly complete)
  dealerTotalHold = true;
  dealerVisibleCount = 1;

  // Keep internal state face-down while we animate, so totals stay frozen to the upcard.
  // We will flip the visual + then commit holeDown=false at the midpoint.
  holeDown = true;
  renderHands();

  await animateRevealDealerHoleCard();
  holeDown = false;
  // v156 FIX: Ensure the dealer hole card is visibly face-up after settlement.
  // The reveal animation is best-effort and may no-op if the visual shell
  // isn't in an expected state; re-render guarantees correctness.
  renderHands();

  // Now the 2-card dealer hand is fully visible.
  dealerVisibleCount = dealerHand.length;
  dealerTotalHold = false;
  updateLabels();

  // v91: If EVERY player hand has already busted, the hand ends immediately.
  // Dealer does NOT draw any additional cards; we simply resolve losses after flipping the hole card.
  const allPlayerBusted = hands.every(h => handTotal(h.cards) > 21);
  if(allPlayerBusted){
    for(const h of hands){
      h.outcome = 'lose';
    }
    // Settlement: initial wagers were already deducted at round start; all hands are losses.
    updateHud();

    inRound = false;
    updateHud();
    setButtons();

    // If the player is out of money, show bust-out modal.
    maybeShowFundsModalWhenBroke();

    applyOutcomeHighlight('lose');
    cycleResults(myToken);
    return;
  }

  // Dealer hits to 17; soft-17 rule configurable (S17/H17)
  while(true){
    const dt = handTotalDetailed(dealerHand);
    const mustHit = (dt.total < 17) || (RULE_HIT_SOFT_17 && dt.total === 17 && dt.soft);
    if(!mustHit) break;
    const prevCount = dealerHand.length;
    dealerHand.push(draw());

    // Freeze dealer total until the newly dealt card is fully in place.
    dealerTotalHold = true;
    dealerVisibleCount = prevCount;

    renderHands();
    await animateLastDealtCard(dealerLane, true);
    dealerVisibleCount = dealerHand.length;
    dealerTotalHold = false;
    updateLabels();
  }

  const dv = handTotal(dealerHand);

  for(const h of hands){
    const pv = handTotal(h.cards);
    const bj = isBlackjack(h.cards, !!h.fromSplit);

    let out = "lose";
    if(pv > 21) out = "lose";
    else if(dv > 21) out = "win";
    else if(pv > dv) out = "win";
    else if(pv < dv) out = "lose";
    else out = "push";

    if(out === "win" && bj) out = "blackjack";
    h.outcome = out;
  }

  // Settle bankroll (initial wager already deducted at round start)
  for(const h of hands){
    const w = h.wager || bet;
    if(h.outcome === "win"){
      bankroll = roundMoney(bankroll + (2*w));
    }else if(h.outcome === "push"){
      bankroll = roundMoney(bankroll + w);
    }else if(h.outcome === "blackjack"){
      bankroll = roundMoney(bankroll + (2.5*w));
    }
  }
  updateHud();

  // Popup message (net for the round)
  const delta = bankroll - roundStartBankroll;

  // If this was a split round, hold all popups until the end and then show a single summary.
  if(hands.length > 1){
    // v138C: Show a table-style split summary with mini card icons.
    const node = buildSplitResultsNode(dv, hands, delta);
    showResultPopupNode(node);

    inRound = false;
  updateHud();
  setButtons();
    // If the player is out of money, show bust-out modal.
    maybeShowFundsModalWhenBroke();
    cycleResults(myToken);
    return;
  }

  // Special-case popups to avoid duplicates
  if(dv > 21 && delta > 0){
    // Dealer bust: show only this message (no generic Win popup)
    roundPopupOverride = { type: 'dealerBust', amount: Math.abs(delta) };
    showResultPopup(`Dealer busts! Win $${Math.abs(delta)}` + roundTotalsBlock());
  }else if(
    roundPopupOverride &&
    roundPopupOverride.type === 'playerBust' &&
    hands.length === 1 &&
    delta < 0
  ){
    // Player bust already showed immediate Lose popup; suppress generic Lose popup.
    // (We still continue to end the round below.)
  }else{
  let label;
  if(hands.length === 1 && hands[0].outcome === "blackjack" && delta > 0){
    label = "Blackjack";
  }else if(delta > 0){
    label = "Win";
  }else if(delta < 0){
    label = "Lose";
  }else{
    label = "Push";
  }
  showResultPopup(`${label} $${Math.abs(delta)}` + roundTotalsBlock());
  }

  inRound = false;
  updateHud();
  setButtons();

  // If the player is out of money, show bust-out modal.
  maybeShowFundsModalWhenBroke();

  cycleResults(myToken);
}

function applyOutcomeHighlight(outcome){
  clearHighlights();
  if(outcome === "win"){
    playerArea.classList.add("winGlow");
    dealerArea.classList.add("dim");
  }else if(outcome === "lose"){
    dealerArea.classList.add("winGlow");
    playerArea.classList.add("dim");
  }else{ // push
    dealerArea.classList.add("winGlow");
    playerArea.classList.add("winGlow");
  }
}

function endOfRoundFinalizeOnce(reason){
  /* v158D: Single authoritative end-of-round cleanup.
     - Forces all dealer cards face-up
     - Commits final renders/labels/HUD/buttons
     - Runs exactly once per round (keyed by cycleToken)
  */
  try{
    if(!dealerHand || !dealerHand.length) return;

    // Only run after settlement / round end.
    if(inRound) return;

    // Gate: once per round token.
    if(_roundFinalizedToken === cycleToken) return;
    _roundFinalizedToken = cycleToken;

    holeDown = false;
    dealerTotalHold = false;
    dealerVisibleCount = dealerHand.length;

    // Final authoritative UI refresh.
    renderHands();
    updateLabels();
    updateHud();
    setButtons();
  }catch(_e){ /* ignore */ }
}


// v158D: Allow UI modules (result popup) to invoke canonical finalization when needed.
window.endOfRoundFinalizeOnce = endOfRoundFinalizeOnce;

// v158D: Back-compat alias (older call sites).
function endOfRoundRevealSafety(){
  endOfRoundFinalizeOnce('legacySafety');
}

async function cycleResults(token){
  endOfRoundRevealSafety();
  for(let i=0;i<hands.length;i++){
    if(token !== cycleToken) return;
    activeHandIndex = i;
    renderHands();
    applyOutcomeHighlight(hands[i].outcome);
    await pause(1000);
  }
}

async function onHit(){
  const h = currentHand();
  if(!h) return;
  h.acted = true;

  h.cards.push(draw());
  beginPlayerTotalHold(h.cards.length - 1);
  renderHands();
  await animateLastDealtCard(playerLane, true);
  endPlayerTotalHold();
  if(handTotal(h.cards) > 21){
    // Bust
    h.outcome = 'lose';
    h.busted = true;
    const w = h.wager || bet;

    // Immediate bust popup for single-hand rounds (avoid duplicate end-of-round popups).
    if(hands.length === 1){
      roundPopupOverride = { type: 'playerBust', amount: Math.abs(w) };
      showResultPopup(`Bust! Lose $${Math.abs(w)}`);
    }

    finishHand();
    setButtons();
    await nextHandOrDealer();
    return;
  }

  // if split aces: should have been auto-stand already; safeguard
  setButtons();
}

async function onStand(){
  const h = currentHand();
  if(h) h.acted = true;
  finishHand();
  setButtons();
  await nextHandOrDealer();
}

async function onDouble(){
  const h = currentHand();
  if(!h || !h.cards || h.cards.length !== 2) return;

  const add = h.wager || bet;
  if(bankroll < add){
    showFundsModal({
      title: 'Insufficient Funds',
      note: 'Add chips to DOUBLE, or continue the hand.',
      allowContinue: true,
      reason: 'action',
      afterAdd: ()=>{ if(inRound) onDouble(); }
    });
    return;
  }

  // Action is now committed.
  h.acted = true;

  // Deduct additional wager and double the hand wager
  bankroll = Math.max(0, roundMoney(bankroll - add));
  h.wager = (h.wager || bet) * 2;
  updateHud();

  doubledThisHand = true;

  h.cards.push(draw());
  beginPlayerTotalHold(h.cards.length - 1);
  renderHands();
  await animateLastDealtCard(playerLane, true);
  endPlayerTotalHold();
  finishHand();
  setButtons();
  await nextHandOrDealer();
}

async function onSplit(){
  const h = currentHand();
  if(!h) return;

  if(!canSplitCurrent()) return;
  if(hands && hands.length >= MAX_SPLIT_HANDS) return;

  const baseWager = h.wager || bet;
  if(bankroll < baseWager){
    showFundsModal({
      title: 'Insufficient Funds',
      note: 'Add chips to SPLIT, or continue the hand.',
      allowContinue: true,
      reason: 'action',
      afterAdd: ()=>{ if(inRound) onSplit(); }
    });
    return;
  }

  // Action is now committed.
  h.acted = true;
  bankroll = Math.max(0, roundMoney(bankroll - baseWager));
  updateHud();

  const [c1, c2] = h.cards;
  const splittingAces = (c1.r === "A" && c2.r === "A");

  const first  = {cards:[c1], isAceSplit:splittingAces, done:false, outcome:null, wager: baseWager, fromSplit:true, acted:false, surrendered:false, needsSplitCard:false};
  const second = {cards:[c2], isAceSplit:splittingAces, done:false, outcome:null, wager: baseWager, fromSplit:true, acted:false, surrendered:false, needsSplitCard:true};

  hands.splice(activeHandIndex, 1, first, second);

  // v140C: Deal/animate ONLY the active (first) split hand's next card.
  // The next hand will receive its first post-split card only when it becomes active.
  first.cards.push(draw());
  beginPlayerTotalHold(first.cards.length - 1);
  renderHands();
  await animateLastDealtCard(playerLane, true);
  endPlayerTotalHold();
  // Splitting aces: each hand gets one card then stands (unless it becomes AA again).
  if(splittingAces && first.cards.length === 2){
    const firstIsAA = first.cards[0].r === "A" && first.cards[1].r === "A";
    if(!firstIsAA){
      first.done = true;
      first.acted = true;
      setButtons();
      await nextHandOrDealer();
      return;
    }
  }

  doubledThisHand = false;
  renderHands();
  setButtons();
}



/*** Controls ***/
// v143D Step 6: Gameplay button wiring moved to ui/desktop/desktop_ui.js



function canSurrenderCurrent(){
  const h = currentHand();
  if(!RULE_SURRENDER) return false;
  if(!inRound || uiLocked || insurancePending) return false;
  if(!h || h.done) return false;
  // Only on the original hand (not split hands), with the first two cards, before any action.
  if(h.fromSplit) return false;
  if(h.cards.length !== 2) return false;
  if(h.acted) return false;
  return true;
}

async function onSurrender(){
  if(!canSurrenderCurrent()) return;
  const myToken = cycleToken;
  const h = currentHand();
  const w = h.wager || bet;

  // Dealer blackjack would have already been handled in maybeOfferInsuranceAndPeek().
  // Surrender returns half the wager (wager was already deducted at round start).
  const refund = roundMoney(w / 2);
  bankroll = roundMoney(bankroll + refund);
  h.surrendered = true;
  h.outcome = 'surrender';
  h.done = true;
  updateHud();

  showResultPopup(`Surrender. Lose $${refund}`);

  inRound = false;
  updateHud();
  setButtons();

  // If the player is out of money, show bust-out modal.
  maybeShowFundsModalWhenBroke();

  applyOutcomeHighlight('lose');
  cycleResults(myToken);
}
// (hit/stand/double/split/surrender listeners moved to desktop_ui.js)

// ----------------------
// Dev/QA tools (hidden in production)
// ----------------------
if(!DEV_TOOLS_ENABLED){
  if(devToolsRow) devToolsRow.style.display = 'none';
  if(devBadge) devBadge.style.display = 'none';
}else{
  // Make dev tools visible in dev builds (CSS defaults to hidden).
  if(devToolsRow) devToolsRow.style.display = 'flex';
  // Small DEV badge (top-left) to make it obvious this is a debug build.
  if(devBadge) devBadge.style.display = 'block';

  /**
   * Test Splits
   * ----------
   * Forces the player's first two cards to be the same VALUE (10-group counts as same)
   * so you can reliably test split flow without waiting for random pairs.
   */
  testSplitsBtn.addEventListener("click", ()=>{
    testSplits = !testSplits;
    testSplitsBtn.textContent = `Test Splits: ${testSplits ? "ON" : "OFF"}`;
  });

  /**
   * Test Insurance (Dealer Blackjack)
   * -------------------------------
   * Forces dealer to show Ace with a 10-value hole card (blackjack).
   * Uses the real insurance/peek path; only the initial dealer cards are forced.
   */
  testInsBJBtn.addEventListener('click', ()=>{
    testInsuranceMode = (testInsuranceMode === 'bj') ? null : 'bj';
    if(testInsuranceMode === 'bj'){
      // mutually exclusive
      if(testInsNoBJBtn) testInsNoBJBtn.textContent = 'Test Insurance (No BJ): OFF';
    }
    if(testInsBJBtn) testInsBJBtn.textContent = `Test Insurance (BJ): ${testInsuranceMode === 'bj' ? 'ON' : 'OFF'}`;
    if(testInsuranceMode !== 'bj' && testInsNoBJBtn){
      // keep other button label consistent
      testInsNoBJBtn.textContent = `Test Insurance (No BJ): ${testInsuranceMode === 'noBj' ? 'ON' : 'OFF'}`;
    }
  });

  /**
   * Test Insurance (No Dealer Blackjack)
   * -----------------------------------
   * Forces dealer to show Ace with a 9 hole card (no blackjack).
   * Uses the real insurance/peek path; only the initial dealer cards are forced.
   */
  if(deckViewerBtn){
    deckViewerBtn.addEventListener("click", ()=>toggleDeckViewer());
  }

  // v173D: Force initial blackjacks (DEV_TOOLS_ENABLED only)
  if(DEV_TOOLS_ENABLED === true){
    if(forcePlayerBJBtn){
      forcePlayerBJBtn.addEventListener('click', ()=>{
        if(inRound || uiLocked) return;
        forcePlayerBlackjackNext = true;
      });
    }
    if(forceDealerBJBtn){
      forceDealerBJBtn.addEventListener('click', ()=>{
        if(inRound || uiLocked) return;
        forceDealerBlackjackNext = true;
      });
    }
  }else{
    if(forcePlayerBJBtn) forcePlayerBJBtn.style.display = 'none';
    if(forceDealerBJBtn) forceDealerBJBtn.style.display = 'none';
  }

  testInsNoBJBtn.addEventListener('click', ()=>{
    testInsuranceMode = (testInsuranceMode === 'noBj') ? null : 'noBj';
    if(testInsuranceMode === 'noBj'){
      // mutually exclusive
      if(testInsBJBtn) testInsBJBtn.textContent = 'Test Insurance (BJ): OFF';
    }
    if(testInsNoBJBtn) testInsNoBJBtn.textContent = `Test Insurance (No BJ): ${testInsuranceMode === 'noBj' ? 'ON' : 'OFF'}`;
    if(testInsuranceMode !== 'noBj' && testInsBJBtn){
      testInsBJBtn.textContent = `Test Insurance (BJ): ${testInsuranceMode === 'bj' ? 'ON' : 'OFF'}`;
    }
  });
}

// Bets are in $0.50 increments (smallest chip). Keep a $5 table minimum.
function normalizeBet(){
  // Enforce $5 minimum and $5 steps.
  if(!Number.isFinite(bet)) bet = 5;
  bet = Math.max(5, Math.floor(bet / 5) * 5);
  if(bankroll >= 5){
    const max = Math.floor(bankroll / 5) * 5;
    bet = Math.min(bet, max);
  }
  betAmt.textContent = fmtMoney(bet);
}

function changeBet(delta){
  if(inRound || uiLocked) return;
  bet = bet + delta;
  // Clamp to bankroll and $5 steps
  if(bankroll >= 5){
    const max = Math.floor(bankroll / 5) * 5;
    bet = Math.min(bet, max);
  }
  bet = Math.max(5, Math.floor(bet / 5) * 5);
  normalizeBet();
}

function makeHoldStepper(btn, delta){
  let holdTimer = null;
  let loopTimer = null;
  let delay = 500;

  const clear = ()=>{
    if(holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if(loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    delay = 500;
  };

  const loop = ()=>{
    changeBet(delta);
    // accelerate toward 200ms
    delay = Math.max(200, delay - 50);
    loopTimer = setTimeout(loop, delay);
  };

  btn.addEventListener('pointerdown', (e)=>{
    if(btn.disabled) return;
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    // single step immediately
    changeBet(delta);
    // then start repeat after 0.5s
    holdTimer = setTimeout(()=>{
      loop();
    }, 500);
  });

  const stopEvents = ['pointerup','pointercancel','pointerleave','lostpointercapture'];
  stopEvents.forEach(ev=>btn.addEventListener(ev, clear));
}

makeHoldStepper(betDown, -5);
makeHoldStepper(betUp, +5);

normalizeBet();

// Bankroll editing deferred (disabled in v20)

function init(){
  applyUIScale();

  // v133C: Load and apply the "Hide Hand Totals" preference early.
  // NOTE: In this build, the PLAYER/DEALER labels always remain visible;
  // the setting only controls whether numeric totals are shown.
  loadShowHandTotals();
  applyShowHandTotals();

  // v162D: Training Mode (KO running count)
  loadTrainingMode();
  applyTrainingMode();
  wireCountPillInteractions();


  // v130C: Visible build version in the About/Instructions panel.
  try{
    const versionEl = document.getElementById('versionText');
    if(versionEl && typeof APP_VERSION !== 'undefined'){
      versionEl.textContent = APP_VERSION;
    }
  }catch(_e){ /* non-fatal */ }

  initSoundtrack();
  startSoundtrack();

  // v113B: Settings sound controls are staged (apply on ACCEPT, discard on CLOSE).

  initAudio();
  wireDelegatedUI();
  bindInsuranceHandlers();

  // v143D Step 5: Introduce engine facade (no behavior change).
  // The engine currently wraps legacy globals so we can migrate orchestration
  // gradually without rewriting gameplay.
  try{
    if(window.BJ && BJ.engine && typeof BJ.engine.createGame === 'function'){
      // v144D Step 7A: Provide a legacy adapter so the engine can begin owning
      // round-start sequencing without touching the DOM directly.
      // NOTE: This adapter is an internal bridge only. Gameplay behavior
      // should remain unchanged.
      BJ.legacy = {
        // --- Core round/bankroll state (top-level `let` bindings) ---
        get bankroll(){ return bankroll; },
        set bankroll(v){ bankroll = v; },
        get bet(){ return bet; },
        set bet(v){ bet = v; },
        get inRound(){ return inRound; },
        set inRound(v){ inRound = v; },
        get holeDown(){ return holeDown; },
        set holeDown(v){ holeDown = v; },
        get dealerHand(){ return dealerHand; },
        set dealerHand(v){ dealerHand = v; },
        get dealerTotalHold(){ return dealerTotalHold; },
        set dealerTotalHold(v){ dealerTotalHold = v; },
        get dealerVisibleCount(){ return dealerVisibleCount; },
        set dealerVisibleCount(v){ dealerVisibleCount = v; },
        get hands(){ return hands; },
        set hands(v){ hands = v; },
        get activeHandIndex(){ return activeHandIndex; },
        set activeHandIndex(v){ activeHandIndex = v; },
        get doubledThisHand(){ return doubledThisHand; },
        set doubledThisHand(v){ doubledThisHand = v; },
        get roundStartBankroll(){ return roundStartBankroll; },
        set roundStartBankroll(v){ roundStartBankroll = v; },
        get noNewBets(){ return noNewBets; },
        set noNewBets(v){ noNewBets = v; },
        get roundPopupOverride(){ return roundPopupOverride; },
        set roundPopupOverride(v){ roundPopupOverride = v; },
        get insuranceBet(){ return insuranceBet; },
        set insuranceBet(v){ insuranceBet = v; },
        get insurancePending(){ return insurancePending; },
        set insurancePending(v){ insurancePending = v; },
        get insuranceResolve(){ return insuranceResolve; },
        set insuranceResolve(v){ insuranceResolve = v; },
        get cycleToken(){ return cycleToken; },
        set cycleToken(v){ cycleToken = v; },
        get testSplits(){ return testSplits; },
        set testSplits(v){ testSplits = v; },
        get testInsuranceMode(){ return testInsuranceMode; },
        set testInsuranceMode(v){ testInsuranceMode = v; },
        get DEV_TOOLS_ENABLED(){ return DEV_TOOLS_ENABLED; },

        // --- UI element handles (for animation helpers that take lanes) ---
        ui: {
          get playerLane(){ return playerLane; },
          get dealerLane(){ return dealerLane; },
        },

        // --- Function hooks (engine can call these without importing DOM) ---
        fns: {
          clearHighlights,
          hidePopup,
          dbgStep,
          updateHud,
          renderHands,
          setButtons,
          beginPlayerTotalHold,
          endPlayerTotalHold,
          animateLastDealtCard,
          pause,
          showResultPopup,
          showFundsModal,
          showResultPopupNode,
          buildSplitResultsNode,
          roundTotalsBlock,
          updateLabels,
          animateRevealDealerHoleCard,
          maybeShowFundsModalWhenBroke,
          applyOutcomeHighlight,
          cycleResults,
          finishHand,
          nextHandOrDealer,
          maybeOfferInsuranceAndPeek,
          awaitInsuranceEngine,
          showInsuranceResultModal,
          draw,
          drawSpecific,
          drawMatching,
          roundMoney,
        },
      };

      BJ.game = BJ.engine.createGame({ adapter: BJ.legacy });
      // Optional: expose for dev console debugging (does not affect gameplay).
      window.game = BJ.game;

      // v154D: Persistence (bankroll + ledger) mounts here, isolated from UI and engine.
      try{
        if(window.BJ && BJ.persistController && typeof BJ.persistController.mount === 'function'){
          BJ.persistController.mount({ game: BJ.game, adapter: BJ.legacy, maxHands: 2000 });
        }
      }catch(_e){ /* non-fatal */ }
    }
  }catch(_e){ /* non-fatal */ }

  // v143D Step 6: Controls wiring moved out of script.js
  // (buttons + Enter-to-Deal) into ui/desktop/desktop_ui.js.
  try{
    if(window.BJ && BJ.desktop && typeof BJ.desktop.mountControls === 'function'){
      BJ.desktop.mountControls({
        dealBtn,
        hitBtn,
        standBtn,
        doubleBtn,
        splitBtn,
        surrenderBtn,
        isInRound: () => inRound,
        isGameOver: () => gameOver,
        deal: async () => {
          // Mirror legacy behavior: only deal when idle.
          return BJ.game ? BJ.game.action(BJ.engine.ACTIONS.START_ROUND) : startRound();
        },
        hit: async () => (BJ.game ? BJ.game.action(BJ.engine.ACTIONS.HIT) : onHit()),
        stand: async () => (BJ.game ? BJ.game.action(BJ.engine.ACTIONS.STAND) : onStand()),
        double: async () => (BJ.game ? BJ.game.action(BJ.engine.ACTIONS.DOUBLE) : onDouble()),
        split: async () => (BJ.game ? BJ.game.action(BJ.engine.ACTIONS.SPLIT) : onSplit()),
        surrender: async () => (BJ.game ? BJ.game.action(BJ.engine.ACTIONS.SURRENDER) : onSurrender()),
        onDealError: (err) => {
          // Fail-safe: un-wedge the UI so you can try again without reloading.
          inRound = false;
          holeDown = true;
          dealerHand = [];
          hands = [{cards:[], isAceSplit:false, done:false, outcome:null, wager: bet, fromSplit:false, acted:false, surrendered:false}];
          activeHandIndex = 0;
          renderHands();
          updateHud();
          setButtons();
        },
      });
    }
  }catch(_e){ /* non-fatal */ }

  updateHud();
  dealerValue.textContent = "";
  playerValue.textContent = "";
  dealerLane.innerHTML="";
  playerLane.innerHTML="";
  setButtons();
}
window.addEventListener('DOMContentLoaded', init);


// (Delegated UI wiring consolidated below)



/***********************
 * Delegated UI wiring (robust to DOM timing + re-renders)
 ***********************/
let _delegatedUIWired = false;
function wireDelegatedUI(){
  if(_delegatedUIWired) return;
  _delegatedUIWired = true;

  // Click routing for buttons that may not exist at initial parse time.
  document.addEventListener('click', (e)=>{
    const btn = e.target?.closest?.('button');
    if(!btn || !btn.id) return;

    switch(btn.id){
      case 'gearBtn':
        if(!uiLocked) showSettingsModal();
        break;

      case 'helpBtn':
        if(!uiLocked) showHelpScroll();
        break;

      case 'helpOkBtn':
        hideHelpScroll();
        break;


      case 'finalCountOkBtn':
        // v172D: Dismiss training end-of-shoe modal and then shuffle/reset count.
        hideFinalCountModal();
        uiLocked = false;
        setButtons();
        performBetweenHandsShuffle();
        break;
      // Broke / out-of-chips modal
      case 'addFundsBtn':
        // Go straight to Add Chips (no intermediate cancel step, no bankroll mutation here)
        _addChipsOriginBroke = true;
        _addChipsAfterAction = pendingFundsAction;
        hideFundsModal();
        showAddChipsModal();
        break;
      case 'continueHandBtn':
        // Continue current hand. If this modal was opened for Split/Double (or bust-out),
        // disallow any new bets for the rest of the hand. But if this was for INSURANCE,
        // declining funds here should not disable Split/Double later.
        if(fundsModalReason !== 'insurance'){
          noNewBets = true;
        }

        // If the user declines to add funds, make sure any previously-blocked action
        // (e.g., Split/Double retry callbacks) cannot fire later.
        pendingFundsAction = null;
        _addChipsAfterAction = null;

        // If we were in the insurance flow, treat this like declining insurance.
        if(insurancePending){
          insuranceBet = 0;
          hideInsuranceModal();
          const r = insuranceResolve;
          insuranceResolve = null;
          if(typeof r === 'function') r();
        }

        hideFundsModal();
        break;

      case 'leaveTableBtn':
        // Terminal end-state: only available between hands when the player is broke.
        endGame();
        break;

      // (legacy) inline add-funds rows if present
      case 'fundsCancelBtn': {
        const choiceRow = document.getElementById('fundsChoiceRow');
        const addRow = document.getElementById('fundsAddRow');
        if(addRow) addRow.style.display = 'none';
        if(choiceRow) choiceRow.style.display = '';
        break;
      }
      case 'fundsConfirmBtn': {
        const amt = document.getElementById('fundsAmt');
        let v = Number(amt?.value || amt?.placeholder || '0');
        if(!Number.isFinite(v)) v = 0;
        v = clampToHalfDollar(v);
        v = roundMoney(v);
        if(v <= 0) return;

        bankroll = roundMoney(bankroll + v);
        noNewBets = false;
        updateHud();

        const after = pendingFundsAction;
        hideFundsModal();
        if(typeof after === 'function') setTimeout(()=>{ after(); }, 0);
        break;
      }

      // Add Chips modal
      case 'addChipsCancelBtn':
        hideAddChipsModal();
        _addChipsAfterAction = null;
        // If user opened Add Chips from the broke modal and is still broke, return them there.
        if(_addChipsOriginBroke){
          _addChipsOriginBroke = false;
          if(bankroll <= 0){
            showFundsModal({
              title: 'W-w-wah…',
              note: "You're out of money.",
              allowContinue: inRound
            });
          }
        }
        break;
      case 'addChipsOkBtn':
        handleAddChipsOk();
        break;
      // Settings modal
      case 'settingsCloseBtn':
        hideSettingsModal();
        break;
      case 'settingsSaveBtn':
        handleSettingsSave();
        break;

      // About modal
      case 'aboutCloseBtn':
        hideAboutModal();
        break;

      default:
        break;
    }
  }, true);

  // Input hygiene for numeric fields (bankroll + add chips)
  document.addEventListener('input', (e)=>{
    const t = e.target;
    if(!t || !t.id) return;
    if(t.id === 'settingsBankroll' || t.id === 'addChipsAmt'){
      filterBankrollField(t);
    }
    if(t.id === 'settingsPenetration'){
      const lab = getEl('settingsPenetrationLabel');
      if(lab) lab.textContent = String(t.value) + '%';
    }
  }, true);

  // Currency-style display for bankroll-ish fields.
  // - When focused: show raw digits for easy typing.
  // - When blurred: show $ formatted value.
  document.addEventListener('focusin', (e)=>{
    const t = e.target;
    if(!t || !t.id) return;
    if(t.id === 'settingsBankroll' || t.id === 'addChipsAmt'){
      const d = digitsOnly(t.value);
      t.value = d;
      try{ t.select(); }catch(_){ }
    }
  }, true);
  document.addEventListener('focusout', (e)=>{
    const t = e.target;
    if(!t || !t.id) return;
    if(t.id === 'settingsBankroll' || t.id === 'addChipsAmt'){
      const d = digitsOnly(t.value);
      const n = d ? Number(d) : 0;
      t.value = formatUSD0(n);
    }
  }, true);

  // v88: Table-rule lock UX in Settings
  // - All rule controls (decks, H17/S17, surrender) are locked mid-shoe.
  // - Bankroll remains editable.
  // - Attempts to interact with locked controls should do nothing except show a popup.
  document.addEventListener('mousedown', (e)=>{
    const t = e.target;
    if(!t) return;
    if(!isModalVisible('settingsModal')) return;
    if(!areTableRulesLocked()) return;

    // Allow bankroll field + modal buttons.
    const id = t.id || '';
    if(id === 'settingsBankroll' || id === 'hideTotalsYes' || id === 'hideTotalsNo' || id === 'settingsSaveBtn' || id === 'settingsCloseBtn') return;

    // Decks select or locked rule radios within Settings.
    const lockedRuleIds = new Set([
      'hitSoft17Yes','hitSoft17No','staySoft17Yes','staySoft17No','surrenderYes','surrenderNo',
      'randomCutYes','randomCutNo','settingsPenetration'
    ]);

    const radio = (t.tagName && String(t.tagName).toUpperCase() === 'INPUT' && t.type === 'radio') ? t : null;
    const label = (t.tagName && String(t.tagName).toUpperCase() === 'LABEL') ? t : (t.closest ? t.closest('label') : null);
    const labelRadio = label ? label.querySelector('input[type="radio"]') : null;

    const radioId = (radio && radio.id) ? radio.id : ((labelRadio && labelRadio.id) ? labelRadio.id : '');
    const isLockedRuleRadio = lockedRuleIds.has(radioId);

    const isDecks = (id === 'settingsDecks') || (t.closest && t.closest('#settingsDecks'));

    const isCutSlider = (id === "settingsPenetration") || (t.closest && t.closest("#settingsPenetration"));

    if(isDecks || isLockedRuleRadio || isCutSlider){
      e.preventDefault();
      e.stopPropagation();
      showPopup('Table rules cannot be changed in the middle of a shoe.');
    }
  }, true);

  document.addEventListener('keydown', (e)=>{
    const t = e.target;

    // v88: Block keyboard interaction with locked rule controls.
    if(t && isModalVisible('settingsModal') && areTableRulesLocked()){
      const id = t.id || '';
      const isLockedRuleControl = (
        id === 'settingsDecks' ||
        id === 'hitSoft17Yes' || id === 'hitSoft17No' ||
        id === 'staySoft17Yes' || id === 'staySoft17No' ||
        id === 'surrenderYes' || id === 'surrenderNo' ||
        id === 'randomCutYes' || id === 'randomCutNo' ||
        id === 'settingsPenetration'
      );
      if(isLockedRuleControl){
        // Allow Tab to move focus out.
        if(e.key !== 'Tab'){
          e.preventDefault();
          e.stopPropagation();
          showPopup('Table rules cannot be changed in the middle of a shoe.');
          return;
        }
      }
    }
    // Global Enter-to-ACCEPT for modals
    if(e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey){
      const tag = (t && t.tagName) ? String(t.tagName).toUpperCase() : '';
      // Don't hijack Enter on actual buttons/links
      if(tag !== 'BUTTON' && tag !== 'A' && tag !== 'TEXTAREA'){
        if(isModalVisible('settingsModal')){
          e.preventDefault();
          handleSettingsSave();
          return;
        }
        if(isModalVisible('addChipsModal')){
          e.preventDefault();
          handleAddChipsOk();
          return;
        }
      }
    }

    if(!t || !t.id) return;

    // Prevent scientific notation / signs / decimals in bankroll-ish fields
    if(t.id === 'settingsBankroll' || t.id === 'addChipsAmt'){
      if(e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-'){
        e.preventDefault();
        return;
      }
      // Enter submits (handled globally above too, but keep for safety)
      if(e.key === 'Enter'){
        if(t.id === 'addChipsAmt') handleAddChipsOk();
        if(t.id === 'settingsBankroll') handleSettingsSave();
      }
    }
  }, true);

  // Mutual exclusivity wiring for the two soft-17 rows
  document.addEventListener('change', (e)=>{
    const t = e.target;
    if(!t || !t.id) return;

    // v87: Shoe-size guardrail UX
    // - Allow changing decks before first deal
    // - Once the first card is dealt, block deck changes until the next shuffle/new shoe
    if(t.id === 'settingsDecks'){
      const prev = (t.dataset && t.dataset.prevDecks) ? parseInt(t.dataset.prevDecks, 10) : RULE_NUM_DECKS;
      const v = parseInt(t.value, 10);

      if(isShoeSizeLocked()){
        // Revert immediately + explain.
        t.value = String(prev);
        showPopup('Deck count is locked until the next shuffle.');
        return;
      }

      // Unlocked: update baseline for subsequent changes within the same open modal.
      if(Number.isFinite(v)) t.dataset.prevDecks = String(v);
      return;
    }

    // v157: Cut policy UI behavior in Settings
    if(t.id === 'randomCutYes' || t.id === 'randomCutNo'){
      const rulesLocked = areTableRulesLocked();
      if(rulesLocked){
        e.preventDefault();
        e.stopPropagation();
        // Revert checked state back to current
        const y = getEl('randomCutYes');
        const n = getEl('randomCutNo');
        if(y && n){
          y.checked = !!CUT_RANDOM_CUT_CARD;
          n.checked = !CUT_RANDOM_CUT_CARD;
        }
        showPopup('Table rules cannot be changed in the middle of a shoe.');
        return;
      }
      const slider = getEl('settingsPenetration');
      const lab = getEl('settingsPenetrationLabel');
      const wantRandom = !!(getEl('randomCutYes') && getEl('randomCutYes').checked);
      if(slider){
        if(wantRandom){
          slider.value = '75';
          slider.disabled = true;
          slider.setAttribute('aria-disabled','true');
          if(lab) lab.textContent = '75%';
        }else{
          slider.disabled = false;
          slider.setAttribute('aria-disabled','false');
          // keep current stored value in the UI if possible
          slider.value = String(CUT_PENETRATION_PERCENT);
          if(lab) lab.textContent = String(CUT_PENETRATION_PERCENT) + '%';
        }
      }
      return;
    }
    if(t.id === 'hitSoft17Yes' || t.id === 'hitSoft17No' || t.id === 'staySoft17Yes' || t.id === 'staySoft17No'){
      enforceSoft17Mutual(t.id);
    }
  }, true);
}

wireDelegatedUI();


// Close help scroll when clicking outside the parchment
document.addEventListener('click', (e)=>{
  const t = e.target;
  if(t && t.id === 'helpModal'){
    hideHelpScroll();
  }
});


// -----------------
// Soundtrack (v111B)
// -----------------
function initSoundtrack(){
  try{
    soundtrackAudio = new Audio('sounds/tibetan_soundtrack.mp3');
    soundtrackAudio.loop = true;
    soundtrackAudio.volume = SOUNDTRACK_VOL;
  }catch(e){
    console.warn('Soundtrack init failed', e);
    soundtrackAudio = null;
  }
}

function startSoundtrack(){
  if(!soundtrackAudio || soundtrackStarted || !SOUNDTRACK_ON) return;
  soundtrackAudio.volume = SOUNDTRACK_VOL;
  const p = soundtrackAudio.play();
  soundtrackStarted = true;
  if(p && typeof p.catch === 'function'){
    p.catch(()=>{ soundtrackStarted = false; });
  }
}

function setSoundtrackVolume(v){
  SOUNDTRACK_VOL = Math.max(0, Math.min(1, Number(v)));
  if(soundtrackAudio){ soundtrackAudio.volume = SOUNDTRACK_VOL; }
}


function setSoundtrackOn(on){
  SOUNDTRACK_ON = !!on;
  if(!soundtrackAudio) return;
  if(SOUNDTRACK_ON){
    // Ensure volume is applied and attempt to play (user gesture rules may still apply).
    soundtrackAudio.volume = SOUNDTRACK_VOL;
    const p = soundtrackAudio.play();
    soundtrackStarted = true;
    if(p && typeof p.catch === 'function'){
      p.catch(()=>{ soundtrackStarted = false; });
    }
  }else{
    try{ soundtrackAudio.pause(); }catch(_){}
    soundtrackStarted = false;
  }
}
function setGameSoundsOn(on){
  GAME_SOUNDS_ON = !!on;
}

function playSfx(path){
  if(!GAME_SOUNDS_ON) return;
  try{
    const a = new Audio(path);
    a.volume = 1.0;
    a.play().catch(()=>{});
  }catch(e){}
}


// v111B: Autoplay fallback — start soundtrack on first user gesture
function startSoundtrackOnGesture(){
  if(soundtrackStarted) return;
  startSoundtrack();
}
window.addEventListener('pointerdown', startSoundtrackOnGesture, {once:true});
window.addEventListener('keydown', startSoundtrackOnGesture, {once:true});

function applySoundtrackVolume(vol){
  if(window.soundtrackAudio){
    window.soundtrackAudio.volume = Math.max(0, Math.min(1, vol));
  }
}


/*** v126C: Scale ONLY the playfield (dealer+player), keep HUD fixed; lock the player→controls gap. ***/
(function(){
  function initPlayfieldScale(){
    const stage = document.getElementById('gameStage');
    const viewport = document.getElementById('gameViewport');
    const controls = document.querySelector('.controls');
    const controlsInner = controls ? controls.querySelector('.controlsInner') : null;
    const table = stage ? stage.querySelector('.table') : null;
    const playerArea = document.getElementById('playerArea');
    if(!stage || !viewport || !controls || !controlsInner || !table || !playerArea) return;

    // Create a dedicated wrapper we can transform without ever touching the fixed HUD.
    // (Transforming an ancestor of a position:fixed element breaks viewport pinning.)
    let wrap = document.getElementById('playfieldWrap');
    // IMPORTANT: measure baselines while .table is still in normal flow (before moving into an absolute wrapper).
    // If we move first, width:auto + shrink-to-fit rules can collapse the table and corrupt baseline geometry.
    let needsMoveIntoWrap = !wrap;

    function ensureWrap(){
      if(wrap) return;
      wrap = document.createElement('div');
      wrap.id = 'playfieldWrap';
      // Minimal inline layout: wrapper is the transform surface (never an ancestor of the fixed HUD).
      wrap.style.position = 'absolute';
      wrap.style.left = '0px';
      wrap.style.top = '0px';
      wrap.style.transformOrigin = 'top left';
      wrap.style.willChange = 'transform';
      wrap.style.pointerEvents = 'none';

      // Insert wrapper before controls so z-order remains natural.
      stage.insertBefore(wrap, controls);
      wrap.appendChild(table);

      // Allow playfield to receive input.
      wrap.style.pointerEvents = 'auto';
    }

    // Baselines (measured at scale=1, no transforms)
    let baseW = 0;
    let basePlayerBottomLocal = 0;
    let baseGap = 0; // player bottom → controls top
    // Controls bar baseline (scale=1). We'll keep the background full-bleed, but scale the contents.
    let baseControlsH = 0;
    let baseControlsInnerW = 0;
    let baseControlsInnerH = 0;
    let baseControlsPadding = {t:0,r:0,b:0,l:0};
    const MIN_GAP = 24; // px (prevents controls riding too high into player lane)
    const LEATHER_H = 28; // matches .controls::after height

    const tooSmall = document.getElementById('tooSmallOverlay');
    const TOO_SMALL_SCALE = 0.55;

    function measureBase(){
      // Clear transforms to measure true v125/v120B geometry.
      // (wrap may not exist yet on first measure — we intentionally measure before moving .table.)
      if(wrap) wrap.style.transform = 'none';
      if(controlsInner){
        controlsInner.style.transform = 'none';
        controlsInner.style.transformOrigin = 'top left';
        controlsInner.style.willChange = 'transform';
      }
      // Reset any inline sizing from prior resizes.
      controls.style.height = '';
      controls.style.overflow = '';
      controls.style.paddingTop = '';
      controls.style.paddingRight = '';
      controls.style.paddingBottom = '';
      controls.style.paddingLeft = '';

      const vw = (window.visualViewport && window.visualViewport.width)  ? window.visualViewport.width  : window.innerWidth;
      // Ensure stage spans viewport; #gameStage already stretches via right/bottom in CSS.
      // Compute base width from the table's natural size.
      const tr = table.getBoundingClientRect();
      baseW = Math.max(1, Math.round(tr.width));

      // Player bottom local to table top.
      const pr = playerArea.getBoundingClientRect();
      basePlayerBottomLocal = Math.max(1, (pr.bottom - tr.top));

      // Desired (constant) gap in viewport pixels.
      const cr = controls.getBoundingClientRect();
      baseGap = Math.max(0, Math.round(cr.top - pr.bottom));

      // Baseline controls sizing (so we can scale controls content + container height in sync with playfield).
      const cs = window.getComputedStyle(controls);
      baseControlsPadding.t = parseFloat(cs.paddingTop) || 0;
      baseControlsPadding.r = parseFloat(cs.paddingRight) || 0;
      baseControlsPadding.b = parseFloat(cs.paddingBottom) || 0;
      baseControlsPadding.l = parseFloat(cs.paddingLeft) || 0;

      const ir = controlsInner.getBoundingClientRect();
      baseControlsInnerW = Math.max(1, Math.round(ir.width));
      baseControlsInnerH = Math.max(1, Math.round(ir.height));

      // Use content-driven height (inner + paddings). This removes excess "dead felt" at the bottom.
      // Note: leather rail is drawn with ::after and sits above controls (top:-LEATHER_H), so it should NOT
      // contribute to the container's layout height.
      baseControlsH = Math.max(1, Math.round(baseControlsInnerH + baseControlsPadding.t + baseControlsPadding.b));

      // If something is wildly off (e.g. first paint), fall back to a sane gap.
      if(!isFinite(baseGap) || baseGap < 0) baseGap = 16;
      baseGap = Math.max(baseGap, MIN_GAP);

      // If this is the first baseline measure, move the table into the transform wrapper now.
      if(needsMoveIntoWrap){
        ensureWrap();
        needsMoveIntoWrap = false;
      }
      if(!wrap) return;

      // Lock wrapper width so width-based scaling is stable.
      wrap.style.width = baseW + 'px';
    }

    function applyScale(){
      if(!baseW || !basePlayerBottomLocal || !baseControlsH) return;

      const vw = (window.visualViewport && window.visualViewport.width)  ? window.visualViewport.width  : window.innerWidth;
      const vh = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;

      // We want playfield AND controls to shrink at the same rate.
      // Vertical fit constraint:
      //   (playfield playerBottomLocal * s) + baseGap + (controls height * s) <= vh
      // => s <= (vh - baseGap) / (basePlayerBottomLocal + baseControlsH)
      const sW = vw / baseW;
      const sH = (vh - baseGap) / (basePlayerBottomLocal + baseControlsH);
      const s = Math.min(1, sW, sH);

      // Apply the SAME scale factor to the controls content.
      // Keep the controls background full-bleed, but scale the inner UI and shrink the panel height.
      if(controlsInner){
        // Freeze the inner layout at its baseline width so rows never reflow/wrap on narrow viewports.
        // We then center + scale it as a single unit.
        if(baseControlsInnerW){
          controlsInner.style.width = baseControlsInnerW + 'px';
          controlsInner.style.maxWidth = 'none';
          controlsInner.style.margin = '0';
        }
        const txC = Math.max(0, (vw - (baseControlsInnerW * s)) / 2);
        controlsInner.style.transform = `translate(${txC}px, 0px) scale(${s})`;
        controlsInner.style.transformOrigin = 'top left';
      }

      // Scale paddings too so everything feels like it's shrinking together.
      controls.style.paddingTop = (baseControlsPadding.t * s) + 'px';
      controls.style.paddingRight = (baseControlsPadding.r * s) + 'px';
      controls.style.paddingBottom = (baseControlsPadding.b * s) + 'px';
      controls.style.paddingLeft = (baseControlsPadding.l * s) + 'px';

      // Transform doesn't affect layout, so explicitly shrink the control panel height.
      controls.style.height = (baseControlsH * s) + 'px';
      // Keep overflow visible so the leather rail (::after) can render above the panel.
      controls.style.overflow = 'visible';

      // With scaled control panel height, compute its top edge (it is fixed to bottom:0).
      const controlsTop = vh - (baseControlsH * s);

      // Center horizontally.
      const tx = Math.max(0, (vw - (baseW * s)) / 2);

      // Lock the player→controls gap: place player bottom at (controlsTop - baseGap).
      // playerBottomViewport = ty + (basePlayerBottomLocal * s)
      // => ty = (controlsTop - baseGap) - (basePlayerBottomLocal * s)
      let ty = (controlsTop - baseGap) - (basePlayerBottomLocal * s);
      if(!isFinite(ty)) ty = 0;
      // Never push the playfield above the top edge.
      ty = Math.max(0, ty);

      wrap.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;

      if(tooSmall){
        if(s < TOO_SMALL_SCALE) tooSmall.classList.remove('hidden');
        else tooSmall.classList.add('hidden');
      }
    }

    // Initial measure after layout settles.
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        measureBase();
        applyScale();
      });
    });

    // Re-measure when the HUD height changes (e.g., font load) or on first real resize.
    let didBase = false;
    function onResize(){
      if(!didBase){
        measureBase();
        didBase = true;
      }
      applyScale();
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', onResize);
      window.visualViewport.addEventListener('scroll', onResize);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initPlayfieldScale);
  } else {
    initPlayfieldScale();
  }
})();