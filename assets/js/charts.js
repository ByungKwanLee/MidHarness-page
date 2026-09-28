/*
 * Small dependency-free SVG charts for the Mid-Harness page.
 * Colors come from CSS custom properties, so charts follow the light/dark theme
 * without re-rendering.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- DOM helpers ---------- */
  function el(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      }
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(parent, x, y, str, attrs) {
    var a = attrs || {};
    a.x = x;
    a.y = y;
    var t = el('text', a, parent);
    t.textContent = str;
    return t;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- Scales ---------- */
  function linear(d0, d1, r0, r1) {
    return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
  }

  function niceTicks(min, max, count) {
    var raw = (max - min) / count;
    var pow = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var r = raw / pow;
    var step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * pow;
    var out = [];
    for (var v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) {
      out.push(Math.round(v * 1e6) / 1e6);
    }
    return out;
  }

  function pathFrom(pts) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('');
  }

  function ptsStr(pts) {
    return pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ');
  }

  function parsePts(s) {
    return s.split(' ').map(function (pair) { return pair.split(',').map(Number); });
  }

  /* ---------- Markers ---------- */
  function markerPath(shape, s) {
    switch (shape) {
      case 'square':
        return 'M' + (-s * 0.88) + ' ' + (-s * 0.88) + 'h' + (s * 1.76) + 'v' + (s * 1.76) + 'h' + (-s * 1.76) + 'z';
      case 'diamond':
        return 'M0 ' + (-s * 1.22) + 'L' + (s * 1.22) + ' 0L0 ' + (s * 1.22) + 'L' + (-s * 1.22) + ' 0z';
      case 'triangle':
        return 'M0 ' + (-s * 1.25) + 'L' + (s * 1.15) + ' ' + (s * 0.85) + 'L' + (-s * 1.15) + ' ' + (s * 0.85) + 'z';
      case 'plus':
        return 'M' + (-s * 1.15) + ' 0H' + (s * 1.15) + 'M0 ' + (-s * 1.15) + 'V' + (s * 1.15);
      case 'x':
        return 'M' + (-s * 0.85) + ' ' + (-s * 0.85) + 'L' + (s * 0.85) + ' ' + (s * 0.85) + 'M' + (s * 0.85) + ' ' + (-s * 0.85) + 'L' + (-s * 0.85) + ' ' + (s * 0.85);
      default:
        return 'M' + (-s) + ' 0a' + s + ' ' + s + ' 0 1 0 ' + (2 * s) + ' 0a' + s + ' ' + s + ' 0 1 0 ' + (-2 * s) + ' 0z';
    }
  }

  function isStrokeOnly(shape) { return shape === 'plus' || shape === 'x'; }

  function addMarker(parent, p, size) {
    var g = el('g', {
      'class': 'pt s ' + (p.cls || '') + (p.pop === false ? '' : ' pop'),
      transform: 'translate(' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ')',
      'data-k': p.key,
      'data-x': p.x.toFixed(2),
      'data-y': p.y.toFixed(2),
      'data-series': p.series || ''
    }, parent);
    var shape = p.marker || 'circle';
    el('path', {
      d: markerPath(shape, size),
      'class': 'mark' + (p.hollow ? ' hollow' : '') + (isStrokeOnly(shape) ? ' stroke-only' : '')
    }, g);
    el('circle', { r: Math.max(13, size * 2.6), 'class': 'hit' }, g);
    if (p.delay !== undefined) g.style.setProperty('--delay', p.delay + 's');
    if (p.tip) bindTip(g, p.tip);
    return g;
  }

  /* ---------- Tooltip ---------- */
  var tipNode = null;
  var touchTip = false;

  function tipEl() {
    if (!tipNode) tipNode = document.getElementById('chart-tip');
    return tipNode;
  }

  function placeTip(evt) {
    var t = tipEl();
    if (!t) return;
    var pad = 14;
    var w = t.offsetWidth;
    var h = t.offsetHeight;
    var left = evt.clientX + pad;
    var top = evt.clientY - h - pad;
    if (left + w > window.innerWidth - 8) left = evt.clientX - w - pad;
    if (left < 8) left = 8;
    if (top < 8) top = evt.clientY + pad;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  }

  function showTip(evt, node, tip) {
    var t = tipEl();
    if (!t) return;
    var color = getComputedStyle(node).getPropertyValue('--c').trim() || 'currentColor';
    var html = '<div class="t-title"><span class="t-sw" style="background:' + esc(color) + '"></span>' + esc(tip.title) + '</div>';
    (tip.rows || []).forEach(function (r) {
      html += '<div class="t-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
    });
    t.innerHTML = html;
    t.classList.add('is-on');
    placeTip(evt);
  }

  function hideTip() {
    var t = tipEl();
    if (t) t.classList.remove('is-on');
    touchTip = false;
  }

  function bindTip(node, tip) {
    node.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch') return;
      node.classList.add('is-hover');
      showTip(e, node, tip);
    });
    node.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'touch') placeTip(e);
    });
    node.addEventListener('pointerleave', function (e) {
      node.classList.remove('is-hover');
      if (e.pointerType !== 'touch') hideTip();
    });
    node.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      e.stopPropagation();
      showTip(e, node, tip);
      touchTip = true;
    });
  }

  document.addEventListener('pointerdown', function () { if (touchTip) hideTip(); });
  window.addEventListener('scroll', function () { if (touchTip) hideTip(); }, { passive: true });

  /* ---------- Shared frame ---------- */
  function frame(container, height, m) {
    var w = Math.max(260, Math.floor(container.clientWidth));
    var svg = el('svg', {
      width: w,
      height: height,
      viewBox: '0 0 ' + w + ' ' + height,
      'class': 'mh-chart',
      'aria-hidden': 'true'
    });
    return { svg: svg, w: w, h: height, m: m, iw: w - m.l - m.r, ih: height - m.t - m.b };
  }

  function yAxis(f, y, ticks, fmt, title) {
    var grid = el('g', { 'class': 'grid' }, f.svg);
    ticks.forEach(function (v) {
      el('line', { x1: f.m.l, x2: f.m.l + f.iw, y1: y(v).toFixed(1), y2: y(v).toFixed(1) }, grid);
      text(f.svg, f.m.l - 9, y(v) + 4, fmt ? fmt(v) : String(v), { 'class': 'tick', 'text-anchor': 'end' });
    });
    if (title) {
      text(f.svg, 0, 0, title, {
        'class': 'axis-title',
        'text-anchor': 'middle',
        transform: 'translate(12 ' + (f.m.t + f.ih / 2).toFixed(1) + ') rotate(-90)'
      });
    }
  }

  function xTitle(f, title) {
    if (title) text(f.svg, f.m.l + f.iw / 2, f.h - 8, title, { 'class': 'axis-title', 'text-anchor': 'middle' });
  }

  function baseline(f) {
    el('line', { 'class': 'axis-line', x1: f.m.l, x2: f.m.l + f.iw, y1: f.m.t + f.ih, y2: f.m.t + f.ih }, f.svg);
  }

  // Push labels apart vertically so none are closer than `gap`.
  function spread(items, gap, lo, hi) {
    items.sort(function (a, b) { return a.ly - b.ly; });
    for (var i = 1; i < items.length; i++) {
      if (items[i].ly - items[i - 1].ly < gap) items[i].ly = items[i - 1].ly + gap;
    }
    if (items.length && items[items.length - 1].ly > hi) {
      items[items.length - 1].ly = hi;
      for (var j = items.length - 2; j >= 0; j--) {
        if (items[j + 1].ly - items[j].ly < gap) items[j].ly = items[j + 1].ly - gap;
      }
    }
    if (items.length && items[0].ly < lo) items[0].ly = lo;
  }

  /* ---------- Line chart (categorical x) ---------- */
  function renderLine(container, cfg) {
    var small = container.clientWidth < 520;
    var H = typeof cfg.height === 'function'
      ? cfg.height(container.clientWidth)
      : small ? (cfg.heightSmall || 300) : (cfg.height || 360);
    var f = frame(container, H, { t: 16, r: small ? 50 : 64, b: 50, l: small ? 42 : 52 });
    var y = linear(cfg.yDomain[0], cfg.yDomain[1], f.m.t + f.ih, f.m.t);
    var n = cfg.xCats.length;
    var pad = cfg.xPadFrac ? f.iw * cfg.xPadFrac : Math.min(34, f.iw * 0.07);
    var x = function (i) { return f.m.l + pad + (n === 1 ? 0 : i * (f.iw - 2 * pad) / (n - 1)); };

    yAxis(f, y, cfg.yTicks || niceTicks(cfg.yDomain[0], cfg.yDomain[1], 5), null, cfg.yTitle);
    baseline(f);
    cfg.xCats.forEach(function (c, i) {
      text(f.svg, x(i), f.m.t + f.ih + 19, c, { 'class': 'tick', 'text-anchor': 'middle' });
    });
    xTitle(f, cfg.xTitle);

    // Reference lines are labelled in the bottom-left corner, clear of the data.
    (cfg.refs || []).forEach(function (r, i) {
      el('line', { 'class': 'ref', x1: f.m.l, x2: f.m.l + f.iw, y1: y(r.y), y2: y(r.y) }, f.svg);
      var ly = f.m.t + f.ih - 9 - i * 15;
      el('line', { 'class': 'ref', x1: f.m.l + 8, x2: f.m.l + 26, y1: ly - 4, y2: ly - 4 }, f.svg);
      text(f.svg, f.m.l + 32, ly, r.label, { 'class': 'ref-label' });
    });

    var lines = el('g', {}, f.svg);
    cfg.series.forEach(function (s) {
      if (s.noLine) return;
      var pts = s.points.map(function (p) { return [x(p.xi), y(p.y)]; });
      el('path', {
        'class': 'line s draw ' + s.cls, d: pathFrom(pts),
        'data-k': 'line-' + s.key, 'data-pts': ptsStr(pts), 'data-series': s.key
      }, lines);
    });

    var marks = el('g', {}, f.svg);
    var size = small ? 4.1 : 4.7;
    var right = [];
    cfg.series.forEach(function (s) {
      s.points.forEach(function (p, j) {
        var px = x(p.xi);
        var py = y(p.y);
        addMarker(marks, {
          key: s.key + '-' + p.xi, cls: s.cls, series: s.key, marker: s.marker, hollow: s.hollow,
          x: px, y: py, tip: p.tip, delay: 0.2 + j * 0.14
        }, size);
        if (p.label === 'right') right.push({ s: s, p: p, x: px, y: py, ly: py });
        if (p.label === 'above') {
          text(f.svg, px, py - 12, p.text, {
            'class': 'val s pop ' + s.cls, 'text-anchor': 'middle',
            'data-k': 'lab-' + s.key + '-' + p.xi, 'data-x': px, 'data-y': py - 12, 'data-series': s.key
          });
        }
      });
    });

    (cfg.extras || []).forEach(function (e, i) {
      addMarker(marks, {
        key: 'extra-' + i, cls: e.cls, series: e.series || '', marker: e.marker,
        x: x(e.xi) + (e.dx || 0), y: y(e.y), tip: e.tip, delay: 0.6
      }, size);
    });

    spread(right, 14, f.m.t + 4, f.m.t + f.ih - 2);
    right.forEach(function (r) {
      text(f.svg, r.x + 10, r.ly + 4, r.p.text, {
        'class': 'val s pop ' + r.s.cls,
        'data-k': 'lab-' + r.s.key + '-' + r.p.xi, 'data-x': r.x + 10, 'data-y': r.ly + 4, 'data-series': r.s.key
      });
    });

    return f.svg;
  }

  /* ---------- Scatter with a log-scaled x axis ---------- */
  function renderScatter(container, cfg) {
    var small = container.clientWidth < 520;
    var H = small ? 330 : 400;
    var f = frame(container, H, { t: 20, r: small ? 22 : 40, b: 52, l: small ? 42 : 52 });
    var lx0 = Math.log(cfg.xDomain[0]);
    var lx1 = Math.log(cfg.xDomain[1]);
    var x = function (v) { return f.m.l + (Math.log(v) - lx0) / (lx1 - lx0) * f.iw; };
    var y = linear(cfg.yDomain[0], cfg.yDomain[1], f.m.t + f.ih, f.m.t);

    yAxis(f, y, cfg.yTicks, null, cfg.yTitle);
    baseline(f);
    cfg.xTicks.forEach(function (v) {
      text(f.svg, x(v), f.m.t + f.ih + 19, cfg.xFormat ? cfg.xFormat(v) : String(v), { 'class': 'tick', 'text-anchor': 'middle' });
    });
    xTitle(f, cfg.xTitle);

    var lines = el('g', {}, f.svg);
    cfg.series.forEach(function (s) {
      if (s.points.length < 2) return;
      var pts = s.points.map(function (p) { return [x(p.x), y(p.y)]; });
      el('path', {
        'class': 'line s draw ' + s.cls, d: pathFrom(pts),
        'data-k': 'line-' + s.key, 'data-pts': ptsStr(pts), 'data-series': s.key
      }, lines);
    });

    // Arrows run between two data points and stop short of their markers.
    (cfg.arrows || []).forEach(function (a) {
      var x1 = x(a.from[0]);
      var y1 = y(a.from[1]);
      var x2 = x(a.to[0]);
      var y2 = y(a.to[1]);
      var len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) || 1;
      var ux = (x2 - x1) / len;
      var uy = (y2 - y1) / len;
      var sx = x1 + ux * 12;
      var sy = y1 + uy * 12;
      var ex = x2 - ux * 12;
      var ey = y2 - uy * 12;
      var g = el('g', { 'class': 'anno-arrow pop' }, f.svg);
      g.style.setProperty('--delay', '0.9s');
      el('line', { 'class': 'anno-line', x1: sx.toFixed(2), y1: sy.toFixed(2), x2: ex.toFixed(2), y2: ey.toFixed(2) }, g);
      el('path', {
        'class': 'anno-line',
        d: 'M' + (ex - ux * 7 - uy * 4.5).toFixed(2) + ' ' + (ey - uy * 7 + ux * 4.5).toFixed(2) +
          'L' + ex.toFixed(2) + ' ' + ey.toFixed(2) +
          'L' + (ex - ux * 7 + uy * 4.5).toFixed(2) + ' ' + (ey - uy * 7 - ux * 4.5).toFixed(2)
      }, g);
      var mx = (sx + ex) / 2;
      var my = (sy + ey) / 2 + (a.dy === undefined ? -22 : a.dy);
      text(g, mx, my, a.label, { 'class': 'anno', 'text-anchor': 'middle' });
      if (a.sub && !small) text(g, mx, my + 14, a.sub, { 'class': 'anno-sub', 'text-anchor': 'middle' });
    });

    var marks = el('g', {}, f.svg);
    var size = small ? 4.4 : 5.2;
    cfg.series.forEach(function (s) {
      s.points.forEach(function (p, j) {
        var px = x(p.x);
        var py = y(p.y);
        addMarker(marks, {
          key: s.key + '-' + j, cls: s.cls, series: s.key, marker: s.marker, hollow: s.hollow,
          x: px, y: py, tip: p.tip, delay: 0.25 + j * 0.12
        }, size);
        // Narrow charts keep only the labels marked `keep`; the legend and tooltips carry the rest.
        if (p.label && (!small || p.keep)) {
          text(f.svg, px + (p.dx || 10), py + (p.dy === undefined ? 4 : p.dy), p.label, {
            'class': 'val s pop ' + s.cls, 'text-anchor': p.anchor || 'start', 'data-series': s.key
          });
        }
      });
    });
    return f.svg;
  }

  /* ---------- Horizontal grouped bars ---------- */
  function renderHBars(container, cfg) {
    var small = container.clientWidth < 520;
    var labelW = small ? 0 : 152;
    var band = small ? 46 : 36;
    var barH = small ? 9 : 10;
    var top0 = 8;
    var H = top0 + cfg.cats.length * band + 46;
    var f = frame(container, H, { t: top0, r: small ? 40 : 46, b: 46, l: labelW + (small ? 4 : 10) });
    var x = linear(0, cfg.xMax, f.m.l, f.m.l + f.iw);
    var xt = cfg.xTicks || niceTicks(0, cfg.xMax, small ? 4 : 5);
    var grid = el('g', { 'class': 'grid' }, f.svg);
    xt.forEach(function (v) {
      el('line', { x1: x(v), x2: x(v), y1: f.m.t, y2: f.m.t + f.ih }, grid);
      text(f.svg, x(v), f.m.t + f.ih + 18, String(v), { 'class': 'tick', 'text-anchor': 'middle' });
    });
    xTitle(f, cfg.xTitle);

    cfg.cats.forEach(function (cat, i) {
      var top = f.m.t + i * band;
      var barsTop = small ? top + 17 : top + (band - (barH * cfg.series.length + 3)) / 2;
      if (small) {
        text(f.svg, f.m.l, top + 12, cat, { 'class': 'cat' });
      } else {
        text(f.svg, labelW, top + band / 2 + 4, cat, { 'class': 'cat', 'text-anchor': 'end' });
      }
      cfg.series.forEach(function (s, j) {
        var v = s.values[i];
        var by = barsTop + j * (barH + 3);
        var w = Math.max(1.5, x(v) - f.m.l);
        var g = el('g', { 'class': 's pop ' + s.cls, 'data-series': s.key }, f.svg);
        g.style.setProperty('--delay', (0.1 + i * 0.05) + 's');
        el('rect', { 'class': 'bar', x: f.m.l, y: by, width: w, height: barH, rx: 2 }, g);
        text(g, f.m.l + w + 6, by + barH - 1, String(v), { 'class': 'val' });
        var hit = el('rect', { 'class': 'hit', x: f.m.l, y: by - 2, width: Math.max(w + 40, 60), height: barH + 4 }, g);
        bindTip(g, { title: s.label + ' · ' + cat, rows: [['Clear failures', String(v)]] });
        hit.setAttribute('data-series', s.key);
      });
    });
    return f.svg;
  }

  /* ---------- Transition between states ---------- */
  function snapshot(svg) {
    var map = {};
    if (!svg) return map;
    var nodes = svg.querySelectorAll('[data-k]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      map[n.getAttribute('data-k')] = {
        x: parseFloat(n.getAttribute('data-x')),
        y: parseFloat(n.getAttribute('data-y')),
        pts: n.getAttribute('data-pts')
      };
    }
    return map;
  }

  function animateFrom(svg, prev) {
    if (reduceMotion) return;
    var items = [];
    var nodes = svg.querySelectorAll('[data-k]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var o = prev[n.getAttribute('data-k')];
      if (!o) continue;
      var pts = n.getAttribute('data-pts');
      if (pts && o.pts) {
        var a = parsePts(o.pts);
        var b = parsePts(pts);
        if (a.length === b.length) items.push({ n: n, kind: 'path', a: a, b: b });
      } else if (!isNaN(o.x)) {
        items.push({
          n: n, kind: n.tagName.toLowerCase() === 'text' ? 'text' : 'g',
          ax: o.x, ay: o.y, bx: parseFloat(n.getAttribute('data-x')), by: parseFloat(n.getAttribute('data-y'))
        });
      }
    }
    if (!items.length) return;
    var t0 = performance.now();
    var dur = 620;
    function apply(e) {
      items.forEach(function (it) {
        if (it.kind === 'path') {
          it.n.setAttribute('d', pathFrom(it.b.map(function (p, k) {
            return [it.a[k][0] + (p[0] - it.a[k][0]) * e, it.a[k][1] + (p[1] - it.a[k][1]) * e];
          })));
          it.n.style.strokeDasharray = 'none';
        } else {
          var cx = it.ax + (it.bx - it.ax) * e;
          var cy = it.ay + (it.by - it.ay) * e;
          if (it.kind === 'text') {
            it.n.setAttribute('x', cx.toFixed(2));
            it.n.setAttribute('y', cy.toFixed(2));
          } else {
            it.n.setAttribute('transform', 'translate(' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ')');
          }
        }
      });
    }
    apply(0);
    function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      apply(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- Chart instance ---------- */
  function Chart(container, renderFn) {
    this.container = container;
    this.renderFn = renderFn;
    this.cfg = null;
    this.svg = null;
    this.drawn = reduceMotion;
    this.settled = reduceMotion;
    this.focusKey = null;
    this.pinned = null;
    this.lastW = 0;
    var self = this;

    if ('ResizeObserver' in window) {
      var raf = 0;
      this.ro = new ResizeObserver(function () {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          var w = Math.floor(self.container.clientWidth);
          if (self.cfg && Math.abs(w - self.lastW) > 1) self.render();
        });
      });
      this.ro.observe(container);
    }

    if ('IntersectionObserver' in window && !reduceMotion) {
      this.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            self.reveal();
            self.io.disconnect();
          }
        });
      }, { threshold: 0.3 });
      this.io.observe(container);
    } else {
      this.drawn = true;
      this.settled = true;
    }
  }

  Chart.prototype.set = function (cfg, animate) {
    var prev = animate && this.svg ? snapshot(this.svg) : null;
    this.cfg = cfg;
    this.render();
    if (prev) animateFrom(this.svg, prev);
  };

  Chart.prototype.render = function () {
    var svg = this.renderFn(this.container, this.cfg);
    if (this.drawn) svg.classList.add('is-drawn');
    if (this.settled) svg.classList.add('is-settled');
    while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
    this.container.appendChild(svg);
    this.svg = svg;
    this.lastW = Math.floor(this.container.clientWidth);
    var draws = svg.querySelectorAll('.draw');
    for (var i = 0; i < draws.length; i++) {
      var len = draws[i].getTotalLength ? draws[i].getTotalLength() : 0;
      draws[i].style.setProperty('--len', Math.ceil(len + 2));
    }
    this.focus(this.focusKey);
  };

  Chart.prototype.reveal = function () {
    if (this.drawn) return;
    this.drawn = true;
    var self = this;
    var svg = this.svg;
    if (!svg) return;
    svg.getBoundingClientRect();
    requestAnimationFrame(function () { svg.classList.add('is-drawn'); });
    setTimeout(function () {
      self.settled = true;
      if (self.svg) self.svg.classList.add('is-settled');
    }, 1900);
  };

  Chart.prototype.focus = function (key) {
    this.focusKey = key;
    if (!this.svg) return;
    var nodes = this.svg.querySelectorAll('[data-series]');
    for (var i = 0; i < nodes.length; i++) {
      var s = nodes[i].getAttribute('data-series');
      nodes[i].classList.toggle('dim', !!key && !!s && s !== key);
    }
  };

  function create(selector, renderFn) {
    var node = typeof selector === 'string' ? document.querySelector(selector) : selector;
    return node ? new Chart(node, renderFn) : null;
  }

  /* ---------- Legend ---------- */
  function swatch(item) {
    var svg = '<svg viewBox="-10 -8 20 16" aria-hidden="true"><g class="mh-chart"><g class="s ' + item.cls + '">';
    if (item.line) svg += '<path class="line' + (item.dashed ? ' dashed' : '') + '" d="M-10 0H10" style="stroke-width:2"/>';
    if (item.marker) {
      svg += '<path class="mark' + (item.hollow ? ' hollow' : '') + (isStrokeOnly(item.marker) ? ' stroke-only' : '') + '" d="' + markerPath(item.marker, 4.2) + '"/>';
    }
    if (item.bar) svg += '<rect class="bar" x="-9" y="-4" width="18" height="8" rx="2"/>';
    return svg + '</g></g></svg>';
  }

  function legend(selector, chart, items) {
    var node = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!node || !chart) return;
    node.innerHTML = '';
    var buttons = [];
    items.forEach(function (item) {
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = swatch(item) + '<span>' + esc(item.label) + '</span>';
      if (!item.key) {
        b.disabled = true;
        b.style.cursor = 'default';
      } else {
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('mouseenter', function () { chart.focus(item.key); });
        b.addEventListener('mouseleave', function () { chart.focus(chart.pinned); });
        b.addEventListener('focus', function () { chart.focus(item.key); });
        b.addEventListener('blur', function () { chart.focus(chart.pinned); });
        b.addEventListener('click', function () {
          chart.pinned = chart.pinned === item.key ? null : item.key;
          chart.focus(chart.pinned);
          buttons.forEach(function (x) {
            var on = x.key === chart.pinned;
            x.btn.classList.toggle('is-on', on);
            x.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
      }
      buttons.push({ key: item.key, btn: b });
      node.appendChild(b);
    });
  }

  window.MHCharts = {
    create: create,
    legend: legend,
    line: renderLine,
    hbars: renderHBars,
    scatter: renderScatter
  };
})();
