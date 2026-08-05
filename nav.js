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
