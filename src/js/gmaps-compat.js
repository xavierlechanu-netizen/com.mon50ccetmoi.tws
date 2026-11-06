/**
 * gmaps-compat.js — Remplacement souverain de Google Maps.
 *
 * Installe un objet `window.google.maps` qui reproduit le sous-ensemble de l'API Google utilisé
 * par l'application (Map, Marker, AdvancedMarkerElement, InfoWindow, Polyline, Circle, Geocoder,
 * DirectionsService, Autocomplete, PlacesService, OverlayView, geometry…), mais qui dessine avec
 * Leaflet sur le fond « Plan IGN » et interroge les services IGN / OpenStreetMap (voir map-engine.js).
 *
 * Aucun script ni aucune donnée ne part chez Google. Le code existant fonctionne sans réécriture ;
 * les nouveaux écrans peuvent utiliser directement Leaflet (window.map est une carte Leaflet).
 */

import {
  readLatLng,
  distanceMeters,
  bearingDeg,
  decodePolyline,
  isNearPath,
  formatDistance,
  formatDuration,
  computeRoute,
  geocodeAddress,
  reverseGeocode,
  completeAddress,
  findNearbyGarages,
} from "./map-engine.js";

const IGN_TILES =
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png" +
  "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";
const IGN_ATTRIBUTION =
  '&copy; <a href="https://www.ign.fr/" target="_blank" rel="noopener">IGN</a> · ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

function Lf() {
  if (typeof window === "undefined" || !window.L) throw new Error("Leaflet n'est pas chargé");
  return window.L;
}

// ─── Événements (équivalent google.maps.event) ───────────────────────────────

const LISTENERS = new WeakMap();

function listen(obj, name, fn) {
  if (!LISTENERS.has(obj)) LISTENERS.set(obj, {});
  const all = LISTENERS.get(obj);
  (all[name] = all[name] || []).push(fn);
  return { remove: () => { all[name] = (all[name] || []).filter((f) => f !== fn); } };
}

function fire(obj, name, ...args) {
  const fns = (LISTENERS.get(obj) || {})[name] || [];
  fns.slice().forEach((fn) => {
    try { fn.apply(obj, args); } catch (e) { console.error(`[Carte] Erreur dans l'écouteur "${name}"`, e); }
  });
}

const event = {
  addListener(obj, name, fn) {
    if (obj && obj._isCompatMap) return obj.addListener(name, fn);
    return listen(obj, name, fn);
  },
  addListenerOnce(obj, name, fn) {
    const h = event.addListener(obj, name, (...a) => { h.remove(); fn.apply(obj, a); });
    return h;
  },
  addDomListener(el, name, fn) {
    el.addEventListener(name, fn);
    return { remove: () => el.removeEventListener(name, fn) };
  },
  removeListener(handle) { if (handle && handle.remove) handle.remove(); },
  clearInstanceListeners(obj) { LISTENERS.delete(obj); },
  trigger(obj, name, ...args) {
    if (obj && obj._isCompatMap) obj.fire(name, args[0] || {});
    else fire(obj, name, ...args);
  },
};

// ─── Coordonnées ────────────────────────────────────────────────────────────

class LatLng {
  constructor(lat, lng) {
    const p = typeof lat === "object" && lat !== null ? readLatLng(lat) : { lat: Number(lat), lng: Number(lng) };
    this._lat = p ? p.lat : NaN;
    this._lng = p ? p.lng : NaN;
  }
  lat() { return this._lat; }
  lng() { return this._lng; }
  toJSON() { return { lat: this._lat, lng: this._lng }; }
  equals(o) { const p = readLatLng(o); return !!p && p.lat === this._lat && p.lng === this._lng; }
  toString() { return `(${this._lat}, ${this._lng})`; }
  toUrlValue(precision = 6) { return `${this._lat.toFixed(precision)},${this._lng.toFixed(precision)}`; }
}

const toLatLng = (p) => (p instanceof LatLng ? p : new LatLng(p));

/** Coordonnée au format Leaflet ; accepte Google LatLng, littéral {lat,lng}, L.LatLng ou tableau. */
function toL(p) {
  const L = Lf();
  if (p instanceof L.LatLng) return p;
  const q = readLatLng(p);
  return q ? L.latLng(q.lat, q.lng) : null;
}

class LatLngBounds {
  constructor(sw, ne) {
    this._pts = [];
    if (sw) this.extend(sw);
    if (ne) this.extend(ne);
  }
  extend(p) { const q = readLatLng(p); if (q) this._pts.push(q); return this; }
  isEmpty() { return this._pts.length === 0; }
  getCenter() {
    if (this.isEmpty()) return new LatLng(0, 0);
    const b = this._toL();
    return toLatLng(b.getCenter());
  }
  contains(p) { const q = toL(p); return !this.isEmpty() && !!q && this._toL().contains(q); }
  getNorthEast() { return toLatLng(this._toL().getNorthEast()); }
  getSouthWest() { return toLatLng(this._toL().getSouthWest()); }
  _toL() { return Lf().latLngBounds(this._pts.map((q) => [q.lat, q.lng])); }
}

