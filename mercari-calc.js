/* ============================================================
CLAWBACK — mercari-calc.js  (Mercari calculation engine)
Implements the locked Mercari decision tree.
Loss = refund exposure + seller return shipping - recovered value
- confirmed reimbursement (floored at $0).
Selling fee is INFORMATIONAL ONLY (never added/subtracted).
Renders into #mercariResult + shared receipt/letter/evidence.
Does NOT modify app.js. USD only.
============================================================ */
(function(){
const $ = id => document.getElementById(id);
const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
const FALLBACK_MERCARI = {
sellingFeePct: 10,
processingFee: null,               /* no separate processing fee on current listings */
buyerProtectionPct: 3.6,           /* buyer-side — NEVER a seller loss */
shippingProtection: { prepaidMax: 200, firstClassEnvelopeMax: 20, sellerArrangedCoverage: 0 }
};
let MERCARI = FALLBACK_MERCARI;
/* Prefer centralized fee data when available */
fetch('fees.json').then(function(r){ return r.ok ? r.json() : Promise.reject(); })
.then(function(d){
if(d && d.mercari && d.mercari.finalValuePct != null){
MERCARI = Object.assign({}, FALLBACK_MERCARI, { sellingFeePct: d.mercari.finalValuePct });
}
}).catch(function(){});
function ynValue(cls){
var el = document.querySelector('.' + cls + '.active');
return el ? el.getAttribute('data-val') : '';
}
window.calculateMercari = function(){
const sale = parseFloat($('mercariSalePrice').value);
if(isNaN(sale) || sale < 0){ alert('Please enter the original sale price.'); return; }
const buyerShip = parseFloat($('mercariBuyerShipping').value);
if(isNaN(buyerShip) || buyerShip < 0){ alert('Buyer-paid shipping cannot be negative.'); return; }
const reason = $('mercariRefundReason').value;
if(!reason){ alert('Please select why the buyer was refunded.'); return; }
const actualRefund = parseFloat($('mercariActualRefund').value) || 0;
if(actualRefund < 0){ alert('Actual buyer refund cannot be negative.'); return; }
const returned = ynValue('mercari-yn-returned');
 if(!returned){ alert('Please tell us if the item was returned to you.'); return; }
 /* Refund exposure: actual if entered, else derived (sale + buyer shipping) */
 const refundExposure = actualRefund > 0 ? actualRefund : (sale + buyerShip);
 const derived = actualRefund <= 0;
 let currentItemValue = 0, sellerReturnShipping = 0, reimbursement = 0, protection = null;
 if(returned === 'yes'){
   const cv = parseFloat($('mercariCurrentItemValue').value);
   if(isNaN(cv) || cv < 0){ alert('Please enter what the item is worth to you now.'); return; }
   currentItemValue = cv;
   const payer = $('mercariReturnShipPayer').value;
   if(!payer){ alert('Please select who paid return shipping.'); return; }
   if(payer === 'seller'){
     const sc = parseFloat($('mercariReturnShipCost').value);
     if(isNaN(sc) || sc < 0){ alert('Please enter the return shipping cost.'); return; }
     sellerReturnShipping = sc;
   }
   reimbursement = 0;
 } else {
   const why = $('mercariNotReturnedWhy').value;
   if(!why){ alert('Please tell us why the item did not come back.'); return; }
   if(why === 'transit'){
     const method = ynValue('mercari-yn-method');
     if(!method){ alert('Please select the shipping method.'); return; }
     if(method === 'prepaid'){
       protection = 'prepaid';
       const reimb = ynValue('mercari-yn-reimb');
       if(!reimb){ alert('Please tell us if Mercari reimbursed you.'); return; }
       if(reimb === 'yes'){
         const ra = parseFloat($('mercariReimbursement').value);
         if(isNaN(ra) || ra < 0){ alert('Please enter the actual Mercari reimbursement.'); return; }
         reimbursement = ra;
       }
     } else {
       protection = 'seller';   /* seller-arranged → protection $0, never ask reimbursement */
       reimbursement = 0;
     }
   }
 }
 /* ===== CORE LOSS FORMULA ===== */
 let loss;
 if(returned === 'yes'){
   loss = refundExposure + sellerReturnShipping - currentItemValue - reimbursement;
 } else {
   loss = refundExposure - reimbursement;
 }
 loss = Math.max(0, loss);
 /* Breakdown lines (only relevant rows) */
 const lines = [];
 lines.push({label:'REFUND EXPOSURE' + (derived ? ' (DERIVED: SALE + BUYER SHIPPING)' : ' (ACTUAL REFUND)'), amount: money(refundExposure), cls:'info', cat:''});
 if(sellerReturnShipping > 0) lines.push({label:'SELLER RETURN SHIPPING', amount: money(sellerReturnShipping), cls:'loss', cat:'shipping'});
 if(returned === 'yes' && currentItemValue > 0) lines.push({label:'VALUE RECOVERED', amount:'-' + money(currentItemValue), cls:'ok', cat:'value'});
 if(reimbursement > 0) lines.push({label:'MERCARI REIMBURSEMENT', amount:'-' + money(reimbursement), cls:'ok', cat:'value'});
 /* Selling fee — INFORMATIONAL ONLY, never in the loss */
 const sellerFee = (sale + buyerShip) * (MERCARI.sellingFeePct / 100);
 const feeText = 'Estimated Mercari selling fee: ' + money(sellerFee) + ' (' + MERCARI.sellingFeePct +
   '% of item price + buyer-paid shipping). Fee refund treatment NOT included in estimated loss — verify the actual fee adjustment in your Mercari transaction record.';
 /* Shipping Protection info — never assumes a payout */
 let protText = '';
 if(protection === 'prepaid'){
   protText = reimbursement > 0
     ? 'Mercari Shipping Protection — Reimbursement received: ' + money(reimbursement) + '. Protection can provide up to $' + MERCARI.shippingProtection.prepaidMax + ' for eligible prepaid shipments (up to $' + MERCARI.shippingProtection.firstClassEnvelopeMax + ' for First-Class Envelope). Actual reimbursement may be lower.'
     : 'Mercari Shipping Protection — eligible prepaid shipment, no reimbursement entered. Up to $' + MERCARI.shippingProtection.prepaidMax + ' may apply (up to $' + MERCARI.shippingProtection.firstClassEnvelopeMax + ' for First-Class Envelope); actual reimbursement may be lower.';
 } else if(protection === 'seller'){
   protText = 'Shipping Protection — Not included because this order was shipped with a seller-arranged label.';
 }
 /* Render Mercari panel */
 $('mercariResult').hidden = false;
 $('mercariLossAmount').textContent = money(loss);
 $('mercariBreakdown').innerHTML = lines.map(function(l){
   return '<div class="r-line ' + l.cls + '"><span class="r-label">' + l.label + '</span><span class="r-dots"></span><span class="r-amt">' + l.amount + '</span></div>';
 }).join('');
 $('mercariFeeNote2').textContent = feeText;
 $('mercariProtectionNote').textContent = protText;
 /* Shared receipt / letter / evidence (chart skipped — its fixed labels would mislead here) */
 const valueLost = returned === 'yes'
   ? Math.max(0, refundExposure - currentItemValue - reimbursement)
   : Math.max(0, refundExposure - reimbursement);
 const result = { sale: sale, feesLost: 0, returnCost: sellerReturnShipping, valueLost: valueLost,
   total: loss, condition: 'same', outcome: 'inad', platform: 'Mercari', lines: lines };
 if(typeof renderReceipt === 'function') renderReceipt(result);
 var cw = $('chartWrap'); if(cw) cw.style.display = 'none';
 if(typeof updateLetter === 'function') updateLetter(result);
 if(typeof updateEvidence === 'function') updateEvidence(result);
 const act = $('actions'); if(act) act.style.display = 'flex';
};
})();