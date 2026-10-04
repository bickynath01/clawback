/* ============================================================
CLAWBACK — depop-calc.js  (Depop calculation engine)
Reads the Depop section of fees.json and shipping.json.
Implements the locked Depop decision tree exactly.
Renders into #depopResult + shared receipt/chart/letter.
Does NOT modify app.js.
============================================================ */
(function(){
const $ = id => document.getElementById(id);
/* FIX 2/3 — market-aware currency symbol (display only, never changes math) */
let CUR = '$';
const money = n => {
if(n == null || isNaN(n)) return CUR + '0.00';
return CUR + (Math.round(n * 100) / 100).toFixed(2);
};
/* Embedded fallback — mirrors the "depop" sections of fees.json and shipping.json.
Used automatically when fetch() is blocked (file:// testing). */
const FALLBACK_DEPOP = {
markets: {
US: { currency: 'USD', sellingFeePct: 0,
processing: { provider: 'Depop Payments', processor: 'Stripe', pct: 3.3, fixed: 0.45,
base: 'item_sale_price + shipping + applicable_taxes' } },
UK: { currency: 'GBP', sellingFeePct: 0,
processing: { provider: 'Depop Payments', processor: 'Stripe', pct: 2.9, fixed: 0.30,
base: 'item_sale_price + shipping + applicable_taxes' } },
AU: { currency: 'AUD', sellingFeePct: 0,
processing: { provider: 'Depop Payments', processor: 'Stripe', pct: 2.6, fixed: 0.30,
base: 'item_sale_price + shipping + applicable_taxes' } },
OTHER: { sellingFeePct: 10,
sellingFeeBase: { base: 'item_sale_price_excluding_taxes', include_shipping_when: 'seller_arranged_shipping' },
processing: { provider: 'PayPal', pct: null, fixed: null,
varies_by: ['seller_location', 'PayPal_account_setup'] } }
},
boosting: {
effectiveFrom: '2026-03-23',
rates: { US: 12, UK: 12, AU: 8, OTHER: 8 },
qualifyingWindowDays: 28,
base: 'item_sale_price_excluding_taxes + shipping_when_seller_arranged',
depopShippingLabelExcludedFromBase: true
},
refund_rules: {
full: { sellingFeeReversed: true, processingFeeReversed: true, boostingFeeReversed: true,
depopPaymentsAutomatic: true },
partial: { buyerKeepsItem: true, returnRequired: false, feeRefundSupported: true,
calculationFormula: null, useActualFeeRefundWhenKnown: true },
paypal: { depopSellingFeeRefundMayRequireSupport: true }
}
};
const FALLBACK_SHIPPING = {
shippingMethods: {
depopShipping: { label: 'Depop Shipping', prepaidLabel: true, tracked: true,
sellerMustUseGeneratedLabel: true,
markets: { US: { carrier: 'USPS' }, UK: { carrier: 'Evri' }, AU: { carrier: null } } },
sellerArranged: { label: 'Seller-arranged shipping', prepaidLabel: false,
sellerPaysShipping: true, trackedRequiredOrRecommended: true, sellerProvidesTracking: true }
},
returns: {
US: { buyerReturnLabel: 'prepaid', sellerOutOfPocketReturnShipping: false },
outsideUS: { buyerArrangesReturn: true, tracked: true,
depopBuyerShippingReimbursementCap: { USD: 20, GBP: 20 } },
returnDeadlineDays: 7
},
sellerProtection: {
eligibleMarkets: ['UK', 'US', 'AU'],
requiresDepopShipping: true,
requiresBuyButton: true,
shipmentDeadlineDays: 5,
correctBuyerAddressRequired: true,
coveredEvents: ['lost_in_transit', 'damaged_in_transit', 'return_lost_in_transit', 'return_damaged_in_transit'],
limits: { GBP: 250, USD: 300, AUD: 450 },
limitIncludes: ['item_price', 'shipping_fees', 'applicable_taxes'],
bundleCountsAsSingleTransaction: true,
guaranteedCompensation: false
},
sellerArrangedLostShipment: {
carrierClaimRequired: true,
actualCarrierCompensationInput: true,
depopSellerProtection: false
},
unknowns: {
ordinaryRefundDepopShippingLabelRecovery: null,
ordinaryRefundSellerOutboundShippingRecovery: null,
sellerProtectionActualCompensation: null
}
};
let DEPOP = FALLBACK_DEPOP;
let DEPOP_SHIPPING = FALLBACK_SHIPPING;
function tryLoad(urls){
if(!urls.length) return Promise.resolve();
return fetch(urls[0])
.then(r => r.ok ? r.json() : Promise.reject())
.then(d => {
if(d && d.depop){
DEPOP = d.depop;
return;
}
return tryLoad(urls.slice(1));
})
.catch(() => tryLoad(urls.slice(1)));
}
tryLoad(['fees.json', 'fee.json']);
/* Depop shipping/protection rules live in shipping.json (fees.json depop has no sellerProtection) */
fetch('shipping.json').then(function(r){ return r.ok ? r.json() : Promise.reject(); })
.then(function(d){ if(d && d.depop){ DEPOP_SHIPPING = d.depop; } })
.catch(function(){});
/* Calculate Depop fees for a given market and base amount */
function calcFees(market, salePrice, buyerShipping, shipMethod){
const marketData = DEPOP.markets[market] || DEPOP.markets.US;
const sellingPct = marketData.sellingFeePct || 0;
let sellingFee = 0;
 let processingFee = 0;
 if(market === 'OTHER'){
   /* OTHER market: 10% selling fee on item price (exclude taxes)
      Include shipping when seller_arranged_shipping */
   const sellingBase = salePrice + (shipMethod === 'seller' ? buyerShipping : 0);
   sellingFee = sellingBase * (sellingPct / 100);
   /* PayPal processing is UNKNOWN — never estimate */
   processingFee = 0;
 } else {
   /* US/UK/AU: Depop Payments processing on (sale + shipping + taxes)
      We don't collect taxes, so base = sale + shipping */
   const processingBase = salePrice + buyerShipping;
   const proc = marketData.processing || {};
   processingFee = processingBase * ((proc.pct || 0) / 100) + (proc.fixed || 0);
 }
 return { sellingFee, processingFee, totalFees: sellingFee + processingFee };
}
/* Main calculation */
window.calculateDepop = function(){
const sale = parseFloat($('depopSalePrice').value);
if(!sale || sale <= 0){ alert('Please enter the original item sale price.'); return; }
const market = $('depopMarket').value;
 /* FIX 2/3 — set display currency from market (display only) */
 CUR = (market === 'UK') ? '£' : (market === 'AU') ? 'A$' : '$';
 const buyerShipping = parseFloat($('depopBuyerShipping').value) || 0;
 const shipMethod = $('depopShipMethod').value;
 if(!shipMethod){ alert('Please select the shipping method.'); return; }
 const refundStatus = $('depopRefundStatus').value;
 if(!refundStatus){ alert('Please select the refund status.'); return; }
 /* Read branch-specific fields (only if visible) */
 const partialAmount = parseFloat($('depopRefundAmount').value) || 0;
 const returned = $('depopItemReturned').value;
 const actualRefund = parseFloat($('depopActualRefundAmount').value) || 0;
 const recoveredValue = parseFloat($('depopRecoveredValue').value) || 0;
 const sellerPaidShip = $('depopSellerPaidReturnShip').value;
 const returnShipCost = parseFloat($('depopReturnShipCost').value) || 0;
 const notReturnedWhy = $('depopNotReturnedWhy').value;
 const protectionCheck = $('depopProtectionCheck').value;
 const compensationReceived = parseFloat($('depopCompensationReceived').value) || 0;
 /* Validate visible fields */
 if(refundStatus === 'partial' && partialAmount <= 0){
   alert('Please enter the actual partial refund amount.'); return;
 }
 if(refundStatus === 'full'){
   if(!returned){ alert('Please tell us if the item came back.'); return; }
   if(returned === 'yes'){
     if(isNaN(parseFloat($('depopRecoveredValue').value))){
       alert('Please enter what the item is worth to you now.'); return;
     }
     if(!sellerPaidShip){ alert('Please tell us if you paid return shipping.'); return; }
     if(sellerPaidShip === 'yes' && isNaN(parseFloat($('depopReturnShipCost').value))){
       alert('Please enter the return shipping cost.'); return;
     }
   } else if(returned === 'no'){
     if(!notReturnedWhy){ alert('Please tell us why the item did not come back.'); return; }
     if(notReturnedWhy === 'transit' && !protectionCheck){
       alert('Please check Depop Seller Protection eligibility.'); return;
     }
   }
 }
 /* ===== LOSS CALCULATION BY BRANCH ===== */
 let totalLoss = 0;
 const lines = [];
 let refundOutflow = 0;
 let refundLabel = '';
 let feesReversed = 0;
 let feesUnrecovered = 0;
 let returnShippingLoss = 0;
 let valueLost = 0;
 let compensationOffset = 0;
 let unknownFee = false;   /* FIX 4 — true when PayPal processing impact is unknown */
 /* Calculate fees for context (even if reversed) */
 const fees = calcFees(market, sale, buyerShipping, shipMethod);
 if(refundStatus === 'no'){
   /* ===== NO REFUND =====
      No completed forced-refund loss to calculate.
      Display statement, not $0 loss. */
   lines.push({label:'REFUND STATUS', amount:'NO REFUND ISSUED', cls:'info', cat:''});
   lines.push({label:'CALCULATION', amount:'NO COMPLETED REFUND', cls:'info', cat:''});
   totalLoss = 0;
   refundLabel = 'NO REFUND';
 } else if(refundStatus === 'partial'){
   /* ===== FIX 1 — PARTIAL REFUND =====
      Use ONLY the actual refund amount entered by the seller.
      Do NOT auto-calculate the full original processing fee as reversed.
      Do NOT invent a partial-refund fee formula. */
   refundOutflow = partialAmount;
   refundLabel = 'ACTUAL (you entered)';
   lines.push({label:'PARTIAL REFUND AMOUNT', amount:'-' + money(partialAmount), cls:'loss', cat:''});
   lines.push({label:'FEE REFUND ON PARTIAL', amount:'UNKNOWN — NOT ESTIMATED', cls:'info', cat:'fees'});
   totalLoss = partialAmount;
 } else if(refundStatus === 'full'){
   /* ===== FULL REFUND =====
      Determine refund outflow: actual or derived */
   if(actualRefund > 0){
     refundOutflow = actualRefund;
     refundLabel = 'ACTUAL (you entered)';
   } else {
     /* Derive from sale + buyer shipping */
     refundOutflow = sale + buyerShipping;
     refundLabel = 'DERIVED (item + buyer shipping only)';
   }
   lines.push({label:'REFUND OUTFLOW', amount:'-' + money(refundOutflow), cls:'loss', cat:''});
   if(actualRefund === 0){
     lines.push({label:'REFUND SOURCE', amount:refundLabel, cls:'info', cat:''});
   }
   if(returned === 'yes'){
     /* ===== FULL + RETURNED ===== */
     if(market !== 'OTHER'){
       feesReversed = fees.totalFees;
       lines.push({label:'FEES REVERSED (OFFICIAL DEPOP RULE)', amount:'+' + money(feesReversed), cls:'ok', cat:'fees'});
       feesUnrecovered = 0;
     } else {
       /* FIX 4 — 10% selling fee known & reversed (may require support);
          PayPal processing UNKNOWN, never estimated. */
       feesReversed = fees.sellingFee;
       lines.push({label:'SELLING FEE 10% REVERSED (MAY REQUIRE SUPPORT)', amount:'+' + money(feesReversed), cls:'ok', cat:'fees'});
       lines.push({label:'PAYPAL PROCESSING FEE', amount:'UNKNOWN — NOT ESTIMATED', cls:'info', cat:'fees'});
       unknownFee = true;
     }
     /* Return shipping loss (seller-paid only) */
     if(sellerPaidShip === 'yes'){
       returnShippingLoss = returnShipCost;
       lines.push({label:'RETURN SHIPPING (YOU PAID)', amount:'-' + money(returnShippingLoss), cls:'loss', cat:'shipping'});
     } else {
       lines.push({label:'RETURN SHIPPING', amount:'NOT CHARGED TO YOU', cls:'ok', cat:'shipping'});
     }
     /* Value lost = refund outflow - recovered value */
     valueLost = Math.max(0, refundOutflow - recoveredValue);
     if(valueLost > 0){
       lines.push({label:'RECOVERED VALUE (YOUR ESTIMATE)', amount:'-' + money(recoveredValue), cls:'ok', cat:'value'});
       lines.push({label:'VALUE LOST', amount:'-' + money(valueLost), cls:'loss', cat:'value'});
     } else {
       lines.push({label:'RECOVERED VALUE', amount:'FULLY RECOVERED', cls:'ok', cat:'value'});
       valueLost = 0;
     }
     totalLoss = Math.max(0, refundOutflow - feesReversed + returnShippingLoss + feesUnrecovered - recoveredValue);
   } else if(returned === 'no'){
     /* ===== FULL + NOT RETURNED ===== */
     if(notReturnedWhy === 'transit'){
       /* ===== TRANSIT LOSS / DAMAGE ===== */
       if(market !== 'OTHER'){
         feesReversed = fees.totalFees;
         lines.push({label:'FEES REVERSED (OFFICIAL DEPOP RULE)', amount:'+' + money(feesReversed), cls:'ok', cat:'fees'});
         feesUnrecovered = 0;
       } else {
         /* FIX 4 */
         feesReversed = fees.sellingFee;
         lines.push({label:'SELLING FEE 10% REVERSED (MAY REQUIRE SUPPORT)', amount:'+' + money(feesReversed), cls:'ok', cat:'fees'});
         lines.push({label:'PAYPAL PROCESSING FEE', amount:'UNKNOWN — NOT ESTIMATED', cls:'info', cat:'fees'});
         unknownFee = true;
       }
       /* Protection check (informational only) */
       if(protectionCheck === 'eligible'){
         const limit = DEPOP_SHIPPING.sellerProtection.limits[market === 'UK' ? 'GBP' : market === 'AU' ? 'AUD' : 'USD'];
         lines.push({label:'DEPOP PROTECTION', amount:'ELIGIBLE (limit ' + money(limit) + ')', cls:'info', cat:''});
       } else if(protectionCheck === 'ineligible'){
         lines.push({label:'DEPOP PROTECTION', amount:'NOT ELIGIBLE', cls:'info', cat:''});
       } else {
         lines.push({label:'DEPOP PROTECTION', amount:'NOT SURE', cls:'info', cat:''});
       }
       /* Actual compensation received (seller-entered fact) */
       if(compensationReceived > 0){
         compensationOffset = compensationReceived;
         lines.push({label:'COMPENSATION RECEIVED', amount:'+' + money(compensationOffset), cls:'ok', cat:''});
       } else {
         lines.push({label:'COMPENSATION RECEIVED', amount:'NONE', cls:'info', cat:''});
       }
       totalLoss = Math.max(0, refundOutflow - feesReversed + feesUnrecovered - compensationOffset);
     } else {
       /* ===== OTHER / NOT RETURNED ===== */
       if(market !== 'OTHER'){
         feesReversed = fees.totalFees;
         lines.push({label:'FEES REVERSED (OFFICIAL DEPOP RULE)', amount:'+' + money(feesReversed), cls:'ok', cat:'fees'});
         feesUnrecovered = 0;
       } else {
         /* FIX 4 */
         feesReversed = fees.sellingFee;
         lines.push({label:'SELLING FEE 10% REVERSED (MAY REQUIRE SUPPORT)', amount:'+' + money(feesReversed), cls:'ok', cat:'fees'});
         lines.push({label:'PAYPAL PROCESSING FEE', amount:'UNKNOWN — NOT ESTIMATED', cls:'info', cat:'fees'});
         unknownFee = true;
       }
       lines.push({label:'ITEM RECOVERY', amount:'UNKNOWN — not estimated', cls:'info', cat:''});
       totalLoss = Math.max(0, refundOutflow - feesReversed + feesUnrecovered);
     }
   }
 }
 /* ===== RENDER RESULT ===== */
 /* FIX 4 — make estimate status obvious when a fee component is unknown */
 if(unknownFee){
   lines.push({label:'⚠ ESTIMATE ONLY — PAYPAL PROCESSING FEE UNKNOWN, NOT INCLUDED', amount:'', cls:'info', cat:''});
 }
 $('depopResult').hidden = false;
 $('depopLossAmount').textContent = (unknownFee ? '≈ ' : '') + money(totalLoss);
 $('depopBreakdown').innerHTML = lines.map(l =>
   '<div class="r-line ' + l.cls + '"><span class="r-label">' + l.label + '</span><span class="r-dots"></span><span class="r-amt">' + l.amount + '</span></div>'
 ).join('');
 /* Shared receipt / chart / letter / evidence */
 const result = {
   sale: sale,
   feesLost: feesUnrecovered,
   returnCost: returnShippingLoss,
   valueLost: valueLost,
   total: totalLoss,
   condition: (returned === 'yes') ? 'returned' : 'not_returned',
   outcome: refundStatus,
   platform: 'Depop',
   lines: lines
 };
 if(typeof renderReceipt === 'function') renderReceipt(result);
 if(typeof renderChart === 'function') renderChart(result);
 if(typeof updateLetter === 'function') updateLetter(result);
 if(typeof updateEvidence === 'function') updateEvidence(result);
 /* FIX 2/3 — currency post-processing for shared (app.js) outputs.
    app.js is protected, so we rewrite its $ symbols after it renders. */
 if(CUR !== '$'){
   const ap = $('appealLetter'); if(ap) ap.value = ap.value.split('$').join(CUR);
   const tx = $('taxLine'); if(tx) tx.value = tx.value.split('$').join(CUR);
   setTimeout(function(){
     const t = $('totalAmt'); if(t) t.textContent = money(totalLoss);
     const d = $('dcAmt'); if(d) d.textContent = money(totalLoss);
   }, 3000);
 }
 const act = $('actions'); if(act) act.style.display = 'flex';
};
})();