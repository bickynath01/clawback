/* ============================================================
   CLAWBACK — app.js  (STEP 8: REGIONS + VAT + PROFIT MARGIN + GA EVENTS)
   ============================================================ */

const FALLBACK_FEES = {
  ebay:{label:"eBay",finalValuePct:13.6,finalValuePctOver7500:2.35,flatFee:0,flatFeeUnder:0,perOrderFee:0.40,perOrderFeeLow:0.30,perOrderThreshold:10,processingPct:0,processingFixed:0,disputeFee:20,refund:{finalValue:true,perOrder:false,processing:true},"_note":"eBay US 2026: 13.6% final value fee on most categories (books 15.3%, cards/coins 13.25%); per-order fee $0.30 (≤$10) / $0.40 (>$10); no separate processing fee. Whether fees come back depends on the reason — use the 'what happened' selector."},
  poshmark:{label:"Poshmark",finalValuePct:20,flatFee:2.95,flatFeeUnder:15,perOrderFee:0,processingPct:0,processingFixed:0,refund:{finalValue:true,perOrder:false,processing:true},"_note":"Poshmark 2026: 20% commission ($2.95 flat under $15); commission reversed on an approved return and a prepaid label is provided, so your real loss is the item's value if it comes back damaged. Fit/change-of-mind returns go through Seel and cost you nothing."},
  mercari:{label:"Mercari",finalValuePct:10,flatFee:0,flatFeeUnder:0,perOrderFee:0,processingPct:0,processingFixed:0,refund:{finalValue:true,perOrder:false,processing:true},"_note":"Mercari US 2026: 10% selling fee (back since Jan 2025), no seller processing fee. Prepaid return label is free up to 50 lbs — OVER 50 lbs YOU pay the return label. Your real losses = item value + heavy-item shipping."},
  depop:{label:"Depop",finalValuePct:0,flatFee:0,flatFeeUnder:0,perOrderFee:0,processingPct:3.3,processingFixed:0.45,refund:{finalValue:true,perOrder:false,processing:true},"_note":"Depop US 2026: no selling fee; processing 3.3% + $0.45. ALL fees are auto-refunded when you refund via Depop Payments — so your real loss is the item's value + return shipping, not fees."},
  whatnot:{label:"Whatnot",finalValuePct:8,flatFee:0,flatFeeUnder:0,perOrderFee:0,processingPct:2.9,processingFixed:0.30,processingBase:"gross_order_value",separateCheckoutFixedFee:true,highValueCap:{enabled:true,threshold:1500},categories:{std:{label:"Comics / TCG / Toys / Bags / Jewelry — 8% (cap $1,500)",commissionPct:8,capEligible:true},coins:{label:"Coins & Money — 4% (cap $1,500)",commissionPct:4,capEligible:true},pallets:{label:"Pallets — 4% (no cap)",commissionPct:4,capEligible:false},other:{label:"All other categories — 8% (no cap)",commissionPct:8,capEligible:false}},refund:{finalValue:true,perOrder:false,processing:true},"_note":"Whatnot US 2026: 8% commission on the item's final sale price (4% Coins & Money, 4% Pallets) with 0% on the portion above $1,500 in eligible categories (limited-time promo). Payment processing is 2.9% + $0.30 on the TOTAL order value — item + buyer shipping + buyer sales tax — money you never pocket. Carrier re-weigh adjustments are clawed back days after the stream, and the $0.30 fixed fee is charged per CHECKOUT, so bundled multi-checkout orders pay it every time."},
  vinted:{label:"Vinted",finalValuePct:0,flatFee:0,flatFeeUnder:0,perOrderFee:0,processingPct:0,processingFixed:0,buyerProtectionPct:5,buyerProtectionFixed:0.70,refund:{finalValue:true,perOrder:false,processing:true},"_note":"Vinted US 2026: $0 seller fees — no commission, no processing, no listing fee. You keep 100% of your listed price. The BUYER pays $0.70 + 5% protection and the prepaid shipping label. Optional paid boosts are the only seller cost. On returns there is no seller return fee — your only risk is the item's value drop, which is exactly what CLAWBACK measures."}
};