function toLBounds(b) {
  const L = Lf();
  if (b instanceof L.LatLngBounds) return b;
  if (b instanceof LatLngBounds) return b.isEmpty() ? null : b._toL();
  if (b && typeof b === "object" && "north" in b) return L.latLngBounds([b.south, b.west], [b.north, b.east]);
  return null;
}

// ─── Carte ──────────────────────────────────────────────────────────────────

let styleInjected = false;
function injectStyles() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const css = document.createElement("style");
  css.id = "gmaps-compat-style";
  css.textContent = `
    .gmc-dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.6); }
    .gmc-dark.leaflet-container { background: #1a1d21; }
    .gmc-icon { background: none; border: none; }
    .gmc-anchor { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); }
    .gmc-anchor.gmc-center { transform: translate(-50%, -50%); }
    .gmc-pin { width: 22px; height: 22px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
    .gmc-suggest { position: fixed; z-index: 100000; background: #16181c; color: #f2f2f2; border: 1px solid #333; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.45); max-height: 280px; overflow-y: auto; font: 14px/1.35 'Outfit', system-ui, sans-serif; }
    .gmc-suggest div { padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #24272c; }
    .gmc-suggest div:last-child { border-bottom: none; }
    .gmc-suggest div.active, .gmc-suggest div:hover { background: #00d2ff22; }
    .gmc-suggest .gmc-credit { font-size: 11px; color: #8a8f98; cursor: default; padding: 6px 12px; }
    .gmc-suggest .gmc-credit:hover { background: none; }
  `;
  document.head.appendChild(css);
}

const MAP_EVENTS = {
  idle: "moveend",
  bounds_changed: "moveend",
  center_changed: "move",
  zoom_changed: "zoomend",
  dragstart: "dragstart",
  drag: "drag",
  dragend: "dragend",
  click: "click",
  dblclick: "dblclick",
  rightclick: "contextmenu",
  tilesloaded: "load",
};

function wrapMouseEvent(e) {
  return e && e.latlng ? { latLng: toLatLng(e.latlng), domEvent: e.originalEvent, stop() {} } : e;
}

/**
 * Crée une carte Leaflet qui accepte aussi les appels Google (setCenter, addListener, panTo(LatLng)…).
 * `new google.maps.Map(el, opts)` renvoie directement cette carte.
 */
function createMap(el, opts = {}) {
  const L = Lf();
  injectStyles();
  if (!el) throw new Error("Élément de carte introuvable");
  if (el._leaflet_id) {
    // Une carte de secours occupe déjà l'élément : on la remplace.
    if (window.leafletMap && window.leafletMap.getContainer() === el) window.leafletMap.remove();
    else delete el._leaflet_id;
  }
  // Ne garder que l'élément nu (un éventuel message de chargement est remplacé).
  while (el.firstChild) el.removeChild(el.firstChild);

  const center = toL(opts.center) || L.latLng(46.6, 2.4);
  const m = L.map(el, {
    center,
    zoom: typeof opts.zoom === "number" ? opts.zoom : 6,
    zoomControl: opts.zoomControl === true,
    attributionControl: true,
    maxZoom: 19,
    minZoom: 3,
    tap: true,
  });
  m.attributionControl.setPrefix(false);
  L.tileLayer(IGN_TILES, { maxZoom: 19, maxNativeZoom: 19, attribution: IGN_ATTRIBUTION, crossOrigin: true }).addTo(m);
  if (Array.isArray(opts.styles) && opts.styles.length > 0) el.classList.add("gmc-dark");

  const proto = L.Map.prototype;
  m._isCompatMap = true;
  m.panTo = function (p, o) { const q = toL(p); return q ? proto.panTo.call(this, q, o) : this; };
  m.setCenter = function (p) { const q = toL(p); return q ? this.setView(q, this.getZoom(), { animate: false }) : this; };
  m.panBy = function (x, y, o) {
    if (typeof x === "number" && typeof y === "number") return proto.panBy.call(this, [x, y], o);
    return proto.panBy.call(this, x, y);
  };
  m.fitBounds = function (b, o) {
    const lb = toLBounds(b);
    if (!lb) return this;
    const pad = typeof o === "number" ? { padding: [o, o] } : o && !(o.padding instanceof Array) && typeof o === "object" && "top" in o
      ? { paddingTopLeft: [o.left || 0, o.top || 0], paddingBottomRight: [o.right || 0, o.bottom || 0] }
      : o || { padding: [40, 40] };
    return proto.fitBounds.call(this, lb, pad);
  };
  m.getDiv = function () { return this.getContainer(); };
  m.getTilt = () => 0;
  m.setTilt = () => {};
  m.getHeading = () => 0;
  m.setHeading = () => {};
  m.getMapTypeId = () => "roadmap";
  m.setMapTypeId = () => {};
  m.setOptions = function (o = {}) {
    if (o.center) this.setCenter(o.center);
    if (typeof o.zoom === "number") this.setZoom(o.zoom);
    if (Array.isArray(o.styles)) el.classList.toggle("gmc-dark", o.styles.length > 0);
    if (o.draggable === false || o.gestureHandling === "none") this.dragging.disable();
    if (o.draggable === true || o.gestureHandling === "greedy") this.dragging.enable();
  };
  m.addListener = function (name, fn) {
    const lname = MAP_EVENTS[name] || name;
    const handler = (e) => fn.call(this, wrapMouseEvent(e));
    this.on(lname, handler);
    return { remove: () => this.off(lname, handler) };
  };
  // Les appels Google lisent getCenter().lat() ; Leaflet lit .lat : on renvoie un objet qui sert les deux.
  m.getCenterLatLng = function () { return toLatLng(proto.getCenter.call(this)); };

  // Leaflet calcule mal sa taille si la carte apparaît dans un écran caché : on la recalcule.
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => m.invalidateSize({ pan: false })).observe(el);
  }
  setTimeout(() => m.invalidateSize({ pan: false }), 300);
  return m;
}

