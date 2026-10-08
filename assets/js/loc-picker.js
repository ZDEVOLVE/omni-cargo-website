/* Omni Cargo — location picker.
   Flow: the person fills the address DETAILS first; then the map drops a pin found from
   that address (or their current location), which they can drag to the exact spot.
   Enhances <div class="locpick" data-oc-loc="pickup|delivery"></div>.
   Requires Leaflet (loaded before this file).
   Public API:
     window.OCLoc.read(prefix)     -> { address: "<composed>", coords: "lat,lng" | "" }
     window.OCLoc.complete(prefix) -> true if road + area are filled (min specificity)
     window.OCLoc.refresh()        -> re-measures any open maps
*/
(function () {
  'use strict';
  if (window.OCLoc || typeof L === 'undefined') { if (!window.OCLoc) window.OCLoc = { read: function () { return { address: '', coords: '' }; }, complete: function () { return false; }, refresh: function () {} }; return; }

  var css = [
    '.locpick{margin:4px 0 2px}',
    '.lp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}',
    '.lp-full{margin-bottom:10px}',
    '.lp-actions{display:flex;gap:8px;margin:2px 0 10px;flex-wrap:wrap}',
    '.lp-btn{display:inline-flex;align-items:center;gap:7px;font:600 13.5px "IBM Plex Sans",sans-serif;border-radius:12px;padding:11px 16px;cursor:pointer;white-space:nowrap;transition:border-color .2s,color .2s,background-color .2s,transform .2s}',
    '.lp-btn svg{width:16px;height:16px;flex:none}',
    '.lp-btn.lp-find{background:var(--accent);color:#081020;border:1px solid var(--accent)}',
    '.lp-btn.lp-find:hover{transform:translateY(-1px)}',
    '.lp-btn.lp-geo{background:var(--surface-2);color:var(--text);border:1px solid var(--hairline-hi)}',
    '.lp-btn.lp-geo:hover{border-color:var(--accent);color:var(--accent)}',
    '.lp-map{height:210px;border-radius:14px;overflow:hidden;border:1px solid var(--hairline-hi);background:var(--surface-2);z-index:0;margin-bottom:8px}',
    '.lp-map.lp-hidden{display:none}',
    '.lp-hint{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.04em;color:var(--text-faint);margin:2px 2px 12px}',
    '.lp-hint.set{color:var(--accent)}',
    '.lp-busy{opacity:.6;pointer-events:none}',
    '.lp-pin{background:none;border:0}',
    '.leaflet-container{font-family:"IBM Plex Sans",sans-serif}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var MAPICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var GEOICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
  var PIN = L.divIcon({
    className: 'lp-pin', iconSize: [30, 40], iconAnchor: [15, 40],
    html: '<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20C24 5.37 18.63 0 12 0z" fill="#FF6B1A" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="4.4" fill="#fff"/></svg>'
  });

  var KENYA = [0.23, 37.9], DEFAULT_ZOOM = 6;
  var pickers = {};
  var el = function (tag, cls, attrs) { var e = document.createElement(tag); if (cls) e.className = cls; if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; };
  var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };

  function initOne(container) {
    var prefix = container.getAttribute('data-oc-loc');
    if (!prefix || pickers[prefix]) return;

    // ---- 1) address DETAILS first ----
    var fRoad = el('input', 'f-input lp-full', { id: prefix + '_road', type: 'text', placeholder: 'Road / street name' });
    var fArea = el('input', 'f-input lp-full', { id: prefix + '_area', type: 'text', placeholder: 'Area / estate (e.g. Kilimani, Nyali)' });
    var g1 = el('div', 'lp-grid');
    var fBld = el('input', 'f-input', { id: prefix + '_building', type: 'text', placeholder: 'Building / estate name' });
    var fNo = el('input', 'f-input', { id: prefix + '_houseno', type: 'text', placeholder: 'House / flat / door no.' });
    g1.appendChild(fBld); g1.appendChild(fNo);
    var fLand = el('input', 'f-input lp-full', { id: prefix + '_landmark', type: 'text', placeholder: 'Nearest landmark (optional)' });

    // ---- 2) actions: drop pin from the address, or use current location ----
    var actions = el('div', 'lp-actions');
    var findBtn = el('button', 'lp-btn lp-find', { type: 'button' }); findBtn.innerHTML = MAPICON + '<span>Show on map</span>';
    var geoBtn = el('button', 'lp-btn lp-geo', { type: 'button' }); geoBtn.innerHTML = GEOICON + '<span>My location</span>';
    actions.appendChild(findBtn); actions.appendChild(geoBtn);

    // ---- 3) map (hidden until found) + hint ----
    var mapEl = el('div', 'lp-map lp-hidden', { id: 'lpmap_' + prefix });
    var hint = el('div', 'lp-hint'); hint.textContent = 'Fill the address, then tap “Show on map” to drop the pin — you can drag it to the exact spot.';
    var fCoords = el('input', '', { id: prefix + '_coords', type: 'hidden' });

    container.appendChild(fRoad); container.appendChild(fArea); container.appendChild(g1); container.appendChild(fLand);
    container.appendChild(actions); container.appendChild(mapEl); container.appendChild(hint); container.appendChild(fCoords);

    var map = null, marker = null, autoTried = false;

    function ensureMap() {
      if (map) return map;
      map = L.map(mapEl, { scrollWheelZoom: false }).setView(KENYA, DEFAULT_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
      map.on('click', function (e) { setPin(e.latlng.lat, e.latlng.lng); });
      return map;
    }
    function showMap() { ensureMap(); mapEl.classList.remove('lp-hidden'); setTimeout(function () { map.invalidateSize(); }, 60); }
    function pinDropped() { hint.textContent = 'Pin dropped — drag it to the exact spot if needed.'; hint.className = 'lp-hint set'; }
    function setPin(lat, lng, zoom) {
      showMap();
      lat = +lat; lng = +lng;
      if (marker) { marker.setLatLng([lat, lng]); }
      else {
        marker = L.marker([lat, lng], { draggable: true, icon: PIN, autoPan: true }).addTo(map);
        marker.on('dragend', function () { var p = marker.getLatLng(); fCoords.value = p.lat.toFixed(6) + ',' + p.lng.toFixed(6); pinDropped(); });
      }
      fCoords.value = lat.toFixed(6) + ',' + lng.toFixed(6);
      map.setView([lat, lng], zoom || 16);
      pinDropped();
    }

    function geoQuery() { return [val(prefix + '_road'), val(prefix + '_area')].filter(Boolean).join(', '); }

    function findFromAddress() {
      var q = geoQuery();
      if (!q) { showMap(); hint.textContent = 'Add the road and area above first, then tap “Show on map”.'; hint.className = 'lp-hint'; return; }
      showMap();
      findBtn.classList.add('lp-busy'); var saved = findBtn.innerHTML; findBtn.innerHTML = MAPICON + '<span>Finding…</span>';
      fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ke&q=' + encodeURIComponent(q + ', Kenya'))
        .then(function (r) { return r.json(); })
        .then(function (list) {
          findBtn.classList.remove('lp-busy'); findBtn.innerHTML = saved;
          if (list && list.length) { setPin(list[0].lat, list[0].lon, 16); }
          else { hint.textContent = 'Couldn’t find that address — tap the map to drop the pin yourself.'; hint.className = 'lp-hint'; }
        })
        .catch(function () { findBtn.classList.remove('lp-busy'); findBtn.innerHTML = saved; hint.textContent = 'Search unavailable — tap the map to drop the pin.'; hint.className = 'lp-hint'; });
    }

    findBtn.addEventListener('click', findFromAddress);
    geoBtn.addEventListener('click', function () {
      if (!navigator.geolocation) { showMap(); hint.textContent = 'Location not available — tap the map to drop the pin.'; hint.className = 'lp-hint'; return; }
      geoBtn.classList.add('lp-busy'); showMap(); hint.textContent = 'Finding your location…'; hint.className = 'lp-hint';
      navigator.geolocation.getCurrentPosition(
        function (pos) { geoBtn.classList.remove('lp-busy'); setPin(pos.coords.latitude, pos.coords.longitude, 17); },
        function () { geoBtn.classList.remove('lp-busy'); hint.textContent = 'Couldn’t get your location — tap the map to drop the pin.'; hint.className = 'lp-hint'; },
        { enableHighAccuracy: true, timeout: 9000 }
      );
    });

    // once the road + area are filled and they move on, auto-drop the pin from the address
    fArea.addEventListener('blur', function () {
      if (!autoTried && !fCoords.value && val(prefix + '_road') && val(prefix + '_area')) { autoTried = true; findFromAddress(); }
    });

    pickers[prefix] = { refresh: function () { try { if (map) map.invalidateSize(); } catch (e) {} } };
  }

  window.OCLoc = {
    read: function (prefix) {
      var parts = [val(prefix + '_houseno'), val(prefix + '_building'), val(prefix + '_road'), val(prefix + '_area')].filter(Boolean);
      var addr = parts.join(', ');
      var lm = val(prefix + '_landmark'); if (lm) addr += (addr ? ' ' : '') + '(near ' + lm + ')';
      return { address: addr, coords: val(prefix + '_coords') };
    },
    complete: function (prefix) { return !!(val(prefix + '_road') && val(prefix + '_area')); },
    refresh: function () { Object.keys(pickers).forEach(function (k) { pickers[k].refresh(); }); }
  };

  function boot() { Array.prototype.forEach.call(document.querySelectorAll('.locpick[data-oc-loc]'), initOne); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