/* ---------- Whatnot region rates (verified Aug 2026; UK/EU include 20% VAT on fees) ---------- */
const WN_REGIONS = {
  us:{symbol:'$',name:'US',commission:{std:8,coins:4,pallets:4,other:8},cap:{std:true,coins:true,pallets:false,other:false},capThreshold:1500,procPct:2.9,procFixed:0.30,vatPct:0},
  uk:{symbol:'£',name:'UK',commission:{std:6.67,coins:4,pallets:6.67,other:6.67},cap:{std:false,coins:false,pallets:false,other:false},capThreshold:0,procPct:2.42,procFixed:0.25,vatPct:20},
  eu:{symbol:'€',name:'EU',commission:{std:6.67,coins:4,pallets:6.67,other:6.67},cap:{std:false,coins:false,pallets:false,other:false},capThreshold:0,procPct:2.42,procFixed:0.25,vatPct:20}
};

let FEES = FALLBACK_FEES;
let currentPlatform = 'ebay';
let lastResult = null;

const $ = id => document.getElementById(id);
const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
const noteOf = f => f['_note'] || f.note || '';

/* ---------- privacy-safe analytics: fires ONLY if the visitor consented & gtag loaded ---------- */
function trackEvent(name, params){
  try{ if(typeof window.gtag === 'function'){ window.gtag('event', name, params || {}); } }catch(e){}
}

function setNote(){ const f = FEES[currentPlatform]; const el = $('feeNote'); if(el) el.textContent = noteOf(f); }

fetch('fees.json')
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(d => { if(d && typeof d === 'object'){ FEES = d; setNote(); } })
  .catch(() => {});

/* ---------- platform selector ---------- */
function setPlatform(p){
  const btn = document.querySelector(`.platform-btn[data-platform="${p}"]`);
  if(!btn) return;
  document.querySelectorAll('.platform-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
  btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
  currentPlatform = p; setNote();
  const wnFields = $('wnFields');   if(wnFields)   wnFields.hidden   = (p !== 'whatnot');
  const vNote    = $('vintedNote'); if(vNote)      vNote.hidden      = (p !== 'vinted');
  syncReturnFields();
}
document.querySelectorAll('.platform-btn').forEach(btn => {
  btn.addEventListener('click', () => setPlatform(btn.dataset.platform));
  btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
});

/* ---------- conditional fields ---------- */
function syncCondition(){ const vr=$('valueRow'); if(vr) vr.style.display = $('condition').value === 'same' ? 'none' : ''; }
function syncPayer(){ const p = $('returnPayer').value; const rc=$('returnCostRow'); if(rc) rc.style.display = (p === 'me' || p === 'platform') ? '' : 'none'; }
function syncReturnFields(){
  const special = (currentPlatform === 'whatnot' || currentPlatform === 'vinted');
  ['outcome','returnPayer','condition'].forEach(id => {
    const el = $(id); if(el){ const f = el.closest('.field'); if(f) f.style.display = special ? 'none' : ''; }
  });
  if(special){
    const rc=$('returnCostRow'); if(rc) rc.style.display='none';
    const vr=$('valueRow'); if(vr) vr.style.display='none';
  } else { syncCondition(); syncPayer(); }
}
$('condition').addEventListener('change', syncCondition);
$('returnPayer').addEventListener('change', syncPayer);
syncCondition(); syncPayer(); syncReturnFields(); setNote();

/* ---------- feedback ---------- */
function flag(el){
  if(!el) return;
  el.style.borderColor = 'var(--red)';
  el.style.boxShadow = '0 0 0 3px rgba(212,64,26,.28)';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 950);
}

/* ---------- calculate ---------- */
$('calcBtn').addEventListener('click', () => {
  const sale = parseFloat($('salePrice').value);
  if(!sale || sale <= 0){ flag($('salePrice')); return; }
  const btn = $('calcBtn'); const old = btn.textContent;
  btn.textContent = 'CALCULATING…'; btn.disabled = true; btn.style.filter = 'brightness(.85)';
  setTimeout(() => { compute(); trackEvent('calculate', {platform: currentPlatform}); btn.textContent = old; btn.disabled = false; btn.style.filter = ''; }, 260);
});