function MapCtor(el, opts) { return createMap(el, opts); }

const leafletMapOf = (map) => (map && map._isCompatMap ? map : map && map.getContainer ? map : null);

// ─── Marqueurs ──────────────────────────────────────────────────────────────

const SymbolPath = { CIRCLE: 0, FORWARD_CLOSED_ARROW: 1, FORWARD_OPEN_ARROW: 2, BACKWARD_CLOSED_ARROW: 3, BACKWARD_OPEN_ARROW: 4 };

function circleSymbol(icon) {
  const r = Math.max(2, Number(icon.scale) || 6);
  const d = document.createElement("div");
  d.style.cssText = `width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:${icon.fillColor || "#00d2ff"};` +
    `opacity:${icon.fillOpacity ?? 1};border:${icon.strokeWeight ?? 1}px solid ${icon.strokeColor || "#fff"};box-sizing:border-box;`;
  return d;
}

function defaultPin(color = "#ea4335") {
  const d = document.createElement("div");
  d.className = "gmc-pin";
  d.style.background = color;
  d.style.marginBottom = "8px";
  return d;
}

/** Construit l'icône Leaflet d'un marqueur à partir des options Google. */
function buildIcon({ content, icon, centered }) {
  const L = Lf();
  if (typeof icon === "string" || (icon && icon.url)) {
    const url = typeof icon === "string" ? icon : icon.url;
    const size = icon && icon.scaledSize ? [icon.scaledSize.width, icon.scaledSize.height] : [32, 32];
    const anchor = icon && icon.anchor ? [icon.anchor.x, icon.anchor.y] : [size[0] / 2, size[1]];
    return L.icon({ iconUrl: url, iconSize: size, iconAnchor: anchor, popupAnchor: [0, -anchor[1]] });
  }
  const inner = content || (icon && icon.path === SymbolPath.CIRCLE ? circleSymbol(icon) : defaultPin());
  const wrap = document.createElement("div");
  wrap.className = "gmc-anchor" + (centered || (icon && icon.path === SymbolPath.CIRCLE) ? " gmc-center" : "");
  wrap.appendChild(inner instanceof Node ? inner : document.createTextNode(String(inner)));
  return L.divIcon({ html: wrap, className: "gmc-icon", iconSize: [0, 0], iconAnchor: [0, 0], popupAnchor: [0, -28] });
}

