/* ============================================================
CLAWBACK — vinted-calc.js  (Vinted seller-loss)
$0 seller fees; loss = refunds + seller expenses - recovered
value - confirmed compensation. Never invents compensation.
Official integrated-label compensation caps used as CONTEXT
and sanity-warning only — NEVER auto-applied as a payout.
============================================================ */
(function(){
const $=id=>document.getElementById(id);
const money=n=>'$'+(Math.round(n*100)/100).toFixed(2);
const VINTED_CAPS={usps:100,better:30,speedx:15,fedex:100,intl:27};
const CAP_LABEL={usps:'USPS',better:'Better Trucks',speedx:'SpeedX',fedex:'FedEx',intl:'International USPS/SpeedX'};
let CAPS=VINTED_CAPS;
fetch('shipping.json').then(r=>r.ok?r.json():Promise.reject()).then(d=>{
if(d&&d.vinted_compensation_caps){
const c=d.vinted_compensation_caps;
CAPS={usps:c.domestic_us.usps,better:c.domestic_us.better_trucks,speedx:c.domestic_us.speedx,fedex:c.domestic_us.fedex,intl:c.international.usps_speedx};
}
}).catch(()=>{});
function capFor(p){ return (p&&CAPS[p]!=null)?CAPS[p]:null; }
function updateCapHint(){
const wrap=$('vtProviderWrap'); if(!wrap) return;
const hint=wrap.querySelector('.wn-hint'); if(!hint) return;
const prov=$('vtProvider')?$('vtProvider').value:'';
const cap=capFor(prov);
hint.textContent = cap!=null
? CAP_LABEL[prov]+' — stated max '+money(cap)+'. Enter ONLY your confirmed amount; caps are NOT automatic payouts.'
: 'Maximums are stated caps, NOT automatic payouts.';
}
['vtProvider','vtCompStatus'].forEach(function(id){ var el=$(id); if(el) el.addEventListener('change',updateCapHint); });
window.calculateVinted=function(){
const sale=parseFloat($('vtSalePrice').value);
if(isNaN(sale)||sale<0){alert('Please enter the selling price.');return;}
const sc=$('vtScenario').value;
if(!sc){alert('Please select what happened to this order.');return;}
let branch=(sc==='snad'||sc==='remorse')?($('vtSubChoice').value):sc;
if((sc==='snad'||sc==='remorse')&&!branch){alert('Please select how it was resolved.');return;}
const compStatus=($('vtCompStatus')&&!$('vtCompStatusWrap').hidden)?$('vtCompStatus').value:'';
 const comp=(compStatus==='confirmed')?(parseFloat($('vtCompAmount').value)||0):0;
 const carrierConfirmed=($('vtCarrierConfirmed')&&!$('vtCarrierConfirmedWrap').hidden)?$('vtCarrierConfirmed').value:'';
 const prov=($('vtProvider')&&!$('vtProviderWrap').hidden)?$('vtProvider').value:'';
 const cap=capFor(prov);
 updateCapHint();
 let protStatus='Not applicable';
 if(branch!=='no_refund'){
   if(compStatus==='confirmed') protStatus='Confirmed';
   else if(compStatus==='pending'||carrierConfirmed==='pending') protStatus='Undetermined';
   else protStatus='Not confirmed';
 }
 let loss=0, exposure=0, recovered=0, expense=0, itemNotRecovered=false;
 const lines=[];
 if(branch==='no_refund'){
   $('vtResult').hidden=false;
   $('vtHeadline').textContent='VINTED SELLER LOSS';
   $('vtLossAmount').textContent=money(0);
   $('vtBreakdown').innerHTML='<div class="r-line ok"><span class="r-label">Selling price received</span><span class="r-dots"></span><span class="r-amt">'+money(sale)+'</span></div><div class="r-line info"><span class="r-label">STATUS</span><span class="r-dots"></span><span class="r-amt">NO COMPLETED REFUND</span></div>';
   $('vtProtectionNote').textContent='Protection Status: Not applicable.';
   $('vtFeeNote').textContent='Vinted charges $0 in seller selling fees — when your sale completes, you receive the full selling price. Buyer-paid Buyer Protection and shipping are not counted as seller loss.';
   finish(0);
   return;
 }
 expense=parseFloat($('vtExpense').value)||0;
 const actual=parseFloat($('vtFullActual').value)||0;
 if(branch==='partial'){
   const partial=parseFloat($('vtPartialAmount').value);
   if(isNaN(partial)||partial<=0){alert('Please enter the partial refund amount.');return;}
   exposure=partial; recovered=0;
   loss=Math.max(0, partial+expense-comp);
 }
 else if(branch==='full_keep'){
   exposure=actual>0?actual:sale; recovered=0; itemNotRecovered=true;
   loss=Math.max(0, exposure-comp);
 }
 else if(branch==='full_return'){
   const cond=$('vtReturnCondition').value;
   if(!cond){alert('Please select the returned item condition.');return;}
   exposure=sale;
   if(cond==='not_received'){ recovered=0; itemNotRecovered=true; }
   else { recovered=parseFloat($('vtRecoverValue').value)||0; if(recovered<0){alert('Recoverable value cannot be negative.');return;} }
   loss=Math.max(0, sale-recovered+expense-comp);
 }
 else if(branch==='lost_transit'){
   exposure=actual>0?actual:sale; recovered=0; itemNotRecovered=true;
   loss=Math.max(0, exposure-comp);
 }
 else if(branch==='damaged_transit'){
   exposure=sale; recovered=parseFloat($('vtRecoverValue').value)||0;
   loss=Math.max(0, sale-recovered+expense-comp);
 }
 else if(branch==='rts'){
   const rec=$('vtRtsReceived').value;
   if(!rec){alert('Please tell us if you received the item back.');return;}
   if(rec==='yes'){
     const cond=$('vtReturnCondition').value;
     if(!cond){alert('Please select the returned item condition.');return;}
     exposure=sale; recovered=parseFloat($('vtRecoverValue').value)||0;
     loss=Math.max(0, sale-recovered+expense-comp);
   } else {
     exposure=actual>0?actual:sale; recovered=0; itemNotRecovered=true;
     loss=Math.max(0, exposure-comp);
   }
 }
 else if(branch==='return_parcel'){
   exposure=sale; recovered=parseFloat($('vtRecoverValue').value)||0;
   if(recovered===0) itemNotRecovered=true;
   loss=Math.max(0, sale-recovered+expense-comp);
 }
 lines.push({l:'Selling price',a:money(sale),c:'info'});
 lines.push({l:'Refund / seller exposure',a:money(exposure),c:'loss'});
 if(recovered>0) lines.push({l:'Item value recovered',a:'-'+money(recovered),c:'ok'});
 if(itemNotRecovered) lines.push({l:'Item not recovered — recovery value',a:money(0),c:'info'});
 if(comp>0) lines.push({l:'Confirmed Vinted compensation',a:'-'+money(comp),c:'ok'});
 if(expense>0) lines.push({l:'Seller-paid expenses (entered)',a:money(expense),c:'loss'});
 let protNote='Protection Status: '+protStatus+'.';
 if(protStatus==='Undetermined') protNote+=' Exposure shown before any compensation decision.';
 if(cap!=null && protStatus==='Undetermined') protNote+=' Stated max for '+CAP_LABEL[prov]+': '+money(cap)+' (not guaranteed).';
 if(comp>0 && cap!=null && comp>cap) protNote+=' Warning: entered compensation exceeds the stated '+CAP_LABEL[prov]+' maximum ('+money(cap)+'); verify your confirmed amount.';
 $('vtResult').hidden=false;
 $('vtHeadline').textContent='VINTED SELLER LOSS';
 $('vtLossAmount').textContent=money(loss);
 $('vtBreakdown').innerHTML=lines.map(x=>'<div class="r-line '+x.c+'"><span class="r-label">'+x.l+'</span><span class="r-dots"></span><span class="r-amt">'+x.a+'</span></div>').join('');
 $('vtProtectionNote').textContent=protNote;
 $('vtFeeNote').textContent='Vinted charges $0 in seller selling fees. CLAWBACK estimate based on the transaction details and compensation information you entered. Actual Vinted decisions and compensation may differ.';
 finish(loss);
 function finish(loss){
   const result={sale,feesLost:0,returnCost:expense,valueLost:loss,total:loss,condition:'same',outcome:branch,platform:'Vinted',
     lines:lines.map(x=>({label:x.l.toUpperCase(),amount:x.a,cls:x.c,cat:''}))};
   if(typeof renderReceipt==='function')renderReceipt(result);
   var cw=$('chartWrap'); if(cw)cw.style.display='none';
   if(typeof updateLetter==='function')updateLetter(result);
   if(typeof updateEvidence==='function')updateEvidence(result);
   var act=$('actions'); if(act)act.style.display='flex';
 }
};
})();