/* ---------- the math ---------- */
function compute(){
  const sale = parseFloat($('salePrice').value);
  const fee = FEES[currentPlatform];

  if(currentPlatform === 'whatnot'){ computeWhatnot(sale, fee); return; }
  if(currentPlatform === 'vinted'){ computeVinted(sale, fee); return; }

  const outcome = $('outcome').value;
  const payer = $('returnPayer').value;
  const returnCost = (payer === 'me' || payer === 'platform') ? (parseFloat($('returnCost').value) || 0) : 0;
  const condition = $('condition').value;

  let currentValue = sale;
  if(condition !== 'same'){
    const cv = parseFloat($('currentValue').value);
    if(isNaN(cv)){ flag($('currentValue')); return; }
    currentValue = cv;
  }

  let fv;
  if(fee.flatFee && sale < (fee.flatFeeUnder || 0)) fv = fee.flatFee;
  else if(fee.finalValuePctOver7500 && sale > 7500) fv = 7500 * fee.finalValuePct / 100 + (sale - 7500) * fee.finalValuePctOver7500 / 100;
  else fv = sale * fee.finalValuePct / 100;

  const po = (fee.perOrderThreshold != null)
    ? (sale <= fee.perOrderThreshold ? (fee.perOrderFeeLow || 0) : (fee.perOrderFee || 0))
    : (fee.perOrderFee || 0);
  const processing = sale * (fee.processingPct / 100) + (fee.processingFixed || 0);

  let fvCredit, perCredit, procCredit;
  if(currentPlatform === 'ebay'){
    if(outcome === 'remorse')        { fvCredit = true;  perCredit = true;  procCredit = true;  }
    else if(outcome === 'stepped_in'){ fvCredit = false; perCredit = false; procCredit = false; }
    else if(outcome === 'unsure')    { fvCredit = true;  perCredit = false; procCredit = true;  }
    else                             { fvCredit = true;  perCredit = false; procCredit = true;  }
  } else {
    fvCredit = !!fee.refund.finalValue; perCredit = !!fee.refund.perOrder; procCredit = !!fee.refund.processing;
  }

  const fvLost = fvCredit ? 0 : fv;
  const perLost = perCredit ? 0 : po;
  const procLost = procCredit ? 0 : processing;
  const valueLost = condition === 'same' ? 0 : Math.max(0, sale - currentValue);
  const feesLost = fvLost + perLost + procLost;
  const total = feesLost + returnCost + valueLost;

  const lines = [{label:'SALE PRICE', amount:'+' + money(sale), cls:'info', cat:''}];
  if(fv > 0) lines.push(fvLost === 0
    ? {label:fee.label.toUpperCase() + ' FEE', amount:'REFUNDED', cls:'ok', cat:'fees'}
    : {label:fee.label.toUpperCase() + ' FEE (KEPT)', amount:'-' + money(fvLost), cls:'loss', cat:'fees'});
  if(po > 0) lines.push(perLost === 0
    ? {label:'PER-ORDER FEE', amount:'REFUNDED', cls:'ok', cat:'fees'}
    : {label:'PER-ORDER FEE (KEPT)', amount:'-' + money(perLost), cls:'loss', cat:'fees'});
  if(processing > 0) lines.push(procLost === 0
    ? {label:'PAYMENT PROCESSING', amount:'REFUNDED', cls:'ok', cat:'fees'}
    : {label:'PAYMENT PROCESSING (KEPT)', amount:'-' + money(procLost), cls:'loss', cat:'fees'});
  lines.push(returnCost > 0
    ? {label:'RETURN SHIPPING (YOU PAID)', amount:'-' + money(returnCost), cls:'loss', cat:'shipping'}
    : {label:'RETURN SHIPPING', amount:'NOT CHARGED TO YOU', cls:'ok', cat:'shipping'});
  if(valueLost > 0) lines.push({label:'ITEM VALUE DROP', amount:'-' + money(valueLost), cls:'loss', cat:'value'});

  lastResult = { sale, feesLost, returnCost, valueLost, total, condition, outcome, platform:fee.label, lines };
  renderReceipt(lastResult);
  renderChart(lastResult);
  $('actions').style.display = 'flex';
  updateLetter(lastResult);
  updateEvidence(lastResult);
  buildShareLink();
}

