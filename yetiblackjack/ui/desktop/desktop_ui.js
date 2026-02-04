/*
  ui/desktop/desktop_ui.js (v143 skeleton)
  --------------------------------------
  Owns: desktop control wiring (buttons, keyboard) + calling engine actions.
  Not allowed: game rules. This file should not decide outcomes or totals.

  Planned flow:
    - const game = BJ.engine.createGame(config)
    - wire UI events -> game.action(...)
    - after each action, call render(state) in desktop_render.js
*/
(() => {
  window.BJ = window.BJ || {};
  BJ.desktop = BJ.desktop || {};

  let _controlsMounted = false;

  /**
   * Mount desktop controls (buttons + keyboard) using callbacks provided by
   * the legacy layer.
   *
   * Why this shape?
   * - In v142C/v143D, many key state variables are `let` bindings inside
   *   script.js (not on window). That means other files can't read them.
   * - To keep Step 6 "no behavior change", script.js passes closures for
   *   isInRound/gameOver/etc.
   *
   * @param {object} opts
   * @param {HTMLButtonElement} opts.dealBtn
   * @param {HTMLButtonElement} opts.hitBtn
   * @param {HTMLButtonElement} opts.standBtn
   * @param {HTMLButtonElement} opts.doubleBtn
   * @param {HTMLButtonElement} opts.splitBtn
   * @param {HTMLButtonElement} opts.surrenderBtn
   * @param {function():boolean} opts.isInRound
   * @param {function():boolean} opts.isGameOver
   * @param {function():Promise<void>} opts.deal
   * @param {function():Promise<void>} opts.hit
   * @param {function():Promise<void>} opts.stand
   * @param {function():Promise<void>} opts.double
   * @param {function():Promise<void>} opts.split
   * @param {function():Promise<void>} opts.surrender
   * @param {function(Error):void} opts.onDealError
   */
  BJ.desktop.mountControls = function mountControls(opts){
    if(_controlsMounted) return;
    _controlsMounted = true;

    const {
      dealBtn,
      hitBtn,
      standBtn,
      doubleBtn,
      splitBtn,
      surrenderBtn,
      isInRound,
      isGameOver,
      deal,
      hit,
      stand,
      double,
      split,
      surrender,
      onDealError,
    } = opts || {};

    // --- Deal ---
    if(dealBtn){
      dealBtn.addEventListener('click', async ()=>{
        if(typeof isInRound === 'function' && isInRound()) return;
        if(typeof isGameOver === 'function' && isGameOver()) return;
        try{
          if(typeof deal === 'function') await deal();
        }catch(err){
          console.error('Deal failed', err);
          if(typeof onDealError === 'function') onDealError(err);
        }
      });
    }

    // --- Core actions ---
    if(hitBtn){
      hitBtn.addEventListener('click', async ()=>{
        if(typeof isInRound === 'function' && !isInRound()) return;
        if(typeof hit === 'function') await hit();
      });
    }
    if(standBtn){
      standBtn.addEventListener('click', async ()=>{
        if(typeof isInRound === 'function' && !isInRound()) return;
        if(typeof stand === 'function') await stand();
      });
    }
    if(doubleBtn){
      doubleBtn.addEventListener('click', async ()=>{
        if(typeof isInRound === 'function' && !isInRound()) return;
        if(typeof double === 'function') await double();
      });
    }
    if(splitBtn){
      splitBtn.addEventListener('click', async ()=>{
        if(typeof isInRound === 'function' && !isInRound()) return;
        if(typeof split === 'function') await split();
      });
    }
    if(surrenderBtn){
      surrenderBtn.addEventListener('click', async ()=>{
        if(typeof isInRound === 'function' && !isInRound()) return;
        if(typeof surrender === 'function') await surrender();
      });
    }

    // --- Keyboard: Enter triggers Deal when enabled ---
    document.addEventListener('keydown', (e)=>{
      if(e.key !== 'Enter') return;

      // Don't hijack Enter when typing in a form field.
      const ae = document.activeElement;
      if(ae){
        const tag = (ae.tagName || '').toLowerCase();
        if(tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if(ae.isContentEditable) return;
      }

      if(!dealBtn) return;
      if(dealBtn.disabled) return;

      // Prevent accidental double-trigger in some browsers.
      e.preventDefault();
      dealBtn.click();
    });
  };
})();