/** google.maps.Marker et AdvancedMarkerElement (mêmes propriétés et méthodes utiles). */
class Marker {
  constructor(opts = {}) {
    this._opts = { ...opts };
    this._position = opts.position ? readLatLng(opts.position) : null;
    this._layer = null;
    this._map = null;
    if (opts.map && this._position) this.setMap(opts.map);
    else if (opts.map) this._pendingMap = opts.map;
  }
  _ensureLayer() {
    const L = Lf();
    if (this._layer || !this._position) return;
    this._layer = L.marker([this._position.lat, this._position.lng], {
      icon: buildIcon(this._opts),
      title: this._opts.title || "",
      zIndexOffset: Number(this._opts.zIndex) || 0,
      keyboard: false,
      draggable: !!this._opts.draggable,
    });
    this._layer.on("click", (e) => { fire(this, "click", wrapMouseEvent(e)); fire(this, "gmp-click", wrapMouseEvent(e)); });
    this._layer.on("dragend", () => {
      this._position = readLatLng(this._layer.getLatLng());
      fire(this, "dragend", { latLng: toLatLng(this._position) });
    });
  }
  setMap(map) {
    const lm = leafletMapOf(map);
    if (this._layer && this._map) this._layer.remove();
    this._map = lm;
    if (!lm) return;
    this._ensureLayer();
    if (this._layer) this._layer.addTo(lm);
  }
  getMap() { return this._map; }
  get map() { return this._map; }
  set map(v) { this.setMap(v); }
  getPosition() { return this._position ? toLatLng(this._position) : null; }
  setPosition(p) {
    this._position = readLatLng(p);
    if (!this._position) return;
    if (this._layer) this._layer.setLatLng([this._position.lat, this._position.lng]);
    else if (this._pendingMap) { const m = this._pendingMap; this._pendingMap = null; this.setMap(m); }
  }
  // AdvancedMarkerElement : .position renvoie un littéral {lat, lng}
  get position() { return this._position ? { ...this._position } : null; }
  set position(p) { this.setPosition(p); }
  get content() { return this._opts.content || null; }
  set content(el) { this._opts.content = el; if (this._layer) this._layer.setIcon(buildIcon(this._opts)); }
  setIcon(icon) { this._opts.icon = icon; if (this._layer) this._layer.setIcon(buildIcon(this._opts)); }
  getIcon() { return this._opts.icon; }
  get title() { return this._opts.title || ""; }
  set title(t) { this._opts.title = t; }
  setTitle(t) { this._opts.title = t; }
  get zIndex() { return this._opts.zIndex; }
  set zIndex(z) { this.setZIndex(z); }
  setZIndex(z) { this._opts.zIndex = z; if (this._layer) this._layer.setZIndexOffset(Number(z) || 0); }
  setVisible(v) { if (this._layer) this._layer.setOpacity(v ? 1 : 0); }
  getVisible() { return !this._layer || this._layer.options.opacity !== 0; }
  setLabel() {}
  setAnimation() {}
  setDraggable(v) { this._opts.draggable = v; if (this._layer && this._layer.dragging) v ? this._layer.dragging.enable() : this._layer.dragging.disable(); }
  addListener(name, fn) { return listen(this, name === "gmp-click" ? "click" : name, fn); }
  addEventListener(name, fn) { return this.addListener(name === "gmp-click" ? "click" : name, fn); }
}

class PinElement {
  constructor(opts = {}) {
    const d = defaultPin(opts.background || "#ea4335");
    if (opts.borderColor) d.style.borderColor = opts.borderColor;
    if (opts.scale) d.style.transform = `rotate(-45deg) scale(${opts.scale})`;
    if (opts.glyph) {
      const g = document.createElement("span");
      g.style.cssText = `display:block;transform:rotate(45deg);text-align:center;line-height:18px;font-size:11px;color:${opts.glyphColor || "#fff"}`;
      g.textContent = typeof opts.glyph === "string" ? opts.glyph : "";
      d.appendChild(g);
    }
    this.element = d;
  }
}

// ─── Bulle d'information ───────────────────────────────────────────────────

class InfoWindow {
  constructor(opts = {}) {
    this._content = opts.content || "";
    this._position = opts.position ? readLatLng(opts.position) : null;
    this._popup = null;
    this._map = null;
  }
  setContent(c) { this._content = c; if (this._popup) this._popup.setContent(c); }
  getContent() { return this._content; }
  setPosition(p) { this._position = readLatLng(p); if (this._popup && this._position) this._popup.setLatLng(this._position); }
  getPosition() { return this._position ? toLatLng(this._position) : null; }
  open(a, b) {
    const L = Lf();
    let map = a;
    let anchor = b;
    if (a && !a._isCompatMap && (a.map || a.anchor)) { map = a.map; anchor = a.anchor; }
    const lm = leafletMapOf(map) || (anchor && anchor.getMap && anchor.getMap()) || window.map;
    if (!lm) return;
    const pos = anchor ? readLatLng(anchor.getPosition ? anchor.getPosition() : anchor.position) : this._position;
    if (!pos) return;
    if (!this._popup) {
      this._popup = L.popup({ maxWidth: 300, autoPanPadding: [24, 80], className: "gmc-popup" });
      this._popup.on("remove", () => fire(this, "closeclick"));
    }
    this._popup.setLatLng([pos.lat, pos.lng]).setContent(this._content).openOn(lm);
    this._map = lm;
    fire(this, "domready");
  }
  close() { if (this._popup && this._map) this._map.closePopup(this._popup); }
  addListener(name, fn) { return listen(this, name, fn); }
}

// ─── Formes ─────────────────────────────────────────────────────────────────

