/**
 * Chongqing Travel Companion - Clean Editorial Application Logic
 * Inspired by Apple Maps, Airbnb & Notion Travel Guides
 */

const state = {
  currentDay: 1, // 1 to 8, or 'all'
  selectedStopId: null,
  map: null,
  markersLayer: null,
  routesLayer: null,
  hotelRayLayer: null,
  userLocationMarker: null,
  activeTileLayer: null,
  activeTileType: 'street',
  mobileView: 'list' // 'list' or 'map'
};

const DAY_THEMES = {
  1: '解放碑 · 火锅 · 三样子',
  2: '山城巷 · 十八梯 · 饭江湖',
  3: '大礼堂 · 三峡博 · 燥烧烤',
  4: '仙女山滑雪 (东195km)',
  5: '雾凇雪原 · 肥肠鸡',
  6: '李子坝 · 磁器口 · 毛血旺',
  7: '长江索道 · 黄桷垭老街',
  8: '朝天门 · 来福士 · 送机'
};

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupRibbonTabs();
  setupControls();
  renderDay(1);
});

/* ==========================================================================
   Map Setup
   ========================================================================== */
function initMap() {
  state.map = L.map('map', {
    center: [29.5580, 106.5750],
    zoom: 14,
    zoomControl: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  // Default clean Esri Street Map
  setTileLayer('street');

  state.routesLayer = L.layerGroup().addTo(state.map);
  state.markersLayer = L.layerGroup().addTo(state.map);
  state.hotelRayLayer = L.layerGroup().addTo(state.map);
}

function setTileLayer(type) {
  if (state.activeTileLayer) {
    state.map.removeLayer(state.activeTileLayer);
  }

  let tileUrl = '';
  let options = {};

  if (type === 'satellite') {
    tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    options = { maxZoom: 18, attribution: '&copy; Esri, Maxar, Earthstar' };
  } else if (type === 'topo') {
    tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    options = { 
      maxZoom: 17, 
      subdomains: 'abc', 
      attribution: '&copy; OpenStreetMap contributors, SRTM | OpenTopoMap' 
    };
  } else {
    // street: OpenStreetMap official standard (100% full coverage of Chongqing, zero missing tiles)
    tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    options = { 
      maxZoom: 19, 
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' 
    };
  }

  state.activeTileLayer = L.tileLayer(tileUrl, options).addTo(state.map);
  state.activeTileType = type;

  // Update button active state
  document.querySelectorAll('.map-control-chip').forEach(btn => btn.classList.remove('active'));
  if (type === 'street') document.getElementById('btnTileStreet')?.classList.add('active');
  if (type === 'satellite') document.getElementById('btnTileSatellite')?.classList.add('active');
  if (type === 'topo') document.getElementById('btnTileTopo')?.classList.add('active');
}

/* ==========================================================================
   Day Itinerary Rendering & Polyline Highlighting
   ========================================================================== */
function renderDay(day) {
  state.currentDay = day;
  state.markersLayer.clearLayers();
  state.routesLayer.clearLayers();
  state.hotelRayLayer?.clearLayers();

  // Reset scroll to top & prevent any horizontal window shift
  const sidebar = document.getElementById('itinerarySidebar');
  if (sidebar) {
    sidebar.scrollTop = 0;
    sidebar.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
  const stopList = document.getElementById('sidebarStopList');
  if (stopList) {
    stopList.scrollTop = 0;
    stopList.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  if (document.documentElement) document.documentElement.scrollLeft = 0;
  if (document.body) document.body.scrollLeft = 0;

  // Update ribbon active tab & scroll ONLY the ribbon element itself (never scroll window)
  const ribbon = document.getElementById('daysRibbon');
  document.querySelectorAll('.day-card-pill').forEach(pill => {
    if (pill.dataset.day === String(day)) {
      pill.classList.add('active');
      if (ribbon) {
        const pillLeft = pill.offsetLeft;
        const pillWidth = pill.offsetWidth;
        const ribbonWidth = ribbon.clientWidth;
        const targetScrollLeft = Math.max(0, pillLeft - (ribbonWidth / 2) + (pillWidth / 2));
        ribbon.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
      }
    } else {
      pill.classList.remove('active');
    }
  });

  if (day === 'all') {
    renderAllDaysView();
  } else {
    renderSingleDay(parseInt(day, 10));
  }
}

function renderSingleDay(dayNumber) {
  const meta = DAYS_METADATA.find(d => d.day === dayNumber);
  const stops = ITINERARY_STOPS.filter(s => s.day === dayNumber);

  // Update mobile tab badge
  const countBadge = document.getElementById('mobileStopsCountBadge');
  if (countBadge) countBadge.innerText = `${stops.length} 站`;

  // 1. Sidebar Header Summary
  renderSidebarDayHeader(meta, stops.length);

  // 2. Sidebar Stop Cards
  renderSidebarStops(stops);

  // 3. Draw Connecting Polyline with Distance Badges
  const latlngs = stops.map(s => [s.lat, s.lng]);

  if (latlngs.length > 1) {
    // Glow line
    L.polyline(latlngs, {
      color: '#e11d48',
      weight: 8,
      opacity: 0.22,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(state.routesLayer);

    // Main line
    L.polyline(latlngs, {
      color: '#e11d48',
      weight: 3.5,
      opacity: 0.9,
      dashArray: '6, 6',
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(state.routesLayer);

    // Transit midpoint badges
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];
      const midLat = (from.lat + to.lat) / 2;
      const midLng = (from.lng + to.lng) / 2;

      const pillIcon = L.divIcon({
        className: 'route-pill-div-icon',
        html: `<div class="map-route-distance-pill">${from.next_transit} · ${from.next_distance}</div>`,
        iconSize: [120, 24],
        iconAnchor: [60, 12]
      });

      L.marker([midLat, midLng], { icon: pillIcon, interactive: false }).addTo(state.routesLayer);
    }
  }

  // 4. Render Markers
  stops.forEach((stop, index) => {
    const marker = createEditorialMarker(stop, stop.page);
    marker.addTo(state.markersLayer);
  });

  // Render Basecamp Hotel Marker
  renderHotelMarker();

  // 5. Fit Map Bounds
  if (latlngs.length === 1) {
    state.map.setView(latlngs[0], 15);
  } else if (latlngs.length > 1) {
    let boundsCoords = [...latlngs];
    if (typeof CONFIRMED_HOTEL !== 'undefined' && [1, 2, 8].includes(dayNumber)) {
      boundsCoords.push([CONFIRMED_HOTEL.lat, CONFIRMED_HOTEL.lng]);
    }
    state.map.fitBounds(L.latLngBounds(boundsCoords), { padding: [70, 70], maxZoom: 16 });
  }

  // 6. Update HUD Card
  updateStatsHUD(meta, stops);
}

function renderAllDaysView() {
  const countBadge = document.getElementById('mobileStopsCountBadge');
  if (countBadge) countBadge.innerText = `${ITINERARY_STOPS.length} 站`;

  const container = document.getElementById('sidebarDaySummary');
  container.innerHTML = `
    <div class="day-meta-tag">8-DAY REGIONAL OVERVIEW</div>
    <div class="day-headline">重庆全域空间大格局与行车走廊</div>
    <div class="day-stats-row">
      <span class="stat-chip distance">全行程 ${ITINERARY_STOPS.length} 大精选站点</span>
      <span class="stat-chip">涵盖: 母城文博 + 高山雪原 + 江景老街</span>
    </div>
  `;

  renderSidebarStops(ITINERARY_STOPS);

  const wulongLine = [
    [29.55715, 106.57703], // Jiefangbei
    [29.4185, 107.7289],   // Highway southeast
    [29.4678, 107.7425]    // Ski Resort
  ];
  L.polyline(wulongLine, { color: '#059669', weight: 3, dashArray: '5, 5', opacity: 0.85, interactive: false }).addTo(state.routesLayer);

  const airportLine = [
    [29.55715, 106.57703],
    [29.7192, 106.6436]
  ];
  L.polyline(airportLine, { color: '#52525b', weight: 2.5, dashArray: '4, 4', opacity: 0.7, interactive: false }).addTo(state.routesLayer);

  ITINERARY_STOPS.forEach(stop => {
    const marker = createEditorialMarker(stop, stop.page);
    marker.addTo(state.markersLayer);
  });

  // Render Basecamp Hotel Marker
  renderHotelMarker();

  const allCoords = ITINERARY_STOPS.map(s => [s.lat, s.lng]);
  state.map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });

  const hud = document.getElementById('mapRouteHud');
  hud.innerHTML = `
    <div class="hud-header">
      <span>重庆全域空间矩阵</span>
      <span style="font-size:0.7rem; color:#71717a;">8天7晚 · 26站</span>
    </div>
    <div class="hud-item"><span>主城半岛核心 (Days 1,2,6,7,8)</span><span class="hud-item-val">0.3 - 15 km</span></div>
    <div class="hud-item"><span>母城文博历史圈 (Day 3)</span><span class="hud-item-val">3.5 km (车程10m)</span></div>
    <div class="hud-item"><span>东南仙女山雪场 (Days 4-5)</span><span class="hud-item-val">195 km (车程3.5h)</span></div>
    <div class="hud-item"><span>江北机场 T3 接送机</span><span class="hud-item-val">27 km (滴滴45m)</span></div>
  `;
}

function createEditorialMarker(stop, badgeNumber) {
  const customIcon = L.divIcon({
    className: 'editorial-pin-wrapper',
    html: `
      <div class="editorial-map-pin ${state.selectedStopId === stop.id ? 'active' : ''}" id="marker-${stop.id}">
        <span>${String(badgeNumber).padStart(2, '0')}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });

  const marker = L.marker([stop.lat, stop.lng], { icon: customIcon, zIndexOffset: 1000 });

  marker.on('click', () => {
    selectStop(stop.id);
  });

  marker.bindTooltip(`<strong>${stop.title}</strong><br><span style="color:#71717a;">${stop.time}</span>`, {
    direction: 'top',
    offset: [0, -16]
  });

  return marker;
}

function renderHotelMarker() {
  if (typeof CONFIRMED_HOTEL === 'undefined') return;

  const hotelIcon = L.divIcon({
    className: 'hotel-pin-wrapper',
    html: `
      <div class="hotel-map-pin" id="marker-hotel" title="${CONFIRMED_HOTEL.name}">
        <div class="hotel-pin-pulse"></div>
        <div class="hotel-pin-badge">🏨 创汇酒店 (大本营)</div>
      </div>
    `,
    iconSize: [140, 36],
    iconAnchor: [70, 18],
    popupAnchor: [0, -18]
  });

  const hotelMarker = L.marker([CONFIRMED_HOTEL.lat, CONFIRMED_HOTEL.lng], {
    icon: hotelIcon,
    zIndexOffset: 1500
  });

  hotelMarker.on('click', () => {
    openHotelModal();
  });

  hotelMarker.bindTooltip(`<strong>🏨 ${CONFIRMED_HOTEL.name}</strong><br><span style="color:#d97706; font-weight:700;">全家7晚大本营</span> · 步行2分至十八梯`, {
    direction: 'top',
    offset: [0, -18]
  });

  hotelMarker.addTo(state.markersLayer);
}

function renderHotelModalData() {
  if (typeof CONFIRMED_HOTEL === 'undefined') return;

  const distContainer = document.getElementById('hotelDistancesContainer');
  if (distContainer && CONFIRMED_HOTEL.distances_from_hotel) {
    distContainer.innerHTML = CONFIRMED_HOTEL.distances_from_hotel.map(d => `
      <div class="hotel-dist-card">
        <div class="target-name">${d.target}</div>
        <div class="target-metrics">${d.distance} · ${d.time}</div>
        <div class="target-note">${d.note}</div>
      </div>
    `).join('');
  }

  const tipsContainer = document.getElementById('hotelTipsContainer');
  if (tipsContainer && CONFIRMED_HOTEL.tips) {
    tipsContainer.innerHTML = CONFIRMED_HOTEL.tips.map(t => `
      <div class="hotel-tip-box">${t}</div>
    `).join('');
  }
}

function openHotelModal() {
  renderHotelModalData();
  document.getElementById('hotelModal')?.classList.add('visible');
}

window.openHotelModal = openHotelModal;

/* ==========================================================================
   Sidebar Journal & Timeline Rendering
   ========================================================================== */
function renderSidebarDayHeader(meta, count) {
  const container = document.getElementById('sidebarDaySummary');
  if (!meta) return;

  container.innerHTML = `
    <div class="day-meta-tag">DAY 0${meta.day} · ${meta.date}</div>
    <div class="day-headline">${meta.title}</div>
    <div style="font-size: 0.76rem; color: #52525b; margin-bottom: 10px;">${meta.highlight}</div>
    <div class="day-stats-row">
      <span class="stat-chip distance">路程: ${meta.total_distance}</span>
      <span class="stat-chip mom">全家舒适度: ${meta.intensity}</span>
    </div>
  `;
}

function renderSidebarStops(stops) {
  const container = document.getElementById('sidebarStopList');
  container.innerHTML = '';

  stops.forEach((stop, index) => {
    const item = document.createElement('div');
    item.className = 'timeline-item';

    const card = document.createElement('div');
    card.className = `stop-entry-card ${state.selectedStopId === stop.id ? 'active' : ''}`;
    card.id = `card-stop-${stop.id}`;

    card.innerHTML = `
      <div class="entry-photo">
        <img src="${stop.image}" alt="${stop.title}" loading="lazy" onerror="this.src='images/stop_01.jpg'">
        <div class="photo-badge-number">${String(stop.page).padStart(2, '0')}</div>
        <div class="photo-badge-category">${stop.category_label.split('/')[0].trim()}</div>
      </div>
      <div class="entry-body">
        <div class="entry-time">${stop.weekday} · ${stop.time}</div>
        <div class="entry-title">${stop.title}</div>
        <div class="entry-title-en">${stop.title_en}</div>

        <!-- Permanent Hotel Distance Badge on Stop Card -->
        <div class="entry-hotel-dist-pill" title="此站点与大本营酒店的实测距离与往返方案">
          <div class="dist-pill-left">
            <span class="dist-icon">🏨</span>
            <span class="dist-tag">距大本营:</span>
            <span class="dist-km">${stop.hotel_distance || '商圈核心'}</span>
          </div>
          <div class="dist-pill-right">
            <span class="dist-mode">${stop.hotel_transit || '交通便捷'}</span>
          </div>
        </div>

        <div class="entry-section-snippet">
          <strong>看什么:</strong> ${stop.see}
        </div>
        <div class="entry-section-snippet" style="color: #92400e;">
          <strong>吃什么:</strong> ${stop.eat}
        </div>
        <div class="entry-footer">
          <span>海拔 ${stop.elevation.split('·')[0]}</span>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="card-map-jump-btn" type="button" title="在地图上查看此站点" style="background:#f4f4f5; border:1px solid #d4d4d8; border-radius:12px; padding:3px 9px; font-size:0.74rem; font-weight:700; color:#27272a; cursor:pointer;">🗺️ 地图</button>
            <span class="link-cta">详情 ➔</span>
          </div>
        </div>
      </div>
    `;

    // Map jump button click
    const mapJumpBtn = card.querySelector('.card-map-jump-btn');
    if (mapJumpBtn) {
      mapJumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        switchMobileView('map');
        selectStop(stop.id);
        if (state.map) {
          state.map.setView([stop.lat, stop.lng], 16, { animate: true });
        }
      });
    }

    card.addEventListener('click', () => {
      selectStop(stop.id);
    });

    item.appendChild(card);

    // Add inter-stop transit connector
    if (index < stops.length - 1) {
      const transitEl = document.createElement('div');
      transitEl.className = 'transit-spine';
      transitEl.innerHTML = `
        <span class="transit-spine-pill">↓ ${stop.next_transit} (${stop.next_distance})</span>
      `;
      item.appendChild(transitEl);
    }

    container.appendChild(item);
  });
}

function updateStatsHUD(meta, stops) {
  const hud = document.getElementById('mapRouteHud');
  if (!meta) return;

  hud.innerHTML = `
    <div class="hud-header">
      <span>DAY 0${meta.day} 行程数据</span>
      <span style="font-size:0.72rem; color:#71717a;">${stops.length} 个站点</span>
    </div>
    <div class="hud-item"><span>区域位置</span><span class="hud-item-val">${meta.area.split('(')[0]}</span></div>
    <div class="hud-item"><span>全天路程</span><span class="hud-item-val">${meta.total_distance.split('(')[0]}</span></div>
    <div class="hud-item"><span>出行方案</span><span class="hud-item-val">${meta.transit_summary.split('+')[0]}</span></div>
    <div class="hud-item"><span>全家舒适度</span><span class="hud-item-val" style="color:#059669;">${meta.intensity.split('(')[0]}</span></div>
  `;
}

/* ==========================================================================
   Details Drawer (Slide-Over Panel)
   ========================================================================== */
function selectStop(stopId) {
  state.selectedStopId = stopId;
  const stop = ITINERARY_STOPS.find(s => s.id === stopId);
  if (!stop) return;

  // Active state on markers
  document.querySelectorAll('.editorial-map-pin').forEach(el => el.classList.remove('active'));
  const activePin = document.getElementById(`marker-${stop.id}`);
  if (activePin) activePin.classList.add('active');

  // Center map smoothly
  state.map.setView([stop.lat, stop.lng], Math.max(state.map.getZoom(), 15), { animate: true });

  // Draw dynamic Hotel-to-Stop distance ray on map
  if (state.hotelRayLayer) {
    state.hotelRayLayer.clearLayers();
    if (typeof CONFIRMED_HOTEL !== 'undefined') {
      const hotelCoords = [CONFIRMED_HOTEL.lat, CONFIRMED_HOTEL.lng];
      const stopCoords = [stop.lat, stop.lng];

      L.polyline([hotelCoords, stopCoords], {
        color: '#d97706',
        weight: 3,
        dashArray: '6, 8',
        opacity: 0.85,
        interactive: false
      }).addTo(state.hotelRayLayer);

      const midLat = (hotelCoords[0] + stopCoords[0]) / 2;
      const midLng = (hotelCoords[1] + stopCoords[1]) / 2;
      const rayPill = L.divIcon({
        className: 'hotel-ray-pill-div',
        html: `<div class="hotel-distance-ray-pill">🏨 距大本营: ${stop.hotel_distance || ''}</div>`,
        iconSize: [140, 26],
        iconAnchor: [70, 13]
      });
      L.marker([midLat, midLng], { icon: rayPill, interactive: false }).addTo(state.hotelRayLayer);
    }
  }

  // Active state on sidebar cards
  document.querySelectorAll('.stop-entry-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`card-stop-${stop.id}`);
  if (card) {
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Open drawer
  openDrawer(stop);
}

function openDrawer(stop) {
  // Ensure drawer scrolls back to top when opened or switching stops
  const drawer = document.getElementById('detailsDrawer');
  if (drawer) {
    drawer.scrollTop = 0;
    drawer.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
  const scrollBody = drawer ? drawer.querySelector('.drawer-scroll-body') : null;
  if (scrollBody) {
    scrollBody.scrollTop = 0;
    scrollBody.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  document.getElementById('drawerImg').src = stop.image;
  document.getElementById('drawerPageBadge').innerText = `站点 ${String(stop.page).padStart(2, '0')}/${ITINERARY_STOPS.length} · Day ${stop.day}`;
  document.getElementById('drawerDayCategoryBadge').innerText = stop.category_label.split('/')[0].trim();
  document.getElementById('drawerTitle').innerText = stop.title;
  document.getElementById('drawerTitleEn').innerText = stop.title_en;

  document.getElementById('drawerTimeVal').innerText = `${stop.date} ${stop.weekday} · ${stop.time}`;
  document.getElementById('drawerElevationVal').innerText = stop.elevation;

  // Populate hotel commute card
  const distValEl = document.getElementById('drawerHotelDistVal');
  const transitValEl = document.getElementById('drawerHotelTransitVal');
  const noteValEl = document.getElementById('drawerHotelNoteVal');
  if (distValEl) distValEl.innerText = stop.hotel_distance || '商圈核心';
  if (transitValEl) transitValEl.innerText = stop.hotel_transit || '便捷可达';
  if (noteValEl) noteValEl.innerText = stop.hotel_transit_note || '距大本营扬际·创汇酒店交通便利';

  const drawerHotelClick = document.getElementById('drawerHotelAddrClick');
  if (drawerHotelClick) {
    drawerHotelClick.onclick = () => {
      if (typeof CONFIRMED_HOTEL !== 'undefined' && CONFIRMED_HOTEL.didi_dest) {
        navigator.clipboard.writeText(CONFIRMED_HOTEL.didi_dest).then(() => {
          showToast(`已复制大本营打车地址: "${CONFIRMED_HOTEL.didi_dest}"`);
        });
      }
    };
  }

  document.getElementById('drawerSeeVal').innerText = stop.see;
  document.getElementById('drawerEatVal').innerText = stop.eat;
  
  // Format transport & mom tips with clickable links if present
  const formatLinks = (text) => text.replace(/(https?:\/\/[^\s\)\'\"，]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#e11d48;text-decoration:underline;font-weight:700;word-break:break-all;">$1</a>');
  document.getElementById('drawerTransportVal').innerHTML = formatLinks(stop.transport);
  document.getElementById('drawerMomTipsVal').innerHTML = formatLinks(stop.mom_tips);
  document.getElementById('drawerCreditVal').innerText = stop.credit;

  // Copy POI for Taxi/Didi
  const copyBtn = document.getElementById('btnCopyDidi');
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(stop.didi_dest).then(() => {
      showToast(`已复制目的地: "${stop.didi_dest}" 可直接粘贴给滴滴/高德！`);
    });
  };

  // Nav link
  document.getElementById('btnOpenNav').href = `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;

  // Next / Prev buttons
  const prevBtn = document.getElementById('btnPrevStop');
  const nextBtn = document.getElementById('btnNextStop');

  prevBtn.disabled = stop.id <= 1;
  nextBtn.disabled = stop.id >= ITINERARY_STOPS.length;

  prevBtn.onclick = () => {
    if (stop.id > 1) {
      const prev = ITINERARY_STOPS[stop.id - 2];
      if (prev.day !== state.currentDay && state.currentDay !== 'all') {
        renderDay(prev.day);
      }
      selectStop(prev.id);
    }
  };

  nextBtn.onclick = () => {
    if (stop.id < ITINERARY_STOPS.length) {
      const next = ITINERARY_STOPS[stop.id];
      if (next.day !== state.currentDay && state.currentDay !== 'all') {
        renderDay(next.day);
      }
      selectStop(next.id);
    }
  };

  // Ensure close button handler is fresh
  const closeBtn = document.getElementById('drawerCloseBtn');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeDrawer();
    };
  }

  document.getElementById('detailsDrawer').classList.add('visible');
  document.getElementById('drawerScrim').classList.add('visible');
}

function closeDrawer() {
  document.getElementById('detailsDrawer')?.classList.remove('visible');
  document.getElementById('drawerScrim')?.classList.remove('visible');
  state.selectedStopId = null;
  document.querySelectorAll('.editorial-map-pin').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.stop-entry-card').forEach(c => c.classList.remove('active'));
  state.hotelRayLayer?.clearLayers();
}

window.closeDrawer = closeDrawer;

/* ==========================================================================
   Ribbon Date Cards & Header Setup
   ========================================================================== */
function setupRibbonTabs() {
  const ribbon = document.getElementById('daysRibbon');
  ribbon.innerHTML = '';

  // All Days Tab
  const allCard = document.createElement('div');
  allCard.className = 'day-card-pill';
  allCard.dataset.day = 'all';
  allCard.innerHTML = `
    <div class="pill-top">
      <span class="pill-day">全部行程</span>
      <span class="pill-date">8天总览</span>
    </div>
    <div class="pill-theme">全域大格局</div>
  `;
  allCard.onclick = () => renderDay('all');
  ribbon.appendChild(allCard);

  // Day 1 to 8 Cards
  DAYS_METADATA.forEach(d => {
    const card = document.createElement('div');
    card.className = `day-card-pill ${d.day === 1 ? 'active' : ''}`;
    card.dataset.day = String(d.day);
    card.innerHTML = `
      <div class="pill-top">
        <span class="pill-day">Day 0${d.day}</span>
        <span class="pill-date">${d.date.split(' ')[0]}</span>
      </div>
      <div class="pill-theme">${DAY_THEMES[d.day] || d.area}</div>
    `;
    card.onclick = () => renderDay(d.day);
    ribbon.appendChild(card);
  });
}

function setupControls() {
  // Drawer close
  const closeBtn = document.getElementById('drawerCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });
  }
  
  const scrim = document.getElementById('drawerScrim');
  if (scrim) {
    scrim.addEventListener('click', closeDrawer);
  }

  // Escape key listener to close drawer & modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      closeDrawer();
      document.querySelectorAll('.modal-scrim').forEach(m => m.classList.remove('visible'));
    }
  });

  // Scope Switcher in Header
  document.getElementById('btnScopeUrban')?.addEventListener('click', () => {
    document.getElementById('btnScopeUrban').classList.add('active');
    document.getElementById('btnScopeMacro').classList.remove('active');
    state.map.setView([29.5580, 106.5780], 14, { animate: true });
    showToast('已聚焦: 重庆主城核心半岛 (渝中 / 南岸 / 沙坪坝)');
  });

  document.getElementById('btnScopeMacro')?.addEventListener('click', () => {
    document.getElementById('btnScopeMacro').classList.add('active');
    document.getElementById('btnScopeUrban').classList.remove('active');
    renderDay('all');
    showToast('已展开: 重庆全域大格局 (含主城核心圈与武隆仙女山 195km)');
  });

  // Map Tile Switcher Buttons
  document.getElementById('btnTileStreet')?.addEventListener('click', () => setTileLayer('street'));
  document.getElementById('btnTileSatellite')?.addEventListener('click', () => setTileLayer('satellite'));
  document.getElementById('btnTileTopo')?.addEventListener('click', () => setTileLayer('topo'));

  // Permanent Sidebar Hotel Dock Card Controls
  document.getElementById('btnDockCopyAddr')?.addEventListener('click', () => {
    if (typeof CONFIRMED_HOTEL !== 'undefined' && CONFIRMED_HOTEL.didi_dest) {
      navigator.clipboard.writeText(CONFIRMED_HOTEL.didi_dest).then(() => {
        showToast(`已复制大本营打车地址: "${CONFIRMED_HOTEL.didi_dest}"`);
      });
    }
  });

  document.getElementById('btnDockLocate')?.addEventListener('click', () => {
    if (state.currentDay !== 1 && state.currentDay !== 2 && state.currentDay !== 'all') {
      renderDay(1);
    }
    state.map.setView([CONFIRMED_HOTEL.lat, CONFIRMED_HOTEL.lng], 16, { animate: true });
    showToast('已在地图上对焦全家大本营: 扬际·创汇酒店 (中华路1号)');
  });

  document.getElementById('btnDockDetails')?.addEventListener('click', openHotelModal);

  document.querySelector('.dock-hotel-addr')?.addEventListener('click', () => {
    if (typeof CONFIRMED_HOTEL !== 'undefined' && CONFIRMED_HOTEL.didi_dest) {
      navigator.clipboard.writeText(CONFIRMED_HOTEL.didi_dest).then(() => {
        showToast(`已复制大本营打车地址: "${CONFIRMED_HOTEL.didi_dest}"`);
      });
    }
  });

  // Modals
  document.getElementById('btnOpenHotelModal')?.addEventListener('click', openHotelModal);

  document.getElementById('btnCopyHotelDidi')?.addEventListener('click', () => {
    if (typeof CONFIRMED_HOTEL !== 'undefined' && CONFIRMED_HOTEL.didi_dest) {
      navigator.clipboard.writeText(CONFIRMED_HOTEL.didi_dest).then(() => {
        showToast(`已复制酒店打车目的地: "${CONFIRMED_HOTEL.didi_dest}"`);
      });
    }
  });

  document.getElementById('btnFocusHotelMap')?.addEventListener('click', () => {
    document.getElementById('hotelModal')?.classList.remove('visible');
    if (state.currentDay !== 1 && state.currentDay !== 2 && state.currentDay !== 'all') {
      renderDay(1);
    }
    state.map.setView([CONFIRMED_HOTEL.lat, CONFIRMED_HOTEL.lng], 16, { animate: true });
    showToast('已在地图上聚焦全家大本营: 扬际·创汇酒店');
  });

  document.getElementById('btnOpenDistanceModal')?.addEventListener('click', () => {
    document.getElementById('distanceModal').classList.add('visible');
  });

  document.getElementById('btnOpenMomGuide')?.addEventListener('click', () => {
    document.getElementById('momGuideModal').classList.add('visible');
  });

  document.querySelectorAll('.modal-close-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-scrim').forEach(m => m.classList.remove('visible'));
    });
  });

  document.querySelectorAll('.modal-scrim').forEach(scrim => {
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) scrim.classList.remove('visible');
    });
  });

  // GPS Locate Me
  document.getElementById('btnLocateMe')?.addEventListener('click', locateUser);

  // Mobile Dual View Switcher (List vs Map)
  initMobileView();
}