/* ---------- Whatnot payout audit (region-aware, VAT-aware, profit-aware) ---------- */
function computeWhatnot(sale, fee){
  const R = WN_REGIONS[($('wnRegion') ? $('wnRegion').value : 'us')] || WN_REGIONS.us;
  const sym = R.symbol;
  const m = n => sym + (Math.round(n * 100) / 100).toFixed(2);
  const cat = $('wnCategory') ? $('wnCategory').value : 'std';
  const ship = parseFloat($('wnShip').value) || 0;
  const tax  = parseFloat($('wnTax').value) || 0;
  const claw = parseFloat($('wnClaw').value) || 0;
  const chk  = Math.max(1, Math.round(parseFloat($('wnCheckouts').value) || 1));
  const label = parseFloat($('wnLabel').value) || 0;
  const itemCost = parseFloat($('wnCost').value) || 0;

  const catMeta = (fee.categories && fee.categories[cat]) || (fee.categories && fee.categories.std) || {capEligible:false};
  const pct = (R.commission[cat] != null ? R.commission[cat] : R.commission.std);
  const capped = R.cap[cat] && catMeta.capEligible && fee.highValueCap && fee.highValueCap.enabled && sale > (R.capThreshold || fee.highValueCap.threshold || 1500);
  const commission = capped ? (R.capThreshold || 1500) * (pct / 100) : sale * (pct / 100);
  const commVat = commission * (R.vatPct / 100);

  const gross = sale + ship + tax;
  const processing = gross > 0 ? (gross * (R.procPct / 100)) + (R.procFixed * chk) : 0;
  const procVat = processing * (R.vatPct / 100);

  const platformTake = commission + commVat + processing + procVat + claw;
  const totalCost = platformTake + label;
  const keep = sale - totalCost;
  const bite = sale > 0 ? (totalCost / sale) * 100 : 0;
  const platformBite = sale > 0 ? (platformTake / sale) * 100 : 0;
  const profit = keep - itemCost;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;

  const lines = [
    {label:'HAMMER SALE (' + R.name + ')', amount:'+' + m(sale), cls:'info', cat:''},
    {label:'COMMISSION (' + pct + '%' + (capped ? ' · CAP' : '') + ')', amount:'-' + m(commission), cls:'loss', cat:'fees'}
  ];
  if(commVat > 0) lines.push({label:'VAT ON COMMISSION (' + R.vatPct + '%)', amount:'-' + m(commVat), cls:'loss', cat:'fees'});
  lines.push({label:'PROCESSING ON GROSS (' + chk + '× ' + sym + R.procFixed.toFixed(2) + ')', amount:'-' + m(processing), cls:'loss', cat:'fees'});
  if(procVat > 0) lines.push({label:'VAT ON PROCESSING (' + R.vatPct + '%)', amount:'-' + m(procVat), cls:'loss', cat:'fees'});
  if(claw > 0) lines.push({label:'WEIGHT CLAWBACKS', amount:'-' + m(claw), cls:'loss', cat:'fees'});
  if(label > 0) lines.push({label:'YOUR SHIPPING LABEL', amount:'-' + m(label), cls:'loss', cat:'shipping'});

  lastResult = { sale, feesLost: platformTake, returnCost: label, valueLost: 0, total: totalCost, condition:'same', outcome:'inad', platform:fee.label, lines };
  renderWhatnotReceipt(lastResult, {sym, bite, platformBite, keep, label, itemCost, profit, margin});
  renderChart(lastResult);
  $('actions').style.display = 'flex';
  updateLetter(lastResult);
  updateEvidence(lastResult);
  buildShareLink();
}

/* ---------- Vinted anchor (keep 100%) ---------- */
function computeVinted(sale, fee){
  const buyerPays = fee.buyerProtectionFixed + (sale * (fee.buyerProtectionPct / 100));
  const lines = [
    {label:'LISTED PRICE', amount:'+' + money(sale), cls:'info', cat:''},
    {label:'SELLING FEE', amount:'$0.00', cls:'ok', cat:'fees'},
    {label:'PROCESSING FEE', amount:'$0.00', cls:'ok', cat:'fees'}
  ];
  lastResult = { sale, feesLost: 0, returnCost: 0, valueLost: 0, total: 0, condition:'same', outcome:'remorse', platform:fee.label, lines };
  renderVintedReceipt(lastResult, buyerPays);
  renderChart(lastResult);
  $('actions').style.display = 'flex';
  updateLetter(lastResult);
  updateEvidence(lastResult);
  buildShareLink();
}

