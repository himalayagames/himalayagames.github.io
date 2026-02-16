/*
  core/shoe.js (v143D Step 3)
  --------------------------
  Owns: shoe/deck build + shuffle + draw + cut-marker logic (DOM-free).
  Does NOT: touch DOM, trigger overlays, update deck viewer, update icons, play audio.
  UI is responsible for reacting to the returned flags.

  Public API (BJ.shoe):
    - newShuffledShoe(decks)
    - draw({decks, inRound})
    - drawSpecific({decks, target})
    - drawMatching({decks, firstCard})
    - shoeTotalCards()
    - shoeArrayLength()
    - cardsRemaining()
    - discardCount()
    - cardsUntilCut()
    - getState()   (for dev tools / UI read-only)
*/

(() => {
  window.BJ = window.BJ || {};

  // IMPORTANT: Suit tokens must match the legacy v142C UI/render pipeline.
  // The UI expects suit names ("spades","hearts","diamonds","clubs"),
  // which are used for:
  //   - SUIT_CHAR lookup (pip text)
  //   - CSS classnames (suit-*)
  //   - face-card asset selection
  const SUITS = ['spades','hearts','diamonds','clubs'];
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const TEN_SET = new Set(['10','J','Q','K']);

  
  

  // ----------------------------
  // v168D: Card identities
  // ----------------------------
  // Each physical card in a shoe is assigned a unique, stable id at shoe creation.
  // UI uses this id to emit cardRevealed events; counting systems can dedupe safely.

// Internal shoe state
  let shoe = [];
  let shoePos = 0;        // next draw index
  let cutIndex = -1;      // index of cut marker within shoe array
  let discardPile = [];   // cards drawn this shoe, in order (cards only, no cut marker)
  let shoeId = 0;

  // Cut policy is owned by the shoe module (UI can update via setCutPolicy).
  // v157 defaults: randomCutCard=false, penetrationPercent=75.
  let cutPolicy = { randomCutCard: false, penetrationPercent: 75 };

  function normalizeCutPolicy(policy){
    const base = (policy && typeof policy === 'object') ? policy : {};
    let randomCutCard = !!base.randomCutCard;
    let penetrationPercent = Number.isFinite(base.penetrationPercent) ? Number(base.penetrationPercent) : 75;

    // Clamp + snap to 5% increments inside [65, 90].
    penetrationPercent = Math.max(65, Math.min(90, penetrationPercent));
    penetrationPercent = Math.round(penetrationPercent / 5) * 5;
    penetrationPercent = Math.max(65, Math.min(90, penetrationPercent));

    return { randomCutCard, penetrationPercent };
  }

  function setCutPolicy(policy){
    cutPolicy = normalizeCutPolicy(policy);
    return cutPolicy;
  }


  function shuffleInPlace(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function buildRawCards(decks, shoeIdForCards){
    const cards=[];
    let seq = 0;
    const sid = String(shoeIdForCards || 0);
    for(let d=0; d<decks; d++){
      for(const s of SUITS){
        for(const r of RANKS){
          // Stable id for this physical card instance within the shoe
          // Format: "<shoeId>-<seq>"
          cards.push({s,r,id:`${sid}-${seq++}`});
        }
      }
    }
    return cards;
  }

  function validateFullShoe(cardsOnly, decks){
    const issues = [];
    const expectedTotal = 52 * decks;
    if(cardsOnly.length !== expectedTotal){
      issues.push(`Total cards ${cardsOnly.length} != expected ${expectedTotal}`);
    }

    const counts = new Map();
    for(const c of cardsOnly){
      if(!c || !c.s || !c.r){ issues.push('Encountered invalid card object'); continue; }
      const key = c.s + '|' + c.r;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    if(counts.size !== 52) issues.push(`Distinct suit/rank combos ${counts.size} != 52`);
    for(const s of SUITS){
      for(const r of RANKS){
        const key = s + '|' + r;
        const n = counts.get(key) || 0;
        if(n !== decks) issues.push(`Count for ${r}${s} = ${n} (expected ${decks})`);
      }
    }

    return { ok: issues.length === 0, issues };
  }

  function placeCutMarker(arrCardsOnly, policy){
    // Cut marker placement policy:
    // - If policy.randomCutCard is true: legacy random placement (70%–80%).
    // - Else: deterministic placement based on policy.penetrationPercent.
    const total = arrCardsOnly.length;

    const pol = normalizeCutPolicy(policy);
    let pos = 0;

    if(pol.randomCutCard){
      const minPos = Math.floor(total * 0.70);
      const maxPos = Math.floor(total * 0.80);
      pos = minPos + Math.floor(Math.random() * (maxPos - minPos + 1));
    }else{
      const p = Math.max(0, Math.min(1, pol.penetrationPercent / 100));
      pos = Math.floor(total * p);
      // Keep the marker inside the deal stream.
      pos = Math.max(1, Math.min(total - 1, pos));
    }

    arrCardsOnly.splice(pos, 0, {cut:true});
    return pos;
  }

  function newShuffledShoe(decks){
    const nextShoeId = shoeId + 1;
    const cards = buildRawCards(decks, nextShoeId);
    const audit = validateFullShoe(cards, decks);
    if(!audit.ok){
      console.error('Shoe validation FAILED:', audit.issues);
    }

    shuffleInPlace(cards);
    cutIndex = placeCutMarker(cards, cutPolicy);

    shoe = cards;
    shoePos = 0;
    discardPile = [];
    shoeId = nextShoeId;

    return { auditOk: audit.ok, auditIssues: audit.issues || [], shoeId };
  }

  function shoeTotalCards(){
    // total cards in shoe, excluding cut marker
    // If shoe is not initialized yet, infer from current array length.
    const n = (shoe && shoe.length) ? shoe.filter(x => !x.cut).length : 0;
    return n;
  }
  function shoeArrayLength(){ return (shoe && shoe.length) ? shoe.length : 0; }

  function cardsRemaining(){
    if(!shoe || shoe.length === 0) return 0;
    let rem = shoe.length - shoePos;
    if(cutIndex >= shoePos) rem -= 1; // cut marker still ahead in remaining segment
    return Math.max(0, rem);
  }
  function discardCount(){ return discardPile.length; }
  function cardsUntilCut(){
    if(cutIndex < 0) return null;
    if(cutIndex < shoePos) return 0;
    return cutIndex - shoePos;
  }

  function adjustCutIndexAfterSplice(spliceIndex){
    if(cutIndex >= 0 && spliceIndex < cutIndex) cutIndex -= 1;
  }

  function ensureShoe(decks){
    if(!shoe || shoe.length === 0){
      newShuffledShoe(decks);
    }
    if(shoePos >= shoe.length){
      newShuffledShoe(decks);
    }
  }

  /**
   * Draws the next card (cards only) from the shoe.
   * Returns:
   *   { card, shufflePending, shuffledNow }
   *
   * Behavior:
   * - If cut marker is encountered:
   *     - if inRound: consume cut marker and set shufflePending=true, continue drawing.
   *     - if NOT inRound: reshuffle immediately (shuffledNow=true).
   */
  function draw({decks, inRound}){
    ensureShoe(decks);

    let shufflePending = false;
    let shuffledNow = false;

    // If cut marker is reached at draw time, consume and decide shuffle policy.
    if(shoe[shoePos] && shoe[shoePos].cut){
      shoePos++; // consume cut marker
      if(inRound){
        shufflePending = true;
        // continue drawing from remaining cards without reshuffling now
      } else {
        newShuffledShoe(decks);
        shuffledNow = true;
      }
    }

    ensureShoe(decks);

    // Draw a real card (should not be cut marker)
    let c = shoe[shoePos++];
    // Defensive: if somehow we pulled cut marker here, recurse once.
    if(c && c.cut){
      return draw({decks, inRound});
    }

    discardPile.push(c);
    return { card: c, shufflePending, shuffledNow };
  }

  
function drawSpecific({decks, target, inRound}, _secondTry=false){
  ensureShoe(decks);

  let shufflePending = false;
  let shuffledNow = false;

  // Handle cut marker at the mouth using the same policy as draw()
  if(shoe[shoePos] && shoe[shoePos].cut){
    shoePos++; // consume cut marker
    if(inRound){
      shufflePending = true;
      // continue without reshuffling now
    }else{
      newShuffledShoe(decks);
      shuffledNow = true;
    }
  }

  ensureShoe(decks);

  // Pull a specific card from the remaining shoe to preserve deck integrity.
  if(!target || !target.s || !target.r){
    const res = draw({decks, inRound: !!inRound});
    // merge flags (draw() may also set shufflePending/shuffledNow)
    return {
      card: res.card,
      shufflePending: shufflePending || res.shufflePending,
      shuffledNow: shuffledNow || res.shuffledNow
    };
  }

  for(let i=shoePos;i<shoe.length;i++){
    const c = shoe[i];
    if(c && !c.cut && c.s === target.s && c.r === target.r){
      const [picked] = shoe.splice(i,1);
      adjustCutIndexAfterSplice(i);
      discardPile.push(picked);
      return { card: picked, shufflePending, shuffledNow };
    }
  }

  if(_secondTry){
    console.warn('drawSpecific: card not found in shoe; falling back to draw()', target);
    const res = draw({decks, inRound: !!inRound});
    return {
      card: res.card,
      shufflePending: shufflePending || res.shufflePending,
      shuffledNow: shuffledNow || res.shuffledNow
    };
  }

  newShuffledShoe(decks);
  shuffledNow = true;
  return drawSpecific({decks, target, inRound}, true);
}


  
function drawMatching({decks, firstCard, inRound}, _secondTry=false){
  ensureShoe(decks);

  let shufflePending = false;
  let shuffledNow = false;

  // Handle cut marker at the mouth using the same policy as draw()
  if(shoe[shoePos] && shoe[shoePos].cut){
    shoePos++; // consume cut marker
    if(inRound){
      shufflePending = true;
    }else{
      newShuffledShoe(decks);
      shuffledNow = true;
    }
  }

  ensureShoe(decks);

  const wantTen = firstCard && firstCard.r ? TEN_SET.has(firstCard.r) : false;

  for(let i=shoePos;i<shoe.length;i++){
    const c = shoe[i];
    if(!c || c.cut) continue;
    const ok = wantTen ? TEN_SET.has(c.r) : (firstCard && c.r === firstCard.r);
    if(ok){
      const [picked] = shoe.splice(i,1);
      adjustCutIndexAfterSplice(i);
      discardPile.push(picked);
      return { card: picked, shufflePending, shuffledNow };
    }
  }

  if(_secondTry){
    console.warn('drawMatching: no match found after reshuffle; falling back to draw()');
    const res = draw({decks, inRound: !!inRound});
    return {
      card: res.card,
      shufflePending: shufflePending || res.shufflePending,
      shuffledNow: shuffledNow || res.shuffledNow
    };
  }

  newShuffledShoe(decks);
  shuffledNow = true;
  return drawMatching({decks, firstCard, inRound}, true);
}


  function getState(){
    return {
      shoe,
      shoePos,
      cutIndex,
      discardPile,
      shoeId,
      totalCards: shoeTotalCards(),
      cardsRemaining: cardsRemaining(),
      discardCount: discardCount(),
      cardsUntilCut: cardsUntilCut(),
      shoeArrayLength: shoeArrayLength()
    };
  }

  BJ.shoe = {
    newShuffledShoe,
    setCutPolicy,
    draw,
    drawSpecific,
    drawMatching,
    shoeTotalCards,
    shoeArrayLength,
    cardsRemaining,
    discardCount,
    cardsUntilCut,
    getState
  };
})();
