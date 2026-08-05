/* ============================================================
   גדלים למחר · מנוע מצגות משותף (slides-core.js)
   נאמן לתבניות A-G כפי שאושרו ב-presentations/animation-demo.html
   כל קובץ lesson-XX-slides.html רק בונה .slide, המנוע מריץ ניווט+אנימציה
   ============================================================ */
(function(){
  const slides = document.querySelectorAll('.slide');
  const dotsEl = document.getElementById('dots');
  const counterEl = document.getElementById('counter');
  let i = 0, step = 0;

  slides.forEach((_,idx)=>{
    const d=document.createElement('div');
    d.className='dot'+(idx===0?' active':'');
    d.onclick=()=>{ i=idx; step=0; render(true); };
    dotsEl.appendChild(d);
  });

  function maxSteps(idx){ return parseInt(slides[idx].dataset.steps||'0'); }

  function runAutoAnim(slide){
    slide.querySelectorAll('.growbar[data-height]').forEach((b,idx)=>{
      b.style.height='0%';
      b.style.transitionDelay=(idx*.15)+'s';
      setTimeout(()=>{ b.style.height = b.dataset.height; }, 60);
    });
    slide.querySelectorAll('.counter[data-target]').forEach(c=>{
      const target = parseInt(c.dataset.target, 10);
      const suffix = c.dataset.suffix || '';
      let n = 0; clearInterval(c._timer);
      const stepSize = Math.max(1, Math.round(target/24));
      c._timer = setInterval(()=>{
        n += stepSize;
        if(n >= target){ n = target; clearInterval(c._timer); }
        c.textContent = n + suffix;
      }, 40);
    });
  }

  function render(reset){
    slides.forEach((s,idx)=>s.classList.toggle('active', idx===i));
    document.querySelectorAll('#dots .dot').forEach((d,idx)=>d.classList.toggle('active', idx===i));
    const ms = maxSteps(i);
    counterEl.textContent = (i+1)+' / '+slides.length + (ms ? '  ·  '+step+'/'+ms : '');

    const cur = slides[i];

    cur.querySelectorAll('.rv[data-step]').forEach(el=>{
      const st = parseInt(el.dataset.step, 10);
      el.classList.toggle('shown', st<=step);
    });

    cur.querySelectorAll('.pulse-at[data-step]').forEach(el=>{
      const st = parseInt(el.dataset.step, 10);
      if(step>=st){ el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
      else{ el.classList.remove('pulse'); }
    });

    cur.querySelectorAll('.draw-path[data-step]').forEach(el=>{
      const st = parseInt(el.dataset.step, 10);
      el.classList.toggle('go', step>=st);
    });

    if(reset){
      cur.querySelectorAll('.rv:not([data-step])').forEach(el=>el.classList.add('shown'));
      if(cur.classList.contains('auto-anim')) runAutoAnim(cur);
    }
  }

  function go(dir){
    const ms = maxSteps(i);
    if(dir>0){
      if(step < ms){ step++; render(false); return; }
      i = (i+1) % slides.length; step = 0; render(true);
    } else {
      if(step > 0){ step--; render(false); return; }
      i = (i-1+slides.length) % slides.length; step = maxSteps(i); render(true);
    }
  }
  window.slidesGo = go;

  document.addEventListener('keydown', e=>{
    if(e.key==='ArrowLeft' || e.key===' '){ e.preventDefault(); go(1); }
    if(e.key==='ArrowRight'){ e.preventDefault(); go(-1); }
  });

  const fsBtn = document.getElementById('fsbtn');
  if(fsBtn){
    fsBtn.addEventListener('click', ()=>{
      if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
      else document.exitFullscreen();
    });
  }

  render(true);
})();