/* ---------- the receipt (standard) ---------- */
function renderReceipt(r){
  const rec = $('receipt'); rec.innerHTML = '';
  rec.insertAdjacentHTML('beforeend',
    `<div class="r-head"><div class="r-brand">CLAWBACK</div><div class="r-sub">FORCED-RETURN LOSS STATEMENT</div>` +
    `<div class="r-meta">${r.platform} · ${new Date().toLocaleDateString()}</div></div><div class="r-rule"></div>`);
  const body = document.createElement('div'); rec.appendChild(body);
  r.lines.forEach((ln, i) => {
    setTimeout(() => {
      body.insertAdjacentHTML('beforeend',
        `<div class="r-line ${ln.cls}" data-cat="${ln.cat}"><span class="r-label">${ln.label}</span><span class="r-dots"></span><span class="r-amt">${ln.amount}</span></div>`);
    }, 140 + i * 150);
  });
  const after = 140 + r.lines.length * 150 + 220;
  setTimeout(() => {
    rec.insertAdjacentHTML('beforeend',
      `<div class="r-rule"></div><div class="r-total"><span>YOU LOST</span><span id="totalAmt">$0.00</span></div><div class="r-barcode"></div>`);
    countUp($('totalAmt'), r.total, 700);
  }, after);
  setTimeout(() => {
    const appeal = r.total >= 25;
    rec.insertAdjacentHTML('beforeend', `<div class="stamp ${appeal ? 'appeal' : 'writeoff'}">${appeal ? 'APPEAL IT' : 'WRITE IT OFF'}</div>`);
  }, after + 480);
}

function renderWhatnotReceipt(r, meta){
  const rec = $('receipt'); rec.innerHTML = '';
  rec.insertAdjacentHTML('beforeend',
    `<div class="r-head"><div class="r-brand">CLAWBACK</div><div class="r-sub">WHATNOT PAYOUT AUDIT</div>` +
    `<div class="r-meta">${r.platform} · ${new Date().toLocaleDateString()}</div></div><div class="r-rule"></div>`);
  const body = document.createElement('div'); rec.appendChild(body);
  r.lines.forEach((ln, i) => {
    setTimeout(() => {
      body.insertAdjacentHTML('beforeend',
        `<div class="r-line ${ln.cls}" data-cat="${ln.cat}"><span class="r-label">${ln.label}</span><span class="r-dots"></span><span class="r-amt">${ln.amount}</span></div>`);
    }, 140 + i * 150);
  });
  const after = 140 + r.lines.length * 150 + 220;
  setTimeout(() => {
    const biteLabel = meta.label > 0
      ? `PLATFORM TAKE ${meta.platformBite.toFixed(1)}% · WITH LABEL ${meta.bite.toFixed(1)}%`
      : `ADVERTISED RATE → REAL TAKE ${meta.bite.toFixed(1)}%`;
    const profitLine = meta.itemCost > 0
      ? `<div class="r-line ${meta.profit >= 0 ? 'ok' : 'loss'}"><span class="r-label">PROFIT AFTER COST (${meta.margin.toFixed(0)}% MARGIN)</span><span class="r-dots"></span><span class="r-amt">${meta.profit < 0 ? '-' : ''}${meta.sym}${Math.abs(meta.profit).toFixed(2)}</span></div>`
      : '';
    rec.insertAdjacentHTML('beforeend',
      `<div class="r-rule"></div><div class="r-total"><span>YOU KEEP</span><span id="totalAmt" style="color:${meta.keep > 0 ? 'var(--green)' : 'var(--red)'}">${meta.sym}${meta.keep.toFixed(2)}</span></div>` +
      profitLine +
      `<div class="r-line hl"><span class="r-label">${biteLabel}</span><span class="r-dots"></span><span class="r-amt">${meta.bite.toFixed(1)}%</span></div>` +
      `<div class="r-barcode"></div>`);
  }, after);
  setTimeout(() => {
    rec.insertAdjacentHTML('beforeend', `<div class="stamp appeal">CLAWED ${meta.bite.toFixed(1)}%</div>`);
  }, after + 480);
}

function renderVintedReceipt(r, buyerPays){
  const rec = $('receipt'); rec.innerHTML = '';
  rec.insertAdjacentHTML('beforeend',
    `<div class="r-head"><div class="r-brand">CLAWBACK</div><div class="r-sub">VINTED STATEMENT</div>` +
    `<div class="r-meta">${r.platform} · ${new Date().toLocaleDateString()}</div></div><div class="r-rule"></div>`);
  const body = document.createElement('div'); rec.appendChild(body);
  r.lines.forEach((ln, i) => {
    setTimeout(() => {
      body.insertAdjacentHTML('beforeend',
        `<div class="r-line ${ln.cls}" data-cat="${ln.cat}"><span class="r-label">${ln.label}</span><span class="r-dots"></span><span class="r-amt">${ln.amount}</span></div>`);
    }, 140 + i * 150);
  });
  const after = 140 + r.lines.length * 150 + 220;
  setTimeout(() => {
    rec.insertAdjacentHTML('beforeend',
      `<div class="r-rule"></div><div class="r-total"><span>YOU KEEP</span><span id="totalAmt" style="color:var(--green)">${money(r.sale)}</span></div>` +
      `<div class="r-line info"><span class="r-label">BUYER PAYS ON TOP</span><span class="r-dots"></span><span class="r-amt">${money(buyerPays)} + shipping</span></div>` +
      `<div class="r-barcode"></div>`);
  }, after);
  setTimeout(() => {
    rec.insertAdjacentHTML('beforeend', `<div class="stamp writeoff">KEEP 100%</div>`);
  }, after + 480);
}

