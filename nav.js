/* CLAWBACK — nav.js : makes the mobile Menu button open/close the nav */
(function(){
  var t = document.querySelector('.nav-toggle');
  var l = document.getElementById('navlist');
  if(t && l){
    t.addEventListener('click', function(){
      var open = l.classList.toggle('open');
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
})();