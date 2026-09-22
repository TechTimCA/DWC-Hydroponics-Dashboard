/* DWC Control Center — Home Assistant custom card
 * type: custom:dwc-control-center-card
 * Built by tools/build_card.py from src/template.html (same look, same layout) — edit the template, then rebuild.
 */
(() => {
const VERSION = "__VERSION__";
const CSS = `__CSS__`;
const STAGE_HTML = `__STAGE__`;

const DEFAULTS = __DEFAULTS__;

function merge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? base.map((b, i) => merge(b, over[i])) : base;
  if (base && typeof base === "object") {
    const out = { ...base };
    if (over && typeof over === "object") for (const k of Object.keys(over)) out[k] = k in base ? merge(base[k], over[k]) : over[k];
    return out;
  }
  return over === undefined ? base : over;
}
// YAML-friendly keys (snake_case) → config keys used by the dashboard code
function normalize(cfg) {
  const c = { ...cfg };
  if (c.quick_actions && !c.quickActions) c.quickActions = c.quick_actions;
  if (c.bottles) c.bottles = c.bottles.map(b => b && b.ml_per_min != null ? { ...b, mlPerMin: b.ml_per_min } : b);
  return c;
}

function ensureFont() {
  if (document.getElementById("dwc-font")) return;
  const l = document.createElement("link"); l.id = "dwc-font"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap";
  document.head.appendChild(l);
}

function getBackground() {
  const g = window.__DWC_BG;
  if (!g || !g.parts) return null;
  const idx = Object.keys(g.parts);
  if (idx.length < g.n) return null;
  let s = ""; for (let i = 0; i < g.n; i++) s += g.parts[i];
  return "data:image/webp;base64," + s;
}

/* The dashboard code, shared with the standalone page. `root` is the card's shadow root. */
function mount(root, CONFIG, host) {
__MOUNT__
  return { S, render, pushHist, toast, buildIndex, applyState, entityIndex, UI, QA };
}

class DwcControlCenterCard extends HTMLElement {
  setConfig(config) {
    this._config = merge(DEFAULTS, normalize(config || {}));
    this._fit = (config && config.fit) || "screen";
    if (this._app) { this._teardown(); }
  }
  static getStubConfig() { return {}; }
  getCardSize() { return 16; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }

  connectedCallback() {
    if (this._ro) return;
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);
    this._onWinResize = () => this._resize();
    window.addEventListener("resize", this._onWinResize);
  }
  disconnectedCallback() {
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    window.removeEventListener("resize", this._onWinResize);
  }

  _teardown() {
    clearInterval(this._histT); clearInterval(this._bgT);
    if (this.shadowRoot) this.shadowRoot.innerHTML = "";
    this._app = null; this._last = {};
  }

  _build() {
    ensureFont();
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}
      :host{display:block;}
      #frame{position:relative;width:100%;overflow:hidden;background:var(--ground);color:var(--ink);font-family:var(--font);border-radius:var(--ha-card-border-radius,12px);}
      #stage{position:absolute;left:0;top:0;transform-origin:0 0;}
    </style><div id="frame">${STAGE_HTML}</div>`;
    const stage = root.querySelector("#stage");
    const setBg = () => { const bg = this._config.background || getBackground(); if (bg) { stage.style.backgroundImage = `url("${bg}")`; clearInterval(this._bgT); } };
    setBg(); this._bgT = setInterval(setBg, 300);
    this._app = mount(root, this._config, this);
    this._app.buildIndex();
    this._last = {};
    this._resize();
    this._histT = setInterval(() => { if (this._app) { this._app.pushHist(); this._app.render(); } }, 60000);
  }

  _resize() {
    if (!this.shadowRoot) return;
    const frame = this.shadowRoot.querySelector("#frame"), stage = this.shadowRoot.querySelector("#stage");
    if (!frame || !stage) return;
    const w = this.clientWidth || frame.clientWidth; if (!w) return;
    let s = w / 1536;
    if (this._fit === "screen") {
      const top = Math.max(0, this.getBoundingClientRect().top + (window.scrollY || 0));
      const avail = window.innerHeight - Math.min(top, 120) - 8;
      if (avail > 200) s = Math.min(s, avail / 1024);
    }
    const h = Math.round(1024 * s);
    frame.style.height = h + "px";
    stage.style.left = Math.max(0, (w - 1536 * s) / 2) + "px";
    stage.style.transform = `scale(${s})`;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._app) { this._build(); this._loadHistory(); }
    const app = this._app;
    app.S.mode = "live";
    app.S.conn = hass.connected === false ? "offline" : "live";
    let changed = false;
    for (const id of Object.keys(app.entityIndex)) {
      const st = hass.states[id];
      if (st && st !== this._last[id]) { this._last[id] = st; app.applyState(st); changed = true; }
    }
    if (changed || this._lastConn !== app.S.conn) {
      this._lastConn = app.S.conn;
      if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = null; app.render(); });
    }
  }

  async _loadHistory() {
    const hass = this._hass, app = this._app, E = this._config.entities;
    if (!hass || !app) return;
    const ids = [E.ph, E.ec, E.waterTemp, E.reservoirLevel].filter(Boolean);
    try {
      const r = await hass.callWS({ type: "history/history_during_period", start_time: new Date(Date.now() - 864e5).toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      const conv = (id, k, f = x => x) => { const rows = r[id] || []; app.S.hist[k] = rows.map(x => [(x.lu || x.lc || 0) * 1000, f(parseFloat(x.s))]).filter(p => !isNaN(p[1]) && p[0]); };
      conv(E.ph, "ph"); conv(E.ec, "ec", v => v > 20 ? v / 1000 : v); conv(E.waterTemp, "temp"); conv(E.reservoirLevel, "res");
      app.render();
    } catch (e) { /* history is optional */ }
  }

  async _runAction(key, label) {
    const app = this._app, script = this._config.quickActions[key];
    if (!script) { app.toast(`${label} isn't linked to a script yet — add quick_actions.${key} to the card config.`); return; }
    if (key === "emergencyStop" || key === "drainAll" || key === "waterChange") {
      this._armed = this._armed || {};
      if (!this._armed[key]) { this._armed[key] = true; app.toast(`Tap ${label} again within 4 s to confirm.`); setTimeout(() => this._armed[key] = false, 4000); return; }
      this._armed[key] = false;
    }
    try { await this._hass.callService("script", "turn_on", {}, { entity_id: script }); app.toast(`${label} started.`); }
    catch (e) { app.toast(`${label} failed: ${(e && e.message) || "Home Assistant returned an error"}.`); }
  }
}

if (!customElements.get("dwc-control-center-card")) customElements.define("dwc-control-center-card", DwcControlCenterCard);
window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === "dwc-control-center-card"))
  window.customCards.push({ type: "dwc-control-center-card", name: "DWC Control Center", description: "Animated DWC hydroponics control center (" + VERSION + ")", preview: false });
console.info("%c DWC-CONTROL-CENTER %c " + VERSION + " ", "background:#0b5fd6;color:#fff;border-radius:3px 0 0 3px", "background:#10243a;color:#9fd3ff;border-radius:0 3px 3px 0");
})();
