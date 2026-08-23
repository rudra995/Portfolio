(() => {
  // 'folder' | 'scrollstack' — flip to roll back to Folder, which is untouched below.
  const PROJECTS_DISPLAY = 'folder';

  function scrambleHeading(cat) {
    if (!cat || cat.dataset.scrambled) return;
    cat.dataset.scrambled = '1';
    const text = cat.textContent;
    const chars = '01</>#{}*+=-_';
    cat.textContent = '';
    const letters = text.split('');
    const timers = [];
    const spans = letters.map((letter) => {
      const span = document.createElement('span');
      span.textContent = letter === ' ' ? ' ' : letter;
      cat.appendChild(span);
      return span;
    });
    letters.forEach((letter, i) => {
      if (letter === ' ') return;
      const span = spans[i];
      const frames = 8 + Math.floor(Math.random() * 4);
      let frame = 0;
      timers.push(setTimeout(() => {
        const iv = setInterval(() => {
          frame++;
          if (frame >= frames) {
            span.textContent = letter;
            span.style.animation = 'letterPop .45s cubic-bezier(.34,1.56,.64,1)';
            clearInterval(iv);
          } else {
            span.textContent = chars[Math.floor(Math.random() * chars.length)];
          }
        }, 28);
        timers.push(iv);
      }, i * 35));
    });
    setTimeout(() => {
      timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
      spans.forEach((span, i) => { span.textContent = letters[i] === ' ' ? ' ' : letters[i]; });
    }, 2000);
  }

  function init() {
    const root = document;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Must run before the [data-reveal] scan below, since it builds the folder-item elements
    // that scan is looking for.
    if (PROJECTS_DISPLAY === 'scrollstack') initProjectScrollStack(); else initProjectFolders();

    const revealEls = root.querySelectorAll('[data-reveal]');
    const revealNow = (el) => {
      if (el.classList.contains('is-visible')) return;
      el.style.transition = 'none';
      el.classList.add('is-visible');
      el.style.opacity = '1';
      el.style.transform = 'none';
      void el.offsetHeight;
      el.style.transition = '';
      if (el.classList.contains('skill-row')) scrambleHeading(el.querySelector('.skill-cat'));
    };
    if (reduced) {
      revealEls.forEach(revealNow);
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealNow(entry.target);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      revealEls.forEach((el) => io.observe(el));
      const sweepReveal = () => {
        revealEls.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight * 1.1 && r.bottom > -window.innerHeight * 0.5) revealNow(el);
        });
      };
      sweepReveal();
      setTimeout(sweepReveal, 400);
      setTimeout(sweepReveal, 1200);
      window.addEventListener('scroll', sweepReveal, { passive: true });
    }

    const animateCounter = (el) => {
      const target = parseFloat(el.getAttribute('data-countup'));
      if (reduced || isNaN(target)) { el.textContent = String(target); return; }
      const dur = 1100;
      const start = performance.now();
      let done = false;
      const finish = () => { if (done) return; done = true; el.textContent = String(target); };
      const step = (now) => {
        if (done) return;
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toString();
        if (p < 1) requestAnimationFrame(step);
        else finish();
      };
      requestAnimationFrame(step);
      setTimeout(finish, 1800);
    };
    const counters = root.querySelectorAll('[data-countup]');
    const startedCounters = new WeakSet();
    const triggerCounter = (el) => {
      if (startedCounters.has(el)) return;
      startedCounters.add(el);
      animateCounter(el);
    };
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          triggerCounter(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => cio.observe(el));
    const sweepCounters = () => {
      counters.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.1 && r.bottom > -window.innerHeight * 0.5) triggerCounter(el);
      });
    };
    sweepCounters();
    setTimeout(sweepCounters, 400);
    setTimeout(sweepCounters, 1200);
    window.addEventListener('scroll', sweepCounters, { passive: true });

    const navLinks = Array.from(root.querySelectorAll('.rs-nav .pill-list a[href^="#"]'));
    const sections = navLinks
      .map((a) => root.querySelector(a.getAttribute('href')))
      .filter(Boolean);

    // IntersectionObserver crossing-detection turned out to be the wrong tool here: it only
    // samples a few times per frame, so a fast scroll can carry a section across a thin
    // detection band between two checks without ever reporting it — Skills got skipped
    // scrolling back up. And a short last section (Contact) may never reach a band placed
    // near the top of the viewport at all, since there's no more page left to scroll it into
    // place once you hit the bottom. Computing directly from live geometry on every scroll
    // tick sidesteps both: it can't "miss" a crossing, and the at-bottom case is handled
    // explicitly instead of depending on geometry that may be unreachable.
    const updateActiveSection = () => {
      if (!sections.length) return;
      const refY = window.innerHeight * 0.3;
      let current = sections[0];
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= refY) current = s;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) current = sections[sections.length - 1];
      const link = navLinks.find((a) => a.getAttribute('href') === '#' + current.id);
      if (link && link.getAttribute('aria-current') !== 'page') {
        navLinks.forEach((l) => l.removeAttribute('aria-current'));
        link.setAttribute('aria-current', 'page');
      }
    };

    const nav = root.querySelector('.rs-nav');
    const progress = root.querySelector('.scroll-progress');
    let ticking = false;
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(100, (y / max) * 100) : 0;
      if (progress) progress.style.width = pct + '%';
      if (nav) nav.classList.toggle('is-scrolled', y > 8);
      updateActiveSection();
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();

    splitHeroHeading(reduced);
    typeTerminal(reduced);
    initScrollHeadings(reduced);
    initPillNav();
  }

  function initPillNav() {
    const pills = Array.from(document.querySelectorAll('.rs-nav .pill'));
    if (!pills.length) return;

    // Ported from React Bits' PillNav: size + anchor each hover-circle so that scaling it
    // up from the bottom edge sweeps a perfect fill across the pill's actual rounded shape.
    const layout = () => {
      pills.forEach((pill) => {
        const circle = pill.querySelector('.hover-circle');
        if (!circle) return;
        const rect = pill.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (!w || !h) return;
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;
        circle.style.width = D + 'px';
        circle.style.height = D + 'px';
        circle.style.bottom = -delta + 'px';
        circle.style.transformOrigin = '50% ' + originY + 'px';
        pill.style.setProperty('--h', h + 'px');
      });
    };

    layout();
    window.addEventListener('resize', layout);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(layout).catch(() => { });
    }
  }

  function initScrollHeadings(reduced) {
    const headings = Array.from(document.querySelectorAll('.section-title'));
    if (!headings.length || reduced) return;

    headings.forEach((h) => {
      const label = h.textContent.trim();
      h.setAttribute('aria-label', label);
      h.classList.add('scroll-heading');
      h.textContent = '';
      const words = label.split(/\s+/);
      let charIndex = 0;
      words.forEach((word, wi) => {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'sr-word';
        wordSpan.setAttribute('aria-hidden', 'true');
        wordSpan.style.transitionDelay = (wi * 70) + 'ms';
        word.split('').forEach((ch) => {
          const charSpan = document.createElement('span');
          charSpan.className = 'sr-char';
          charSpan.textContent = ch;
          charSpan.style.transitionDelay = (charIndex * 18) + 'ms';
          wordSpan.appendChild(charSpan);
          charIndex++;
        });
        h.appendChild(wordSpan);
        if (wi < words.length - 1) h.appendChild(document.createTextNode(' '));
      });
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
    headings.forEach((h) => io.observe(h));
  }

  function splitHeroHeading(reduced) {
    const heading = document.getElementById('heroHeading');
    if (!heading || reduced) return;
    const targets = heading.querySelectorAll('[data-split]');
    targets.forEach((el) => {
      el.setAttribute('aria-hidden', 'true');
      const words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      words.forEach((word, i) => {
        const clip = document.createElement('span');
        clip.className = 'split-clip';
        const inner = document.createElement('span');
        inner.className = 'split-word';
        inner.textContent = word;
        inner.style.transitionDelay = (i * 45) + 'ms';
        clip.appendChild(inner);
        el.appendChild(clip);
        el.appendChild(document.createTextNode(' '));
      });
    });
    requestAnimationFrame(() => requestAnimationFrame(() => heading.classList.add('split-in')));
  }

  const TERMINAL_LINES = [
    { cmd: 'whoami', out: 'rudra_solanki' },
    { cmd: 'cat role.txt', out: 'Data Analyst · ML Engineer', accent: true },
    { cmd: 'cat location.txt', out: 'Bengaluru, India' },
    { cmd: 'cat education.txt', out: 'B.Tech IT, Manipal Institute of Technology · 2027' },
    { cmd: 'cat status.txt', out: 'Open to Data Analytics & ML internships' },
    { cmd: 'ls skills/', out: 'python fastapi docker langgraph databricks' },
    { cmd: 'cat contact.txt', out: 'rudrasolanki@outlook.in' }
  ];

  function typeTerminal(reduced) {
    const body = document.getElementById('terminalBody');
    if (!body) return;
    const renderStatic = () => {
      body.innerHTML = '';
      TERMINAL_LINES.forEach((line) => {
        const cmdP = document.createElement('p');
        cmdP.innerHTML = '<span class="prompt">$</span>' + line.cmd;
        body.appendChild(cmdP);
        const outP = document.createElement('p');
        outP.className = 'out' + (line.accent ? ' accent' : '');
        outP.textContent = line.out;
        body.appendChild(outP);
      });
      const finalP = document.createElement('p');
      finalP.innerHTML = '<span class="prompt">$</span><span class="cursor">▋</span>';
      body.appendChild(finalP);
    };
    if (reduced) { renderStatic(); return; }

    let cancelled = false;
    const run = async () => {
      const wait = (ms) => new Promise((resolve) => {
        const id = setTimeout(resolve, ms);
        if (cancelled) clearTimeout(id);
      });
      for (const line of TERMINAL_LINES) {
        if (cancelled) return;
        const cmdP = document.createElement('p');
        const promptSpan = document.createElement('span');
        promptSpan.className = 'prompt';
        promptSpan.textContent = '$';
        const cmdSpan = document.createElement('span');
        cmdP.appendChild(promptSpan);
        cmdP.appendChild(cmdSpan);
        body.appendChild(cmdP);
        for (let i = 0; i < line.cmd.length; i++) {
          if (cancelled) return;
          cmdSpan.textContent += line.cmd[i];
          await wait(2 + Math.random() * 3);
        }
        await wait(25);
        const outP = document.createElement('p');
        outP.className = 'out' + (line.accent ? ' accent' : '');
        outP.textContent = line.out;
        body.appendChild(outP);
        await wait(45);
      }
      if (cancelled) return;
      const finalP = document.createElement('p');
      finalP.innerHTML = '<span class="prompt">$</span><span class="cursor">▋</span>';
      body.appendChild(finalP);
    };
    setTimeout(run, 300);
    window.addEventListener('pagehide', () => { cancelled = true; });
  }

  // Fill in real project URLs here once you have them — placeholders link nowhere yet.
  const PROJECTS = [
    {
      title: 'Drifting Oracle',
      blurb: 'Drift-aware credit-risk scoring system using Population Stability Index to auto-trigger XGBoost retraining, improving AUC from 0.73 to 0.76.',
      tags: ['FastAPI', 'Python', 'Databricks', 'XGBoost', 'LangGraph'],
      link: '#'
    },
    {
      title: 'PitWall',
      blurb: 'Multi-agent RAG system (6 agents + orchestrator) answering race-analytics queries over 30K+ records via ChromaDB and Groq LLMs.',
      tags: ['Python', 'FastAPI', 'React', 'ChromaDB', 'Groq'],
      link: '#'
    },
    {
      title: 'QuantForge',
      blurb: 'Event-driven backtesting engine simulating trade execution across a 4-stage pipeline, validated with 126 pytest tests.',
      tags: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker'],
      link: '#'
    }
  ];

  // Shared project-detail modal — used by whichever Projects display variant is active.
  // Image + description + tool tags + link, all fed from one PROJECTS array.
  function createProjectModal() {
    const modal = document.createElement('div');
    modal.className = 'project-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="project-modal-backdrop"></div>' +
      '<div class="project-modal-panel" role="dialog" aria-modal="true" aria-labelledby="projectModalTitle">' +
      '<button type="button" class="project-modal-close" aria-label="Close">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>' +
      '</button>' +
      '<div class="project-modal-image"><span class="initials"></span></div>' +
      '<div class="project-modal-body">' +
      '<h3 class="project-modal-title" id="projectModalTitle"></h3>' +
      '<p class="project-modal-blurb"></p>' +
      '<div class="project-modal-tags"></div>' +
      '<a class="btn btn-primary project-modal-link" target="_blank" rel="noopener">View Project</a>' +
      '</div></div>';
    document.body.appendChild(modal);

    const backdrop = modal.querySelector('.project-modal-backdrop');
    const closeBtn = modal.querySelector('.project-modal-close');
    const imgEl = modal.querySelector('.project-modal-image .initials');
    const titleEl = modal.querySelector('.project-modal-title');
    const blurbEl = modal.querySelector('.project-modal-blurb');
    const tagsEl = modal.querySelector('.project-modal-tags');
    const linkEl = modal.querySelector('.project-modal-link');

    let isOpen = false;
    let activeTrigger = null;
    let onCloseExtra = null;

    const open = (project, triggerEl, onClose) => {
      activeTrigger = triggerEl;
      onCloseExtra = onClose || null;
      imgEl.textContent = project.title.slice(0, 2).toUpperCase();
      titleEl.textContent = project.title;
      blurbEl.textContent = project.blurb;
      tagsEl.innerHTML = '';
      project.tags.forEach((t) => {
        const span = document.createElement('span');
        span.className = 'tag tag-outline';
        span.textContent = t;
        tagsEl.appendChild(span);
      });
      linkEl.href = project.link;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      isOpen = true;
      closeBtn.focus();
    };

    const close = () => {
      if (!isOpen) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      if (onCloseExtra) onCloseExtra();
      if (activeTrigger) activeTrigger.focus();
      isOpen = false;
      activeTrigger = null;
      onCloseExtra = null;
    };

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (isOpen && e.key === 'Escape') close(); });

    return { open, close };
  }

  // Folder (React Bits) as the Projects grid trigger: click plays the folder's native
  // open/flap animation and opens the modal with the actual project details, since a
  // folder's small "papers" aren't roomy enough for an image + description + tags + link.
  function initProjectFolders() {
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;
    grid.className = 'folder-grid';

    const hint = document.createElement('p');
    hint.className = 'folder-hint';
    hint.textContent = 'Click a folder to open it.';
    grid.before(hint);

    const modal = createProjectModal();

    PROJECTS.forEach((project) => {
      const item = document.createElement('div');
      item.className = 'folder-item';
      item.setAttribute('data-reveal', '');

      const folder = document.createElement('div');
      folder.className = 'folder';
      folder.tabIndex = 0;
      folder.setAttribute('role', 'button');
      folder.setAttribute('aria-expanded', 'false');
      folder.setAttribute('aria-label', 'Open ' + project.title + ' project details');
      folder.innerHTML =
        '<div class="folder__back">' +
        '<div class="paper paper-1"></div><div class="paper paper-2"></div><div class="paper paper-3"></div>' +
        '<div class="folder__front"></div><div class="folder__front right"></div>' +
        '</div>';

      const activate = () => {
        folder.classList.add('open');
        folder.setAttribute('aria-expanded', 'true');
        modal.open(project, folder, () => {
          folder.classList.remove('open');
          folder.setAttribute('aria-expanded', 'false');
        });
      };
      folder.addEventListener('click', activate);
      folder.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });

      const label = document.createElement('span');
      label.className = 'folder-label';
      label.textContent = project.title;

      item.appendChild(folder);
      item.appendChild(label);
      grid.appendChild(item);
    });
  }

  // ScrollStack (React Bits), useWindowScroll mode — cards pin one behind another and scale
  // down as you scroll past, forming a stack. Ported the pin/scale math directly from the
  // source; Lenis (the smooth-scroll library the demo wraps scrolling in) is intentionally
  // skipped — it would take over scroll physics for the *entire* page, not just this section,
  // and the stacking effect itself doesn't depend on it. Driven by native window scroll instead.
  function initProjectScrollStack() {
    const mount = document.getElementById('projectsGrid');
    if (!mount) return;
    mount.className = 'scroll-stack-inner';

    const modal = createProjectModal();
    const cards = [];

    PROJECTS.forEach((project) => {
      const card = document.createElement('div');
      card.className = 'scroll-stack-card';
      card.innerHTML =
        '<div class="ss-card-image"><span class="initials">' + project.title.slice(0, 2).toUpperCase() + '</span></div>' +
        '<div class="ss-card-body">' +
        '<h3 class="ss-card-title">' + project.title + '</h3>' +
        '<p class="ss-card-desc">' + project.blurb + '</p>' +
        '<button type="button" class="btn btn-primary ss-card-more">Read more</button>' +
        '</div>';
      const moreBtn = card.querySelector('.ss-card-more');
      moreBtn.addEventListener('click', () => modal.open(project, moreBtn));
      mount.appendChild(card);
      cards.push(card);
    });

    const endEl = document.createElement('div');
    endEl.className = 'scroll-stack-end';
    mount.appendChild(endEl);

    if (!cards.length) return;

    const ITEM_DISTANCE = 100;
    const ITEM_SCALE = 0.03;
    const ITEM_STACK_DISTANCE = 30;
    const STACK_POSITION_PCT = 20;
    const SCALE_END_POSITION_PCT = 10;
    const BASE_SCALE = 0.85;

    cards.forEach((card, i) => {
      if (i < cards.length - 1) card.style.marginBottom = ITEM_DISTANCE + 'px';
      card.style.willChange = 'transform';
      card.style.transformOrigin = 'top center';
      card.style.backfaceVisibility = 'hidden';
    });

    // Natural (untransformed) document-relative offsets, cached rather than re-read from
    // getBoundingClientRect() on every scroll tick — a pinned card's rect reflects its
    // already-applied transform, so re-deriving "top" from it would feed the offset back
    // into itself and drift. Re-measured (with transforms cleared first) on resize only.
    let cardTops = [];
    let endTop = 0;

    const measure = () => {
      cards.forEach((card) => { card.style.transform = 'none'; });
      const scrollTop = window.scrollY;
      cardTops = cards.map((card) => card.getBoundingClientRect().top + scrollTop);
      endTop = endEl.getBoundingClientRect().top + scrollTop;
    };

    const calcProgress = (scrollTop, start, end) => {
      if (scrollTop < start) return 0;
      if (scrollTop > end) return 1;
      return (scrollTop - start) / (end - start);
    };

    const update = () => {
      const scrollTop = window.scrollY;
      const containerHeight = window.innerHeight;
      const stackPositionPx = (STACK_POSITION_PCT / 100) * containerHeight;
      const scaleEndPositionPx = (SCALE_END_POSITION_PCT / 100) * containerHeight;
      const pinEnd = endTop - containerHeight / 2;

      cards.forEach((card, i) => {
        const cardTop = cardTops[i];
        const triggerStart = cardTop - stackPositionPx - ITEM_STACK_DISTANCE * i;
        const triggerEnd = cardTop - scaleEndPositionPx;
        const pinStart = triggerStart;

        const scaleProgress = calcProgress(scrollTop, triggerStart, triggerEnd);
        const targetScale = BASE_SCALE + i * ITEM_SCALE;
        const scale = 1 - scaleProgress * (1 - targetScale);

        let translateY = 0;
        if (scrollTop >= pinStart && scrollTop <= pinEnd) {
          translateY = scrollTop - cardTop + stackPositionPx + ITEM_STACK_DISTANCE * i;
        } else if (scrollTop > pinEnd) {
          translateY = pinEnd - cardTop + stackPositionPx + ITEM_STACK_DISTANCE * i;
        }

        card.style.transform = 'translate3d(0,' + translateY.toFixed(2) + 'px,0) scale(' + scale.toFixed(3) + ')';
      });
    };

    measure();
    update();

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false; }); }
    }, { passive: true });
    window.addEventListener('resize', () => { measure(); update(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