/* ---------- donut chart ---------- */
function renderChart(r){
  const wrap = $('chartWrap'); wrap.style.display = 'block';
  if(r.total < 0.01){
    wrap.innerHTML = `<div class="chart-card"><div class="chart-title">WHERE YOUR MONEY WENT</div><div class="no-loss">Nothing lost — this return didn't cost you. Log it and move on.</div></div>`;
    return;
  }
  const cats = [
    {key:'fees',     label:'Fees kept',       val:r.feesLost,   color:'#E8734A'},
    {key:'shipping', label:'Return shipping', val:r.returnCost, color:'#D4402A'},
    {key:'value',    label:'Item value drop', val:r.valueLost,  color:'#8E2420'}
  ].filter(c => c.val > 0.005);
  const R = 72, C = 2 * Math.PI * R; let cum = 0, segs = '', legend = '';
  cats.forEach(c => {
    const f = c.val / r.total;
    segs += `<circle class="seg" data-cat="${c.key}" cx="92" cy="92" r="${R}" fill="none" stroke="${c.color}" stroke-width="26" stroke-dasharray="0 ${C.toFixed(2)}" data-target="${(f*C).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-cum*C).toFixed(2)}" transform="rotate(-90 92 92)"></circle>`;
    cum += f;
    legend += `<div class="lg-row" data-cat="${c.key}"><span class="lg-dot" style="background:${c.color}"></span><span class="lg-label">${c.label}</span><span class="lg-val">${money(c.val)} · ${Math.round(f*100)}%</span></div>`;
  });
  const pct = Math.round(r.total / r.sale * 100);
  wrap.innerHTML =
    `<div class="chart-card"><div class="chart-title">WHERE YOUR MONEY WENT</div>` +
    `<div class="donut-area"><svg viewBox="0 0 184 184" class="donut" role="img" aria-label="Loss breakdown donut chart">` +
    `<circle cx="92" cy="92" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="26"/>${segs}</svg>` +
    `<div class="donut-center"><div class="dc-amt" id="dcAmt">$0.00</div><div class="dc-sub">total loss</div></div></div>` +
    `<div class="legend">${legend}</div>` +
    `<div class="kept-line">This return cost you <b>${pct}%</b> of what the item sold for.</div></div>`;
  requestAnimationFrame(() => {
    wrap.querySelectorAll('.seg').forEach((s, i) => {
      setTimeout(() => {
        s.style.transition = 'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1), opacity .2s, stroke-width .2s';
        s.style.strokeDasharray = s.dataset.target;
      }, i * 130);
    });
    countUp($('dcAmt'), r.total, 800);
  });
}

/* ---------- hover-sync ---------- */
function hl(cat, on){
  document.querySelectorAll('.seg').forEach(s => { s.classList.toggle('dim', on && s.dataset.cat !== cat); s.classList.toggle('hot', on && s.dataset.cat === cat); });
  document.querySelectorAll('.lg-row').forEach(rw => rw.classList.toggle('hot', on && rw.dataset.cat === cat));
  document.querySelectorAll('.r-line[data-cat]').forEach(l => { if(l.dataset.cat) l.classList.toggle('hl', on && l.dataset.cat === cat); });
}
document.addEventListener('mouseover', e => { const el = e.target.closest('[data-cat]'); if(el && el.dataset.cat) hl(el.dataset.cat, true); });
document.addEventListener('mouseout',  e => { const el = e.target.closest('[data-cat]'); if(el && el.dataset.cat) hl(el.dataset.cat, false); });

