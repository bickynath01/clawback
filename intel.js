/* CLAWBACK — intel.js : Platform Intel panel (fills the left column, updates with platform) */
const INTEL = {
  ebay:{title:'eBay',bullets:[
    'Final value fee 13.6% on most categories (books 15.3%, cards/coins 13.25%); per-order fee $0.30 (≤$10) / $0.40 (>$10).',
    'On a "not as described / damaged / wrong item" return, eBay refunds the 13.6% but KEEPS the per-order fee.',
    'If the buyer simply changed their mind, BOTH are refunded. If eBay stepped in and ruled against you, NEITHER is.',
    'You pay return shipping on "not as described" claims — often $8–$15 out of pocket.'],
    example:'A $60 not-as-described return with an $8.50 label and a ruined item ≈ <b>$43.90</b> lost.'},
  poshmark:{title:'Poshmark',bullets:[
    'Commission 20% (or $2.95 flat under $15); reversed on an approved return, and a prepaid label is provided.',
    'Fit / change-of-mind returns run through Seel (Worry-Free): Seel refunds the buyer, the item goes to Seel, you keep your earnings — $0 loss.',
    'Your real Poshmark loss is the item\u2019s value when it comes back worn, stained, or swapped.',
    'Overweight outbound labels ($5/$10/$15) are deducted from earnings; returns themselves are prepaid.'],
    example:'A $40 dress returned stained, now worth $15 = <b>$25.00</b> lost — fees and shipping covered.'},
  mercari:{title:'Mercari',bullets:[
    'The selling fee is BACK: 10% of (price + buyer shipping) since Jan 6, 2025; no separate seller processing fee.',
    'Approved returns under 50 lbs get a FREE prepaid label — you pay $0 return shipping.',
    'OVER 50 lbs (or over the size limit) YOU provide and pay the return label within 3 days, or the order is canceled.',
    'The 3.6% buyer-protection fee is charged to the buyer, not you.'],
    example:'A 60 lb forced return = you buy the label (~$16+) on top of the item\u2019s lost value.'},
  depop:{title:'Depop',bullets:[
    'No selling fee for US/UK/AUS sellers; payment processing is 3.3% + $0.45 (Depop Payments).',
    'When you refund via Depop Payments, ALL fees (selling, processing, boosting) are reversed automatically.',
    'So a Depop return\u2019s real cost is the item\u2019s value + any return shipping, not fees.',
    'US buyers get a prepaid return label; returns must ship within 7 days of being agreed.'],
    example:'A $30 tee returned damaged, now worth $10 = <b>$20.00</b> lost — fees fully reversed.'},
  whatnot:{title:'Whatnot',bullets:[
    'Commission is 8% on the item price (4% for Coins & Money and Pallets). Eligible categories get 0% on the portion above $1,500.',
    'The TRAP: payment processing is 2.9% + $0.30 on the GROSS order value — item + buyer shipping + buyer tax — money you never pocket.',
    'The $0.30 fixed fee is charged PER CHECKOUT, so a 5-item bundle from 5 separate bids costs you 5 × $0.30 = $1.50.',
    'Carrier weight clawbacks are deducted days after your stream when USPS/UPS re-weighs your package and finds it heavier than you guessed.'],
    example:'A $100 card with $8 buyer shipping + $5 tax + $4.50 weight clawback = <b>$12.73</b> in hidden fees. Advertised 8%, real take 12.7%.'},
  vinted:{title:'Vinted',bullets:[
    '$0 seller fees. No commission, no processing, no listing fee. You keep 100% of your listed price.',
    'The BUYER pays the platform: $0.70 + 5% Buyer Protection fee plus the prepaid shipping label.',
    'Returns are handled inside the app; the seller typically pays $0 in return shipping on approved claims.',
    'Optional paid boosts (Item Boost, Wardrobe Spotlight) are the only seller cost — and they\u2019re purely promotional.'],
    example:'A $50 item sold on Vinted = you keep <b>$50.00</b>. On Poshmark, the same item leaves you with $40. Vinted is your anchor.'}
};
function renderIntel(){
  const active = document.querySelector('.platform-btn.active');
  const key = active ? active.dataset.platform : 'ebay';
  const t = INTEL[key] || INTEL.ebay;
  let el = document.getElementById('intelPanel');
  if(!el){ el = document.createElement('div'); el.id='intelPanel'; el.className='intel';
    document.getElementById('calcBtn').insertAdjacentElement('afterend', el); }
  el.innerHTML =
    `<div class="intel-head">PLATFORM INTEL · ${t.title.toUpperCase()}</div>` +
    `<ul>${t.bullets.map(b=>`<li>${b}</li>`).join('')}</ul>` +
    `<div class="intel-ex">${t.example}</div>` +
    `<div class="intel-links"><a href="sources.html">Where our numbers come from →</a><a href="about.html">About CLAWBACK →</a></div>`;
}
document.querySelectorAll('.platform-btn').forEach(b => b.addEventListener('click', renderIntel));
renderIntel();
