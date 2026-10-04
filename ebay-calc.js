/* ============================================================
CLAWBACK — ebay-calc.js  (eBay calculation engine)
Reads the eBay section of the merged fee data file when served
over http(s); falls back to the embedded copy when opened via
file:// (local testing). Renders into #ebayResult + shared
receipt/chart/letter. Does NOT modify app.js.
============================================================ */
(function(){
const $ = id => document.getElementById(id);
const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
/* Embedded fallback — mirrors the "ebay" section of fees.json.
Used automatically when fetch() is blocked (file:// testing). */
const FALLBACK_EBAY = {
per_order_fee: { type:'threshold', threshold:10, currency:'USD',
tiers:[ {max:10, fee:0.30}, {min:10.01, fee:0.40} ] },
categories: [
{ id:'most_categories', fee_type:'tiered_percentage', per_order_fee_applies:true,
tiers:[ {min:0,max:7500,rate_pct:13.6}, {min:7500,max:null,rate_pct:2.35} ] },
{ id:'books_media', fee_type:'tiered_percentage', per_order_fee_applies:true,
tiers:[ {min:0,max:7500,rate_pct:15.3}, {min:7500,max: null,rate_pct:2.35} ] },
{ id:'coins_paper_money', fee_type:'tiered_percentage', per_order_fee_applies:true,
tiers:[ {min:0,max:7500,rate_pct:13.25}, {min:7500,max:null,rate_pct:2.35} ] },
{ id:'womens_bags', fee_type:'tiered_percentage', per_order_fee_applies:true,
tiers:[ {min:0,max:2000,rate_pct:15}, {min:2000,max:null,rate_pct:9} ] },
{ id:'jewelry_watches', fee_type:'tiered_percentage', per_order_fee_applies:true,
tiers:[ {min:0,max:5000,rate_pct:15}, {min:5000,max:null,rate_pct:9} ] },
{ id:'watches_parts_accessories', fee_type: 'tiered_percentage', per_order_fee_applies:true,
tiers:[ {min:0,max:1000,rate_pct:15}, {min:1000,max:7500,rate_pct:6.5}, {min:7500,max:null,rate_pct:3} ] },
{ id:'athletic_shoes',  fee_type:'order_amount_threshold', threshold:150,
rules:[ {condition:'total_below',threshold:150,rate_pct:13.6,per_order_fee_applies:true},
{condition:'total_at_or_above',threshold:150,rate_pct:8,per_order_fee_applies:false} ] },
{ id:'custom', fee_type:'custom', rate_pct:null }
],
partial_refund: {
variable_fee_credit: { type: 'proportional_to_total_refund_over_total_sale' },
per_order_fee_credit: { type: 'not_credited', do_not_prorate: true },
notes: 'Credit ratio = Total Refund to Buyer / (Sale Price + Buyer Shipping + Buyer Tax). Per-order fee is never prorated or credited on partial refunds.'
},
fee_credit_rules: {
buyer_remorse_full_refund_on_ebay:   { variable_final_value_fee:'may_be_credited', per_order_fee:'may_be_credited' },
item_problem_full_refund_on_ebay:    { variable_final_value_fee:'may_be_credited', per_order_fee:'not_credited' },
item_not_received_full_refund_on_ebay:{  variable_final_value_fee:'may_be_credited', per_order_fee:'not_credited' },
ebay_stepped_in:                     { variable_final_value_fee:'not_credited',    per_order_fee:'not_credited' },
refunded_outside_ebay:               { variable_final_value_fee:'not_credited',    per_order_fee:'not_credited' }
},
reason_mapping: {
inad:'item_problem_full_refund_on_ebay', damaged:'item_problem_full_refund_on_ebay',
wrong_item:'item_problem_full_refund_on_ebay', defective:'item_problem_full_refund_on_ebay',
changed_mind:'buyer_remorse_full_refund_on_ebay', ordered_wrong:'buyer_remorse_full_refund_on_ebay',
not_received:'item_not_received_full_refund_on_ebay', other:null
}
};
let EBAY = FALLBACK_EBAY;
function tryLoad(urls){
if(!urls.length) return Promise.resolve();
return fetch(urls[0])
.then(r => r.ok ? r.json() : Promise.reject())
.then(d => { if(d && d.ebay && d.ebay.categories){ EBAY = d.ebay; return; } return tryLoad(urls.slice(1)); })
.catch(() => tryLoad(urls.slice(1)));
}
tryLoad(['fees.json', 'fee.json']);
function tieredFee(tiers, base){
let fee = 0;
for(const t of tiers){
const min = t.min || 0;
const max = (t.max == null) ? Infinity : t.max;
if(base <= min) break;
fee += (Math.min(base, max) - min) * (t.rate_pct / 100);
}
return fee;
}
function categoryFee(cat, base){
if(cat.fee_type === 'tiered_percentage'){
return { variable: tieredFee(cat.tiers, base), perOrderApplies: cat.per_order_fee_applies !== false };
}
if(cat.fee_type === 'order_amount_threshold'){
for(const r of cat.rules){
if(r.condition === 'total_below' && base < r.threshold)
return { variable: base * r.rate_pct / 100, perOrderApplies: r.per_order_fee_applies };
if(r.condition === 'total_at_or_above' && base >= r.threshold)
return { variable: base * r.rate_pct / 100, perOrderApplies: r.per_order_fee_applies };
}
}
if(cat.fee_type === 'custom'){
const rate = parseFloat($('ebayCustomFeeRate').value) || 0;
return { variable: base * rate / 100, perOrderApplies: true };
}
return { variable: 0, perOrderApplies: true };
}
function perOrderFee(base, po, applies){
if(!applies) return 0;
for(const t of po.tiers){
if(t.max != null && base <= t.max) return t.fee;
}
return po.tiers.length ? po.tiers[po.tiers.length - 1].fee : 0;
}
window.calculateEbay = function(){
const sale = parseFloat($('ebaySalePrice').value);
if(!sale || sale <= 0){ alert('Please enter the original sale price.'); return; }
const ship   = parseFloat($('ebayBuyerShipping').value) || 0;
 const tax    = parseFloat($('ebaySalesTax').value) || 0;
 const reason = $('ebayRefundReason').value;
 if(!reason){ alert('Please select why the buyer got a refund.'); return; }
 const returned  = $('ebayItemReturned').value;
 const condition = $('ebayReturnedCondition').value;
 const curValue  = parseFloat($('ebayCurrentItemValue').value) || 0;
 const payer     = $('ebayReturnShippingPayer').value;
 const shipCost  = parseFloat($('ebayReturnShippingCost').value) || 0;
 const dedOn     = $('ebayDeductionEnabled').value;
 const dedAmt    = parseFloat($('ebayRefundDeduction').value) || 0;
 const handler   = $('ebayRefundHandler').value;
 if(!handler){ alert('Please select how the refund was handled.'); return; }
 const rType = $('ebayRefundType').value;
 const rAmt  = parseFloat($('ebayRefundAmount').value) || 0;
 if(!$('ebayReturnedWrap').hidden && !returned){ alert('Please tell us if the item came back.'); return; }
 if(!$('ebayConditionWrap').hidden && !condition){ alert('Please select the returned condition.'); return; }
 if(!$('ebayCurrentValueWrap').hidden && isNaN(parseFloat($('ebayCurrentItemValue').value))){ alert('Please enter what the item could sell for now.'); return; }
 if(!$('ebayShipPayerWrap').hidden && !payer){ alert('Please select who was charged for return shipping.'); return; }
 if(!$('ebayShipCostWrap').hidden && isNaN(parseFloat($('ebayReturnShippingCost').value))){ alert('Please enter the return shipping cost.'); return; }
 if(!$('ebayRefundTypeWrap').hidden && !rType){ alert('Please select full or partial refund.'); return; }
 if(!$('ebayRefundAmountWrap').hidden && isNaN(parseFloat($('ebayRefundAmount').value))){ alert('Please enter the refund amount.'); return; }
 const catMap = { most:'most_categories', books:'books_media', coins:'coins_paper_money',
   bags:'womens_bags', jewelry:'jewelry_watches', watches:'watches_parts_accessories',
   shoes:'athletic_shoes', custom:'custom' };
 const cat = EBAY.categories.find(c => c.id === (catMap[$('ebayCategory').value] || 'most_categories')) || EBAY.categories[0];
 const base = sale + ship + tax;
 const cf = categoryFee(cat, base);
 const variableFee = cf.variable;
 const perFee = perOrderFee(base, EBAY.per_order_fee, cf.perOrderApplies);
 let ruleKey = EBAY.reason_mapping[reason] || null;
 if(handler === 'stepped_in') ruleKey = 'ebay_stepped_in';
 if(handler === 'outside')    ruleKey = 'refunded_outside_ebay';
 const rule = ruleKey ? (EBAY.fee_credit_rules[ruleKey] || null) : null;
 const varCredit = rule ? rule.variable_final_value_fee === 'may_be_credited' : false;
 const perCredit = rule ? rule.per_order_fee === 'may_be_credited' : false;
 /* ===== LOST FEES BY SCENARIO =====
    - stepped_in / outside: no credits at all
    - partial refund on eBay: proportional variable-fee credit;
      per-order fee NEVER prorated; deduction override does NOT apply
      (deduction is already baked into the partial amount the user entered)
    - full refund with deduction: deduction override kills normal credits
    - full refund without deduction: normal credit rules apply
 */
 let varLost, perLost;
 if(handler === 'stepped_in' || handler === 'outside'){
   varLost = variableFee; perLost = perFee;
 } else if(handler === 'on_ebay' && rType === 'partial'){
   const totalSaleAmount = sale + ship + tax;
   const p = totalSaleAmount > 0 ? Math.min(1, rAmt / totalSaleAmount) : 0;
   varLost = varCredit ? variableFee * (1 - p) : variableFee;
   perLost = perFee;
 } else if(dedOn === 'yes'){
   /* Full refund + deduction: deduction override kills normal fee credits */
   varLost = variableFee; perLost = perFee;
 } else {
   varLost = varCredit ? 0 : variableFee;
   perLost = perCredit ? 0 : perFee;
 }
 /* ===== RETURN SHIPPING (seller-paid only) =====
    Hardened: a visible 'me' + entered cost can never be dropped;
    a hidden/stale cost can never leak in. */
 const payerNorm = String(payer || '').trim().toLowerCase();
 const costVisible = !$('ebayShipCostWrap').hidden;
 const returnShip = (payerNorm === 'me' && costVisible) ? shipCost : 0;
 /* ===== ACTUAL CASH REFUNDED =====
    For loss calc, the cash outflow is what the seller actually gave back,
    NOT the original sale price.
    - Full refund on eBay = sale
    - Partial refund on eBay = user-entered partial amount
    - stepped_in / outside = user-entered amount (or sale if missing)
 */
 let actualRefund = sale;
 if(handler === 'on_ebay' && rType === 'partial'){
   actualRefund = rAmt;
 } else if(handler === 'stepped_in' || handler === 'outside'){
   actualRefund = rAmt > 0 ? rAmt : sale;
 }
 /* ===== VALUE LOST = cash refunded − recovered item value =====
    Returned + damaged: actualRefund - curValue
    Returned + same: 0 (no drop)
    Not returned / not received: actualRefund (item never recovered)
 */
 let valueLost = 0;
 if(returned === 'yes' && condition && condition !== 'same'){
   valueLost = Math.max(0, actualRefund - curValue);
 } else if(returned === 'no' || reason === 'not_received'){
   valueLost = actualRefund;
 }
 /* Deduction only offsets value drop on FULL refunds.
    On partial refunds, deduction is already baked into the partial amount
    the user entered, so applying it again would double-count. */
 const deductionApplies = (handler === 'on_ebay' && rType !== 'partial' && dedOn === 'yes');
 const valueLostNet = deductionApplies ? Math.max(0, valueLost - dedAmt) : valueLost;
 const feesLost = varLost + perLost;
 const total = Math.max(0, feesLost + returnShip + valueLostNet);
 const lines = [{label:'SALE PRICE', amount:'+' + money(sale), cls:'info', cat:''}];
 if(handler === 'on_ebay' && rType === 'partial'){
   lines.push({label:'ACTUAL REFUND PAID', amount:'-' + money(actualRefund), cls:'info', cat:''});
 }
 if(variableFee > 0.004) lines.push(varLost < 0.005
   ? {label:'FINAL VALUE FEE', amount:'CREDITED', cls:'ok', cat:'fees'}
   : {label:'FINAL VALUE FEE (KEPT)', amount:'-' + money(varLost), cls:'loss', cat:'fees'});
 if(perFee > 0.004) lines.push(perLost < 0.005
   ? {label:'PER-ORDER FEE', amount:'CREDITED', cls:'ok', cat:'fees'}
   : {label:'PER-ORDER FEE (KEPT)', amount:'-' + money(perLost), cls:'loss', cat:'fees'});
 lines.push(payerNorm === 'me'
   ? {label:'RETURN SHIPPING (YOU PAID)', amount:'-' + money(returnShip), cls:'loss', cat:'shipping'}
   : {label:'RETURN SHIPPING (PAYER: ' + (payerNorm || '—').toUpperCase() + ')', amount:'NOT CHARGED TO YOU', cls:'ok', cat:'shipping'});
 if(valueLostNet > 0.004) lines.push({label:(returned === 'yes' ? 'ITEM VALUE DROP' : 'ITEM NOT RECOVERED'), amount:'-' + money(valueLostNet), cls:'loss', cat:'value'});
 if(deductionApplies && dedAmt > 0) lines.push({label:'DEDUCTION KEPT FROM REFUND', amount:'offsets loss', cls:'ok', cat:'value'});
 $('ebayResult').hidden = false;
 $('ebayLossAmount').textContent = money(total);
 $('ebayBreakdown').innerHTML = lines.map(l =>
   '<div class="r-line ' + l.cls + '"><span class="r-label">' + l.label + '</span><span class="r-dots"></span><span class="r-amt">' + l.amount + '</span></div>'
 ).join('');
 const cond = (returned === 'yes' && condition) ? condition : 'same';
 const outcome = (reason === 'changed_mind' || reason === 'ordered_wrong') ? 'remorse'
               : (handler === 'stepped_in') ? 'stepped_in' : 'inad';
 const result = { sale, feesLost, returnCost: returnShip, valueLost: valueLostNet,
   total, condition: cond, outcome, platform: 'eBay', lines };
 if(typeof renderReceipt === 'function') renderReceipt(result);
 if(typeof renderChart === 'function') renderChart(result);
 if(typeof updateLetter === 'function') updateLetter(result);
 if(typeof updateEvidence === 'function') updateEvidence(result);
 const act = $('actions'); if(act) act.style.display = 'flex';
};
})();