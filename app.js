/* ============================================================
   CLAWBACK — app.js  (STEP 4B: COMPLETE)
   Adds: loss-breakdown donut chart + hover-sync, appeal letter,
   tax line, shareable link (auto-fills from a shared URL),
   Print / Save-PDF, and the photo-evidence checklist.
   This file fully replaces the Step 4A version.
   ============================================================ */

/* ---- verified Aug-2026 numbers (safety net for local/offline use) ---- */
const FALLBACK_FEES = {
  ebay:{label:"eBay",finalValuePct:13.6,finalValuePctOver7500:2.35,flatFee:0,flatFeeUnder:0,perOrderFee:0.40,perOrderFeeLow:0.30,perOrderThreshold:10,processingPct:0,processingFixed:0,disputeFee:20,refund:{finalValue:true,perOrder:false,processing:true},"_note":"eBay US 2026: 13.6% final value fee on most categories (books 15.3%, cards/coins 13.25%); per-order fee $0.30 (≤$10) / $0.40 (>$10); no separate processing fee. Whether fees come back depends on the reason — use the 'what happened' selector."},
  poshmark:{label:"Poshmark",finalValuePct:20,flatFee:2.95,flatFeeUnder:15,perOrderFee:0,processingPct:0,processingFixed:0,refund:{finalValue:true,perOrder:false,processing:true},"_note":"Poshmark 2026: 20% commission ($2.95 flat under $15); commission reversed on an approved return and a prepaid label is provided, so your real loss is the item's value if it comes back damaged. Fit/change-of-mind returns go through Seel and cost you nothing."},
  mercari:{label:"Mercari",finalValuePct:10,flatFee:0,flatFeeUnder:0,perOrderFee:0,processingPct:0,processingFixed:0,refund:{finalValue:true,perOrder:false,processing:true},"_note":"Mercari US 2026: 10% selling fee (back since Jan 2025), no seller processing fee. Prepaid return label is free up to 50 lbs — OVER 50 lbs YOU pay the return label. Your real losses = item value + heavy-item shipping."},
  depop:{label:"Depop",finalValuePct:0,flatFee:0,flatFeeUnder:0,perOrderFee:0,processingPct:3.3,processingFixed:0.45,refund:{finalValue:true,perOrder:false,processing:true},"_note":"Depop US 2026: no selling fee; processing 3.3% + $0.45. ALL fees are auto-refunded when you refund via Depop Payments — so your real loss is the item's value + return shipping, not fees."}
};

let FEES = FALLBACK_FEES;
let currentPlatform = 'ebay';
let lastResult = null;

const $ = id => document.getElementById(id);
const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
const noteOf = f => f['_note'] || f.note || '';

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
}
document.querySelectorAll('.platform-btn').forEach(btn => {
  btn.addEventListener('click', () => setPlatform(btn.dataset.platform));
  btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
});

/* ---------- conditional fields ---------- */
function syncCondition(){ const c = $('condition').value; $('valueRow').style.display = (c === 'same' || c === 'empty') ? 'none' : 'block'; }
function syncPayer(){ const p = $('returnPayer').value; $('returnCostRow').style.display = (p === 'me' || p === 'platform') ? 'block' : 'none'; }
$('condition').addEventListener('change', syncCondition);
$('returnPayer').addEventListener('change', syncPayer);
syncCondition(); syncPayer(); setNote();

/* ---------- feedback ---------- */
function flag(el){
  if(!el) return;
  el.style.borderColor = 'var(--red)';
  el.style.boxShadow = '0 0 0 3px rgba(212,64,26,.28)';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 950);
}

/* ---------- calculate (with a short "crunching" beat) ---------- */
$('calcBtn').addEventListener('click', () => {
  const sale = parseFloat($('salePrice').value);
  if(!sale || sale <= 0){ flag($('salePrice')); return; }
  const btn = $('calcBtn'); const old = btn.textContent;
  btn.textContent = 'CALCULATING…'; btn.disabled = true; btn.style.filter = 'brightness(.85)';
  setTimeout(() => { compute(); btn.textContent = old; btn.disabled = false; btn.style.filter = ''; }, 260);
});

/* ---------- the math ---------- */
function compute(){
  const sale = parseFloat($('salePrice').value);
  const fee = FEES[currentPlatform];
  const outcome = $('outcome').value;
  const payer = $('returnPayer').value;
  const returnCost = (payer === 'me' || payer === 'platform') ? (parseFloat($('returnCost').value) || 0) : 0;
  const condition = $('condition').value;

  let currentValue = sale;
  if(condition === 'empty'){
    currentValue = 0;
  } else if(condition !== 'same'){
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
  } else if(outcome === 'stepped_in'){
    /* Platform ruled against you, or you refunded the buyer outside the platform:
       treat this like an unapproved return — no fee credit, same principle as
       eBay's "stepped in" case above. */
    fvCredit = false; perCredit = false; procCredit = false;
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

/* ---------- the receipt ---------- */
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

/* ---------- the loss-breakdown donut chart ---------- */
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

/* ---------- hover-sync: chart slice <-> legend <-> receipt line ---------- */
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

/* ---------- photo-evidence checklist (platform + damage aware) ---------- */
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
    depop:'Raise the issue within 30 days and upload clear, well-lit images that show how the item differs.'
  }[currentPlatform];
  const all = [...base]; if(cond) all.push(cond); if(plat) all.push(plat);
  $('evidenceList').innerHTML = all.map(t => `<li>${t}</li>`).join('');
}

/* ---------- shareable result link (encodes the inputs) ---------- */
function buildShareLink(){
  const p = new URLSearchParams();
  p.set('p', currentPlatform);
  p.set('s', $('salePrice').value);
  p.set('o', $('outcome').value);
  p.set('rp', $('returnPayer').value);
  if($('returnCost').value) p.set('rc', $('returnCost').value);
  p.set('c', $('condition').value);
  if($('currentValue').value && $('condition').value !== 'same' && $('condition').value !== 'empty') p.set('cv', $('currentValue').value);
  const base = (location.protocol === 'http:' || location.protocol === 'https:')
    ? (location.origin + location.pathname)
    : 'https://gotclawback.com/';   // sensible default while testing locally
  $('shareLink').value = base + '?' + p.toString();
}

/* ---------- copy buttons ---------- */
function copyText(text, btn, label){
  const done = () => { const o = label || btn.textContent; btn.textContent = 'COPIED ✓'; setTimeout(() => btn.textContent = o, 1600); };
  const fb = () => { const el = btn.dataset.copy ? $(btn.dataset.copy) : null; if(el){ el.select(); el.setSelectionRange && el.setSelectionRange(0, 9999); document.execCommand('copy'); } done(); };
  if(navigator.clipboard){ navigator.clipboard.writeText(text).then(done).catch(fb); } else fb();
}
document.querySelectorAll('.action-btn[data-copy]').forEach(btn =>
  btn.addEventListener('click', () => copyText($(btn.dataset.copy).value || '', btn)));
$('shareBtn').addEventListener('click', () => copyText($('shareLink').value || '', $('shareBtn'), 'COPY SHAREABLE LINK'));

/* ---------- Print / Save-as-PDF button (injected) + print styling ---------- */
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

/* ---------- rebuild a result from a shared link ---------- */
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
  syncCondition(); syncPayer();
  setTimeout(() => { if(parseFloat($('salePrice').value) > 0) compute(); }, 350);
})();
