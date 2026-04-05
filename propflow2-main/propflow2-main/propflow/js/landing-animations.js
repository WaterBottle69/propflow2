/**
 * PropFlow — Landing Page Animations
 * Inspired by sirnik.co: smooth scroll, scrubbed reveals,
 * sticky features panel, horizontal title sweep, marquee ticker.
 */
(function () {
  'use strict';

  /* ── 1. LENIS SMOOTH SCROLL ─────────────────────────────────── */
  const lenis = new Lenis({
    autoRaf: false,
    lerp: 0.08,
    smoothWheel: true,
    syncTouch: false,
  });

  function raf(time) {
    lenis.raf(time);
    ScrollTrigger.update();
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  /* ── 2. PRELOADER ───────────────────────────────────────────── */
  const html   = document.documentElement;
  const slices = document.querySelectorAll('.preloader_slice');
  const logoEl = document.getElementById('preloader_logo');
  const fillEl = document.getElementById('preloader_fill');
  const pctEl  = document.getElementById('preloader_pct');

  gsap.to(logoEl, { opacity: 1, duration: .5, delay: .12, ease: 'power2.out' });

  let pct = 0;
  const countUp = setInterval(() => {
    pct = Math.min(pct + Math.random() * 14, 88);
    if (fillEl) fillEl.style.width = pct + '%';
    if (pctEl) pctEl.textContent = Math.floor(pct) + '%';
    if (pct >= 88) clearInterval(countUp);
  }, 70);

  function finishPreloader(onDone) {
    clearInterval(countUp);
    if (fillEl) {
      fillEl.style.transition = 'width .3s ease';
      fillEl.style.width = '100%';
    }
    if (pctEl) pctEl.textContent = '100%';

    setTimeout(() => {
      gsap.to(slices, {
        yPercent: -120,
        duration: .85,
        ease: 'power4.inOut',
        stagger: .07,
        onComplete: () => {
          const loader = document.getElementById('preloader');
          if (loader) loader.style.display = 'none';
          html.classList.remove('is-preloading');
          document.body.classList.remove('is-preloading');
          onDone();
        },
      });
    }, 300);
  }

  /* ── 3. HERO INTRO ANIMATION ────────────────────────────────── */
  function runHeroIntro() {
    // Nav items — blur-fade in from top
    const navItems = document.querySelectorAll('[data-stagger="nav"][data-anim="in"]');
    gsap.set(navItems, { autoAlpha: 0, y: -10, filter: 'blur(8px)' });
    gsap.to(navItems, {
      autoAlpha: 1, y: 0, filter: 'blur(0px)',
      duration: .65, ease: 'power3.out',
      stagger: .06, delay: .2,
    });

    // Hero eyebrow
    const eyebrow = document.querySelector('.hero_eyebrow');
    if (eyebrow) {
      gsap.from(eyebrow, {
        autoAlpha: 0, y: 14, filter: 'blur(8px)',
        duration: .7, ease: 'power3.out', delay: .1,
      });
    }

    // Hero h1 — lines slide up from below
    const heroH1 = document.querySelector('.hero_h1');
    if (heroH1) {
      const split = new SplitType(heroH1, { types: 'lines' });
      gsap.set(split.lines, { yPercent: 112, opacity: 0 });
      gsap.to(split.lines, {
        yPercent: 0, opacity: 1,
        duration: .9, ease: 'power4.out',
        stagger: .1, delay: .2,
      });
    }

    // Hero desc — lines slide up
    const heroDesc = document.querySelector('.hero_desc');
    if (heroDesc) {
      const splitDesc = new SplitType(heroDesc, { types: 'lines' });
      gsap.set(splitDesc.lines, { yPercent: 112, opacity: 0 });
      gsap.to(splitDesc.lines, {
        yPercent: 0, opacity: 1,
        duration: .8, ease: 'power4.out',
        stagger: .08, delay: .5,
      });
    }

    // Hero CTA group
    const ctaGroup = document.querySelector('.hero_cta_group');
    if (ctaGroup) {
      gsap.from(ctaGroup, {
        autoAlpha: 0, y: 18, filter: 'blur(8px)',
        duration: .7, ease: 'power3.out', delay: .8,
      });
    }
  }

  /* ── 4. MARQUEE TICKER ──────────────────────────────────────── */
  function initMarquee() {
    const inner = document.querySelector('.marquee_inner');
    if (!inner) return;

    // Clone sets for seamless loop
    const sets = inner.querySelectorAll('.marquee_set');
    sets.forEach(s => inner.appendChild(s.cloneNode(true)));

    const totalW = inner.scrollWidth / 2;
    gsap.fromTo(inner,
      { x: 0 },
      {
        x: -totalW,
        duration: 35,
        ease: 'none',
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize(x => parseFloat(x) % totalW),
        },
      }
    );
  }

  /* ── 5. HORIZONTAL TITLE SWEEP (scrubbed) ───────────────────── */
  function initHorizontalSweep() {
    const track = document.getElementById('h-sweep');
    if (!track) return;

    gsap.fromTo(track,
      { x: 0 },
      {
        x: '-25%',
        ease: 'none',
        scrollTrigger: {
          trigger: '.h_sweep',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      }
    );
  }

  /* ── 6. SCRUBBED INTRO TEXT ─────────────────────────────────── */
  function initIntroScrub() {
    const introH2 = document.querySelector('.intro_h2');
    if (!introH2) return;

    // Split into words and animate them in from the right, scrubbed to scroll
    const split = new SplitType(introH2, { types: 'words' });
    gsap.set(split.words, { x: 60, autoAlpha: 0 });
    gsap.to(split.words, {
      x: 0, autoAlpha: 1,
      stagger: 0.03,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: introH2,
        start: 'top 80%',
        end: 'top 35%',
        scrub: 0.7,
      },
    });

    // Intro paragraphs — line-by-line reveal
    document.querySelectorAll('.intro_p').forEach(el => {
      const s = new SplitType(el, { types: 'lines' });
      gsap.set(s.lines, { yPercent: 110, opacity: 0 });
      gsap.to(s.lines, {
        yPercent: 0, opacity: 1,
        duration: .75, ease: 'power4.out',
        stagger: .07,
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          once: true,
        },
      });
    });
  }

  /* ── 7. STICKY FEATURES PANEL ───────────────────────────────── */
  function initStickyFeatures() {
    const items  = document.querySelectorAll('.feature_item');
    const fpNum  = document.getElementById('fp-num');
    const fpTitle= document.getElementById('fp-title');
    const fpDesc = document.getElementById('fp-desc');
    const fpTag  = document.getElementById('fp-tag');
    const fpBar  = document.getElementById('fp-bar');

    if (!items.length || !fpNum) return;

    // Set first item active immediately
    items[0].classList.add('is-active');

    items.forEach((item, i) => {
      ScrollTrigger.create({
        trigger: item,
        start: 'top 58%',
        end: 'bottom 42%',
        onEnter:     () => activateFeature(i),
        onEnterBack: () => activateFeature(i),
      });
    });

    function activateFeature(i) {
      items.forEach(f => f.classList.remove('is-active'));
      items[i]?.classList.add('is-active');

      const item = items[i];
      if (!item) return;

      const progress = ((i + 1) / items.length * 100) + '%';

      // Animate panel content swap
      const targets = [fpNum, fpTitle, fpDesc, fpTag].filter(Boolean);
      gsap.to(targets, {
        y: -10, autoAlpha: 0,
        duration: .18, ease: 'power2.in',
        stagger: .02,
        onComplete: () => {
          if (fpNum)   fpNum.textContent   = item.dataset.num;
          if (fpTitle) fpTitle.textContent = item.dataset.title;
          if (fpDesc)  fpDesc.textContent  = item.dataset.desc;
          if (fpTag)   fpTag.textContent   = item.dataset.tag;
          if (fpBar)   fpBar.style.width   = progress;

          gsap.to(targets, {
            y: 0, autoAlpha: 1,
            duration: .32, ease: 'power3.out',
            stagger: .04,
          });
        },
      });
    }
  }

  /* ── 8. SCROLL REVEAL ANIMATIONS ────────────────────────────── */
  function initScrollAnimations() {
    gsap.registerPlugin(ScrollTrigger);

    // Generic fade+blur+y for [data-anim="in"] (excluding nav items)
    document.querySelectorAll('[data-anim="in"]:not([data-stagger="nav"])').forEach(el => {
      gsap.from(el, {
        autoAlpha: 0, y: 22, filter: 'blur(10px)',
        duration: .75, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    // [data-anim="lines"] — split text reveals (non-hero)
    document.querySelectorAll('[data-anim="lines"]').forEach(el => {
      if (el.closest('.hero') || el.closest('.intro_h2')) return;

      const split = new SplitType(el, { types: 'lines' });
      gsap.set(split.lines, { yPercent: 112, opacity: 0 });
      gsap.to(split.lines, {
        yPercent: 0, opacity: 1,
        duration: .8, ease: 'power4.out',
        stagger: .08,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    // How-it-works steps
    gsap.from('.how_step', {
      autoAlpha: 0, y: 26, filter: 'blur(8px)',
      duration: .65, ease: 'power3.out',
      stagger: .12,
      scrollTrigger: { trigger: '.how_steps', start: 'top 88%', once: true },
    });

    // Pricing cards — 3D perspective entrance
    gsap.from('.plan_card', {
      autoAlpha: 0,
      y: 36,
      rotateX: 8,
      scale: 0.94,
      filter: 'blur(6px)',
      duration: .75,
      ease: 'power4.out',
      stagger: .1,
      scrollTrigger: { trigger: '.pricing_grid', start: 'top 88%', once: true },
      onStart() {
        document.querySelector('.pricing_grid')?.style.setProperty('perspective', '1200px');
      },
    });

    // Integration chips — staggered wave
    gsap.from('.int_chip', {
      autoAlpha: 0, y: 16, scale: 0.92,
      duration: .5, ease: 'back.out(1.4)',
      stagger: .04,
      scrollTrigger: { trigger: '.int_chips', start: 'top 88%', once: true },
    });

    // AI demo terminal
    gsap.from('.demo_terminal', {
      autoAlpha: 0, y: 36, filter: 'blur(14px)',
      duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.demo_terminal', start: 'top 88%', once: true },
    });

    // Features header row
    gsap.from('.features_header_h2', {
      autoAlpha: 0, y: 20,
      duration: .75, ease: 'power3.out',
      scrollTrigger: { trigger: '.features_header_row', start: 'top 88%', once: true },
    });

    // Intro label
    const introLabel = document.querySelector('.intro_label');
    if (introLabel) {
      gsap.from(introLabel, {
        autoAlpha: 0, x: -14,
        duration: .6, ease: 'power3.out',
        scrollTrigger: { trigger: introLabel, start: 'top 88%', once: true },
      });
    }

    // CTA section — dramatic entrance
    const ctaH2 = document.querySelector('.cta_h2');
    if (ctaH2) {
      const split = new SplitType(ctaH2, { types: 'lines' });
      gsap.set(split.lines, { yPercent: 112, opacity: 0 });
      gsap.to(split.lines, {
        yPercent: 0, opacity: 1,
        duration: .9, ease: 'power4.out',
        stagger: .1,
        scrollTrigger: { trigger: ctaH2, start: 'top 88%', once: true },
      });
    }
  }

  /* ── 9. SMOOTH ANCHOR SCROLL ────────────────────────────────── */
  function initAnchorScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          lenis.scrollTo(target, { offset: -80, duration: 1.4 });
        }
      });
    });
  }

  /* ── 10. BOOT ───────────────────────────────────────────────── */
  window.addEventListener('load', () => {
    finishPreloader(() => {
      runHeroIntro();
      initMarquee();
      initHorizontalSweep();
      initIntroScrub();
      initStickyFeatures();
      initScrollAnimations();
      initAnchorScroll();
    });
  });

})();