function pathOptions(o = {}) {
  const out = {};
  if (o.strokeColor) out.color = o.strokeColor;
  if (o.strokeOpacity !== undefined) out.opacity = o.strokeOpacity;
  if (o.strokeWeight !== undefined) out.weight = o.strokeWeight;
  if (o.fillColor) out.fillColor = o.fillColor;
  if (o.fillOpacity !== undefined) out.fillOpacity = o.fillOpacity;
  if (o.clickable === false) out.interactive = false;
  return out;
}

class MVCArray {
  constructor(items) { this._a = items; }
  getArray() { return this._a; }
  getLength() { return this._a.length; }
  getAt(i) { return this._a[i]; }
  forEach(fn) { this._a.forEach(fn); }
}

class ShapeBase {
  _bindLayer() {
    this._layer.on("click", (e) => fire(this, "click", wrapMouseEvent(e)));
    if (this._pendingMap) { const m = this._pendingMap; this._pendingMap = null; this.setMap(m); }
  }
  setMap(map) {
    const lm = leafletMapOf(map);
    if (this._map) this._layer.remove();
    this._map = lm;
    if (lm) this._layer.addTo(lm);
  }
  getMap() { return this._map; }
  setOptions(o = {}) { this._layer.setStyle(pathOptions(o)); if (o.map !== undefined) this.setMap(o.map); }
  setVisible(v) { if (this._map) { v ? this._layer.addTo(this._map) : this._layer.remove(); } }
  addListener(name, fn) { return listen(this, name, fn); }
}

class Polyline extends ShapeBase {
  constructor(opts = {}) {
    super();
    this._path = (opts.path || []).map(readLatLng).filter(Boolean);
    this._layer = Lf().polyline(this._path.map((p) => [p.lat, p.lng]), { interactive: false, ...pathOptions(opts) });
    this._pendingMap = opts.map;
    this._bindLayer();
  }
  setPath(path) {
    this._path = (path && path.getArray ? path.getArray() : path || []).map(readLatLng).filter(Boolean);
    this._layer.setLatLngs(this._path.map((p) => [p.lat, p.lng]));
  }
  getPath() { return new MVCArray(this._path.map(toLatLng)); }
}

class Polygon extends Polyline {
  constructor(opts = {}) {
    super({ ...opts, map: null });
    this._layer = Lf().polygon(this._path.map((p) => [p.lat, p.lng]), pathOptions(opts));
    this._pendingMap = opts.map;
    this._bindLayer();
  }
}

class Circle extends ShapeBase {
  constructor(opts = {}) {
    super();
    const c = readLatLng(opts.center) || { lat: 0, lng: 0 };
    this._layer = Lf().circle([c.lat, c.lng], { radius: Number(opts.radius) || 1, ...pathOptions(opts) });
    this._pendingMap = opts.map;
    this._bindLayer();
  }
  setCenter(p) { const c = readLatLng(p); if (c) this._layer.setLatLng([c.lat, c.lng]); }
  getCenter() { return toLatLng(this._layer.getLatLng()); }
  setRadius(r) { this._layer.setRadius(Number(r) || 1); }
  getRadius() { return this._layer.getRadius(); }
  getBounds() {
    const b = this._layer.getBounds ? this._layer.getBounds() : null;
    return b ? new LatLngBounds(b.getSouthWest(), b.getNorthEast()) : null;
  }
}

/** google.maps.OverlayView : élément HTML libre positionné sur la carte. */
class OverlayView {
  setMap(map) {
    const lm = leafletMapOf(map);
    if (this._map) {
      this._map.off("zoom move zoomend moveend viewreset", this._redraw);
      if (this.onRemove) this.onRemove();
    }
    this._map = lm;
    if (!lm) return;
    this._redraw = () => this.draw && this.draw();
    if (this.onAdd) this.onAdd();
    lm.on("zoom move zoomend moveend viewreset", this._redraw);
    this._redraw();
  }
  getMap() { return this._map; }
  getPanes() {
    const m = this._map;
    if (!m) return null;
    const marker = m.getPane("markerPane");
    return { mapPane: m.getPane("mapPane"), overlayLayer: m.getPane("overlayPane"), overlayMouseTarget: marker, markerLayer: marker, floatPane: m.getPane("popupPane") };
  }
  getProjection() {
    const m = this._map;
    if (!m) return null;
    return {
      fromLatLngToDivPixel: (p) => { const q = toL(p); return q ? m.latLngToLayerPoint(q) : null; },
      fromLatLngToContainerPixel: (p) => { const q = toL(p); return q ? m.latLngToContainerPoint(q) : null; },
      fromContainerPixelToLatLng: (pt) => toLatLng(m.containerPointToLatLng([pt.x, pt.y])),
    };
  }
  addListener(name, fn) { return listen(this, name, fn); }
}

class TrafficLayer {
  // Pas d'équivalent souverain au trafic temps réel de Google : couche volontairement vide.
  setMap() {}
  getMap() { return null; }
}