/* ---------- appeal letter + tax line ---------- */
function updateLetter(r){
  const condText = {damaged:'returned damaged', different:'a different item than the one I shipped', empty:'an empty box'}[r.condition] || '';
  const items = [];
  if(r.feesLost > 0)   items.push(`Selling / processing fees not refunded: ${money(r.feesLost)}`);
  if(r.returnCost > 0) items.push(`Return shipping I was charged: ${money(r.returnCost)}`);
  if(r.valueLost > 0)  items.push(`Drop in the item's resale value: ${money(r.valueLost)}`);
  const condLine = (r.condition !== 'same' && condText)
    ? `\n\nThe item was ${condText}. I photographed it before shipping and again on arrival, and I can submit that evidence immediately.` : '';
  const steppedLine = r.outcome === 'stepped_in'
    ? '\n\nI respectfully disagree with how this case was resolved and am asking for a manual review.' : '';
  $('appealLetter').value =
`To ${r.platform} Support,

I'm requesting a review of the return on this order. The item sold for ${money(r.sale)}. After the return, my documented total loss is ${money(r.total)}:

${items.map(x => '  • ' + x).join('\n')}
${condLine}${steppedLine}

This return was not my fault, and I've kept my account in good standing. Please reimburse the fees and shipping I was charged, or restore the credit that should apply.

Thank you for your time,
[Your name]`;
  $('taxLine').value = `CLAWBACK loss | ${r.platform} | ${new Date().toISOString().slice(0,10)} | total ${money(r.total)} | fees ${money(r.feesLost)} | return shipping ${money(r.returnCost)} | value drop ${money(r.valueLost)} | reason: ${r.outcome} | for tax records`;
}

/* ---------- evidence checklist ---------- */
function updateEvidence(r){
  const base = [
    'Screenshot of your original listing — title, price, the condition you stated, and all photos.',
    'Photos of the item BEFORE you shipped it (every angle, plus any existing flaws, tags, or serial numbers).',
    'A photo of the item packed next to the shipping label — proof of exactly what left your hands.',
    'The outbound tracking number showing it was delivered.',
    'The return tracking number.'
  ];
  const cond = {
    damaged:'Clear photos of the damage on arrival, side-by-side with your pre-ship photos (add a short video if it was a working item).',
    different:'Photos of exactly what arrived next to what you sent — the swap is your strongest evidence.',
    empty:'Photos of the empty or underweight package and the unboxing if you captured it; note the package weight printed on the label.'
  }[r.condition];
  const plat = {
    ebay:'Keep every message inside eBay Messages (not email or text) and open or respond to the case within the stated window.',
    poshmark:'File within 3 days of delivery and upload JPGs — Poshmark rejects HEIC photos.',
    mercari:'Respond to any request and submit photos within 24 hours, or the case can close against you.',
    depop:'Raise the issue within 30 days and upload clear, well-lit images that show how the item differs.',
    whatnot:'Save your stream recording and the order receipt — Whatnot receipts show every fee line, including weight adjustments.',
    vinted:'Keep all communication inside Vinted chat and photograph the item before dropping it at the parcel shop.'
  }[currentPlatform];
  const all = [...base]; if(cond) all.push(cond); if(plat) all.push(plat);
  $('evidenceList').innerHTML = all.map(t => `<li>${t}</li>`).join('');
}

/* ---------- shareable link ---------- */
function buildShareLink(){
  const p = new URLSearchParams();
  p.set('p', currentPlatform);
  p.set('s', $('salePrice').value);
  const special = (currentPlatform === 'whatnot' || currentPlatform === 'vinted');
  if(!special){
    p.set('o', $('outcome').value);
    p.set('rp', $('returnPayer').value);
    if($('returnCost').value) p.set('rc', $('returnCost').value);
    p.set('c', $('condition').value);
    if($('currentValue').value && $('condition').value !== 'same') p.set('cv', $('currentValue').value);
  }
  if(currentPlatform === 'whatnot'){
    if($('wnRegion').value) p.set('wnr', $('wnRegion').value);
    if($('wnCategory').value) p.set('wnc', $('wnCategory').value);
    if($('wnShip').value) p.set('wns', $('wnShip').value);
    if($('wnTax').value) p.set('wnt', $('wnTax').value);
    if($('wnClaw').value) p.set('wncl', $('wnClaw').value);
    if($('wnCheckouts').value) p.set('wnchk', $('wnCheckouts').value);
    if($('wnLabel').value) p.set('wnl', $('wnLabel').value);
    if($('wnCost').value) p.set('wncost', $('wnCost').value);
  }
  const base = (location.protocol === 'http:' || location.protocol === 'https:')
    ? (location.origin + location.pathname)
    : 'https://clawback.vercel.app/';
  $('shareLink').value = base + '?' + p.toString();
}

