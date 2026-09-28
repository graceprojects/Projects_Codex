// HAVEN — 2D location map: stylised streets from OpenStreetMap, nearby places, walking routes.
(() => {
  const host = document.getElementById('map2d');
  if (!host) return;
  const BASE = host.dataset.base || 'assets/map2d/';
  const VER = '8';
  const NS = 'http://www.w3.org/2000/svg';
  const TOUCH = matchMedia('(pointer: coarse)').matches;

  let started = false;
  const io = new IntersectionObserver(es => {
    if (started || !es.some(e => e.isIntersecting)) return;
    started = true; io.disconnect(); init().catch(err => { console.error(err); host.classList.add('m2-failed'); });
  }, { rootMargin: '600px 0px' });
  io.observe(host);

  // black pictograms of the landmarks (26 x 30 box, origin = bottom centre)
  const ICONS = {
    tv: '<path d="M-.6-30h1.2v6h-1.2zM-1.8-24h3.6v3h-3.6zM-.9-21h1.8v6h-1.8zM-5-15h10l-1.2 2.6h-7.6zM-1.2-12.4h2.4v2.4h-2.4zM-1.4-10-7 0h2.4l4.4-7.2zM1.4-10 7 0H4.6L.2-7.2zM-.7-10h1.4V0H-.7z"/>',
    mosque: '<path d="M-11 0v-19h2.4V0zM8.6 0v-19H11V0zM-11.4-19l1.6-4.4 1.6 4.4zM8.2-19l1.6-4.4 1.6 4.4zM-7 0v-10h14V0zM-6.4-10a6.4 6.4 0 0112.8 0zM-.5-20.5h1v4h-1z"/>',
    tower: '<path d="M-5 0v-22l5-7 5 7V0zM-9 0v-5h18v5z"/><path d="M-3-19h6M-3-15h6M-3-11h6" stroke="#f4f0e6" stroke-width="1.1"/>',
    wheel: '<g fill="none" stroke="#14120f" stroke-width="1.5"><circle cx="0" cy="-17" r="10"/><path d="M0-27v20M-10-17h20M-7-24l14 14M7-24L-7-10M0-17-6 0M0-17 6 0M-8 0h16"/></g><circle cx="0" cy="-17" r="2"/>',
    torii: '<path d="M-12-24h24v2.6h-24zM-9.5-27.5h19v2.2h-19zM-7.6-21.4h2.2V0h-2.2zM5.4-21.4h2.2V0H5.4zM-9-16.6h18v1.8H-9z"/>',
    observatory: '<path d="M-10-12a10 10 0 0120 0zM-11-12h22V0h-22z"/><path d="M-1.2-21h2.4v9h-2.4z" fill="#f4f0e6"/>',
    museum: '<path d="M-12-18 0-26l12 8zM-10-17h2.6v14H-10zM-4.3-17h2.6v14h-2.6zM1.7-17h2.6v14H1.7zM7.4-17H10v14H7.4zM-12-3h24V0h-24z"/>',
    wave: '<path d="M-11-8c3.6-4 7.4 4 11 0s7.4-4 11 0v3c-3.6-4-7.4 4-11 0s-7.4-4-11 0zM-11-15c3.6-4 7.4 4 11 0s7.4-4 11 0v3c-3.6-4-7.4 4-11 0s-7.4-4-11 0zM-7-18v-8h2.2v8zM5-18v-8h2.2v8zM-5-24h10v2H-5z"/>',
    zoo: '<path d="M-10 0v-9c0-5 3-8 8-8h6l4-5 1.5 1.5-3 4.5c2 1 3.5 3 3.5 6V0h-3v-6h-12V0z"/><circle cx="7.5" cy="-20" r="1.1" fill="#f4f0e6"/>',
    bazaar: '<path d="M-12-14 0-24l12 10zM-10-13h20V0h-20z"/><path d="M-6 0v-7a6 6 0 0112 0V0z" fill="#f4f0e6"/>',
  };

  const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const fmtKm = m => m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' км' : Math.round(m / 10) * 10 + ' м';

  async function init() {
    const [svgText, D] = await Promise.all([
      fetch(BASE + 'map.svg?v=' + VER).then(r => r.text()),
      fetch(BASE + 'data.json?v=' + VER).then(r => r.json()),
    ]);
    const stage = host.querySelector('.m2-stage'), pop = host.querySelector('.m2-pop');
    const src = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = el('svg', { class: 'm2-svg', role: 'img', 'aria-label': 'Карта района HAVEN' });
    svg.appendChild(document.importNode(src.querySelector('defs'), true));
    const world = el('g', { class: 'm2-world' }, svg);
    world.appendChild(document.importNode(src.querySelector('#m2-layers'), true));
    const ui = el('g', { class: 'm2-ui' }, svg);
    const gLabels = el('g', { class: 'm2-labels' }, ui), gMetro = el('g', {}, ui);
    const routeHalo = el('path', { class: 'm2-route-halo' }, ui), routePath = el('path', { class: 'm2-route' }, ui);
    const gIcons = el('g', {}, ui), gRouteEnds = el('g', {}, ui), gPins = el('g', {}, ui), gHome = el('g', { class: 'm2-home' }, ui);
    stage.appendChild(svg);

    // ---------- labels (screen space, collision-filtered on every zoom)
    const labels = [
      ...D.labels.map(l => ({ ...l, cls: 'm2-label', imp: l.imp })),
      ...D.areas.map(a => ({ ...a, a: a.a || 0, cls: 'm2-area', imp: 6 })),
    ].map(l => { l.node = el('text', { class: l.cls, 'text-anchor': 'middle', dy: '.35em' }, gLabels); l.node.textContent = l.t; return l; });
    const metro = D.metro.map(m => {
      const g = el('g', { class: 'm2-metro' }, gMetro);
      el('circle', { r: 7.5 }, g); const tm = el('text', { class: 'm2-metro-m', 'text-anchor': 'middle', dy: '.36em' }, g); tm.textContent = 'M';
      const t = el('text', { class: 'm2-label m2-metro-t', x: 13, dy: '.35em' }, g); t.textContent = m.t;
      return { ...m, g };
    });
    // ---------- POIs: icon at the place, numbered pin next to it
    const pins = D.pois.map(p => {
      const out = { ...p };
      if (p.icon && ICONS[p.icon]) { out.icon = el('g', { class: 'm2-icon' }, gIcons); out.icon.innerHTML = ICONS[p.icon]; }
      const g = el('g', { class: 'm2-pin', tabindex: 0, role: 'button', 'aria-label': `${p.n}. ${p.title}` }, gPins);
      el('circle', { r: 12.5 }, g); const t = el('text', { 'text-anchor': 'middle', dy: '.36em' }, g); t.textContent = p.n;
      g.addEventListener('click', ev => { ev.stopPropagation(); select(out); });
      g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(out); } });
      out.g = g;
      if (out.icon) { out.icon.style.cursor = 'pointer'; out.icon.addEventListener('click', ev => { ev.stopPropagation(); select(out); }); }
      return out;
    });
    el('circle', { class: 'm2-home-pulse', r: 30 }, gHome);
    el('path', { d: 'M-23-58h46v46H7L0-4-7-12h-16z', class: 'm2-home-box' }, gHome);
    el('image', { href: 'assets/brand/haven-symbol-light.svg', x: -16, y: -51, width: 32, height: 32 }, gHome);
    gHome.addEventListener('click', ev => { ev.stopPropagation(); select({ home: true, title: 'HAVEN', cat: 'Ваш адрес', x: D.home.x, y: D.home.y }); });
    const dotA = el('circle', { class: 'm2-route-dot', r: 4 }, gRouteEnds), dotB = el('circle', { class: 'm2-route-dot', r: 4 }, gRouteEnds);
    dotA.style.display = dotB.style.display = 'none';

    // ---------- view transform: screen = t + s * world
    let W = 1, H = 1, s = 1, tx = 0, ty = 0, fitS = 1, userMoved = false, anim = null, sel = null;
    const fitBox = (b, pad = 60) => {
      const bw = b[2] - b[0], bh = b[3] - b[1], sc = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
      return { s: sc, tx: W / 2 - sc * (b[0] + bw / 2), ty: H / 2 - sc * (b[1] + bh / 2) };
    };
    function resize() {
      W = stage.clientWidth; H = stage.clientHeight; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const f = fitBox(D.fit, TOUCH ? 30 : 70); fitS = f.s;
      if (!userMoved) { s = f.s; tx = f.tx; ty = f.ty; }
      clamp(); layout();
    }
    function clamp() {
      s = Math.min(Math.max(fitS * 8, 2.6), Math.max(fitS * .55, s));
      const e = D.ext + 300, minX = W - s * e, maxX = s * e, minY = H - s * e, maxY = s * e;      // keep the data extent on screen
      tx = Math.min(maxX, Math.max(minX, tx)); ty = Math.min(maxY, Math.max(minY, ty));
    }
    const X = x => tx + s * x, Y = y => ty + s * y;
    let raf = 0;
    const request = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; layout(); }); };
    function layout() {
      world.setAttribute('transform', `matrix(${s} 0 0 ${s} ${tx} ${ty})`);
      host.classList.toggle('m2-zoomed', s > fitS * 1.04);
      // labels with greedy collision test (importance first)
      const taken = [];
      const blockers = [[X(D.home.x) - 26, Y(D.home.y) - 62, X(D.home.x) + 26, Y(D.home.y) + 4]];
      for (const p of pins) {
        const x = X(p.x), y = Y(p.y);
        if (p.icon) { blockers.push([x - 15, y - 31, x + 15, y + 2], [x + 21 - 15, y - 30 - 15, x + 21 + 15, y - 30 + 15]); }
        else blockers.push([x - 15, y - 15, x + 15, y + 15]);
      }
      const hit = r => taken.concat(blockers).some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
      const minImp = s < fitS * .9 ? 4 : s < fitS * 1.6 ? 2 : 0;
      for (const l of [...labels].sort((a, b) => b.imp - a.imp)) {
        const x = X(l.x), y = Y(l.y);
        let show = l.imp >= minImp && x > -40 && x < W + 40 && y > -20 && y < H + 20;
        if (show) {
          const w = (l.w || (l.w = l.node.getComputedTextLength() || l.t.length * 7)) / 2 + 6, a = l.a * Math.PI / 180;
          const ex = Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * 7, ey = Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * 7;
          const r = [x - ex, y - ey, x + ex, y + ey];
          if (hit(r)) show = false; else taken.push(r);
        }
        l.node.style.display = show ? '' : 'none';
        if (show) l.node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${l.a})`);
      }
      for (const m of metro) m.g.setAttribute('transform', `translate(${X(m.x).toFixed(1)} ${Y(m.y).toFixed(1)})`);
      for (const p of pins) {
        const x = X(p.x), y = Y(p.y);
        if (p.icon) {
          p.icon.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
          p.g.setAttribute('transform', `translate(${(x + 21).toFixed(1)} ${(y - 30).toFixed(1)})`);
        } else p.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      }
      gHome.setAttribute('transform', `translate(${X(D.home.x).toFixed(1)} ${Y(D.home.y).toFixed(1)})`);
      if (sel && !sel.home && sel.route && sel.route.length) {
        const r = sel.route, d = 'M' + r.map(q => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join('L');
        routePath.setAttribute('d', d); routeHalo.setAttribute('d', d);
        dotA.setAttribute('cx', X(r[0][0])); dotA.setAttribute('cy', Y(r[0][1]));
        dotB.setAttribute('cx', X(r[r.length - 1][0])); dotB.setAttribute('cy', Y(r[r.length - 1][1]));
      }
      placePop();
    }

    // ---------- selection: route + card
    const narrow = () => W < 700;
    function placePop() {
      if (!sel) return;
      const w = pop.offsetWidth, h = pop.offsetHeight;
      pop.classList.toggle('dock', narrow());
      if (narrow()) { pop.style.transform = `translate(12px, ${Math.round(H - h - 12)}px)`; return; }
      const px = sel.home ? X(sel.x) : sel.icon ? X(sel.x) + 21 : X(sel.x), py = sel.home ? Y(sel.y) - 60 : sel.icon ? Y(sel.y) - 30 : Y(sel.y);
      const lx = sel.icon ? X(sel.x) - 16 : px - 14;                   // left edge of the icon / pin
      // candidate spots around the pin; pick the one that covers the least of the route
      const pref = sel.side === 'left' ? 'left' : 'right';
      const cands = [
        { k: 'right', left: px + 22, top: py - 14 }, { k: 'left', left: lx - 18 - w, top: py - 14 },
        { k: 'above', left: px - w / 2, top: py - 44 - h }, { k: 'below', left: px - w / 2, top: py + 40 },
      ];
      const pts = [];
      if (sel.route && !sel.home) for (let i = 0; i < sel.route.length - 1; i++) {
        const ax = X(sel.route[i][0]), ay = Y(sel.route[i][1]), bx = X(sel.route[i + 1][0]), by = Y(sel.route[i + 1][1]);
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
        for (let j = 0; j <= n; j++) pts.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]);
      }
      let best = null;
      for (const c of cands) {
        const l = Math.min(W - w - 12, Math.max(12, c.left)), t = Math.min(H - h - 12, Math.max(12, c.top));
        let score = pts.reduce((a, q) => a + (q[0] > l - 8 && q[0] < l + w + 8 && q[1] > t - 8 && q[1] < t + h + 8 ? 1 : 0), 0) * 10;
        score += (Math.abs(l - c.left) + Math.abs(t - c.top)) * .08 + (c.k === pref ? 0 : c.k === 'left' || c.k === 'right' ? 4 : 7);
        if (!best || score < best.score) best = { ...c, l, t, score };
      }
      pop.style.transform = `translate(${Math.round(best.l)}px, ${Math.round(best.t)}px)`;
      pop.classList.toggle('flip', best.k === 'left');
      pop.classList.toggle('nonotch', best.k === 'above' || best.k === 'below');
    }
    // view that shows the whole route with room for the card on the side away from the complex
    function routeView(p) {
      const r = p.route, xs = r.map(q => q[0]), ys = r.map(q => q[1]);
      const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const side = D.home.x >= p.x ? 'left' : 'right', card = Math.min(290, W - 24) + 44;
      let lm = 80, rm = 80, tm = 110, bm = 80;
      if (narrow()) { lm = rm = 52; tm = 76; bm = pop.offsetHeight + 44; }
      else if (side === 'left') lm += card; else rm += card;
      const bw = Math.max(b[2] - b[0], 120), bh = Math.max(b[3] - b[1], 120);
      const s1 = Math.max(fitS * .6, Math.min((W - lm - rm) / bw, (H - tm - bm) / bh, fitS * 4.5, 1.7));
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      return { s: s1, tx: lm + (W - lm - rm) / 2 - s1 * cx, ty: tm + (H - tm - bm) / 2 - s1 * cy, side };
    }
    function drawRoute() {
      layout();
      const L = routePath.getTotalLength();
      for (const el_ of [routePath, routeHalo]) { el_.style.transition = 'none'; el_.style.strokeDasharray = `${L} ${L}`; el_.style.strokeDashoffset = L; }
      routePath.getBoundingClientRect();
      for (const el_ of [routePath, routeHalo]) { el_.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)'; el_.style.strokeDashoffset = 0; }
      clearTimeout(drawRoute.t); drawRoute.t = setTimeout(() => { routePath.style.strokeDasharray = routeHalo.style.strokeDasharray = 'none'; }, 1300);
    }
    function select(p) {
      sel = p;
      pins.forEach(q => q.g.classList.toggle('on', q === p));
      host.classList.toggle('m2-has-sel', !!p);
      if (!p) { pop.hidden = true; routePath.setAttribute('d', ''); routeHalo.setAttribute('d', ''); dotA.style.display = dotB.style.display = 'none'; return; }
      pop.querySelector('.m2-pop-n').textContent = p.home ? 'BH' : String(p.n).padStart(2, '0');
      pop.querySelector('.m2-pop-title').textContent = p.title;
      pop.querySelector('.m2-pop-cat').textContent = p.cat || '';
      const walk = p.walk <= 30 ? `${p.walk} мин пешком` : `${p.walk} мин пешком · ${p.car} мин на авто`;
      pop.querySelector('.m2-pop-meta').textContent = p.home ? 'Вы здесь' : `${walk} · ${fmtKm(p.len)}`;
      pop.hidden = false;
      if (p.home || !p.route || !p.route.length) { routePath.setAttribute('d', ''); routeHalo.setAttribute('d', ''); dotA.style.display = dotB.style.display = 'none'; layout(); return; }
      routePath.style.opacity = routeHalo.style.opacity = 0; dotA.style.display = dotB.style.display = '';
      const v = routeView(p); p.side = v.side; userMoved = true;
      flyTo(v.s, v.tx, v.ty, () => { routePath.style.opacity = routeHalo.style.opacity = ''; drawRoute(); });
    }
    function flyTo(s1, tx1, ty1, done) {
      const s0 = s, tx0 = tx, ty0 = ty, t0 = performance.now();
      const dur = Math.abs(Math.log(s1 / s0)) < .02 && Math.hypot(tx1 - tx0, ty1 - ty0) < 4 ? 0 : 800;
      cancelAnimationFrame(anim);
      const step = now => {
        const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        s = s0 + (s1 - s0) * e; tx = tx0 + (tx1 - tx0) * e; ty = ty0 + (ty1 - ty0) * e; clamp(); layout();
        if (k < 1) anim = requestAnimationFrame(step); else if (done) done();
      };
      anim = requestAnimationFrame(step);
    }
    function zoomAt(f, cx, cy) {
      const s1 = Math.min(Math.max(fitS * 8, 2.6), Math.max(fitS * .55, s * f)), k = s1 / s;
      tx = cx - (cx - tx) * k; ty = cy - (cy - ty) * k; s = s1; userMoved = true; clamp(); request();
    }

    // ---------- interaction: drag to pan, ⌘/ctrl + wheel or pinch to zoom, buttons
    const pts = new Map(); let drag = null, moved = 0, pinch0 = 0;
    stage.addEventListener('pointerdown', e => {
      if (e.target.closest && e.target.closest('.m2-pin, .m2-icon, .m2-home')) return;     // let pins receive their click
      if (TOUCH && !host.classList.contains('m2-zoomed') && e.pointerType === 'touch' && pts.size === 0) { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); return; }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0;
      if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, tx, ty };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); drag = null; }
    });
    stage.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = stage.getBoundingClientRect();
        if (pinch0) zoomAt(d / pinch0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinch0 = d; moved = 99; return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > 3) {
        if (!stage.classList.contains('dragging')) { try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } stage.classList.add('dragging'); }
        tx = drag.tx + dx; ty = drag.ty + dy; userMoved = true; clamp(); request();
      }
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; if (!pts.size) { drag = null; stage.classList.remove('dragging'); } };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('click', e => { if (moved < 4 && e.target.closest && !e.target.closest('.m2-pin, .m2-icon, .m2-home')) select(null); });
    let hintT = 0;
    stage.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); const r = stage.getBoundingClientRect();
        zoomAt(Math.exp(-e.deltaY * (e.ctrlKey && !e.metaKey ? .012 : .0022)), e.clientX - r.left, e.clientY - r.top);
      } else { host.classList.add('m2-hint'); clearTimeout(hintT); hintT = setTimeout(() => host.classList.remove('m2-hint'), 1300); }
    }, { passive: false });
    host.querySelector('.m2-zoom-in').addEventListener('click', () => zoomAt(1.5, W / 2, H / 2));
    host.querySelector('.m2-zoom-out').addEventListener('click', () => zoomAt(1 / 1.5, W / 2, H / 2));
    host.querySelector('.m2-pop-close').addEventListener('click', ev => { ev.stopPropagation(); select(null); });
    new ResizeObserver(resize).observe(stage);
    resize();
    host.classList.add('m2-ready');
  }
})();
