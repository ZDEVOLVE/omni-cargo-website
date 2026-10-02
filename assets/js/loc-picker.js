/* Omni Cargo — location picker.
   Enhances <div class="locpick" data-oc-loc="pickup|delivery" data-label="…"></div> into:
   a Leaflet map with a draggable brand pin (tap map / drag / "use my location" / search a place)
   + detailed address fields (building, house/flat no., road, area, landmark).
   Requires Leaflet (loaded before this file).
   Public API:
     window.OCLoc.read(prefix)     -> { address: "<composed>", coords: "lat,lng" | "" }
     window.OCLoc.complete(prefix) -> true if road + area are filled (min specificity)
     window.OCLoc.refresh()        -> re-measures maps (call when a hidden step becomes visible)
*/
(function () {
  'use strict';
  if (window.OCLoc || typeof L === 'undefined') { if (!window.OCLoc) window.OCLoc = { read: function () { return { address: '', coords: '' }; }, complete: function () { return false; }, refresh: function () {} }; return; }

  /* ---- styles (uses the page's brand CSS variables) ---- */
  var css = [
    '.locpick{margin:4px 0 2px}',
    '.lp-search{display:flex;gap:8px;margin-bottom:10px}',
    '.lp-search-in{flex:1;min-width:0;font:400 15px "IBM Plex Sans",sans-serif;color:var(--text);background:var(--surface-2);border:1px solid var(--hairline-hi);border-radius:12px;padding:12px 14px}',
    '.lp-search-in:focus{outline:none;border-color:var(--accent);box-shadow:var(--accent-glow)}',
    '.lp-btn{flex:none;display:inline-flex;align-items:center;gap:7px;font:600 13.5px "IBM Plex Sans",sans-serif;color:var(--text);background:var(--surface-2);border:1px solid var(--hairline-hi);border-radius:12px;padding:0 14px;cursor:pointer;white-space:nowrap;transition:border-color .2s,color .2s}',
    '.lp-btn:hover{border-color:var(--accent);color:var(--accent)}',
    '.lp-btn svg{width:16px;height:16px}',
    '.lp-map{height:210px;border-radius:14px;overflow:hidden;border:1px solid var(--hairline-hi);background:var(--surface-2);z-index:0}',
    '.lp-hint{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.04em;color:var(--text-faint);margin:8px 2px 12px}',
    '.lp-hint.set{color:var(--accent)}',
    '.lp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}',
    '.lp-full{margin-bottom:10px}',
    '.lp-pin{background:none;border:0}',
    '.leaflet-container{font-family:"IBM Plex Sans",sans-serif}',
    '.lp-busy{opacity:.55;pointer-events:none}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var PIN = L.divIcon({
    className: 'lp-pin', iconSize: [30, 40], iconAnchor: [15, 40],
    html: '<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20C24 5.37 18.63 0 12 0z" fill="#FF6B1A" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="4.4" fill="#fff"/></svg>'
  });

  var KENYA = [0.23, 37.9], DEFAULT_ZOOM = 6;
  var pickers = {};
  var el = function (tag, cls, attrs) { var e = document.createElement(tag); if (cls) e.className = cls; if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; };
  var byId = function (id) { return document.getElementById(id); };

  function initOne(container) {
    var prefix = container.getAttribute('data-oc-loc');
    if (!prefix || pickers[prefix]) return;

    // search row
    var sRow = el('div', 'lp-search');
    var sIn = el('input', 'lp-search-in', { type: 'text', placeholder: 'Search a place — e.g. Nyali, Yaya Centre, Ruaka', autocomplete: 'off', 'aria-label': 'Search for a place' });
    var sBtn = el('button', 'lp-btn', { type: 'button' }); sBtn.textContent = 'Search';
    var geoBtn = el('button', 'lp-btn', { type: 'button', title: 'Use my current location' });
    geoBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><span>My&nbsp;location</span>';
    sRow.appendChild(sIn); sRow.appendChild(sBtn); sRow.appendChild(geoBtn);

    // map + hint
    var mapEl = el('div', 'lp-map', { id: 'lpmap_' + prefix });
    var hint = el('div', 'lp-hint'); hint.textContent = 'Tap the map or search, then drag the pin to the exact spot.';

    // detail fields
    var g1 = el('div', 'lp-grid');
    var fBld = el('input', 'f-input', { id: prefix + '_building', type: 'text', placeholder: 'Building / estate name' });
    var fNo = el('input', 'f-input', { id: prefix + '_houseno', type: 'text', placeholder: 'House / flat / door no.' });
    g1.appendChild(fBld); g1.appendChild(fNo);
    var fRoad = el('input', 'f-input lp-full', { id: prefix + '_road', type: 'text', placeholder: 'Road / street name' });
    var g2 = el('div', 'lp-grid');
    var fArea = el('input', 'f-input', { id: prefix + '_area', type: 'text', placeholder: 'Area / estate (e.g. Kilimani)' });
    var fLand = el('input', 'f-input', { id: prefix + '_landmark', type: 'text', placeholder: 'Nearest landmark (optional)' });
    g2.appendChild(fArea); g2.appendChild(fLand);
    var fCoords = el('input', '', { id: prefix + '_coords', type: 'hidden' });

    container.appendChild(sRow); container.appendChild(mapEl); container.appendChild(hint);
    container.appendChild(g1); container.appendChild(fRoad); container.appendChild(g2); container.appendChild(fCoords);

    // leaflet map
    var map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView(KENYA, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    var marker = null;

    function setPin(lat, lng, zoom) {
      lat = +lat; lng = +lng;
      if (marker) { marker.setLatLng([lat, lng]); }
      else {
        marker = L.marker([lat, lng], { draggable: true, icon: PIN, autoPan: true }).addTo(map);
        marker.on('dragend', function () { var p = marker.getLatLng(); fCoords.value = p.lat.toFixed(6) + ',' + p.lng.toFixed(6); });
      }
      fCoords.value = lat.toFixed(6) + ',' + lng.toFixed(6);
      if (zoom) map.setView([lat, lng], zoom); else map.panTo([lat, lng]);
      hint.textContent = 'Pin dropped — drag it to the exact spot if needed.'; hint.className = 'lp-hint set';
    }

    map.on('click', function (e) { setPin(e.latlng.lat, e.latlng.lng); });

    geoBtn.addEventListener('click', function () {
      if (!navigator.geolocation) { hint.textContent = 'Location not available on this device — tap the map instead.'; return; }
      geoBtn.classList.add('lp-busy'); hint.textContent = 'Finding your location…'; hint.className = 'lp-hint';
      navigator.geolocation.getCurrentPosition(
        function (pos) { geoBtn.classList.remove('lp-busy'); setPin(pos.coords.latitude, pos.coords.longitude, 17); },
        function () { geoBtn.classList.remove('lp-busy'); hint.textContent = 'Couldn’t get your location — search or tap the map instead.'; hint.className = 'lp-hint'; },
        { enableHighAccuracy: true, timeout: 9000 }
      );
    });

    function doSearch() {
      var q = sIn.value.trim(); if (!q) return;
      sBtn.classList.add('lp-busy'); var old = sBtn.textContent; sBtn.textContent = '…';
      fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ke&q=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (list) {
          sBtn.classList.remove('lp-busy'); sBtn.textContent = old;
          if (list && list.length) { setPin(list[0].lat, list[0].lon, 16); }
          else { hint.textContent = 'No match — try a nearby place name, or tap the map.'; hint.className = 'lp-hint'; }
        })
        .catch(function () { sBtn.classList.remove('lp-busy'); sBtn.textContent = old; hint.textContent = 'Search unavailable — tap the map to drop a pin.'; hint.className = 'lp-hint'; });
    }
    sBtn.addEventListener('click', doSearch);
    sIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

    pickers[prefix] = { map: map };
    setTimeout(function () { map.invalidateSize(); }, 250);
  }

  function val(id) { var e = byId(id); return e ? e.value.trim() : ''; }

  window.OCLoc = {
    read: function (prefix) {
      var parts = [val(prefix + '_houseno'), val(prefix + '_building'), val(prefix + '_road'), val(prefix + '_area')].filter(Boolean);
      var addr = parts.join(', ');
      var lm = val(prefix + '_landmark'); if (lm) addr += (addr ? ' ' : '') + '(near ' + lm + ')';
      return { address: addr, coords: val(prefix + '_coords') };
    },
    complete: function (prefix) { return !!(val(prefix + '_road') && val(prefix + '_area')); },
    refresh: function () { Object.keys(pickers).forEach(function (k) { try { pickers[k].map.invalidateSize(); } catch (e) {} }); }
  };

  function boot() { Array.prototype.forEach.call(document.querySelectorAll('.locpick[data-oc-loc]'), initOne); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
