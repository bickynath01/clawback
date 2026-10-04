/* ============================================================
   CLAWBACK — poshmark-calc.js  (Poshmark forced-return loss)
   Seller-truth model: money out − value back − money back = loss.
   Fee is INFORMATIONAL only (never auto-added/subtracted).
   Never invents reimbursements, depreciation, or protection payouts.
   USD, two-decimal display.
   ============================================================ */
(function(){
  const $ = id => document.getElementById(id);
  const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);

  const FALLBACK_POSHMARK = {
    fees: { under15: { threshold: 15, flatFee: 2.95 }, fifteenAndOver: { percentage: 0.20 } },
    shipping: { standardBuyerPaid: 6.49, carrier: 'USPS Ground Advantage' },
    returns: { standardIssueWindowDays: 3, prepaidReturnLabel: true },
    sellerProtection: { reimbursement: 'actual amount only', automaticCompensation: false },
    seelWorryFreeReturns: { includedInStandardLossCalculator: false }
  };
  let POSHMARK = FALLBACK_POSHMARK;

  fetch('fees.json').then(r => r.ok ? r.json() : Promise.reject())
    .then(d => { if(d && d.poshmark && d.poshmark.fees){ POSHMARK = Object.assign({}, FALLBACK_POSHMARK, d.poshmark); } })
    .catch(()=>{});

  function yn(cls){ const el = document.querySelector('.' + cls + '.active'); return el ? el.getAttribute('data-val') : ''; }
  function fee(sale){ return sale < POSHMARK.fees.under15.threshold ? POSHMARK.fees.under15.flatFee : sale * POSHMARK.fees.fifteenAndOver.percentage; }

  window.calculatePoshmark = function(){
    const sale = parseFloat($('poshmarkSalePrice').value);
    if(isNaN(sale) || sale < 0){ alert('Please enter the original sale price.'); return; }
    const buyerShip = parseFloat($('poshmarkBuyerShipping').value) || 0;
    const happened = $('poshmarkWhatHappened').value;
    if(!happened){ alert('Please tell us what happened to this order.'); return; }

    const estFee = fee(sale);
    const feeLine = 'Poshmark selling fee (transaction context, not counted as loss): ' + money(estFee);
    let loss = 0, headline = '', explanation = '';
    const lines = [];
    let completed = true;

    /* ===== NO REFUND ===== */
    if(happened === 'no'){
      completed = false;
      headline = 'NO COMPLETED REFUND';
      explanation = 'No completed buyer refund was entered, so this is not counted as a completed seller loss.';

    /* ===== PARTIAL REFUND ===== */
    } else if(happened === 'partial'){
      const refund = parseFloat($('poshmarkPartialAmount').value);
      if(isNaN(refund) || refund <= 0){ alert('Please enter how much you refunded the buyer.'); return; }
      const expense = yn('poshmark-yn-p-expense') === 'yes' ? (parseFloat($('poshmarkPartialExpenseCost').value) || 0) : 0;
      const reimb = yn('poshmark-yn-p-reimb') === 'yes' ? (parseFloat($('poshmarkPartialReimbAmt').value) || 0) : 0;
      loss = Math.max(0, refund + expense - reimb);
      lines.push({l:'You refunded', a:money(refund), c:'loss'});
      if(expense > 0) lines.push({l:'You paid out of pocket', a:money(expense), c:'loss'});
      if(reimb > 0) lines.push({l:'You were reimbursed', a:'-' + money(reimb), c:'ok'});
      lines.push({l:'Buyer kept the item', a:'', c:'info'});
      explanation = 'The buyer kept the item, so the refund itself is the primary unrecovered amount.';

    /* ===== FULL REFUND ===== */
    } else {
      const returned = yn('poshmark-yn-returned');
      if(!returned){ alert('Please tell us if you got the item back.'); return; }
      const actualRefund = parseFloat($('poshmarkFullActualRefund').value) || 0;
      const refundExposure = actualRefund > 0 ? actualRefund : sale;
      const derived = actualRefund <= 0;
      let warn = '';
      if(actualRefund > (sale + buyerShip)) warn = ' (You entered a refund larger than the sale + buyer shipping — using your actual amount.)';

      if(returned === 'yes'){
        const condition = $('poshmarkCondition').value;
        if(!condition){ alert('Please select the returned condition.'); return; }
        const value = parseFloat($('poshmarkCurrentValue').value);
        if(isNaN(value) || value < 0){ alert('Please enter what you could realistically sell it for now.'); return; }
        const expense = yn('poshmark-yn-expense') === 'yes' ? (parseFloat($('poshmarkExpenseCost').value) || 0) : 0;
        const reimb = yn('poshmark-yn-reimb') === 'yes' ? (parseFloat($('poshmarkReimbAmt').value) || 0) : 0;
        loss = Math.max(0, refundExposure + expense - value - reimb);
        lines.push({l:'You refunded' + (derived ? ' (estimated)' : ''), a:money(refundExposure), c:'loss'});
        lines.push({l:'Returned item value', a:'-' + money(value), c:'ok'});
        if(expense > 0) lines.push({l:'You paid out of pocket', a:money(expense), c:'loss'});
        if(reimb > 0) lines.push({l:'You were reimbursed', a:'-' + money(reimb), c:'ok'});
        explanation = 'You got the item back, so its current resale value offsets part of the refund.' +
          (condition !== 'same' ? ' The returned item\u2019s lower current value is counted as the value you recovered.' : '') + warn;
      } else {
        const why = $('poshmarkNotReturnedWhy').value;
        if(!why){ alert('Please tell us why you don\u2019t have the item.'); return; }
        const reimb = yn('poshmark-yn-n-reimb') === 'yes' ? (parseFloat($('poshmarkNotReimbAmt').value) || 0) : 0;
        loss = Math.max(0, refundExposure - reimb);
        lines.push({l:'You refunded' + (derived ? ' (estimated)' : ''), a:money(refundExposure), c:'loss'});
        if(reimb > 0) lines.push({l:'You were reimbursed', a:'-' + money(reimb), c:'ok'});
        lines.push({l:'Item not recovered', a:'', c:'info'});
        explanation = 'You refunded the buyer but did not recover the item. Any confirmed reimbursement reduces the remaining loss.' + warn;
      }
    }

    /* Render */
    $('poshmarkResult').hidden = false;
    $('poshmarkLossAmount').textContent = completed ? money(loss) : '—';
       /* FIX #2: Use "REFUND" for partial, "RETURN" for full */
    let headlineText = completed ? ('THIS RETURN COST YOU ' + money(loss)) : headline;
    if(happened === 'partial') headlineText = 'THIS REFUND COST YOU ' + money(loss);
    $('poshmarkHeadline').textContent = headlineText;
    $('poshmarkBreakdown').innerHTML = lines.map(x =>
      '<div class="r-line ' + x.c + '"><span class="r-label">' + x.l + '</span><span class="r-dots"></span><span class="r-amt">' + x.a + '</span></div>').join('');
    $('poshmarkExplanation').textContent = explanation;
    $('poshmarkFeeNote').textContent = feeLine + ' · Buyer-paid shipping: ' + money(buyerShip) + ' (context only). ' +
      'Estimated seller loss based on the transaction details entered. CLAWBACK does not verify your Poshmark account records.';

    if(completed){
      const result = { sale, feesLost:0, returnCost:0, valueLost:loss, total:loss,
        condition:'same', outcome:happened, platform:'Poshmark',
        lines: lines.map(x => ({label:x.l.toUpperCase(), amount:x.a, cls:x.c, cat:''})) };
      if(typeof renderReceipt === 'function') renderReceipt(result);
      const cw = $('chartWrap'); if(cw) cw.style.display = 'none';
      if(typeof updateLetter === 'function') updateLetter(result);
      if(typeof updateEvidence === 'function') updateEvidence(result);
      const act = $('actions'); if(act) act.style.display = 'flex';
    }
  };
})();