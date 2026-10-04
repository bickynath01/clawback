/* ============================================================
   CLAWBACK — whatnot-calc.js  (Whatnot forced-return loss)
   SPS-based exposure; fees informational only; protection only
   when confirmed; never invents payouts or depreciation.

   Whatnot commission is tiered by four-week total sales; this
   calculator has no four-week-sales input, so commission is
   NEVER estimated and NEVER enters the loss calculation.
   ============================================================ */

(function(){
  const $=id=>document.getElementById(id);

  /* Dynamic currency symbol follows the region selector */
  function getCurrencySymbol(){
    const r=$('wnRegion') ? $('wnRegion').value : 'us';
    const map={
      us:'$',
      ca:'C$',
      au:'A$',
      jp:'¥',
      uk:'£',
      eu:'€'
    };
    return map[r]||'$';
  }

  const money=n =>
    getCurrencySymbol()+(Math.round(n*100)/100).toFixed(2);

  /*
    Defensive fallback only.

    IMPORTANT:
    There is NO Whatnot commission fallback here.
    Current commission is tiered by four-week sales and this
    calculator has no four-week-sales input.
  */
  const FALLBACK_WHATNOT={
    regions:{
      us:{
        group:'uscaau',
        processing:{
          pct:2.9,
          fixed:0.30,
          base:'gross_order_value'
        },
        taxOnFees:false
      },

      ca:{
        group:'uscaau',
        processing:{
          pct:2.9,
          fixed:0.30,
          base:'gross_order_value'
        },
        taxOnFees:false
      },

      au:{
        group:'uscaau',
        processing:{
          pct:2.9,
          fixed:0.30,
          base:'gross_order_value'
        },
        taxOnFees:false
      },

      uk:{
        group:'euk',
        processing:{
          pct:2.42,
          fixed:0.25,
          base:'gross_order_value'
        },
        taxOnFees:true,
        taxLabel:'+ VAT (not estimated)'
      },

      eu:{
        group:'euk',
        processing:{
          pct:2.42,
          fixed:0.25,
          base:'gross_order_value'
        },
        taxOnFees:true,
        taxLabel:'+ VAT (not estimated)'
      },

      jp:{
        group:'jp',
        processing:{
          pct:2.9,
          fixed:50,
          base:'gross_order_value'
        },
        taxOnFees:true,
        taxLabel:'+ JCT (not estimated)'
      }
    }

    /*
      No commission fallback.

      Current Whatnot commission is tiered by four-week
      total sales. Without a four-week-sales input it
      cannot be estimated, so no commission rates, caps,
      or promotional assumptions live here.
    */
  };

  let WHATNOT=FALLBACK_WHATNOT;

  /*
    Load current Whatnot processing data from fees.json.

    Commission remains informational only and is NEVER
    estimated or included in the CLAWBACK loss calculation.
  */
  fetch('fees.json')
    .then(r=>r.ok ? r.json() : Promise.reject())
    .then(d=>{

      if(
        d &&
        d.whatnot &&
        d.whatnot.processingPct != null &&
        d.whatnot.processingFixed != null
      ){

        const pct=Number(d.whatnot.processingPct);
        const fixed=Number(d.whatnot.processingFixed);
        const base=d.whatnot.processingBase || 'gross_order_value';

        /*
          Use the current fees.json processing data for the
          US calculator.

          Commission remains tiered/informational only.
        */
        FALLBACK_WHATNOT.regions.us.processing={
          pct:pct,
          fixed:fixed,
          base:base
        };

        WHATNOT=FALLBACK_WHATNOT;
      }
    })
    .catch(()=>{});

  function regionData(r){
    return WHATNOT.regions[r] || WHATNOT.regions.us;
  }

  /*
    Processing fee is informational only.

    Respect the processingBase supplied by fees.json.

    Current Whatnot US base:
      gross_order_value

    This does NOT enter the CLAWBACK loss calculation.
  */
  function processingFee(region,sale,ship,tax){

    const p=regionData(region).processing;

    let baseAmount;

    switch(p.base){

      case 'item_sale_price':
        baseAmount=sale;
        break;

      case 'sale_plus_shipping':
        baseAmount=sale+ship;
        break;

      case 'gross_order_value':
      default:
        baseAmount=sale+ship+tax;
        break;
    }

    return baseAmount*(p.pct/100)+p.fixed;
  }

  function yn(cls){
    var el=document.querySelector('.'+cls+'.active');
    return el ? el.getAttribute('data-val') : '';
  }

  window.wnPreviewFees=function(){

    const sale=parseFloat($('wnSalePrice').value)||0;
    const ship=parseFloat($('wnBuyerShipping').value)||0;
    const tax=parseFloat($('wnBuyerTax').value)||0;

    const pf=processingFee(
      $('wnRegion').value,
      sale,
      ship,
      tax
    );

    const rd=regionData($('wnRegion').value);

    const fd=$('wnFeeDisplay');

    if(fd){
      fd.textContent=
        'Whatnot commission: TIERED by four-week sales — not estimated here (check Seller Hub for your current rate). '+
        'Processing estimate: '+
        money(pf)+
        (rd.taxOnFees ? ' '+rd.taxLabel : '')+
        '. Context only — not added to loss.';
    }
  };

  window.calculateWhatnot=function(){

    const sale=parseFloat($('wnSalePrice').value);

    if(isNaN(sale)||sale<0){
      alert('Please enter the final sale price.');
      return;
    }

    const ship=parseFloat($('wnBuyerShipping').value)||0;
    const tax=parseFloat($('wnBuyerTax').value)||0;
    const region=$('wnRegion').value;
    const happened=$('wnWhatHappened').value;

    if(!happened){
      alert('Please select what happened.');
      return;
    }

    /*
      Processing fee is context only.
      It NEVER enters the CLAWBACK loss calculation.
    */
    const pf=processingFee(
      region,
      sale,
      ship,
      tax
    );

    const rd=regionData(region);

    const protStatus=$('wnProtStatus')
      ? $('wnProtStatus').value
      : '';

    const reimb=
      (protStatus==='yes')
        ? (parseFloat($('wnProtAmount').value)||0)
        : 0;

    /*
      Carrier/proof questions are only live when the reason
      actually requires them.
    */
    const reason=$('wnReason')
      ? $('wnReason').value
      : '';

    const why=$('wnNotReturnedWhy')
      ? $('wnNotReturnedWhy').value
      : '';

    const carrierRelated=
      (reason==='damaged_transit'||reason==='delayed');

    const proofRelevant=
      (reason==='delayed');

    let loss=0;
    let exposure=0;
    let recovered=0;

    const lines=[];
    let protNote='';

    /*
      NO COMPLETED REFUND
    */
    if(happened==='no'){

      $('wnResult').hidden=false;

      $('wnHeadline').textContent=
        'NO COMPLETED REFUND';

      $('wnLossAmount').textContent='—';

      $('wnBreakdown').innerHTML=
        '<div class="r-line info">'+
        '<span class="r-label">STATUS</span>'+
        '<span class="r-dots"></span>'+
        '<span class="r-amt">NO COMPLETED REFUND</span>'+
        '</div>';

      $('wnExposureNote').textContent=
        'A buyer may still escalate and Whatnot may later approve a refund or billback. No completed refund loss is calculated at this stage.';

      $('wnProtectionNote').textContent='';

      $('wnFeeNote').textContent=
        'Whatnot commission: not estimated (tiered by four-week sales — check Seller Hub). '+
        'Processing estimate: '+
        money(pf)+
        (rd.taxOnFees ? ' '+rd.taxLabel : '')+
        '.';

      return;
    }

    /*
      PARTIAL REFUND
    */
    if(happened==='partial'){

      const partial=
        parseFloat($('wnPartialAmount').value);

      if(isNaN(partial)||partial<=0){
        alert('Please enter the actual partial refund amount.');
        return;
      }

      const expense=
        parseFloat($('wnPartialExpenseCost').value)||0;

      exposure=partial;

      loss=Math.max(
        0,
        partial+expense-reimb
      );

      lines.push({
        l:'Partial refund (SPS ledger adjustment)',
        a:money(partial),
        c:'loss'
      });

      if(expense>0){
        lines.push({
          l:'Seller-paid expense',
          a:money(expense),
          c:'loss'
        });
      }

      if(reimb>0){
        lines.push({
          l:'Confirmed Whatnot reimbursement',
          a:'-'+money(reimb),
          c:'ok'
        });
      }

    } else {

      /*
        FULL REFUND / RETURN
      */
      const ret=yn('wn-yn-returned');

      if(!ret){
        alert('Please tell us if the item was returned.');
        return;
      }

      /*
        If seller knows the actual refund/billback,
        use it directly.

        Otherwise use the existing SPS-derived exposure
        without estimating Whatnot commission.
      */
      const actual=
        parseFloat($('wnFullActualRefund').value)||0;

      const derivedCore=
        sale+ship;

      exposure=
        actual>0
          ? actual
          : derivedCore;

      /*
        ITEM RETURNED
      */
      if(ret==='yes'){

        const cv=
          parseFloat($('wnCurrentValue').value);

        if(isNaN(cv)||cv<0){
          alert(
            'Please enter the current resale/recovery value.'
          );
          return;
        }

        const cond=$('wnCondition').value;

        if(!cond){
          alert(
            'Please select returned condition.'
          );
          return;
        }

        const rs=
          parseFloat($('wnReturnShipping').value)||0;

        recovered=cv;

        /*
          CORE CLAWBACK LOSS FORMULA:

          refund/billback exposure
          + seller-paid return shipping
          - current recovery value
          - confirmed reimbursement
        */
        loss=Math.max(
          0,
          exposure+rs-cv-reimb
        );

        lines.push({
          l:
            'Refund / billback exposure'+
            (actual>0 ? ' (actual)' : ' (SPS-derived)'),
          a:money(exposure),
          c:'loss'
        });

        if(rs>0){
          lines.push({
            l:'Seller-paid return shipping',
            a:money(rs),
            c:'loss'
          });
        }

        if(cv>0){
          lines.push({
            l:'Estimated value recovered',
            a:'-'+money(cv),
            c:'ok'
          });
        }

        if(reimb>0){
          lines.push({
            l:'Confirmed Whatnot reimbursement',
            a:'-'+money(reimb),
            c:'ok'
          });
        }

      } else {

        /*
          ITEM NOT RETURNED
        */
        const whyVal=
          $('wnNotReturnedWhy').value;

        if(!whyVal){
          alert(
            'Please select why the item was not returned.'
          );
          return;
        }

        recovered=0;

        loss=Math.max(
          0,
          exposure-reimb
        );

        lines.push({
          l:
            'Refund / billback exposure'+
            (actual>0 ? ' (actual)' : ' (SPS-derived)'),
          a:money(exposure),
          c:'loss'
        });

        if(reimb>0){
          lines.push({
            l:'Confirmed Whatnot reimbursement',
            a:'-'+money(reimb),
            c:'ok'
          });
        }

        lines.push({
          l:'Item not recovered',
          a:'',
          c:'info'
        });
      }

      /*
        Read carrier/proof only when their questions
        are actually relevant.
      */
      const carrier=
        carrierRelated
          ? yn('wn-yn-carrier')
          : '';

      const proof=
        proofRelevant
          ? yn('wn-yn-proof')
          : '';

      if(carrier==='yes'){
        protNote=
          'Carrier failure confirmed outside your control may support Whatnot protection (not guaranteed).';
      }

      if(proof==='yes'){
        protNote+=
          (protNote ? ' ' : '')+
          'Valid proof of shipment/drop-off may support seller protection.';
      }

      if(proof==='no'){
        protNote+=
          (protNote ? ' ' : '')+
          'Without valid proof of shipment, seller may be responsible for the refund/billback.';
      }
    }

    if(protStatus==='undecided'){
      protNote=
        'PROTECTION STATUS: UNDETERMINED — exposure shown before any protection decision. '+
        (protNote||'');
    }

    /*
      RESULT
    */
    $('wnResult').hidden=false;

    $('wnHeadline').textContent=
      'ESTIMATED SELLER LOSS';

    $('wnLossAmount').textContent=
      money(loss);

    $('wnBreakdown').innerHTML=
      lines.map(x=>
        '<div class="r-line '+x.c+'">'+
        '<span class="r-label">'+x.l+'</span>'+
        '<span class="r-dots"></span>'+
        '<span class="r-amt">'+x.a+'</span>'+
        '</div>'
      ).join('');

    $('wnExposureNote').textContent=
      'Refund / billback exposure: '+
      money(exposure)+
      ' · Value recovered: '+
      money(recovered)+
      ' · Estimated seller loss: '+
      money(loss)+
      '.';

    $('wnProtectionNote').textContent=
      protNote;

    $('wnFeeNote').textContent=
      'Fees (context only, not added to loss): '+
      'Whatnot commission not estimated (tiered by four-week sales — check Seller Hub). '+
      'Processing estimate: '+
      money(pf)+
      (rd.taxOnFees ? ' '+rd.taxLabel : '')+
      '. CLAWBACK estimate based on entered transaction info and applicable Whatnot rules.';

    const result={
      sale,
      feesLost:0,
      returnCost:0,
      valueLost:loss,
      total:loss,
      condition:'same',
      outcome:happened,
      platform:'Whatnot',
      lines:lines.map(x=>({
        label:x.l.toUpperCase(),
        amount:x.a,
        cls:x.c,
        cat:''
      }))
    };

    if(typeof renderReceipt==='function'){
      renderReceipt(result);
    }

    var cw=$('chartWrap');

    if(cw){
      cw.style.display='none';
    }

    if(typeof updateLetter==='function'){
      updateLetter(result);
    }

    if(typeof updateEvidence==='function'){
      updateEvidence(result);
    }

    /*
      Keep shared receipt/letter currency in sync.
      No currency conversion is performed.
    */
    const sym=getCurrencySymbol();

    if(sym!=='$'){

      const ap=$('appealLetter');

      if(ap){
        ap.value=
          ap.value.split('$').join(sym);
      }

      const tx=$('taxLine');

      if(tx){
        tx.value=
          tx.value.split('$').join(sym);
      }

      setTimeout(function(){

        const t=$('totalAmt');

        if(t){
          t.textContent=
            sym+
            (Math.round(loss*100)/100).toFixed(2);
        }

        const d=$('dcAmt');

        if(d){
          d.textContent=
            sym+
            (Math.round(loss*100)/100).toFixed(2);
        }

      },3000);
    }

    var act=$('actions');

    if(act){
      act.style.display='flex';
    }
  };

})();