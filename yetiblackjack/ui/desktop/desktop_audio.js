/*
  ui/desktop/desktop_audio.js
  --------------------------
  Owns: desktop sound effects (deal/flip, riffle).

  Notes:
  - This file is intentionally DOM-light. It only creates Audio objects.
  - Global flags like GAME_SOUNDS_ON live in script.js; this module reads them at play time.
  - For backward compatibility during refactor, we also publish the legacy
    global function names: initAudio(), playDealFlip(), playRiffle().
*/

(() => {
  window.BJ = window.BJ || {};
  BJ.desktopAudio = BJ.desktopAudio || {};

  const DEAL_FLIP_SFX_SRC = 'sounds/deal_flip.wav';
  const RIFFLE_SFX_SRC    = 'sounds/riffle.mp3';

  let dealFlipSfxBase = null;
  let riffleSfxBase   = null;
  let dealFlipSfxDur  = 0.5; // seconds (will be replaced by loadedmetadata)
  let riffleSfxDur    = 0.7;

  // Legacy globals used by some timing code in script.js
  window.dealFlipSfxDur = dealFlipSfxDur;
  window.riffleSfxDur = riffleSfxDur;

  function initAudio(){
    // Deal/flip
    dealFlipSfxBase = new Audio(DEAL_FLIP_SFX_SRC);
    dealFlipSfxBase.preload = 'auto';
    dealFlipSfxBase.addEventListener('loadedmetadata', ()=>{
      if(Number.isFinite(dealFlipSfxBase.duration) && dealFlipSfxBase.duration > 0){
        dealFlipSfxDur = dealFlipSfxBase.duration;
        window.dealFlipSfxDur = dealFlipSfxDur;
      }
    });

    // Riffle
    riffleSfxBase = new Audio(RIFFLE_SFX_SRC);
    riffleSfxBase.preload = 'auto';
    riffleSfxBase.addEventListener('loadedmetadata', ()=>{
      if(Number.isFinite(riffleSfxBase.duration) && riffleSfxBase.duration > 0){
        riffleSfxDur = riffleSfxBase.duration;
        window.riffleSfxDur = riffleSfxDur;
      }
    });
  }

  function playDealFlip(){
    // In this project, GAME_SOUNDS_ON is a top-level `let` in script.js.
    // Top-level `let` bindings do NOT attach to window, so we must read the
    // identifier directly when available.
    try{
      if(typeof GAME_SOUNDS_ON !== 'undefined' && !GAME_SOUNDS_ON) return;
    }catch(_e){ /* ignore */ }
    // Fallback for any future build that uses a window property.
    if(typeof window.GAME_SOUNDS_ON !== 'undefined' && !window.GAME_SOUNDS_ON) return;
    if(!dealFlipSfxBase) return;
    const a = dealFlipSfxBase.cloneNode(true);
    a.volume = 0.75;
    a.currentTime = 0;
    a.play().catch(()=>{});
  }

  function playRiffle(){
    try{
      if(typeof GAME_SOUNDS_ON !== 'undefined' && !GAME_SOUNDS_ON) return;
    }catch(_e){ /* ignore */ }
    if(typeof window.GAME_SOUNDS_ON !== 'undefined' && !window.GAME_SOUNDS_ON) return;
    if(!riffleSfxBase) return;
    const a = riffleSfxBase.cloneNode(true);
    a.volume = 0.9;
    a.currentTime = 0;
    a.play().catch(()=>{});
  }

  BJ.desktopAudio.initAudio = initAudio;
  BJ.desktopAudio.playDealFlip = playDealFlip;
  BJ.desktopAudio.playRiffle = playRiffle;
  BJ.desktopAudio.getDurations = () => ({ dealFlipSfxDur, riffleSfxDur });

  // Legacy globals
  window.initAudio = initAudio;
  window.playDealFlip = playDealFlip;
  window.playRiffle = playRiffle;
})();
