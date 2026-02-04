/*
  persistence/storage.js
  --------------------
  Thin wrapper around localStorage.

  Rules:
  - No game logic
  - No DOM assumptions
  - String-in / string-out
*/
(() => {
  window.BJ = window.BJ || {};
  BJ.persistStorage = BJ.persistStorage || {};

  function getItem(key){
    try{
      return window.localStorage ? localStorage.getItem(key) : null;
    }catch(_e){
      return null;
    }
  }

  function setItem(key, value){
    try{
      if(!window.localStorage) return false;
      localStorage.setItem(key, String(value));
      return true;
    }catch(_e){
      return false;
    }
  }

  function removeItem(key){
    try{
      if(!window.localStorage) return false;
      localStorage.removeItem(key);
      return true;
    }catch(_e){
      return false;
    }
  }

  BJ.persistStorage.getItem = getItem;
  BJ.persistStorage.setItem = setItem;
  BJ.persistStorage.removeItem = removeItem;
})();