/* ---------- copy buttons ---------- */
function copyText(text, btn, label){
  const done = () => { const o = label || btn.textContent; btn.textContent = 'COPIED ✓'; trackEvent('copy', {target: btn.dataset.copy || btn.id}); setTimeout(() => btn.textContent = o, 1600); };
  const fb = () => { const el = btn.dataset.copy ? $(btn.dataset.copy) : null; if(el){ el.select(); el.setSelectionRange && el.setSelectionRange(0, 9999); document.execCommand('copy'); } done(); };
  if(navigator.clipboard){ navigator.clipboard.writeText(text).then(done).catch(fb); } else fb();
}
document.querySelectorAll('.action-btn[data-copy]').forEach(btn =>
  btn.addEventListener('click', () => copyText($(btn.dataset.copy).value || '', btn)));
$('shareBtn').addEventListener('click', () => copyText($('shareLink').value || '', $('shareBtn'), 'COPY SHAREABLE LINK'));

/* ---------- print ---------- */
function injectPrintStyles(){
  const css = `@media print{
    body{background:#fff!important;color:#000!important;}
    .ticker,.site-head,.main-nav,.float-sym,.panel,.faq,.site-foot,.ad-slot,.action-btn,.evidence,.skip,.noscript{display:none!important;}
    .workbench{display:block!important;margin:0!important;padding:0!important;}
    .receipt-wrap{position:static!important;}
    .receipt{transform:none!important;box-shadow:none!important;border:1px solid #999;margin:0 auto;}
    .chart-wrap{display:block!important;margin:18px auto 0;}
    .chart-card{background:#fff!important;border:1px solid #999;box-shadow:none;}
    .chart-title,.lg-label,.lg-val,.kept-line,.dc-sub{color:#000!important;}
    .dc-amt{color:#c0392b!important;}
    .lg-dot{border:1px solid #999;}
    .stamp{mix-blend-mode:normal;}
    .actions{display:block!important;}
    #appealLetter,#taxLine,#shareLink{display:none!important;}
    @page{margin:14mm;}
  }`;
  const st = document.createElement('style'); st.id = 'printStyles'; st.textContent = css; document.head.appendChild(st);
}
function injectPrintButton(){
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'action-btn'; b.id = 'printBtn'; b.textContent = 'PRINT / SAVE AS PDF';
  b.addEventListener('click', () => window.print());
  $('evidenceBox').insertAdjacentElement('beforebegin', b);
}
injectPrintStyles();
injectPrintButton();

/* ---------- count-up ---------- */
function countUp(el, target, dur){
  if(!el) return;
  const start = performance.now();
  const ease = p => 1 - Math.pow(1 - p, 3);
  (function tick(now){
    const p = Math.min(1, (now - start) / dur);
    el.textContent = money(target * ease(p));
    if(p < 1) requestAnimationFrame(tick); else el.textContent = money(target);
  })(start);
}

/* ---------- rebuild from shared link ---------- */
(function loadFromShare(){
  const q = new URLSearchParams(location.search);
  if(!q.has('s')) return;
  if(q.get('p'))  setPlatform(q.get('p'));
  if(q.get('s'))  $('salePrice').value = q.get('s');
  if(q.get('o'))  $('outcome').value = q.get('o');
  if(q.get('rp')) $('returnPayer').value = q.get('rp');
  if(q.get('rc')) $('returnCost').value = q.get('rc');
  if(q.get('c'))  $('condition').value = q.get('c');
  if(q.get('cv')) $('currentValue').value = q.get('cv');
  if(q.get('p') === 'whatnot'){
    if(q.get('wnr')) $('wnRegion').value = q.get('wnr');
    if(q.get('wnc')) $('wnCategory').value = q.get('wnc');
    if(q.get('wns')) $('wnShip').value = q.get('wns');
    if(q.get('wnt')) $('wnTax').value = q.get('wnt');
    if(q.get('wncl')) $('wnClaw').value = q.get('wncl');
    if(q.get('wnchk')) $('wnCheckouts').value = q.get('wnchk');
    if(q.get('wnl')) $('wnLabel').value = q.get('wnl');
    if(q.get('wncost')) $('wnCost').value = q.get('wncost');
  }
  syncCondition(); syncPayer(); syncReturnFields();
  setTimeout(() => { if(parseFloat($('salePrice').value) > 0) compute(); }, 350);
})();