// ─── Services ───────────────────────────────────────────────────────────────

const GeocoderStatus = { OK: "OK", ZERO_RESULTS: "ZERO_RESULTS", ERROR: "ERROR" };

function placeToGeocoderResult(p) {
  return {
    formatted_address: p.label,
    name: p.name,
    place_id: p.placeId,
    types: [p.type || "street_address"],
    address_components: p.addressComponents,
    geometry: { location: new LatLng(p.lat, p.lng), location_type: "ROOFTOP" },
  };
}

class Geocoder {
  /** geocode({address} | {location}, callback?) → Promise<{results}> */
  geocode(request = {}, callback) {
    const near = window.currentPosition || null;
    const job = request.location || request.latLng
      ? reverseGeocode(request.location || request.latLng)
      : geocodeAddress(request.address || "", { near });
    const p = job.then(
      (places) => {
        const results = places.map(placeToGeocoderResult);
        if (callback) callback(results, results.length ? GeocoderStatus.OK : GeocoderStatus.ZERO_RESULTS);
        return { results };
      },
      (err) => {
        console.warn("[Carte] Géocodage IGN indisponible :", err.message);
        if (callback) callback([], GeocoderStatus.ERROR);
        return { results: [] };
      },
    );
    return p;
  }
}

const TravelMode = { DRIVING: "DRIVING", BICYCLING: "BICYCLING", WALKING: "WALKING", TRANSIT: "TRANSIT" };
const DirectionsStatus = { OK: "OK", ZERO_RESULTS: "ZERO_RESULTS", NOT_FOUND: "NOT_FOUND", UNKNOWN_ERROR: "UNKNOWN_ERROR" };

/** Résultat au format DirectionsResult de Google à partir d'un itinéraire IGN. */
function toDirectionsResult(route, request) {
  const steps = route.steps.map((s) => ({
    instructions: s.instructions,
    maneuver: s.maneuver,
    distance: { text: formatDistance(s.distanceMeters), value: s.distanceMeters },
    duration: { text: formatDuration(s.durationSec), value: s.durationSec },
    start_location: new LatLng(s.start.lat, s.start.lng),
    end_location: new LatLng(s.end.lat, s.end.lng),
    path: s.path.map((p) => new LatLng(p.lat, p.lng)),
    travel_mode: request.travelMode || TravelMode.DRIVING,
  }));
  const overview = route.path.map((p) => new LatLng(p.lat, p.lng));
  const bounds = new LatLngBounds();
  overview.forEach((p) => bounds.extend(p));
  const first = route.path[0];
  const last = route.path[route.path.length - 1];
  return {
    request,
    routes: [{
      bounds,
      overview_path: overview,
      summary: steps.length ? steps.reduce((a, b) => (b.distance.value > a.distance.value ? b : a)).instructions.replace(/^.* sur /, "") : "",
      warnings: [],
      legs: [{
        distance: { text: formatDistance(route.distanceMeters), value: route.distanceMeters },
        duration: { text: formatDuration(route.durationSec), value: route.durationSec },
        start_location: new LatLng(first.lat, first.lng),
        end_location: new LatLng(last.lat, last.lng),
        start_address: "",
        end_address: "",
        steps,
      }],
    }],
  };
}

async function resolvePoint(p) {
  if (typeof p === "string") {
    const found = await geocodeAddress(p, { near: window.currentPosition });
    if (!found.length) throw new Error("Adresse introuvable");
    return { lat: found[0].lat, lng: found[0].lng };
  }
  if (p && p.location) return readLatLng(p.location);
  return readLatLng(p);
}

class DirectionsService {
  /** Itinéraire IGN sans autoroute par défaut (50 cc / VSP). */
  route(request = {}, callback) {
    const job = (async () => {
      const [o, d] = await Promise.all([resolvePoint(request.origin), resolvePoint(request.destination)]);
      const route = await computeRoute(o, d, {
        mode: request.travelMode || TravelMode.DRIVING,
        // Les 50 cc n'ont jamais le droit à l'autoroute : interdite même si la demande l'oublie.
        avoidHighways: true,
      });
      return toDirectionsResult(route, request);
    })();
    return job.then(
      (result) => { if (callback) callback(result, DirectionsStatus.OK); return result; },
      (err) => {
        console.warn("[Carte] Itinéraire IGN indisponible :", err.message);
        const status = /introuvable|Aucun/.test(err.message) ? DirectionsStatus.ZERO_RESULTS : DirectionsStatus.UNKNOWN_ERROR;
        if (callback) { callback({ routes: [] }, status); return { routes: [] }; }
        throw Object.assign(new Error(status), { code: status });
      },
    );
  }
}