function initMobileView() {
  // Default to list view on mobile
  document.body.classList.add('mobile-view-list');
  state.mobileView = 'list';

  const tabList = document.getElementById('tabMobileList');
  const tabMap = document.getElementById('tabMobileMap');
  const floatBtn = document.getElementById('btnFloatingViewSwitch');

  tabList?.addEventListener('click', () => switchMobileView('list'));
  tabMap?.addEventListener('click', () => switchMobileView('map'));
  floatBtn?.addEventListener('click', () => {
    switchMobileView(state.mobileView === 'list' ? 'map' : 'list');
  });
}

function switchMobileView(mode) {
  state.mobileView = mode;
  const tabList = document.getElementById('tabMobileList');
  const tabMap = document.getElementById('tabMobileMap');
  const floatIcon = document.getElementById('floatingPillIcon');
  const floatText = document.getElementById('floatingPillText');

  if (mode === 'map') {
    document.body.classList.remove('mobile-view-list');
    document.body.classList.add('mobile-view-map');
    tabList?.classList.remove('active');
    tabMap?.classList.add('active');
    if (floatIcon) floatIcon.innerText = '📋';
    if (floatText) floatText.innerText = '看行程卡片';

    // Invalidate map size so Leaflet renders full screen properly
    setTimeout(() => {
      if (state.map) {
        state.map.invalidateSize();
      }
    }, 150);
  } else {
    document.body.classList.remove('mobile-view-map');
    document.body.classList.add('mobile-view-list');
    tabList?.classList.add('active');
    tabMap?.classList.remove('active');
    if (floatIcon) floatIcon.innerText = '🗺️';
    if (floatText) floatText.innerText = '看路线地图';
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    showToast('当前浏览器不支持定位服务');
    return;
  }

  showToast('正在定位您的实时位置...');

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (state.userLocationMarker) {
        state.map.removeLayer(state.userLocationMarker);
      }

      const userIcon = L.divIcon({
        className: 'user-gps-dot',
        html: `<div style="width:16px; height:16px; border-radius:50%; background:#0284c7; border:3px solid white; box-shadow:0 0 0 6px rgba(2,132,199,0.35);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      state.userLocationMarker = L.marker([lat, lng], { icon: userIcon }).addTo(state.map);
      state.map.setView([lat, lng], 15, { animate: true });
      showToast('定位成功！已在地图上标注您的实时位置');
    },
    () => {
      showToast('定位失败，请检查手机/浏览器定位权限设置');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function showToast(msg) {
  const banner = document.getElementById('toastMsg');
  banner.innerText = msg;
  banner.classList.add('visible');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    banner.classList.remove('visible');
  }, 3200);
}

// Register PWA Service Worker for offline mobile app support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        reg.update();
        console.log('Chongqing Trip PWA Service Worker registered & updated:', reg.scope);
      })
      .catch(err => console.log('PWA Service Worker registration:', err));
  });
}

// Global Force Clean Reload Utility to wipe old Service Worker caches
window.forceCleanReload = function() {
  showToast('正在清除浏览器旧缓存并载入最新 26 站数据...');
  if ('caches' in window) {
    caches.keys().then(names => {
      Promise.all(names.map(name => caches.delete(name))).then(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            Promise.all(regs.map(r => r.unregister())).then(() => {
              setTimeout(() => {
                window.location.href = window.location.origin + window.location.pathname + '?nocache=' + Date.now();
              }, 400);
            });
          });
        } else {
          setTimeout(() => {
            window.location.href = window.location.origin + window.location.pathname + '?nocache=' + Date.now();
          }, 400);
        }
      });
    });
  } else {
    window.location.href = window.location.origin + window.location.pathname + '?nocache=' + Date.now();
  }
};
