/*
  ui/desktop/desktop_graph.js
  --------------------------
  Desktop-only bankroll graph modal.

  - UI only (DOM + canvas)
  - Reads data via BJ.persistLedger (no direct localStorage calls)
*/
(() => {
  window.BJ = window.BJ || {};
  BJ.desktopGraph = BJ.desktopGraph || {};

  function els(){
    return {
      overlay: document.getElementById('bankrollGraphModal'),
      canvas: document.getElementById('bankrollGraphCanvas'),
      title: document.getElementById('bankrollGraphTitle'),
      note: document.getElementById('bankrollGraphNote'),
      closeBtn: document.getElementById('bankrollGraphCloseBtn'),
      openBtn: document.getElementById('graphWinningsBtn'),
      clearBtn: document.getElementById('clearDataBtn'),
      clearOverlay: document.getElementById('clearDataModal'),
      clearYesBtn: document.getElementById('clearDataYesBtn'),
      clearNoBtn: document.getElementById('clearDataNoBtn'),
    };
  }

  function show(){ const e = els(); if(e.overlay) e.overlay.classList.remove('hidden'); }
  function hide(){ const e = els(); if(e.overlay) e.overlay.classList.add('hidden'); }

  function showClear(){
    const e = els();
    if(e.clearOverlay) e.clearOverlay.classList.remove('hidden');
  }
  function hideClear(){
    const e = els();
    if(e.clearOverlay) e.clearOverlay.classList.add('hidden');
  }

  function drawChart(){
    const e = els();
    const L = BJ.persistLedger;
    if(!e.canvas || !L) return;

    const series = L.getSeries ? L.getSeries() : { points: [] };
    const pts = series.points || [];

    // If not enough data, show a note and clear canvas.
    if(e.note){
      if(pts.length < 2) e.note.textContent = 'Play a few hands to generate a bankroll graph.';
      else e.note.textContent = `Showing last ${pts.length} hands (max ${series.maxHands || 2000}).`;
    }

    const ctx = e.canvas.getContext('2d');
    if(!ctx) return;

    // Size canvas to its CSS box for crisp rendering.
    const rect = e.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(300, Math.floor(rect.width));
    const h = Math.max(180, Math.floor(rect.height));
    e.canvas.width = Math.floor(w * dpr);
    e.canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Padding
    const padL = 54;
    const padR = 16;
    const padT = 18;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Axes
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // If not enough points, nothing else to draw.
    if(pts.length < 2){
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
      ctx.fillText('No graph yet', padL + 12, padT + 24);
      return;
    }

    const xs = pts.map(p => p.i);
    const ys = pts.map(p => p.b);

    const minX = xs[0];
    const maxX = xs[xs.length - 1];
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    // Add a little breathing room so flat lines are visible.
    if(minY === maxY){
      minY -= 10;
      maxY += 10;
    }else{
      const pad = (maxY - minY) * 0.08;
      minY -= pad;
      maxY += pad;
    }

    const xScale = (x) => padL + ( (x - minX) / (maxX - minX) ) * plotW;
    const yScale = (y) => padT + plotH - ( (y - minY) / (maxY - minY) ) * plotH;

    // Ticks (y)
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    const yTicks = 5;
    for(let t=0;t<=yTicks;t++){
      const frac = t / yTicks;
      const yVal = minY + (1-frac) * (maxY - minY);
      const y = padT + frac * plotH;

      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();

      const label = `$${Math.round(yVal)}`;
      ctx.fillText(label, 8, y + 4);
    }

    // Ticks (x) - show start/end
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText(String(minX), padL, padT + plotH + 22);
    ctx.fillText(String(maxX), padL + plotW - ctx.measureText(String(maxX)).width, padT + plotH + 22);

    // Line
    ctx.strokeStyle = '#18A7FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(let k=0;k<pts.length;k++){
      const px = xScale(pts[k].i);
      const py = yScale(pts[k].b);
      if(k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Last point
    const last = pts[pts.length - 1];
    const lx = xScale(last.i);
    const ly = yScale(last.b);
    ctx.fillStyle = '#18A7FF';
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Title stats
    if(e.title){
      const startB = pts[0].b;
      const endB = last.b;
      const delta = endB - startB;
      const sign = delta > 0 ? '+' : (delta < 0 ? '-' : '');
      e.title.textContent = `Bankroll per Hand — Start $${Math.round(startB)} → Now $${Math.round(endB)} (${sign}$${Math.round(Math.abs(delta))})`;
    }
  }

  function open(){
    show();
    // Wait a frame so the modal has layout dimensions.
    requestAnimationFrame(() => drawChart());
  }

  function showClear(){
    const e = els();
    if(e.clearOverlay) e.clearOverlay.classList.remove('hidden');
  }

  function hideClear(){
    const e = els();
    if(e.clearOverlay) e.clearOverlay.classList.add('hidden');
  }

  function doClearData(){
    const DEFAULT_BANKROLL = 500;

    // Safety: don't allow clearing mid-hand.
    try{
      if(window.BJ && BJ.legacy && BJ.legacy.inRound){
        // Use a lightweight notice; don't break gameplay.
        if(window.BJ && BJ.desktopModals && typeof BJ.desktopModals.showPopup === 'function'){
          BJ.desktopModals.showPopup('Finish the current hand before clearing data.');
        }
        return;
      }
    }catch(_e){ /* ignore */ }

    try{
      if(window.BJ && BJ.persistController && typeof BJ.persistController.clear === 'function'){
        BJ.persistController.clear();
      }

      // Reset in-memory bankroll (engine uses adapter.bankroll as source of truth).
      if(window.BJ && BJ.legacy){
        BJ.legacy.bankroll = DEFAULT_BANKROLL;
        BJ.legacy.roundStartBankroll = DEFAULT_BANKROLL;
      }

      // Reset ledger module and persist the fresh bankroll (empty graph).
      if(window.BJ && BJ.persistLedger){
        if(typeof BJ.persistLedger.reset === 'function') BJ.persistLedger.reset();
        if(typeof BJ.persistLedger.setBankroll === 'function') BJ.persistLedger.setBankroll(DEFAULT_BANKROLL);
      }
      if(window.BJ && BJ.persistController && typeof BJ.persistController.saveNow === 'function'){
        BJ.persistController.saveNow();
      }

      // Best-effort UI refresh
      try{
        const F = (window.BJ && BJ.legacy && BJ.legacy.fns) ? BJ.legacy.fns : {};
        if(typeof F.updateHud === 'function') F.updateHud();
        if(typeof F.setButtons === 'function') F.setButtons();
        if(typeof window.updateLabels === 'function') window.updateLabels();
      }catch(_e2){ /* ignore */ }
    }catch(_e){ /* ignore */ }
  }

  function mount(){
    const e = els();
    if(e.openBtn){
      e.openBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        open();
      });
    }

    // Clear Data confirmation
    if(e.clearBtn){
      e.clearBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        showClear();
      });
    }
    if(e.clearNoBtn){
      e.clearNoBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        hideClear();
      });
    }
    if(e.clearYesBtn){
      e.clearYesBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        hideClear();
        doClearData();
      });
    }
    if(e.closeBtn){
      e.closeBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        hide();
      });
    }
    if(e.overlay){
      // Click outside modal card closes.
      e.overlay.addEventListener('click', (ev) => {
        if(ev.target === e.overlay) hide();
      });
    }

    if(e.clearOverlay){
      e.clearOverlay.addEventListener('click', (ev) => {
        if(ev.target === e.clearOverlay) hideClear();
      });
    }

    // Redraw on resize while open.
    window.addEventListener('resize', () => {
      const e2 = els();
      if(e2.overlay && !e2.overlay.classList.contains('hidden')) drawChart();
    });
  }

  BJ.desktopGraph.open = open;
  BJ.desktopGraph.hide = hide;
  BJ.desktopGraph.draw = drawChart;
  BJ.desktopGraph.mount = mount;

  window.addEventListener('DOMContentLoaded', mount);
})();
