/*
  core/utils.js (v143D)
  --------------------
  Purpose
    Pure helper utilities shared across games.

  Owns
    - small math/format helpers
    - timing helpers (pause / nextFrame)
    - currency formatting helpers used by UI + engine

  Must NOT
    - touch the DOM
    - depend on any game state

  Exposes
    window.BJ.utils.{ pause, max0, intMs, nextFrame,
                     roundMoney, fmtMoney,
                     clampToHalfDollar,
                     digitsOnly, snapToNearest5, formatUSD0 }
*/

(() => {
  'use strict';

  // Namespace
  window.BJ = window.BJ || {};
  BJ.utils = BJ.utils || {};

  // ---- Timing helpers ----
  const pause = (ms) => new Promise(r => setTimeout(r, ms));

  function nextFrame(){
    return new Promise((r)=>requestAnimationFrame(()=>r()));
  }

  // ---- Numeric helpers ----
  function max0(n){
    n = Number(n);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  function intMs(seconds){
    const s = Number(seconds);
    if(!Number.isFinite(s)) return 0;
    return Math.max(0, Math.round(s * 1000));
  }

  function roundMoney(n){
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function fmtMoney(n){
    return `$${roundMoney(n).toFixed(2)}`;
  }

  function clampToHalfDollar(v){
    // Keep to $0.50 increments, avoid floating drift
    if(!Number.isFinite(v)) return 0;
    // round DOWN to nearest 0.50
    return Math.floor(v * 2) / 2;
  }

  // ---- Input / formatting helpers ----
  function digitsOnly(str){
    return String(str ?? '').replace(/[^0-9]/g,'');
  }

  function snapToNearest5(n){
    n = Number(n);
    if(!Number.isFinite(n)) return 0;
    return Math.round(n/5)*5;
  }

  function formatUSD0(n){
    // USD currency with 0 fraction digits (e.g. $1,250)
    const v = Number(n);
    const safe = Number.isFinite(v) ? v : 0;
    try{
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(safe);
    }catch(_){
      // Fallback if Intl isn't available
      const rounded = Math.round(safe);
      return '$' + String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  }

  // Export
  Object.assign(BJ.utils, {
    pause,
    max0,
    intMs,
    nextFrame,
    roundMoney,
    fmtMoney,
    clampToHalfDollar,
    digitsOnly,
    snapToNearest5,
    formatUSD0,
  });
})();
