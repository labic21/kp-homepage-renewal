/* Minimal standalone runtime for the KP homepage concept (template + state + DOM morph). */
(function () {
  class DCLogic { constructor(props) { this.props = props || {}; this.state = {}; } setState(p) { Object.assign(this.state, typeof p === 'function' ? p(this.state) : p); window.__dcSchedule && window.__dcSchedule(); } }
  window.DCLogic = DCLogic;
  const cache = new Map();
  const ev = (expr, scope) => { let f = cache.get(expr); if (!f) { f = new Function('__s', 'with(__s){return (' + expr + ');}'); cache.set(expr, f); } try { return f(scope); } catch (e) { return undefined; } };
  const ONE = /^\s*\{\{([\s\S]+?)\}\}\s*$/, ALL = /\{\{([\s\S]+?)\}\}/g;
  const interp = (s, scope) => s.replace(ALL, (_, e) => { const v = ev(e, scope); return v == null ? '' : String(v); });
  const BOOL = { muted: 'muted', autoplay: 'autoplay', loop: 'loop', controls: 'controls', playsinline: 'playsInline', disablepictureinpicture: 'disablePictureInPicture' };
  function build(tpl, scope, out) {
    for (const n of Array.from((tpl && tpl.childNodes) || [])) {
      if (n.nodeType === 3) { out.push({ t: 3, v: interp(n.nodeValue, scope) }); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toLowerCase();
      if (tag === 'sc-for') { const m = (n.getAttribute('list') || '').match(ONE); const list = m ? ev(m[1], scope) : []; const as = n.getAttribute('as') || 'item'; (list || []).forEach((it, i) => build(n, Object.assign(Object.create(scope), { [as]: it, index: i }), out)); continue; }
      if (tag === 'sc-if') { const m = (n.getAttribute('value') || '').match(ONE); if (m && ev(m[1], scope)) build(n, scope, out); continue; }
      const node = { t: 1, tag: n.tagName, ns: n.namespaceURI, attrs: {}, props: {}, on: {}, ref: null, kids: [] };
      for (const a of n.attributes) {
        const name = a.name, m = a.value.match(ONE);
        if (name === 'ref') { node.ref = m ? ev(m[1], scope) : null; continue; }
        if (/^on[a-z]+$/i.test(name)) { node.on[name.slice(2).toLowerCase()] = m ? ev(m[1], scope) : null; continue; }
        if (name === 'hint-placeholder-count') continue;
        const lname = name.toLowerCase();
        if (BOOL[lname] !== undefined) { const v = m ? ev(m[1], scope) : true; node.props[BOOL[lname]] = !!v; if (v) node.attrs[lname] = ''; continue; }
        if (m) { const v = ev(m[1], scope); if (v === false || v == null) continue; node.attrs[name] = v === true ? '' : String(v); } else node.attrs[name] = interp(a.value, scope);
      }
      build(n.tagName === 'TEMPLATE' && n.content ? n.content : n, scope, node.kids);
      out.push(node);
    }
    return out;
  }
  function create(v) {
    if (v.t === 3) return document.createTextNode(v.v);
    const el = v.ns && v.ns !== 'http://www.w3.org/1999/xhtml' ? document.createElementNS(v.ns, v.tag) : document.createElement(v.tag);
    patchEl(el, v, true); return el;
  }
  function patchEl(el, v, fresh) {
    const prevA = el.__ta || {}; for (const k in prevA) if (!(k in v.attrs)) el.removeAttribute(k); el.__ta = v.attrs;
    for (const k in v.attrs) if (el.getAttribute(k) !== v.attrs[k]) el.setAttribute(k, v.attrs[k]);
    for (const k in v.props) if (el[k] !== v.props[k]) el[k] = v.props[k];
    el.__on = el.__on || {};
    for (const e in v.on) { if (!el.__on[e]) el.addEventListener(e, (x) => { const h = el.__on[e]; if (typeof h === 'function') h(x); }); el.__on[e] = v.on[e]; }
    kids(el, v.kids);
    if (fresh && typeof v.ref === 'function') v.ref(el);
  }
  function kids(el, vs) {
    const cur = Array.from(el.childNodes);
    vs.forEach((v, i) => {
      const c = cur[i];
      if (!c) { el.appendChild(create(v)); return; }
      if (v.t === 3) { if (c.nodeType === 3) { if (c.nodeValue !== v.v) c.nodeValue = v.v; } else el.replaceChild(create(v), c); return; }
      if (c.nodeType === 1 && c.tagName === v.tag) patchEl(c, v, false); else el.replaceChild(create(v), c);
    });
    for (let i = cur.length - 1; i >= vs.length; i--) el.removeChild(cur[i]);
  }
  function boot() {
    const root = document.querySelector('x-dc'); if (!root) return;
    const tp = root.querySelector('template[data-dc-tpl]'); const src = tp ? tp.content : root; const helmet = src.querySelector('helmet'); if (helmet) { Array.from(helmet.children).forEach((c) => document.head.appendChild(document.importNode(c, true))); helmet.remove(); }
    const sc = document.querySelector('script[data-dc-script]'); const code = sc ? sc.textContent : '';
    const tpl = document.createElement('template'); if (tp) { tpl.content.appendChild(tp.content.cloneNode(true)); } else tpl.innerHTML = root.innerHTML; root.innerHTML = '';
    const Comp = new Function('DCLogic', code + '\n;return Component;')(DCLogic);
    const c = new Comp({});
    let queued = false;
    const render = () => { queued = false; const vals = c.renderVals ? c.renderVals() : {}; kids(root, build(tpl.content, vals, [])); };
    window.__dcSchedule = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
    render(); if (c.componentDidMount) c.componentDidMount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
