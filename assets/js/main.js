(function () {
  'use strict';

  // Public links. Empty entries are shown as "soon" and are not clickable.
  var PAGE_LINKS = {
    arxiv: '',
    code: ''
  };

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function pct(v) { return v.toFixed(2) + '%'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function tween(dur, delay, fn, done) {
    setTimeout(function () {
      var t0 = performance.now();
      (function step(now) {
        var t = Math.min(1, (now - t0) / dur);
        fn(1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(step);
        else if (done) done();
      })(t0);
    }, delay);
  }
  function aid(i) { return '<i>a</i><sup>' + (i + 1) + '</sup>'; }

  // Margin-weighted win rate: q_i = sum(w_e p_ie) / sum(w_e), w_e = max(|s_A - s_B| / 9, 0.1).
  function winRates(n, duels) {
    var num = [];
    var den = [];
    for (var k = 0; k < n; k++) { num.push(0); den.push(0); }
    duels.forEach(function (d) {
      var w = Math.max(Math.abs(d.si - d.sj) / 9, 0.1);
      var p = d.si > d.sj ? 1 : d.si < d.sj ? 0 : 0.5;
      num[d.i] += w * p; den[d.i] += w;
      num[d.j] += w * (1 - p); den[d.j] += w;
    });
    return num.map(function (v, k) { return den[k] ? v / den[k] : null; });
  }

  // Ring + pivot pairwise tournament for the illustrative example in MH_DATA.demo.
  function tournament(D) {
    var n = D.candidates.length;
    var duels = D.duels.map(function (x, k) {
      return { k: k, i: x[0], j: x[1], si: x[2], sj: x[3], ring: k < D.ringDuels };
    });
    var ringQ = winRates(n, duels.slice(0, D.ringDuels));
    var order = ringQ.map(function (q, i) { return i; }).sort(function (a, b) { return ringQ[b] - ringQ[a] || a - b; });
    var pivots = order.slice(0, D.pivots);
    var finalQ = winRates(n, duels);
    var winner = finalQ.indexOf(Math.max.apply(null, finalQ));
    var records = D.candidates.map(function () { return []; });
    var met = {};
    duels.forEach(function (d) {
      records[d.i].push({ k: d.k, win: d.si > d.sj });
      records[d.j].push({ k: d.k, win: d.sj > d.si });
      met[d.i + '-' + d.j] = met[d.j + '-' + d.i] = true;
    });
    var neverMeet = [];
    for (var a = 0; a < n; a++) {
      for (var b = a + 1; b < n; b++) if (!met[a + '-' + b]) neverMeet.push([a, b]);
    }
    return { duels: duels, pivots: pivots, finalQ: finalQ, winner: winner, records: records, neverMeet: neverMeet };
  }

  function bindSeg(attr, onChange) {
    var buttons = $$('[' + attr + ']');
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('aria-pressed') === 'true') return;
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        onChange(b.getAttribute(attr));
      });
    });
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    var btn = $('#theme-toggle');
    var metas = $$('meta[name="theme-color"]');
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function stored() {
      try { return localStorage.getItem('mh-theme'); } catch (e) { return null; }
    }

    function apply(theme, persist) {
      root.setAttribute('data-theme', theme);
      metas.forEach(function (m) { m.setAttribute('content', theme === 'dark' ? '#0d0d0d' : '#fbfbf8'); });
      if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      if (persist) {
        try { localStorage.setItem('mh-theme', theme); } catch (e) { /* storage unavailable */ }
      }
    }

    apply(root.getAttribute('data-theme') || 'light', false);
    if (btn) {
      btn.addEventListener('click', function () {
        apply(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
      });
    }
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function (e) {
        var s = stored();
        if (s !== 'light' && s !== 'dark') apply(e.matches ? 'dark' : 'light', false);
      });
    }
  }

  /* ---------- Header, mobile menu, active section ---------- */
  function initHeader() {
    var header = $('#site-header');
    if (!header) return;

    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    var btn = $('#menu-toggle');
    var menu = $('#mobile-menu');
    function setOpen(open) {
      if (!btn || !menu) return;
      header.classList.toggle('is-open', open);
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    if (btn && menu) {
      btn.addEventListener('click', function () { setOpen(menu.hidden); });
      menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
      document.addEventListener('click', function (e) {
        if (!menu.hidden && !header.contains(e.target)) setOpen(false);
      });
      var wide = window.matchMedia('(min-width: 901px)');
      if (wide.addEventListener) wide.addEventListener('change', function (e) { if (e.matches) setOpen(false); });
    }

    // The section under a line 45% down the viewport is current. Measured from scroll position
    // rather than an IntersectionObserver rootMargin, which embedded (iframe) previews can ignore.
    // A clicked tab lights up at once and holds while the page scrolls to it.
    var links = {};
    $$('.primary-nav a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var sections = $$('main > section[id]');
    var held = null;
    var holdUntil = 0;
    var queued = false;
    function mark(id) {
      Object.keys(links).forEach(function (k) { links[k].classList.toggle('is-active', k === id); });
    }
    function spy() {
      queued = false;
      var line = window.innerHeight * 0.45;
      var current = null;
      sections.forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) current = s.id;
      });
      if (held) {
        if (current !== held && performance.now() < holdUntil) return;
        held = null;
      }
      mark(current);
    }
    function queue() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(spy);
    }
    Object.keys(links).forEach(function (id) {
      links[id].addEventListener('click', function () {
        held = id;
        holdUntil = performance.now() + 2000;
        mark(id);
      });
    });
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    spy();
  }

  /* ---------- External links ---------- */
  function initLinks() {
    $$('[data-link]').forEach(function (a) {
      var url = PAGE_LINKS[a.getAttribute('data-link')];
      if (url) {
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        return;
      }
      a.classList.add('is-pending');
      a.setAttribute('aria-disabled', 'true');
      a.title = 'Coming soon';
      if (a.classList.contains('pill')) {
        var tag = document.createElement('span');
        tag.className = 'soon';
        tag.textContent = 'soon';
        a.appendChild(tag);
      }
      a.addEventListener('click', function (e) { e.preventDefault(); });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var nodes = $$('.reveal');
    if (!hasIO || reduceMotion) {
      nodes.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  function initCounters() {
    var nodes = $$('[data-count]');
    if (!hasIO || reduceMotion || !nodes.length) return;
    function num(n, attr, fallback) { return parseFloat(n.getAttribute(attr) || fallback); }
    function show(n, v) { n.textContent = v.toFixed(num(n, 'data-decimals', '0')); }
    function count(n) {
      var from = num(n, 'data-from', '0');
      var end = num(n, 'data-count', '0');
      tween(num(n, 'data-duration', '1400'), num(n, 'data-delay', '0'), function (e) {
        show(n, from + (end - from) * e);
      }, function () { n.classList.add('is-counted'); });
    }
    // Start from the initial value so the final number never flashes before counting.
    nodes.forEach(function (n) { show(n, num(n, 'data-from', '0')); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var group = entry.target.closest('[data-count-group]');
        (group ? $$('[data-count]', group) : [entry.target]).forEach(function (n) {
          if (n.classList.contains('is-counting')) return;
          n.classList.add('is-counting');
          io.unobserve(n);
          count(n);
        });
      });
    }, { threshold: 0.6 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------- TL;DR entrance ---------- */
  function initTldr() {
    var sec = $('#tldr');
    var head = sec && $('.tldr-head', sec);
    var title = sec && $('.scramble', sec);
    if (!head || !title) return;
    var cols = $$('.col', sec);
    var spot = $('.tl-spot', sec);
    var blocks = spot ? cols.concat(spot) : cols;
    var text = title.textContent;
    var GLYPHS = '#%&*+=<>/\\|$@01';

    function decode() {
      title.innerHTML = text.split('').map(function (ch) { return '<span class="sc">' + esc(ch) + '</span>'; }).join('');
      var cells = $$('.sc', title);
      cells.forEach(function (c) { c.style.width = c.getBoundingClientRect().width + 'px'; });
      var frames = 18;
      var f = 0;
      (function tick() {
        f += 1;
        cells.forEach(function (c, i) {
          c.textContent = i < (f / frames) * cells.length - 0.5 ? text[i] : GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
        });
        if (f < frames) setTimeout(tick, 45);
        else title.textContent = text;
      })();
    }
    function countBars(col) {
      $$('.hbar', col).forEach(function (bar) {
        var v = parseFloat(bar.style.getPropertyValue('--v'));
        var d = parseFloat(bar.style.getPropertyValue('--d')) || 0;
        var out = $('.hbar-val', bar);
        tween(1200, 400 + d * 160, function (e) {
          out.textContent = (45 + (v - 45) * e).toFixed(2);
        }, function () { out.classList.add('is-counted'); });
      });
    }
    function show(el) {
      el.classList.add('play');
      if (el === spot) el.dispatchEvent(new Event('tl:play'));
      else countBars(el);
    }

    if (!hasIO || reduceMotion) {
      head.classList.add('play');
      blocks.forEach(show);
      return;
    }
    $$('.hbar-val', sec).forEach(function (o) { o.textContent = '45.00'; });
    var headAt = 0;
    var shown = 0;
    var nextAt = 0;
    var STAGGER = 380;
    // Blocks enter strictly in order, 01 → 04: a block that scrolls into view brings in any
    // earlier ones still hidden first, one STAGGER apart, after the headline has landed.
    function showThrough(k) {
      var now = performance.now();
      nextAt = Math.max(nextAt, now, headAt ? headAt + 1400 : 0);
      for (; shown <= k; shown += 1) {
        setTimeout(show.bind(null, blocks[shown]), nextAt - now);
        nextAt += STAGGER;
      }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        if (el === head) {
          headAt = performance.now();
          head.classList.add('play');
          decode();
          return;
        }
        showThrough(blocks.indexOf(el));
      });
    }, { threshold: 0.2 });
    io.observe(head);
    blocks.forEach(function (b) { io.observe(b); });
  }

  /* ---------- Mid-step rail (method heading) ---------- */
  function initMidrail() {
    var rail = $('.midrail');
    if (!rail) return;
    var NS = 'http://www.w3.org/2000/svg';
    var N = 8;
    var WIN = [2, 5, 0, 6, 3, 7, 1, 4];
    var inWrap = $('.mr-in', rail);
    var inSvg = $('svg', inWrap);
    var outSvg = $('.mr-out svg', rail);
    var model = $('.mr-model', rail);
    var gate = $('.mr-gate', rail);
    var harness = $('.mr-harness', rail);
    var stepOut = $('.mr-step b', rail);
    var spread = 0;

    function svgEl(tag, attrs, parent) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      parent.appendChild(n);
      return n;
    }
    var fan = [];
    var dots = [];
    for (var i = 0; i < N; i++) fan.push(svgEl('path', { 'class': 'mr-path', pathLength: 1 }, inSvg));
    for (i = 0; i < N; i++) dots.push(svgEl('circle', { 'class': 'mr-dot', r: 4 }, inSvg));
    var out = svgEl('path', { 'class': 'mr-path', pathLength: 1 }, outSvg);
    var arrow = svgEl('path', { 'class': 'mr-head' }, outSvg);
    var star = svgEl('circle', { 'class': 'mr-star', r: 4.8 }, outSvg);
    // Return loop: the executed action's new state goes back into the model for the next step.
    var loopSvg = svgEl('svg', { 'class': 'mr-loop', 'aria-hidden': 'true' }, rail);
    var back = svgEl('path', { 'class': 'mr-back', pathLength: 1 }, loopSvg);
    var backHead = svgEl('path', { 'class': 'mr-back-head' }, loopSvg);
    var loopTag = document.createElement('span');
    loopTag.className = 'mr-loop-tag';
    loopTag.setAttribute('aria-hidden', 'true');
    loopTag.innerHTML = 'new state <i>h</i><sub>t+1</sub>';
    rail.appendChild(loopTag);
    // The token gets its own layer so it passes over the label instead of behind it.
    var obs = svgEl('circle', { 'class': 'mr-obs', r: 5 }, svgEl('svg', { 'class': 'mr-loop', 'aria-hidden': 'true' }, rail));
    var harnessLabel = $('.mr-harness > small', rail);

    // Paths are laid out in CSS pixels so dots can follow them with getPointAtLength.
    function layout() {
      var w = inSvg.clientWidth;
      var h = inSvg.clientHeight;
      var cy = h / 2;
      var amp = Math.min(h * 0.55, 104) * spread;
      fan.forEach(function (p, k) {
        var dy = ((k - (N - 1) / 2) / ((N - 1) / 2)) * amp;
        p.setAttribute('d', 'M0 ' + cy + ' C' + (w * 0.32) + ' ' + (cy + dy) + ' ' + (w * 0.68) + ' ' + (cy + dy) + ' ' + w + ' ' + cy);
      });
      // The output line starts under the verifier so the plain line reads as one stroke before it cuts in.
      var ow = outSvg.clientWidth;
      var oy = outSvg.clientHeight / 2;
      out.setAttribute('d', 'M' + (-gate.offsetWidth) + ' ' + oy + ' L' + (ow - 3) + ' ' + oy);
      arrow.setAttribute('d', 'M' + (ow - 11) + ' ' + (oy - 5) + ' L' + (ow - 3) + ' ' + oy + ' L' + (ow - 11) + ' ' + (oy + 5));
      // The loop runs below the node labels, from the harness back up to the model.
      var y0 = harness.offsetTop + harnessLabel.offsetTop + harnessLabel.offsetHeight + 10;
      var y1 = y0 + 26;
      var hx = harness.offsetLeft + harness.offsetWidth / 2;
      var mx = model.offsetLeft + model.offsetWidth / 2;
      var r = 12;
      back.setAttribute('d', 'M' + hx + ' ' + y0 + ' L' + hx + ' ' + (y1 - r) + ' Q' + hx + ' ' + y1 + ' ' + (hx - r) + ' ' + y1 +
        ' L' + (mx + r) + ' ' + y1 + ' Q' + mx + ' ' + y1 + ' ' + mx + ' ' + (y1 - r) + ' L' + mx + ' ' + (y0 + 1));
      backHead.setAttribute('d', 'M' + (mx - 5) + ' ' + (y0 + 7) + ' L' + mx + ' ' + (y0 + 1) + ' L' + (mx + 5) + ' ' + (y0 + 7));
      loopTag.style.left = (hx + mx) / 2 + 'px';
      loopTag.style.top = y1 + 'px';
    }
    function along(c, p, e) {
      var pt = p.getPointAtLength(p.getTotalLength() * e);
      c.setAttribute('cx', pt.x.toFixed(1));
      c.setAttribute('cy', pt.y.toFixed(1));
    }
    function pulse(node, lit) {
      var g = $('.mr-glyph', node);
      if (!g.animate) return;
      g.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.13)', offset: 0.35 }, { transform: 'scale(1)' }],
        { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      if (lit) {
        g.animate([{ borderColor: '#76b900', backgroundColor: 'rgba(118, 185, 0, 0.2)' },
          { borderColor: '#76b900', backgroundColor: 'rgba(118, 185, 0, 0.2)', offset: 0.4 }], { duration: 900 });
      }
      var ring = $('.mr-ring', node);
      if (ring) {
        ring.animate([{ opacity: 0.9, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.8)' }],
          { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      }
    }

    layout();
    window.addEventListener('resize', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    if (!hasIO || reduceMotion) {
      spread = 1;
      layout();
      rail.classList.add('play', 'cut', 'open');
      return;
    }

    var visible = false;
    var started = false;
    var ready = false;
    var busy = false;
    var turn = 0;
    var step = 1;

    // One agent step: 8 candidates leave the model, the verifier keeps one, the harness runs it.
    function cycle() {
      if (!visible) { busy = false; return; }
      busy = true;
      var w = WIN[turn % WIN.length];
      turn += 1;
      inWrap.classList.remove('pick');
      fan.forEach(function (p) { p.classList.remove('win'); });
      dots.forEach(function (d, k) {
        d.classList.remove('won', 'out');
        along(d, fan[k], 0);
        d.classList.add('go');
      });
      pulse(model);
      tween(900, 0, function (e) {
        dots.forEach(function (d, k) { along(d, fan[k], e * 0.8); });
      }, function () {
        pulse(gate);
        setTimeout(function () {
          inWrap.classList.add('pick');
          fan[w].classList.add('win');
          dots.forEach(function (d, k) { d.classList.add(k === w ? 'won' : 'out'); });
          tween(320, 380, function (e) { along(dots[w], fan[w], 0.8 + 0.2 * e); }, function () {
            dots[w].classList.remove('go', 'won');
            along(star, out, 0);
            star.classList.add('go');
            tween(620, 60, function (e) { along(star, out, e); }, function () {
              star.classList.remove('go');
              pulse(harness, true);
              setTimeout(feedBack, 280);
            });
          });
        }, 220);
      });
    }
    // The new state rides the loop back to the model, which starts the next step from it.
    function feedBack() {
      rail.classList.add('back');
      along(obs, back, 0);
      obs.classList.add('go');
      tween(1100, 0, function (e) { along(obs, back, e); }, function () {
        obs.classList.remove('go');
        rail.classList.remove('back');
        step += 1;
        stepOut.textContent = step;
        if (stepOut.animate) {
          stepOut.animate([{ transform: 'scale(1.7)', color: '#76b900' }, { transform: 'none' }],
            { duration: 460, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
        }
        setTimeout(cycle, 160);
      });
    }
    function enter() {
      layout();
      rail.classList.add('play');
      setTimeout(function () {
        rail.classList.add('cut');
        tween(850, 260, function (e) { spread = e; layout(); }, function () {
          rail.classList.add('open');
          ready = true;
          setTimeout(function () { if (visible && !busy) cycle(); }, 500);
        });
      }, 1580);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible = entry.isIntersecting;
        if (!started && entry.intersectionRatio >= 0.8) {
          started = true;
          setTimeout(enter, 150);
        }
        if (visible && ready && !busy) cycle();
      });
    }, { threshold: [0, 0.8] });
    io.observe(rail);
  }

  /* ---------- Animated overview ---------- */
  function buildStageCandidates(D) {
    var cands = $('#stage-cands');
    var table = $('#stage-standings');
    if (!cands || !table || !D) return null;
    var T = tournament(D);
    cands.innerHTML = D.candidates.map(function (c, i) {
      return '<span class="chip' + (i === T.winner ? ' is-best' : '') + '" style="--i:' + i + '"><span class="ps">$</span>' + esc(c) + '</span>';
    }).join('');
    table.innerHTML = '<div class="shead"><span>Candidate</span><span>Record</span><span>Win rate</span></div>' +
      D.candidates.map(function (c, i) {
        return '<div class="srow' + (i === T.winner ? ' is-best' : '') + '" data-i="' + i + '" style="--i:' + i + '">' +
          '<code>' + esc(c) + '</code>' +
          '<span class="rec"><b class="w">0</b><small>W</small><b class="l">0</b><small>L</small></span>' +
          '<span class="sbar"><span></span></span>' +
          '<b class="q">–</b></div>';
      }).join('');
    return T;
  }

  function initStage() {
    var stage = $('#stage');
    if (!stage) return;
    var M = window.MH_DATA || {};
    // Turns decided step by step: Mid-Harness candidates and the base agent's single sample.
    var rounds = [
      { turn: 2, D: M.demo, base: 'pip install yaml' },
      { turn: 3, D: M.demoNext, base: 'conda install yaml' }
    ].filter(function (r) { return r.D; });
    var board = $('#stage-standings');
    var T = null;
    var srows = [];
    var ringN = 0;
    var duelOut = $('#stage-duel', stage);
    var duelLabel = duelOut ? duelOut.textContent : '';
    var typed = $$('[data-type]', stage);
    var lanes = $$('.lane', stage);
    var turnTags = $$('.lturn b', stage);
    var histSubs = $$('.ht', stage);
    var baseChips = $$('.lane-base .chip', stage);
    var pickChip = $('.lane-mid .exec-row .chip', stage);
    function lastTurn(el) {
      return $$('[data-type][data-turn]', el).reduce(function (m, n) { return Math.max(m, +n.getAttribute('data-turn')); }, 0);
    }
    var goal = $('#stage-goal', stage);
    var goalText = goal ? goal.textContent : '';
    var timers = [];
    var running = false;
    var PIVOT_PAUSE = 500;
    function loadRound(k) {
      var R = rounds[k];
      if (!R) return;
      T = buildStageCandidates(R.D);
      srows = board ? $$('.srow', board) : [];
      ringN = T ? T.duels.filter(function (d) { return d.ring; }).length : 0;
      if (T) duelLabel = ringN + ' ring + ' + (T.duels.length - ringN) + ' pivot duels';
      if (duelOut) duelOut.textContent = duelLabel;
      turnTags.forEach(function (b) { b.textContent = 't' + R.turn; });
      histSubs.forEach(function (s) { s.textContent = R.turn; });
      baseChips.forEach(function (c) { c.innerHTML = '<span class="ps">$</span>' + esc(R.base); });
      if (pickChip && T) pickChip.innerHTML = '<span class="ps">$</span>' + esc(R.D.candidates[T.winner]);
    }
    loadRound(0);

    // Level the Sample / Verify / Execute rows across the two lanes when they sit side by side.
    var baseSteps = $$('.lane-base .lstep', stage);
    var midSteps = $$('.lane-mid .lstep', stage);
    var sideBySide = window.matchMedia('(min-width: 901px)');
    var alignQueued = false;
    function alignSteps() {
      alignQueued = false;
      baseSteps.concat(midSteps).forEach(function (li) { li.style.minHeight = ''; });
      if (!sideBySide.matches) return;
      baseSteps.forEach(function (b, i) {
        var m = midSteps[i];
        if (!m) return;
        var h = Math.max(b.offsetHeight, m.offsetHeight);
        b.style.minHeight = h + 'px';
        m.style.minHeight = h + 'px';
      });
    }
    function queueAlign() {
      if (alignQueued) return;
      alignQueued = true;
      requestAnimationFrame(alignSteps);
    }
    alignSteps();
    window.addEventListener('resize', queueAlign);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueAlign);
    // Step content is top-aligned, so its size is independent of the min-heights set here.
    if ('ResizeObserver' in window) {
      var stepRO = new ResizeObserver(queueAlign);
      midSteps.forEach(function (li) { stepRO.observe(li.lastElementChild); });
    }

    // Stacked on phones, the standings sit far below the task, so the duels wait until they are on screen.
    var boardSeen = !hasIO;
    var held = null;
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; held = null; }
    function whenBoardSeen(fn) {
      if (boardSeen) fn();
      else held = fn;
    }
    if (hasIO && board) {
      new IntersectionObserver(function (entries) {
        boardSeen = entries[entries.length - 1].intersectionRatio >= 0.6;
        if (boardSeen && held) {
          var fn = held;
          held = null;
          later(300, fn);
        }
      }, { threshold: [0, 0.6] }).observe(board);
    }

    // Standings after the first k duels: won/lost counts, margin-weighted win rate.
    function standAt(k) {
      if (!T) return;
      var played = T.duels.slice(0, k);
      var q = winRates(srows.length, played);
      var won = srows.map(function () { return 0; });
      var lost = won.slice();
      played.forEach(function (d) {
        if (d.si === d.sj) return;
        var w = d.si > d.sj ? d.i : d.j;
        won[w] += 1;
        lost[w === d.i ? d.j : d.i] += 1;
      });
      srows.forEach(function (row, i) {
        $('.w', row).textContent = won[i];
        $('.l', row).textContent = lost[i];
        $('.sbar span', row).style.setProperty('--q', q[i] === null ? 0 : q[i]);
        $('.q', row).textContent = q[i] === null ? '–' : q[i].toFixed(2);
      });
    }
    function bump(el, color) {
      if (el.animate) el.animate([{ transform: 'scale(1.8)', color: color }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    }
    // The flash tint follows the theme (white on the dark stage, a dark wash on the light one).
    function flashColor() { return getComputedStyle(stage).getPropertyValue('--s-flash').trim() || 'rgba(255, 255, 255, 0.16)'; }
    function flash(row) {
      if (row.animate) row.animate([{ backgroundColor: flashColor() }, { backgroundColor: 'transparent' }], { duration: 420, easing: 'ease-out' });
    }
    function duelStep(k) {
      var d = T.duels[k];
      standAt(k + 1);
      flash(srows[d.i]);
      flash(srows[d.j]);
      if (d.si !== d.sj) {
        var w = d.si > d.sj ? d.i : d.j;
        bump($('.w', srows[w]), '#9be15d');
        bump($('.l', srows[w === d.i ? d.j : d.i]), '#ff6b6b');
      }
      var p = k + 1 - ringN;
      if (duelOut) duelOut.textContent = d.ring ? 'ring ' + (k + 1) + ' / ' + ringN : 'pivot ' + (p < 10 ? '0' : '') + p + ' / ' + (T.duels.length - ringN);
    }
    // Ring scores pick the pivots, who then meet every candidate they have not faced.
    function markPivots(on) {
      if (T) T.pivots.forEach(function (i) { srows[i].classList.toggle('pv', on); });
    }
    // Best win rate first; animated rows slide from their old slots (FLIP).
    function rankRows(animate) {
      var before = srows.map(function (r) { return r.offsetTop; });
      srows.slice().sort(function (a, b) {
        var i = +a.getAttribute('data-i');
        var j = +b.getAttribute('data-i');
        return T.finalQ[j] - T.finalQ[i] || i - j;
      }).forEach(function (r) { board.appendChild(r); });
      if (!animate) return;
      srows.forEach(function (r, k) {
        r.style.transition = 'none';
        r.style.transform = 'translateY(' + (before[k] - r.offsetTop) + 'px)';
      });
      void board.offsetHeight;
      srows.forEach(function (r) { r.style.transition = ''; r.style.transform = ''; });
    }
    // Returns the time until the standings settle.
    function playDuels(pace) {
      if (!T) return 0;
      var at = 450;
      T.duels.forEach(function (d, k) {
        if (k === ringN) {
          later(at, function () {
            markPivots(true);
            if (duelOut) duelOut.textContent = 'top ' + T.pivots.length + ' → pivots';
          });
          at += PIVOT_PAUSE * pace;
        }
        later(at, function () { duelStep(k); });
        at += (d.ring ? 140 : 85) * pace;
      });
      later(at + 150, function () {
        stage.classList.add('settled');
        if (duelOut) duelOut.textContent = duelLabel;
        rankRows(true);
      });
      return at + 150;
    }

    function promptHTML(node) {
      var p = node.getAttribute('data-prompt');
      return p ? '<span class="ps">' + p + '</span> ' : '';
    }

    function fillLine(node) {
      node.innerHTML = promptHTML(node);
      node.appendChild(document.createTextNode(node.getAttribute('data-type')));
    }

    function typeLine(node, speed, done) {
      var str = node.getAttribute('data-type');
      node.innerHTML = promptHTML(node);
      var span = document.createElement('span');
      var caret = document.createElement('span');
      caret.className = 'caret';
      node.appendChild(span);
      node.appendChild(caret);
      var i = 0;
      (function tick() {
        i += 1;
        span.textContent = str.slice(0, i);
        if (i < str.length) later(speed, tick);
        else {
          later(220, function () { caret.remove(); if (done) done(); });
        }
      })();
    }

    // Mid-Harness commands show their verification badge before they are typed.
    function startLine(node, done) {
      if (!node.hasAttribute('data-badge')) { typeLine(node, 62, done); return; }
      if (!node.firstChild) node.innerHTML = promptHTML(node);
      node.classList.add('vf');
      later(480, function () {
        typeLine(node, 62, function () {
          node.classList.remove('vf');
          node.classList.add('vd');
          done();
        });
      });
    }
    function runTurn(lane, turn, done) {
      var lines = $$('[data-type][data-turn="' + turn + '"]', lane);
      var k = 0;
      (function next() {
        if (k >= lines.length) { done(); return; }
        var node = lines[k];
        k += 1;
        if (node.hasAttribute('data-prompt')) startLine(node, function () { later(240, next); });
        else { fillLine(node); later(200, next); }
      })();
    }
    // Both lanes type out one turn; `done` runs once both have finished.
    function runTurns(turn, done) {
      var pending = lanes.length;
      lanes.forEach(function (lane) {
        runTurn(lane, turn, function () {
          if (turn >= lastTurn(lane)) lane.classList.add('finished');
          pending -= 1;
          if (!pending) done();
        });
      });
    }
    // While a turn is decided step by step, its terminal line waits with a caret.
    function holdTurn(turn) {
      lanes.forEach(function (lane) {
        var node = $('[data-prompt][data-type][data-turn="' + turn + '"]', lane);
        if (!node) return;
        node.innerHTML = promptHTML(node) + '<span class="caret"></span>';
        if (node.hasAttribute('data-badge')) node.classList.add('vf');
      });
    }

    function typeGoal() {
      goal.textContent = '';
      var caret = document.createElement('span');
      caret.className = 'caret';
      goal.parentNode.appendChild(caret);
      var i = 0;
      (function tick() {
        i += 1;
        goal.textContent = goalText.slice(0, i);
        if (i < goalText.length) later(24, tick);
        else later(700, function () { caret.remove(); });
      })();
    }

    function phase(n) {
      stage.classList.add('p' + n);
      stage.setAttribute('data-active', String(n));
    }
    // The step panel fades out all at once before its content is swapped.
    function clearSteps() {
      stage.classList.add('swap');
      stage.classList.remove('p1', 'p2', 'p3', 'p4', 'settled');
      stage.setAttribute('data-active', '0');
    }
    // One turn, step by step: sample, verify, execute; the next turn starts from the new history.
    function runRound(k) {
      var R = rounds[k];
      if (!R) return;
      var pace = k ? 0.8 : 1;
      later(350, function () { phase(1); holdTurn(R.turn); });
      later(350 + 1850 * pace, function () {
        whenBoardSeen(function () {
          phase(2);
          var settle = playDuels(pace);
          later(settle + 900 * pace, function () {
            phase(3);
            runTurns(R.turn, function () {
              if (k + 1 < rounds.length) { later(600, function () { nextRound(k + 1); }); return; }
              phase(4);
              later(6000, function () { clearSteps(); later(450, function () { play(true); }); });
            });
          });
        });
      });
    }
    function nextRound(k) {
      lanes.forEach(function (lane) {
        $$('[data-type][data-turn="' + rounds[k - 1].turn + '"]', lane).forEach(function (n) {
          if (n.animate) n.animate([{ backgroundColor: flashColor() }, { backgroundColor: 'transparent' }], { duration: 900, easing: 'ease-out' });
        });
      });
      clearSteps();
      later(500, function () {
        loadRound(k);
        standAt(0);
        stage.classList.remove('swap');
        turnTags.concat(histSubs).forEach(function (el) { bump(el, '#9be15d'); });
        runRound(k);
      });
    }

    // A loop keeps the task on screen and replays only the turns.
    function reset(loop) {
      clearTimers();
      stage.classList.remove('p1', 'p2', 'p3', 'p4', 'settled', 'swap');
      stage.setAttribute('data-active', '0');
      typed.forEach(function (n) { n.textContent = ''; n.classList.remove('vf', 'vd'); });
      lanes.forEach(function (l) { l.classList.remove('finished'); });
      loadRound(0);
      standAt(0);
      if (loop || !goal) return;
      stage.classList.remove('p0', 'fork');
      goal.textContent = '';
      $$('.st-goal .caret', stage).forEach(function (c) { c.remove(); });
    }

    function showFinal() {
      reset();
      loadRound(rounds.length - 1);
      stage.classList.add('p0', 'fork', 'p1', 'p2', 'p3', 'p4', 'settled');
      stage.setAttribute('data-active', '4');
      typed.forEach(function (n) {
        fillLine(n);
        if (n.hasAttribute('data-badge')) n.classList.add('vd');
      });
      lanes.forEach(function (l) { l.classList.add('finished'); });
      if (goal) goal.textContent = goalText;
      if (T) {
        standAt(T.duels.length);
        markPivots(true);
        rankRows(false);
      }
    }

    // Untyped error lines are the failing run both agents start from.
    function flashStart() {
      $$('.term-line.err:not([data-type])', stage).forEach(function (n) {
        if (n.animate) n.animate([{ backgroundColor: 'rgba(255, 107, 107, 0.26)' }, { backgroundColor: 'rgba(255, 107, 107, 0)' }], { duration: 1400, easing: 'ease-out' });
      });
    }

    function play(loop) {
      reset(loop);
      if (reduceMotion) { showFinal(); return; }
      var t = 0;
      if (!loop && goal) {
        later(200, function () { stage.classList.add('p0'); typeGoal(); });
        t = 200 + goalText.length * 24 + 350;
        later(t, function () { stage.classList.add('fork'); flashStart(); });
        t += 450;
      } else {
        later(0, flashStart);
      }
      later(t, function () { runRound(0); });
    }

    var replay = $('#stage-replay');
    if (replay) replay.addEventListener('click', function () { running = true; play(); });

    if (!hasIO || reduceMotion) { showFinal(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // A phone-tall stage may never show 30% of itself at once; half a screen of it also counts.
        // rootBounds is null inside cross-origin frames.
        var vh = entry.rootBounds ? entry.rootBounds.height : window.innerHeight;
        var seen = entry.intersectionRatio >= 0.3 || entry.intersectionRect.height >= vh * 0.5;
        if (entry.isIntersecting && seen && !running) { running = true; play(); }
        if (!entry.isIntersecting && running) { running = false; clearTimers(); }
      });
    }, { threshold: [0, 0.1, 0.2, 0.3] });
    io.observe(stage);
  }

  /* ---------- Tabs ---------- */
  function initTabList(list, onSelect) {
    var tabs = $$('[role="tab"]', list);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      if (tab.scrollIntoView && list.scrollWidth > list.clientWidth) {
        tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
      if (onSelect) onSelect(tab);
    }
    tabs.forEach(function (t, i) {
      t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') j = 0;
        if (e.key === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    return { select: select, tabs: tabs };
  }

  /* ---------- Verification mechanisms (schematic) ---------- */
  var TROPHY = '<svg class="trophy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11"/></svg>';

  function initMech() {
    var box = $('#mech');
    var viz = $('#mech-viz');
    var D = window.MH_DATA && window.MH_DATA.demo;
    if (!box || !viz || !D) return;
    var C = D.candidates;
    var N = C.length;
    var T = tournament(D);
    var LETTERS = 'ABCDEFGHIJKL';
    var replayBtn = $('#mech-replay');
    var timers = [];
    var instant = false;
    function still() { return reduceMotion || instant; }
    function later(ms, fn) {
      if (still()) fn();
      else timers.push(setTimeout(fn, ms));
    }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    // Moves a highlight box over target; jump skips the glide for its first appearance.
    function glide(box, target, jump) {
      if (jump) box.style.transition = 'none';
      box.style.width = target.offsetWidth + 'px';
      box.style.height = target.offsetHeight + 'px';
      box.style.transform = 'translate(' + target.offsetLeft + 'px, ' + target.offsetTop + 'px)';
      if (jump) { void box.offsetWidth; box.style.transition = ''; }
    }
    function countTo(el, v, suffix) {
      if (still()) { el.textContent = v + suffix; return; }
      tween(320, 0, function (e) { el.textContent = Math.round(v * e) + suffix; });
    }

    // Listwise: one multiple-choice prompt with every candidate, one letter back.
    function listwise() {
      var pick = D.choice;
      viz.innerHTML =
        '<div class="mv-card mv-exam">' +
          '<div class="mv-card-head"><span>Verifier prompt · 1 call</span><span class="psi">ψ<sub>list</sub></span></div>' +
          '<p class="mv-q">Q. Given the history <i>h</i><sub>t</sub>, which action should run next?</p>' +
          '<div class="mv-opts-wrap"><span class="mv-scan"></span><ol class="mv-opts">' + C.map(function (c, i) {
            return '<li style="--i:' + i + '"><span class="bub">' + LETTERS[i] + '</span><code>' + esc(c) + '</code></li>';
          }).join('') + '</ol></div>' +
          '<div class="mv-answer"><span><span class="psi">ψ</span> returns</span><code>{"best": "<b class="mv-ans">?</b>"}</code></div>' +
        '</div>' +
        '<p class="mv-legend">All ' + N + ' candidates in one prompt → one letter back</p>';
      var exam = $('.mv-exam', viz);
      var opts = $$('.mv-opts li', viz);
      var ans = $('.mv-ans', viz);
      var READ = 750;
      var SCAN = 1200;
      later(60, function () { exam.classList.add('shown'); });
      // The whole list is one input: one pass covers it, then every option is read at once.
      later(READ, function () { exam.classList.add('ingest'); });
      var sweep = READ + 350;
      later(sweep, function () { exam.classList.add('scanning'); });
      later(sweep + SCAN, function () { exam.classList.add('read'); });
      var decide = sweep + SCAN + 450;
      later(decide, function () {
        exam.classList.remove('scanning');
        exam.classList.add('answered');
        opts.forEach(function (o, i) { o.classList.add(i === pick ? 'is-win' : 'is-lose'); });
        ans.textContent = LETTERS[pick];
      });
      return decide + 1000;
    }

    // Reorders rows best-first, animating each row from where it was (FLIP).
    function sortRows(list, rows, S) {
      var before = rows.map(function (r) { return r.offsetTop; });
      rows.slice().sort(function (a, b) {
        var i = +a.getAttribute('data-i');
        var j = +b.getAttribute('data-i');
        return S[j] - S[i] || i - j;
      }).forEach(function (r) { list.appendChild(r); });
      if (still()) return;
      rows.forEach(function (r, k) {
        r.style.transition = 'none';
        r.style.transform = 'translateY(' + (before[k] - r.offsetTop) + 'px)';
      });
      void list.offsetHeight;
      rows.forEach(function (r) { r.style.transition = ''; r.style.transform = ''; });
    }

    // Pointwise: each candidate is scored alone (0–10), then arg max.
    function pointwise() {
      var S = D.pointScores;
      var best = S.indexOf(Math.max.apply(null, S));
      var START = 700;
      var STEP = 400;
      viz.innerHTML =
        '<div class="mv-card mv-point">' +
          '<div class="mv-card-head"><span class="mv-calls">Call <b>0</b> / ' + N + ' · one candidate each</span><span class="psi">ψ<sub>point</sub></span></div>' +
          '<div class="mv-plist-wrap"><span class="mv-focus"></span><ul class="mv-plist">' + C.map(function (c, i) {
            return '<li data-i="' + i + '" style="--i:' + i + '"><span class="id">' + aid(i) + '</span><code>' + esc(c) + '</code><span class="bar"><span></span></span><b class="sc">–</b></li>';
          }).join('') + '</ul></div>' +
        '</div>' +
        '<p class="mv-legend">' + N + ' independent calls · each sees only its candidate · sorted, arg max wins</p>';
      var card = $('.mv-point', viz);
      var list = $('.mv-plist', viz);
      var focus = $('.mv-focus', viz);
      var rows = $$('li', list);
      var calls = $('.mv-calls b', viz);
      later(60, function () { card.classList.add('shown'); });
      rows.forEach(function (row, i) {
        later(START + i * STEP, function () {
          card.classList.add('scoring');
          glide(focus, row, i === 0);
          row.classList.add('active');
          calls.textContent = i + 1;
          row.querySelector('.bar span').style.setProperty('--v', S[i]);
          countTo(row.querySelector('.sc'), S[i], '/10');
        });
        later(START + (i + 1) * STEP - 30, function () {
          row.classList.remove('active');
          row.classList.add('done');
        });
      });
      var sortAt = START + N * STEP + 300;
      later(sortAt, function () {
        card.classList.remove('scoring');
        sortRows(list, rows, S);
      });
      later(sortAt + 750, function () {
        rows.forEach(function (r, i) { r.classList.add(i === best ? 'is-win' : 'is-lose'); });
      });
      return sortAt + 1300;
    }

    // Pairwise: one-on-one duels in a ring, then pivots meet everyone; ranked by margin-weighted win rate.
    function pairwise() {
      var duels = T.duels;
      var head = '<tr><th class="corner"></th>' + C.map(function (c, j) {
        return '<th class="ch" data-c="' + j + '"><span class="xl">' + esc(c) + '</span></th>';
      }).join('') + '<th class="qh">Win rate</th></tr>';
      var body = C.map(function (c, r) {
        return '<tr data-r="' + r + '"><th class="rh"><span class="star">★</span><span class="id">' + aid(r) + '</span><code>' + esc(c) + '</code></th>' +
          C.map(function (x, cc) {
            return '<td class="c' + (r === cc ? ' diag' : '') + '" data-r="' + r + '" data-c="' + cc + '"></td>';
          }).join('') +
          '<td class="q"><span class="t"><span></span></span><b>–</b></td></tr>';
      }).join('');
      viz.innerHTML =
        '<div class="mv-pair">' +
          '<div class="mv-card mv-match">' +
            '<div class="mv-match-top"><span class="stg">Ring stage</span><span class="mno"></span><span class="live">Live</span></div>' +
            '<div class="mv-match-body"></div>' +
            '<p class="mv-json"></p>' +
          '</div>' +
          '<div class="mv-league-wrap"><table class="mv-league"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
          '<p class="mv-legend mv-key">' +
            '<span><i class="k k-win"></i>Row wins · cell = row’s score</span>' +
            '<span><i class="k k-ring"></i>Ring duel</span>' +
            '<span><b class="k-star">★</b>Pivot</span>' +
            '<span><i class="k k-nm"></i>Never meet</span>' +
          '</p>' +
        '</div>';

      var card = $('.mv-match', viz);
      var stg = $('.stg', card);
      var mno = $('.mno', card);
      var live = $('.live', card);
      var bodyEl = $('.mv-match-body', card);
      var json = $('.mv-json', card);
      var rowsEl = $$('tbody tr', viz);

      function cell(r, c) { return $('td.c[data-r="' + r + '"][data-c="' + c + '"]', viz); }
      function spotlight(d) {
        $$('.hot', viz).forEach(function (n) { n.classList.remove('hot'); });
        $$('td.c.live', viz).forEach(function (n) { n.classList.remove('live'); });
        if (!d) return;
        [d.i, d.j].forEach(function (x) {
          rowsEl[x].classList.add('hot');
          $('th.ch[data-c="' + x + '"]', viz).classList.add('hot');
        });
        cell(d.i, d.j).classList.add('live');
        cell(d.j, d.i).classList.add('live');
      }
      function side(x, cls) {
        return '<div class="side ' + cls + '"><span class="id">' + aid(x) + '</span><code>' + esc(C[x]) + '</code></div>';
      }
      function startDuel(d) {
        bodyEl.innerHTML = side(d.i, 'l') + '<div class="score"><b></b><span>vs</span><b></b></div>' + side(d.j, 'r');
        json.textContent = 'ψ compares A and B …';
      }
      function endDuel(d) {
        var won = [d.si > d.sj, d.sj > d.si];
        var sides = $$('.side', bodyEl);
        var tiles = $$('.score b', bodyEl);
        [d.si, d.sj].forEach(function (s, k) {
          tiles[k].textContent = s;
          tiles[k].classList.toggle('win', won[k]);
          sides[k].classList.toggle('won', won[k]);
        });
        $('.score span', bodyEl).textContent = ':';
        $('.score', bodyEl).classList.add('done');
        json.textContent = '{"scores": {"A": ' + d.si + ', "B": ' + d.sj + '}, "winner": "' + (won[0] ? 'A' : won[1] ? 'B' : 'TIE') + '"}';
      }
      function record(d, k) {
        var a = cell(d.i, d.j);
        var b = cell(d.j, d.i);
        a.textContent = d.si;
        b.textContent = d.sj;
        a.title = C[d.i] + '  ' + d.si + ' : ' + d.sj + '  ' + C[d.j];
        b.title = C[d.j] + '  ' + d.sj + ' : ' + d.si + '  ' + C[d.i];
        a.classList.add(d.si > d.sj ? 'w' : 'l');
        b.classList.add(d.sj > d.si ? 'w' : 'l');
        if (d.ring) { a.classList.add('rg'); b.classList.add('rg'); }
        var q = winRates(N, duels.slice(0, k + 1));
        rowsEl.forEach(function (tr, i) {
          if (q[i] === null) return;
          tr.querySelector('.q .t span').style.setProperty('--w', q[i] * 100);
          tr.querySelector('.q b').textContent = q[i].toFixed(2);
        });
      }

      // Hovering a cell lights up its row and column labels.
      var table = $('.mv-league', viz);
      function crosshair(td) {
        $$('.hover', table).forEach(function (n) { n.classList.remove('hover'); });
        if (!td) return;
        rowsEl[+td.getAttribute('data-r')].classList.add('hover');
        $('th.ch[data-c="' + td.getAttribute('data-c') + '"]', table).classList.add('hover');
        td.classList.add('hover');
      }
      table.addEventListener('mouseover', function (e) { crosshair(e.target.closest('td.c:not(.diag)')); });
      table.addEventListener('mouseleave', function () { crosshair(null); });

      later(60, function () { card.classList.add('shown'); });
      var t = 450;
      duels.forEach(function (d, k) {
        var step = d.ring ? 360 : k === duels.length - 1 ? 760 : 240;
        if (k === D.ringDuels) {
          later(t, function () {
            spotlight(null);
            stg.textContent = 'Top ' + T.pivots.length + ' by ring score → pivots';
            bodyEl.innerHTML = '<div class="mv-pivots">' + T.pivots.map(function (p) {
              return '<span class="mv-pv"><b>★</b>' + aid(p) + '<code>' + esc(C[p]) + '</code></span>';
            }).join('') + '</div>';
            json.textContent = 'Pivots meet every candidate they have not faced yet';
            T.pivots.forEach(function (p) { rowsEl[p].classList.add('pv'); });
            T.neverMeet.forEach(function (pr) {
              cell(pr[0], pr[1]).classList.add('nm');
              cell(pr[1], pr[0]).classList.add('nm');
            });
          });
          t += 1300;
        }
        later(t, function () {
          stg.textContent = d.ring ? 'Ring stage' : 'Pivot stage';
          mno.innerHTML = 'Match <b>' + pad2(k + 1) + '</b> / ' + duels.length;
          spotlight(d);
          startDuel(d);
        });
        later(t + step * 0.5, function () {
          endDuel(d);
          record(d, k);
        });
        t += step;
      });
      later(t + 200, function () {
        var w = T.winner;
        spotlight(null);
        card.classList.add('ft');
        live.textContent = 'Full time';
        stg.textContent = 'Final standings';
        mno.textContent = duels.length + ' of ' + N * (N - 1) / 2 + ' pairs';
        bodyEl.innerHTML = '<div class="mv-champ">' + TROPHY + '<span class="id">' + aid(w) + '</span><code>' + esc(C[w]) + '</code>' +
          '<span class="mv-champ-q">win rate <b>' + T.finalQ[w].toFixed(2) + '</b> → executes</span></div>';
        json.textContent = 'Ranked by margin-weighted win rate over every duel played';
        rowsEl[w].classList.add('champ');
      });
      return t + 900;
    }

    var scenes = { listwise: listwise, pointwise: pointwise, pairwise: pairwise };

    var current = 'pairwise';
    var visible = false;
    // Each scene returns its length, which drives the progress line under the diagram.
    function run(kind) {
      clearTimers();
      current = kind;
      box.setAttribute('data-mech', kind);
      viz.classList.remove('playing', 'played');
      if (replayBtn) replayBtn.classList.remove('ended');
      var total = scenes[kind]();
      if (still()) return;
      void viz.offsetWidth;
      viz.style.setProperty('--dur', total + 'ms');
      viz.classList.add('playing');
      later(total, function () {
        viz.classList.remove('playing');
        viz.classList.add('played');
        if (replayBtn) replayBtn.classList.add('ended');
      });
    }
    function runStill(kind) {
      instant = true;
      run(kind);
      instant = false;
    }

    var list = $('[role="tablist"]', box);
    initTabList(list, function (tab) {
      var kind = tab.getAttribute('data-mech-tab');
      if (visible || reduceMotion) run(kind);
      else runStill(kind);
    });
    if (replayBtn) {
      replayBtn.addEventListener('click', function () {
        visible = true;
        replayBtn.classList.remove('spin');
        void replayBtn.offsetWidth;
        replayBtn.classList.add('spin');
        run(current);
      });
    }

    if (!hasIO || reduceMotion) { run(current); return; }
    // Static final state until the diagram scrolls into view.
    runStill(current);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !visible) {
          visible = true;
          run(current);
          io.disconnect();
        }
      });
    }, { threshold: 0.45 });
    io.observe(viz);
  }

  /* ---------- One-token verifier race ---------- */
  function initRace() {
    var race = $('#race');
    if (!race) return;
    var viz = $('.race-viz', race);
    var text = $('.rc-think .rc-text', race);
    var key = $('.rc-key', race);
    var replayBtn = $('#race-replay');
    var lanes = [$('.rc-think', race), $('.rc-one', race)];
    var verdicts = lanes.map(function (l) { return $('.rc-verdict', l); });
    var counts = lanes.map(function (l) { return $('.rc-count b', l); });
    var units = lanes.map(function (l) { return $('.rc-count small', l); });
    var bars = lanes.map(function (l) { return $('.rc-bar', l); });
    // One span per token-sized chunk; hidden spans hold the final layout so nothing reflows.
    var chunks = text.textContent.trim().match(/\s*[\w@.\-]+|\s*[^\w\s]/g) || [];
    text.innerHTML = chunks.map(function (c) { return '<span class="rc-tk">' + esc(c) + '</span>'; }).join('');
    var toks = $$('.rc-tk', text);
    var total = toks.length;
    var STEP = 45;
    var timers = [];
    function later(ms, fn) {
      if (reduceMotion) fn();
      else timers.push(setTimeout(fn, ms));
    }
    function setCount(k, n) {
      counts[k].textContent = n;
      units[k].textContent = n === 1 ? 'token' : 'tokens';
      bars[k].style.setProperty('--f', total ? n / total : 0);
    }
    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      race.classList.remove('probs', 'agree');
      lanes.forEach(function (l) { l.classList.remove('live', 'done'); });
      verdicts.forEach(function (v) { v.classList.remove('on'); });
      toks.forEach(function (t) { t.classList.remove('on', 'cur'); });
      key.classList.remove('on');
      setCount(0, 0);
      setCount(1, 0);
    }
    function finish(k) {
      lanes[k].classList.remove('live');
      lanes[k].classList.add('done');
      verdicts[k].classList.add('on');
    }
    // Both verifiers start together; returns the scene length for the progress line.
    function play() {
      reset();
      lanes.forEach(function (l) { l.classList.add('live'); });
      var t0 = 350;
      later(t0, function () { key.classList.add('on'); setCount(1, 1); });
      later(t0 + 250, function () { race.classList.add('probs'); });
      later(t0 + 1000, function () { finish(1); });
      toks.forEach(function (tk, i) {
        later(t0 + i * STEP, function () {
          if (i) toks[i - 1].classList.remove('cur');
          tk.classList.add('on', 'cur');
          setCount(0, i + 1);
        });
      });
      var end = t0 + total * STEP;
      later(end + 150, function () {
        if (total) toks[total - 1].classList.remove('cur');
        finish(0);
      });
      later(end + 650, function () { race.classList.add('agree'); });
      return end + 1500;
    }
    function run() {
      viz.classList.remove('playing', 'played');
      if (replayBtn) replayBtn.classList.remove('ended');
      var dur = play();
      if (reduceMotion) return;
      void viz.offsetWidth;
      viz.style.setProperty('--dur', dur + 'ms');
      viz.classList.add('playing');
      later(dur, function () {
        viz.classList.remove('playing');
        viz.classList.add('played');
        if (replayBtn) replayBtn.classList.add('ended');
      });
    }
    if (replayBtn) {
      replayBtn.addEventListener('click', function () {
        replayBtn.classList.remove('spin');
        void replayBtn.offsetWidth;
        replayBtn.classList.add('spin');
        run();
      });
    }

    if (!hasIO || reduceMotion) { run(); return; }
    reset();
    // Inside the TL;DR card, wait until the card itself has entered before racing.
    var card = race.closest('.tl-spot');
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      if (!card || card.classList.contains('play')) { run(); return; }
      card.addEventListener('tl:play', function () { setTimeout(run, 700); }, { once: true });
    }, { threshold: 0.45 });
    io.observe(viz);
  }

  /* ---------- Cost: Mid-Harness vs. parallel scaling ---------- */
  var COST_SERIES = [
    { key: 'base', cls: 'k-base', marker: 'diamond', name: 'Base agent' },
    { key: 'bot', cls: 'k-bot', marker: 'circle', name: 'Best-of-T' },
    { key: 'zs', cls: 'k-zeroshot', marker: 'circle', name: 'Mid-Harness (Zero-shot)' },
    { key: 'dist', cls: 'k-distilled', marker: 'square', name: 'Mid-Harness (Distilled)' },
    { key: 'distbot', cls: 'k-combo', marker: 'diamond', hollow: true, name: 'Mid-Harness (Distilled) + T = 3' }
  ];
  // Label offsets [dx, dy, anchor], placed so neighbouring points and the arrow stay clear.
  var COST_LABELS = {
    'base|': ['Base agent', 10, 4, 'start'],
    'bot|T = 3': [null, 9, 16, 'start'],
    'bot|T = 5': [null, 10, 4, 'start'],
    'bot|T = 7': [null, 10, 4, 'start'],
    'zs|N = 4': [null, 8, 17, 'start'],
    'zs|N = 8': [null, 8, 17, 'start'],
    'dist|N = 4': [null, -9, -9, 'end'],
    'dist|N = 8': [null, -9, -9, 'end'],
    'distbot|': ['Mid-Harness (Distilled) + T = 3', -12, 4, 'end']
  };
  // `arrow` = [Best-of-T tag the arrow starts from, its label]; it ends at Mid-Harness (Distilled, N = 8).
  // `labels` overrides COST_LABELS entries for this chart.
  function drawCost(C, chartSel, legendSel, D, arrow, labels) {
    var chart = D && C.create(chartSel, C.scatter);
    if (!chart) return;
    var SERIES = COST_SERIES;
    var LABELS = {};
    Object.keys(COST_LABELS).forEach(function (k) { LABELS[k] = (labels && labels[k]) || COST_LABELS[k]; });
    function find(key, tag) { return D.filter(function (r) { return r.key === key && r.tag === tag; })[0]; }
    var from = find('bot', arrow[0]);
    var dist8 = find('dist', 'N = 8');
    chart.set({
      xDomain: [0.032, 1.5],
      xTicks: [0.04, 0.08, 0.16, 0.32, 0.64, 1.28],
      xFormat: function (v) { return '$' + v; },
      yDomain: [48, 68.5],
      yTicks: [50, 55, 60, 65],
      xTitle: 'Cost / run (USD, log scale)',
      yTitle: 'Pass@1 (%)',
      series: SERIES.map(function (s) {
        return {
          key: s.key, cls: s.cls, marker: s.marker, hollow: s.hollow,
          points: D.filter(function (r) { return r.key === s.key; }).map(function (r) {
            var l = LABELS[r.key + '|' + (r.tag || '')] || [];
            return {
              x: r.usd, y: r.pass1, label: l[0] || r.tag, dx: l[1], dy: l[2], anchor: l[3], keep: !!l[0],
              tip: { title: s.name + (r.tag ? ' · ' + r.tag : ''), rows: [['Pass@1', r.pass1.toFixed(2) + '%'], ['Cost / run', '$' + r.usd.toFixed(2)]] }
            };
          })
        };
      }),
      arrows: from && dist8 ? [{ from: [from.usd, from.pass1], to: [dist8.usd, dist8.pass1], label: arrow[1], sub: 'same Pass@1' }] : []
    });
    C.legend(legendSel, chart, SERIES.map(function (s) {
      return { key: s.key, label: s.name + (s.key === 'bot' ? ' · T = 3/5/7' : s.key === 'zs' || s.key === 'dist' ? ' · N = 4/8' : ''), cls: s.cls, marker: s.marker, hollow: s.hollow, line: s.key === 'bot' || s.key === 'zs' || s.key === 'dist' };
    }));
  }
  function initCost() {
    var C = window.MHCharts;
    var M = window.MH_DATA || {};
    if (!C) return;
    drawCost(C, '#chart-cost', '#legend-cost', M.cost, ['T = 5', '3× cheaper']);
    // Here the composed point sits further left, so its label rises clear of the 65% tick on phones.
    drawCost(C, '#chart-cost-token', '#legend-cost-token', M.costJev, ['T = 7', '5.8× cheaper'], {
      'distbot|': ['Mid-Harness (Distilled) + T = 3', -12, -10, 'end']
    });
    initCostSlides();
  }

  // Two slides (one-token verifier, then verifier with reasoning): the switch, left/right keys, or a swipe.
  function initCostSlides() {
    var card = $('#card-cost');
    var track = card && $('.slides', card);
    if (!track) return;
    var slides = $$('.slide', track);
    var tabs = $$('[data-slide]', card);
    var keys = $$('[data-dir]', card);
    var current = 0;
    function stride() { return slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth; }
    function mark(i) {
      current = i;
      tabs.forEach(function (t, k) {
        t.setAttribute('aria-selected', k === i ? 'true' : 'false');
        t.tabIndex = k === i ? 0 : -1;
      });
      keys.forEach(function (b) {
        var next = i + +b.getAttribute('data-dir');
        b.disabled = next < 0 || next >= slides.length;
      });
    }
    function go(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: i * stride(), behavior: reduceMotion ? 'auto' : 'smooth' });
      mark(i);
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { go(+t.getAttribute('data-slide')); });
    });
    keys.forEach(function (b) {
      b.addEventListener('click', function () { go(current + +b.getAttribute('data-dir')); });
    });
    var queued = false;
    track.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        var i = Math.round(track.scrollLeft / stride());
        if (i !== current) mark(i);
      });
    }, { passive: true });
    // Keys act while at least half the card is on screen, unless focus is in a field or another tab list.
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (t && t.closest && t.closest('[role="tablist"]') && !card.contains(t)) return;
      var r = card.getBoundingClientRect();
      var seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (seen < Math.min(r.height, window.innerHeight) * 0.5) return;
      e.preventDefault();
      go(current + (e.key === 'ArrowRight' ? 1 : -1));
    });
    window.addEventListener('resize', function () { track.scrollLeft = current * stride(); });
    mark(0);
  }

  /* ---------- Transfer cards ---------- */
  function initTransfer() {
    var grid = $('#transfer-grid');
    var D = window.MH_DATA && window.MH_DATA.transfer;
    if (!grid || !D) return;
    function row(label, cls, v) {
      return '<div class="trow ' + cls + '"><span>' + label + '</span><span class="bar"><span style="--v:' + v[0] + '"></span></span>' +
        '<span class="v">' + v[0].toFixed(2) + ' <i>/ ' + v[1].toFixed(2) + '</i></span></div>';
    }
    grid.innerHTML = D.map(function (t, i) {
      var gains = [t.zs[0] - t.base[0]];
      if (t.dist) gains.push(t.dist[0] - t.base[0]);
      var g = Math.max.apply(null, gains);
      return '<article class="tcard reveal" style="--rd:' + (i % 4) + '">' +
        '<h4>' + t.bench + '<small>' + (t.note || '') + '</small></h4>' +
        '<p class="who">' + t.model + '<span class="h">' + t.harness + '</span></p>' +
        '<div class="tcard-rows">' + row('Base', '', t.base) + row('Zero-shot', 'zs', t.zs) + (t.dist ? row('Distilled', 'dist', t.dist) : '') + '</div>' +
        '<p class="tcard-gain"><span>Best Pass@1 gain</span><b>+' + g.toFixed(2) + ' pp</b></p>' +
        '</article>';
    }).join('');
  }

  /* ---------- Charts ---------- */
  function initCharts() {
    var C = window.MHCharts;
    var D = window.MH_DATA;
    if (!C || !D) return;

    // Candidate width
    var widthChart = C.create('#chart-width', C.line);
    function widthCfg(metric) {
      var idx = metric === 'pass1' ? 1 : 2;
      var name = metric === 'pass1' ? 'Pass@1' : 'Pass@3';
      var CW = D.candidateWidth;
      var base = idx === 1 ? D.base.pass1 : D.base.pass3;
      var proxy = idx === 1 ? CW.proxy.pass1 : CW.proxy.pass3;
      return {
        xCats: CW.widths.map(String),
        xTitle: 'Candidate width (N)',
        yTitle: name + ' (%)',
        yDomain: idx === 1 ? [46, 71] : [62.5, 84],
        yTicks: idx === 1 ? [50, 55, 60, 65, 70] : [65, 70, 75, 80],
        refs: [{ key: 'base', y: base, label: 'Base agent ' + base.toFixed(2) }],
        series: CW.series.map(function (s) {
          return {
            key: s.key, cls: 'k-' + s.key, marker: s.marker, hollow: s.key === 'listwise', noLine: !!s.noLine,
            points: s.points.map(function (p, j) {
              var v = p[idx];
              return {
                xi: CW.widths.indexOf(p[0]), y: v, text: v.toFixed(2),
                label: s.noLine ? 'above' : (j === s.points.length - 1 ? 'right' : null),
                tip: p[0] === 1
                  ? { title: 'Base agent (N = 1)', rows: [[name, pct(v)]] }
                  : { title: s.label, rows: [['Candidates', 'N = ' + p[0]], [name, pct(v)]] }
              };
            })
          };
        }),
        extras: [{
          xi: 2, y: proxy, marker: 'x', cls: 'k-proxy', series: 'proxy',
          tip: { title: 'First-runnable proxy', rows: [['Candidates', 'N = 8'], [name, pct(proxy)]] }
        }]
      };
    }
    if (widthChart) {
      widthChart.set(widthCfg('pass1'));
      C.legend('#legend-width', widthChart, [
        { key: 'listwise', label: 'Listwise', cls: 'k-listwise', line: true, marker: 'circle', hollow: true },
        { key: 'pointwise', label: 'Pointwise', cls: 'k-pointwise', line: true, marker: 'square' },
        { key: 'pairwise', label: 'Zero-shot pairwise', cls: 'k-pairwise', line: true, marker: 'diamond' },
        { key: 'distilled', label: 'Distilled pairwise', cls: 'k-distilled', line: true, marker: 'circle' },
        { key: 'frontier', label: 'Frontier verifier', cls: 'k-frontier', marker: 'triangle' },
        { key: 'proxy', label: 'First-runnable proxy', cls: 'k-proxy', marker: 'x' },
        { key: null, label: 'Base agent', cls: 'k-base', line: true, dashed: true }
      ]);
      bindSeg('data-width-metric', function (v) { widthChart.set(widthCfg(v), true); });
    }

    // Model scale: generator on x, success on y; distilled points carry their gain over the base agent.
    var scaleChart = C.create('#chart-scale', C.line);
    var SCALE = [
      { key: 'base', label: 'Base agent', cls: 'k-base', marker: 'diamond' },
      { key: 'zs', label: 'Mid-Harness (Zero-shot)', cls: 'k-pairwise', marker: 'circle' },
      { key: 'dist', label: 'Mid-Harness (Distilled)', cls: 'k-distilled', marker: 'square' }
    ];
    function scaleCfg(mi) {
      var name = mi === 0 ? 'Pass@1' : 'Pass@3';
      return {
        xCats: D.modelScale.map(function (r) { return r.model; }),
        xPadFrac: 0.12,
        xTitle: 'Generator',
        yTitle: name + ' (%)',
        yDomain: mi === 0 ? [30, 82] : [50, 92],
        yTicks: mi === 0 ? [30, 40, 50, 60, 70, 80] : [50, 60, 70, 80, 90],
        series: SCALE.map(function (s) {
          return {
            key: s.key, cls: s.cls, marker: s.marker,
            points: D.modelScale.map(function (r, i) {
              var v = r[s.key][mi];
              var gain = v - r.base[mi];
              var rows = [[name, pct(v)]];
              if (s.key !== 'base') rows.push(['vs base', (gain >= 0 ? '+' : '') + gain.toFixed(2) + ' pp']);
              return {
                xi: i, y: v,
                text: '+' + gain.toFixed(2) + 'pp',
                label: s.key === 'dist' ? 'above' : null,
                tip: { title: r.model + ' · ' + s.label, rows: rows }
              };
            })
          };
        })
      };
    }
    if (scaleChart) {
      scaleChart.set(scaleCfg(0));
      C.legend('#legend-scale', scaleChart, SCALE.map(function (s) {
        return { key: s.key, label: s.label, cls: s.cls, marker: s.marker, line: true };
      }));
      bindSeg('data-scale-metric', function (v) { scaleChart.set(scaleCfg(+v), true); });
    }

    // Agreement by turn
    var A = D.agreement;
    var turnChart = C.create('#chart-turn', C.line);
    if (turnChart) {
      var mk = function (key, cls, marker, name, vals) {
        return {
          key: key, cls: cls, marker: marker,
          points: vals.map(function (v, i) {
            return {
              xi: i, y: v, text: v.toFixed(2), label: i === vals.length - 1 ? 'right' : null,
              tip: { title: name + ' · turns ' + A.byTurn.bins[i], rows: [['Verification agreement', pct(v)]] }
            };
          })
        };
      };
      turnChart.set({
        xCats: A.byTurn.bins, xTitle: 'Episode turn', yTitle: 'Teacher agreement (%)',
        yDomain: [20, 80], yTicks: [20, 30, 40, 50, 60, 70, 80],
        height: function (w) { return w < 420 ? 290 : w < 560 ? 404 : 360; },
        series: [
          mk('zs', 'k-pairwise', 'circle', 'Zero-shot', A.byTurn.zeroShot),
          mk('dist', 'k-distilled', 'square', 'Distilled', A.byTurn.distilled)
        ]
      });
      C.legend('#legend-turn', turnChart, [
        { key: 'zs', label: 'Zero-shot verifier', cls: 'k-pairwise', line: true, marker: 'circle' },
        { key: 'dist', label: 'Distilled verifier', cls: 'k-distilled', line: true, marker: 'square' }
      ]);
    }

    // Failure categories
    var failChart = C.create('#chart-fail', C.hbars);
    if (failChart) {
      failChart.set({
        cats: A.failures.map(function (f) { return f.label; }),
        xMax: 1000, xTicks: [0, 250, 500, 750, 1000], xTitle: 'Clear failure annotations (count)',
        series: [
          { key: 'zs', cls: 'k-pairwise', label: 'Zero-shot', values: A.failures.map(function (f) { return f.zeroShot; }) },
          { key: 'dist', cls: 'k-distilled', label: 'Distilled', values: A.failures.map(function (f) { return f.distilled; }) }
        ]
      });
      C.legend('#legend-fail', failChart, [
        { key: 'zs', label: 'Zero-shot · 3,328', cls: 'k-pairwise', bar: true },
        { key: 'dist', label: 'Distilled · 1,810', cls: 'k-distilled', bar: true }
      ]);
    }
  }

  function init() {
    initTheme();
    initHeader();
    initLinks();
    initTransfer();
    initCost();
    initCharts();
    initMech();
    initRace();
    initStage();
    initReveal();
    initCounters();
    initTldr();
    initMidrail();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