class DirectionsRenderer {
  constructor(opts = {}) {
    this._opts = opts;
    this._layers = [];
    this._map = leafletMapOf(opts.map);
    this._result = null;
  }
  setMap(map) { this._clear(); this._map = leafletMapOf(map); if (this._result) this.setDirections(this._result); }
  getMap() { return this._map; }
  setOptions(o = {}) { Object.assign(this._opts, o); if (this._result) this.setDirections(this._result); }
  getDirections() { return this._result; }
  _clear() { this._layers.forEach((l) => l.remove()); this._layers = []; }
  setDirections(result) {
    const L = Lf();
    this._clear();
    this._result = result;
    const route = result && result.routes && result.routes[0];
    if (!route || !this._map) return;
    const po = this._opts.polylineOptions || {};
    const line = L.polyline(route.overview_path.map((p) => [p.lat(), p.lng()]), {
      color: po.strokeColor || "#00d2ff", weight: po.strokeWeight || 6, opacity: po.strokeOpacity ?? 0.85, interactive: false,
    }).addTo(this._map);
    this._layers.push(line);
    if (!this._opts.suppressMarkers) {
      const leg = route.legs[0];
      [[leg.start_location, "#34a853"], [leg.end_location, "#ea4335"]].forEach(([p, color]) => {
        const mk = L.marker([p.lat(), p.lng()], { icon: buildIcon({ content: defaultPin(color) }), keyboard: false }).addTo(this._map);
        this._layers.push(mk);
      });
    }
    if (!this._opts.preserveViewport) this._map.fitBounds(line.getBounds(), { padding: [40, 40] });
  }
}

// ─── Lieux ──────────────────────────────────────────────────────────────────

const PlacesServiceStatus = { OK: "OK", ZERO_RESULTS: "ZERO_RESULTS", UNKNOWN_ERROR: "UNKNOWN_ERROR" };

/** Champ de recherche avec suggestions IGN (équivalent google.maps.places.Autocomplete). */
class Autocomplete {
  constructor(input, opts = {}) {
    injectStyles();
    this._input = input;
    this._opts = opts;
    this._place = null;
    this._items = [];
    this._active = -1;
    this._box = document.createElement("div");
    this._box.className = "gmc-suggest";
    this._box.style.display = "none";
    this._box.setAttribute("role", "listbox");
    document.body.appendChild(this._box);
    input.setAttribute("autocomplete", "off");

    let timer = null;
    let seq = 0;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const text = input.value;
      if (text.trim().length < 3) { this._hide(); return; }
      timer = setTimeout(async () => {
        const mine = ++seq;
        try {
          const items = await completeAddress(text, { near: window.currentPosition });
          if (mine === seq) this._show(items);
        } catch (e) {
          console.warn("[Carte] Suggestions IGN indisponibles :", e.message);
        }
      }, 250);
    });
    input.addEventListener("keydown", (e) => {
      const open = this._box.style.display !== "none" && this._items.length;
      if (e.key === "ArrowDown" && open) { e.preventDefault(); this._highlight(this._active + 1); }
      else if (e.key === "ArrowUp" && open) { e.preventDefault(); this._highlight(this._active - 1); }
      else if (e.key === "Enter") {
        if (open && this._active >= 0) { e.preventDefault(); this._choose(this._items[this._active]); }
        else { this._hide(); this._place = { name: input.value }; fire(this, "place_changed"); }
      } else if (e.key === "Escape") this._hide();
    });
    input.addEventListener("blur", () => setTimeout(() => this._hide(), 200));
    window.addEventListener("resize", () => this._position());
  }
  _position() {
    const r = this._input.getBoundingClientRect();
    Object.assign(this._box.style, { left: `${r.left}px`, top: `${r.bottom + 4}px`, width: `${Math.max(r.width, 240)}px` });
  }
  _show(items) {
    this._items = items;
    this._active = -1;
    while (this._box.firstChild) this._box.removeChild(this._box.firstChild);
    if (!items.length) { this._hide(); return; }
    items.forEach((it, i) => {
      const row = document.createElement("div");
      row.textContent = it.label;
      row.setAttribute("role", "option");
      row.addEventListener("mousedown", (e) => { e.preventDefault(); this._choose(it); });
      row.addEventListener("mouseenter", () => this._highlight(i));
      this._box.appendChild(row);
    });
    const credit = document.createElement("div");
    credit.className = "gmc-credit";
    credit.textContent = "Adresses : IGN Géoplateforme";
    this._box.appendChild(credit);
    this._position();
    this._box.style.display = "block";
  }
  _highlight(i) {
    const rows = Array.from(this._box.children).slice(0, this._items.length);
    if (!rows.length) return;
    this._active = (i + rows.length) % rows.length;
    rows.forEach((r, k) => r.classList.toggle("active", k === this._active));
  }
  _hide() { this._box.style.display = "none"; }
  _choose(it) {
    this._hide();
    this._input.value = it.label;
    this._place = {
      name: it.label,
      formatted_address: it.label,
      place_id: `${it.lat},${it.lng}`,
      geometry: { location: new LatLng(it.lat, it.lng) },
    };
    fire(this, "place_changed");
  }
  getPlace() { return this._place; }
  setFields() {}
  setComponentRestrictions() {}
  setBounds() {}
  bindTo() {}
  addListener(name, fn) { return listen(this, name, fn); }
}

