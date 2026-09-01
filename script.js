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
    initTiltedCard(reduced);
    initGithubChart();
    initDashboardCoverflow(reduced);
  }

  // Scroll-linked coverflow for the Dashboards section. Rather than hijacking wheel/touch
  // events (janky, breaks trackpads and accessibility), the section is made tall in JS and
  // pinned via CSS `position: sticky`; scroll progress through that extra height is mapped
  // to a continuous "active slide" float, and every slide's transform is derived from its
  // distance from that value. Scrolling further just keeps advancing progress, which reads
  // as paging through the carousel before the section finally scrolls past.
  function initDashboardCoverflow(reduced) {
    const section = document.getElementById('dashboards');
    const track = document.getElementById('dashboardTrack');
    const dotsEl = document.getElementById('dashboardDots');
    const heat = document.getElementById('cfHeat');
    if (!section || !track) return;

    if (heat && !heat.children.length) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 48; i++) {
        const cell = document.createElement('span');
        cell.style.setProperty('--v', Math.round(15 + Math.random() * 70) + '%');
        frag.appendChild(cell);
      }
      heat.appendChild(frag);
    }

    const slides = Array.from(track.children);
    const count = slides.length;
    if (!count) return;

    if (reduced) {
      section.classList.add('is-reduced');
      return;
    }

    dotsEl.innerHTML = slides
      .map((_, i) => '<button type="button" class="coverflow-dot" aria-label="Go to dashboard ' + (i + 1) + '"></button>')
      .join('');
    const dots = Array.from(dotsEl.children);

    const VH_PER_SLIDE = 90;
    const setHeight = () => {
      section.style.height = (100 + (count - 1) * VH_PER_SLIDE) + 'vh';
    };
    setHeight();

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(Math.max(-rect.top / scrollable, 0), 1) : 0;
      const active = progress * (count - 1);
      const stageWidth = slides[0].offsetWidth;

      slides.forEach((slide, i) => {
        const offset = i - active;
        const abs = Math.min(Math.abs(offset), 3);
        const translateX = offset * (stageWidth * 0.62);
        const rotateY = Math.max(-48, Math.min(48, -offset * 40));
        const scale = Math.max(0.6, 1 - abs * 0.16);
        const opacity = Math.max(0, 1 - abs * 0.45);
        slide.style.transform =
          'translate(-50%, -50%) translateX(' + translateX.toFixed(1) + 'px) rotateY(' + rotateY.toFixed(1) + 'deg) scale(' + scale.toFixed(3) + ')';
        slide.style.opacity = opacity.toFixed(3);
        slide.style.zIndex = String(Math.round(100 - abs * 10));
        slide.style.pointerEvents = abs < 0.5 ? 'auto' : 'none';
      });

      const activeIndex = Math.max(0, Math.min(count - 1, Math.round(active)));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === activeIndex));
    };

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { setHeight(); onScroll(); });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const rect = section.getBoundingClientRect();
        const scrollable = section.offsetHeight - window.innerHeight;
        const sectionTop = window.scrollY + rect.top;
        window.scrollTo({ top: sectionTop + (i / (count - 1)) * scrollable, behavior: 'smooth' });
      });
    });

    update();
  }

  // GitHub contribution calendar, pulled live from a public, CORS-enabled mirror of
  // the real contribution data (github-contributions-api.jogruber.de) — real per-day
  // counts, not color buckets, so the total and hover tooltips match what GitHub itself
  // shows on the profile page.
  function initGithubChart() {
    const mount = document.getElementById('githubChart');
    const totalEl = document.getElementById('githubTotal');
    if (!mount) return;

    fetch('https://github-contributions-api.jogruber.de/v4/rudra995')
      .then((r) => { if (!r.ok) throw new Error('bad response'); return r.json(); })
      .then((data) => {
        // The API doesn't guarantee chronological order across years, so sort explicitly
        // before deriving "today" or bucketing into weeks.
        const days = (data.contributions || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        if (!days.length) throw new Error('no contribution data');

        // The API pre-fills the whole current calendar year (future days included as
        // zero), so anchor on the real current date rather than the dataset's max date
        // to avoid a trailing chunk of not-yet-happened blank cells.
        const maxDataDate = new Date(days[days.length - 1].date + 'T00:00:00');
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const today = now < maxDataDate ? now : maxDataDate;
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - 364);

        const recent = days.filter((d) => {
          const t = new Date(d.date + 'T00:00:00');
          return t >= cutoff && t <= today;
        });
        const total = recent.reduce((sum, d) => sum + d.count, 0);
        totalEl.textContent = total.toLocaleString() + (total === 1 ? ' contribution' : ' contributions') + ' in the last year';

        const firstDate = new Date(recent[0].date + 'T00:00:00');
        const leadingPad = firstDate.getDay();

        const weeks = [];
        let week = new Array(leadingPad).fill(null);
        recent.forEach((d) => {
          week.push(d);
          if (week.length === 7) { weeks.push(week); week = []; }
        });
        if (week.length) {
          while (week.length < 7) week.push(null);
          weeks.push(week);
        }

        const LEVEL_COLORS = [
          'color-mix(in srgb, var(--color-text) 6%, transparent)',
          'color-mix(in srgb, var(--color-accent) 32%, transparent)',
          'color-mix(in srgb, var(--color-accent) 56%, transparent)',
          'color-mix(in srgb, var(--color-accent) 80%, transparent)',
          'var(--color-accent)'
        ];

        const grid = document.createElement('div');
        grid.className = 'gh-grid';

        const tooltip = document.createElement('div');
        tooltip.className = 'gh-tooltip';

        const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const showTooltip = (e, day) => {
          const label = day.count === 0 ? 'No contributions' : day.count.toLocaleString() + (day.count === 1 ? ' contribution' : ' contributions');
          tooltip.textContent = label + ' on ' + dateFormatter.format(new Date(day.date + 'T00:00:00'));
          tooltip.classList.add('is-visible');
          positionTooltip(e);
        };
        const positionTooltip = (e) => {
          const rect = mount.getBoundingClientRect();
          tooltip.style.left = (e.clientX - rect.left + mount.scrollLeft) + 'px';
          tooltip.style.top = (e.clientY - rect.top) + 'px';
        };
        const hideTooltip = () => tooltip.classList.remove('is-visible');

        weeks.forEach((w, wi) => {
          w.forEach((day, di) => {
            const cell = document.createElement('div');
            cell.className = 'gh-cell';
            cell.style.gridColumn = String(wi + 1);
            cell.style.gridRow = String(di + 1);
            if (!day) { cell.classList.add('gh-cell--empty'); grid.appendChild(cell); return; }
            cell.style.background = LEVEL_COLORS[day.level] || LEVEL_COLORS[0];
            cell.addEventListener('mouseenter', (e) => showTooltip(e, day));
            cell.addEventListener('mousemove', positionTooltip);
            cell.addEventListener('mouseleave', hideTooltip);
            grid.appendChild(cell);
          });
        });

        mount.appendChild(grid);
        mount.appendChild(tooltip);
        // Show the most recent weeks by default instead of the oldest, sparsest ones.
        mount.scrollLeft = mount.scrollWidth;
      })
      .catch((err) => {
        console.warn('GitHub contributions failed to load:', err);
        totalEl.textContent = '';
      });
  }

  // TiltedCard (React Bits) on the About photo: cursor-tracked 3D tilt with spring
  // physics, replicating framer-motion's useSpring via a plain rAF-stepped spring
  // integrator (semi-implicit Euler) since the site has no motion library.
  function initTiltedCard(reduced) {
    const mount = document.getElementById('aboutPhoto');
    if (!mount || reduced) return;

    const ROTATE_AMPLITUDE = 14;
    const SCALE_ON_HOVER = 1.08;
    const SPRING = { stiffness: 100, damping: 30, mass: 2 };
    const CAPTION_ROTATE_SPRING = { stiffness: 350, damping: 30, mass: 1 };
    const OPACITY_SPRING = { stiffness: 170, damping: 20, mass: 1 };

    mount.innerHTML =
      '<div class="tilted-card-inner">' +
      '<img class="tilted-card-img" src="uploads/rudra-photo.jpg" alt="Rudra Solanki">' +
      '</div>' +
      '<figcaption class="tilted-card-caption">Rudra Solanki</figcaption>';

    const inner = mount.querySelector('.tilted-card-inner');
    const caption = mount.querySelector('.tilted-card-caption');

    const makeSpring = (value, cfg) => ({ value, target: value, velocity: 0, stiffness: cfg.stiffness, damping: cfg.damping, mass: cfg.mass });
    const stepSpring = (s, dt) => {
      const force = -s.stiffness * (s.value - s.target);
      const dampingForce = -s.damping * s.velocity;
      s.velocity += ((force + dampingForce) / s.mass) * dt;
      s.value += s.velocity * dt;
    };
    const isSettled = (s) => Math.abs(s.value - s.target) < 0.001 && Math.abs(s.velocity) < 0.001;

    const rotateX = makeSpring(0, SPRING);
    const rotateY = makeSpring(0, SPRING);
    const scale = makeSpring(1, SPRING);
    const opacity = makeSpring(0, OPACITY_SPRING);
    const rotateFig = makeSpring(0, CAPTION_ROTATE_SPRING);
    const springs = [rotateX, rotateY, scale, opacity, rotateFig];

    let capX = 0, capY = 0, lastY = 0, running = false, lastTime = null;

    const render = () => {
      inner.style.transform = 'rotateX(' + rotateX.value.toFixed(3) + 'deg) rotateY(' + rotateY.value.toFixed(3) + 'deg) scale(' + scale.value.toFixed(4) + ')';
      caption.style.transform = 'translate(' + capX.toFixed(1) + 'px, ' + capY.toFixed(1) + 'px) rotate(' + rotateFig.value.toFixed(2) + 'deg)';
      caption.style.opacity = String(opacity.value);
    };

    const tick = (now) => {
      if (lastTime == null) lastTime = now;
      const dt = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;
      springs.forEach((s) => stepSpring(s, dt));
      render();
      if (springs.every(isSettled)) { running = false; lastTime = null; return; }
      requestAnimationFrame(tick);
    };
    const wake = () => { if (!running) { running = true; requestAnimationFrame(tick); } };

    mount.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const rect = mount.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;
      rotateX.target = (offsetY / (rect.height / 2)) * -ROTATE_AMPLITUDE;
      rotateY.target = (offsetX / (rect.width / 2)) * ROTATE_AMPLITUDE;
      capX = e.clientX - rect.left;
      capY = e.clientY - rect.top;
      const velocityY = offsetY - lastY;
      rotateFig.target = -velocityY * 0.6;
      lastY = offsetY;
      wake();
    });
    mount.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      scale.target = SCALE_ON_HOVER;
      opacity.target = 1;
      wake();
    });
    mount.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      opacity.target = 0;
      scale.target = 1;
      rotateX.target = 0;
      rotateY.target = 0;
      rotateFig.target = 0;
      wake();
    });
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
      title: 'The Drifting Oracle',
      category: 'Credit Risk / MLOps',
      blurb: 'Drift-aware credit-risk system monitoring 7 features via Population Stability Index, triggering Champion/Challenger XGBoost retraining and improving AUC from 0.73 to 0.76. Deployed with Docker, Kubernetes, and Prefect, with Databricks Unity Catalog, MLflow, and a 47-test CI/CD pytest suite. Includes a LangGraph RAG agent using ChromaDB and Llama/Gemini to generate regulatory-grounded loan-rejection explanations with automated hallucination detection.',
      tags: ['Python', 'FastAPI', 'Databricks', 'XGBoost', 'Docker', 'Kubernetes', 'Prefect', 'LangGraph', 'ChromaDB'],
      image: 'assets/drifting-oracle.png',
      link: 'https://github.com/rudra995/The-Drifting-Oracle'
    },
    {
      title: 'Pitwall',
      category: 'Multi-Agent RAG',
      blurb: 'Multi-agent RAG system with 6 specialized agents and an orchestrator using ChromaDB and Groq LLM APIs to answer race-analytics queries over 30K+ records. Backed by a 15-endpoint FastAPI service with SQLite and Python ETL pipelines to ingest, process, and serve structured race data.',
      tags: ['Python', 'FastAPI', 'SQLite', 'ChromaDB', 'Groq'],
      image: 'assets/pitwall.png',
      link: '#'
    },
    {
      title: 'ShockProof',
      category: 'Risk Analytics',
      blurb: 'Supply chain risk platform using NetworkX and Monte Carlo simulations across 101 suppliers, 501 products, and 1.5K+ relationships to compute P95 revenue-at-risk. Risk scoring validated with bootstrap resampling and Wilcoxon testing, achieving 95.6% precision@10; deployed via PostgreSQL, FastAPI, React, and Docker.',
      tags: ['Python', 'PostgreSQL', 'NetworkX', 'FastAPI', 'React', 'Docker'],
      link: '#'
    },
    {
      title: 'MoneyPal',
      category: 'Expense Tracker',
      blurb: 'A one-tap expense tracker built for my younger sister as she left for college for the first time, to help her track her money. FastAPI + async SQLAlchemy backend with 6 routers, 18 REST endpoints, and 4 models; Google OAuth sign-in auto-provisions 10 categories and a ₹10,000 default budget. IST-aware analytics (day/week/month/year) break down spending by category and trend. React 19 + TypeScript frontend (~2,200 LOC), installable as a PWA, with Recharts and TanStack Query.',
      tags: ['Python', 'FastAPI', 'SQLAlchemy', 'PostgreSQL', 'JWT', 'Google OAuth', 'Cron Jobs', 'React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Recharts', 'Docker'],
      link: '#',
      liveLink: '#'
    },
    {
      title: 'QuantForge',
      category: 'Quant Backtesting',
      blurb: 'Quantitative backtesting platform that lets traders validate strategies against real historical data before risking capital, computing Sharpe, Sortino, CAGR, max drawdown, and VaR through an event-driven (Market → Signal → Order → Fill) simulation engine with realistic slippage and commissions. In live testing it correctly flagged a naive SMA crossover on AAPL (2023) as a losing setup (-22.8% return, -1.19 Sharpe) against +54.8% and 2.32 Sharpe for buy-and-hold, and in a 2022 TSLA drawdown cut peak-to-trough loss nearly in half (-47.6% vs -73.0%). Every run auto-generates a full risk report and equity curve via a typed FastAPI backend and Next.js dashboard, backed by a 150-test suite with a 100% pass rate.',
      tags: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'SQLAlchemy', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Docker', 'pytest'],
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
      '<div class="project-modal-titlebar">' +
      '<div class="traffic-lights">' +
      '<button type="button" class="tl tl-close" aria-label="Close">' +
      '<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>' +
      '</button>' +
      '<span class="tl tl-min" aria-hidden="true"></span>' +
      '<span class="tl tl-zoom" aria-hidden="true"></span>' +
      '</div>' +
      '<span class="project-modal-window-title"></span>' +
      '</div>' +
      '<div class="project-modal-scroll">' +
      '<div class="project-modal-image"><span class="initials"></span><img class="project-modal-img" alt="" /></div>' +
      '<div class="project-modal-content">' +
      '<p class="project-modal-eyebrow"></p>' +
      '<h3 class="project-modal-title" id="projectModalTitle"></h3>' +
      '<p class="project-modal-blurb"></p>' +
      '<div class="project-modal-tags"></div>' +
      '<div class="project-modal-links">' +
      '<a class="btn btn-primary project-modal-live-link" target="_blank" rel="noopener">Live<span class="project-modal-link-arrow" aria-hidden="true">→</span></a>' +
      '<a class="project-modal-link" target="_blank" rel="noopener">Code<span class="project-modal-link-arrow" aria-hidden="true">→</span></a>' +
      '</div>' +
      '</div></div></div>';
    document.body.appendChild(modal);

    const backdrop = modal.querySelector('.project-modal-backdrop');
    const closeBtn = modal.querySelector('.tl-close');
    const windowTitleEl = modal.querySelector('.project-modal-window-title');
    const initialsEl = modal.querySelector('.project-modal-image .initials');
    const imgEl = modal.querySelector('.project-modal-img');
    const eyebrowEl = modal.querySelector('.project-modal-eyebrow');
    const titleEl = modal.querySelector('.project-modal-title');
    const blurbEl = modal.querySelector('.project-modal-blurb');
    const tagsEl = modal.querySelector('.project-modal-tags');
    const linkEl = modal.querySelector('.project-modal-link');
    const liveLinkEl = modal.querySelector('.project-modal-live-link');

    let isOpen = false;
    let activeTrigger = null;
    let onCloseExtra = null;

    const open = (project, triggerEl, onClose) => {
      activeTrigger = triggerEl;
      onCloseExtra = onClose || null;
      initialsEl.textContent = project.title.slice(0, 1).toUpperCase();
      if (project.image) {
        imgEl.src = project.image;
        imgEl.alt = project.title;
        imgEl.style.display = 'block';
        initialsEl.style.display = 'none';
      } else {
        imgEl.removeAttribute('src');
        imgEl.style.display = 'none';
        initialsEl.style.display = '';
      }
      windowTitleEl.textContent = project.title;
      eyebrowEl.textContent = project.category || '';
      eyebrowEl.style.display = project.category ? '' : 'none';
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
      if (project.liveLink) {
        liveLinkEl.href = project.liveLink;
        liveLinkEl.style.display = '';
      } else {
        liveLinkEl.style.display = 'none';
      }
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
