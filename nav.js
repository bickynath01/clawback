/* CLAWBACK — nav.js : mobile menu toggle + floating "back to top" arrow */
(function(){
  /* --- mobile menu --- */
  var t = document.querySelector('.nav-toggle'), l = document.getElementById('navlist');
  if(t && l){
    t.addEventListener('click', function(){
      var o = l.classList.toggle('open');
      t.setAttribute('aria-expanded', o ? 'true' : 'false');
    });
  }

  /* --- floating back-to-top arrow --- */
  var b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', 'Back to top');
  b.textContent = '↑';
  b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:90;width:48px;height:48px;' +
    'border-radius:50%;border:2px solid #F5B301;background:#0E3B2C;color:#F5B301;' +
    'font-size:20px;font-weight:700;cursor:pointer;display:none;' +
    'box-shadow:0 6px 18px rgba(0,0,0,.4);';
  document.body.appendChild(b);

  function onScroll(){ b.style.display = (window.scrollY > 500) ? 'block' : 'none'; }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  b.addEventListener('click', function(){ window.scrollTo({top:0, behavior:'smooth'}); });
})();
/* ============================================================
   CLAWBACK — add Whatnot & Vinted everywhere (footer + header)
   ============================================================ */
(function addMissingPlatforms(){
  /* FOOTER: keep the 4 old platforms left, put Whatnot & Vinted on the RIGHT */
  var footNav = document.querySelector('footer .foot-col[aria-label="Platforms"]');
  if (footNav) {
    var firstUl = footNav.querySelector('ul');
    if (firstUl && !footNav.querySelector('.foot-plat')) {
      var wrap = document.createElement('div');
      wrap.className = 'foot-plat';
      var secondUl = document.createElement('ul');
      secondUl.innerHTML =
        '<li><a href="platforms.html#whatnot">Whatnot</a></li>' +
        '<li><a href="platforms.html#vinted">Vinted</a></li>';
      firstUl.parentNode.insertBefore(wrap, firstUl);
      wrap.appendChild(firstUl);
      wrap.appendChild(secondUl);
    }
  }
  /* HEADER dropdown: add them on older pages that only show 4 platforms */
  var drop = document.querySelector('.main-nav .drop');
  if (drop && !drop.querySelector('a[href="platforms.html#whatnot"]')) {
    drop.insertAdjacentHTML('beforeend',
      '<li><a href="platforms.html#whatnot">Whatnot</a></li>' +
      '<li><a href="platforms.html#vinted">Vinted</a></li>');
  }
})();