class PlacesService {
  constructor(map) { this._map = map; }
  /** Garages deux-roues autour d'un point (OpenStreetMap). */
  nearbySearch(request = {}, callback) {
    findNearbyGarages(request.location, request.radius || 5000).then(
      (list) => {
        const results = list.map((g) => ({
          place_id: g.placeId,
          name: g.name,
          vicinity: g.vicinity,
          formatted_phone_number: g.phone,
          website: g.website,
          opening_hours: g.openingHours ? { weekday_text: [g.openingHours] } : undefined,
          geometry: { location: new LatLng(g.lat, g.lng) },
          types: ["car_repair"],
          source: "openstreetmap",
        }));
        callback(results, results.length ? PlacesServiceStatus.OK : PlacesServiceStatus.ZERO_RESULTS);
      },
      (err) => {
        console.warn("[Carte] Recherche de garages indisponible :", err.message);
        callback([], PlacesServiceStatus.UNKNOWN_ERROR);
      },
    );
  }
  textSearch(request = {}, callback) {
    geocodeAddress(request.query || "", { near: request.location }).then(
      (places) => callback(places.map(placeToGeocoderResult), places.length ? PlacesServiceStatus.OK : PlacesServiceStatus.ZERO_RESULTS),
      () => callback([], PlacesServiceStatus.UNKNOWN_ERROR),
    );
  }
}

// ─── Géométrie ──────────────────────────────────────────────────────────────

const geometry = {
  spherical: {
    computeDistanceBetween: (a, b) => distanceMeters(a, b),
    computeHeading: (a, b) => { const h = bearingDeg(a, b); return h > 180 ? h - 360 : h; },
    computeLength: (path) => {
      const pts = path && path.getArray ? path.getArray() : path || [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) total += distanceMeters(pts[i - 1], pts[i]);
      return total;
    },
  },
  poly: {
    isLocationOnEdge: (point, poly, tolerance = 1e-9) => {
      const path = poly && poly.getPath ? poly.getPath().getArray() : poly;
      return isNearPath(point, path, tolerance);
    },
  },
  encoding: {
    decodePath: (str) => decodePolyline(str).map((p) => new LatLng(p.lat, p.lng)),
  },
};

// ─── Installation ───────────────────────────────────────────────────────────

class Size { constructor(w, h) { this.width = w; this.height = h; } }
class Point { constructor(x, y) { this.x = x; this.y = y; } }

export function buildCompatNamespace() {
  const ns = {
    __sovereign: true,
    Map: MapCtor,
    LatLng,
    LatLngBounds,
    Marker,
    InfoWindow,
    Polyline,
    Polygon,
    Circle,
    OverlayView,
    TrafficLayer,
    Geocoder,
    GeocoderStatus,
    DirectionsService,
    DirectionsRenderer,
    DirectionsStatus,
    TravelMode,
    SymbolPath,
    Animation: { DROP: 1, BOUNCE: 2 },
    MapTypeId: { ROADMAP: "roadmap", SATELLITE: "satellite", HYBRID: "hybrid", TERRAIN: "terrain" },
    ControlPosition: { TOP_LEFT: 1, TOP_RIGHT: 3, BOTTOM_LEFT: 10, BOTTOM_RIGHT: 12, RIGHT_BOTTOM: 9 },
    Size,
    Point,
    MVCArray,
    event,
    geometry,
    places: { Autocomplete, PlacesService, PlacesServiceStatus },
    marker: { AdvancedMarkerElement: Marker, PinElement },
  };
  ns.importLibrary = async (name) => {
    switch (name) {
      case "maps": return { Map: MapCtor, InfoWindow, Polyline, Polygon, Circle, OverlayView };
      case "marker": return { AdvancedMarkerElement: Marker, PinElement };
      case "places": return { Autocomplete, PlacesService };
      case "geometry": return geometry;
      case "geocoding": return { Geocoder };
      case "core": return { LatLng, LatLngBounds, event };
      default: throw new Error(`Bibliothèque « ${name} » non disponible (carte souveraine)`);
    }
  };
  return ns;
}

/** Installe window.google.maps (une seule fois). Ne remplace jamais un vrai SDK Google déjà présent. */
export function installSovereignMaps() {
  if (typeof window === "undefined") return null;
  if (window.google && window.google.maps) return window.google.maps;
  window.google = window.google || {};
  window.google.maps = buildCompatNamespace();
  return window.google.maps;
}
