(function () {
  'use strict';

  /* ===== Config ===== */
  var TILE_BASE = 'https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=7&ltype=';
  var TILE_SUFFIX = '&x={x}&y={y}&z={z}';
  var TILE_ATTR = '&copy; 高德地图';
  var MAP_CENTER = [32.05, 118.80];
  var MAP_ZOOM = 12;
  var MIN_YEAR = 211;
  var MAX_YEAR = 2025;
  // 站点部署根路径（兼容 GitHub Pages 子路径 /NJHistMap/ 与自定义域名根路径 /）
  var BASE = location.pathname.replace(/[^/]*$/, '');

  /* ===== State ===== */
  var map = null;
  var markerLayer = null;
  var currentTileLayer = null;
  var currentLtype = null;
  var tilePaneCounter = 0;
  var allPoints = [];
  var allPeriods = [];
  var allCategories = [];
  var activeCount = 0;

  var filter = {
    yearStart: MIN_YEAR,
    yearEnd: MAX_YEAR,
    activeCategories: null // Set, init later
  };

  /* ===== Init ===== */
  function init() {
    loadData().then(function () {
      initMap();
      initTimeline();
      initCategoryFilter();
      initPanelToggle();
      updateMarkers();
    }).catch(function (err) {
      console.error('Init error:', err);
      var el = document.getElementById('loading');
      el.innerHTML = '<p>数据加载失败，请刷新重试</p>';
    });
  }

  /* ===== Data ===== */
  function loadData() {
    return Promise.all([
      fetch('data/periods.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
      fetch('data/points.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
    ]).then(function (results) {
      allPeriods = results[0];
      allPoints = results[1];
      allCategories = [];
      allPoints.forEach(function (p) {
        if (p.category && allCategories.indexOf(p.category) === -1) {
          allCategories.push(p.category);
        }
      });
      filter.activeCategories = new Set(allCategories);
      document.getElementById('loading').style.display = 'none';
    });
  }

  /* ===== Map ===== */
  function initMap() {
    map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
      maxBounds: [[31.75, 118.45], [32.20, 119.25]],
      maxBoundsViscosity: 0.8,
      minZoom: 11
    }).setView(MAP_CENTER, MAP_ZOOM);

    L.control.zoom({ position: 'topright' }).addTo(map);

    updateTileLayer();
    updatePinScale();

    map.on('zoomend', function () {
      updateTileLayer();
    });

    // Pin labels scale gently with zoom level
    map.on('zoom zoomanim', function () {
      updatePinScale();
    });

    markerLayer = L.layerGroup().addTo(map);

    // 弹窗上拖拽穿透：按住弹窗拖动时地图跟随平移，单击/长按不受影响
    map.on('popupopen', function (e) {
      enablePopupDragThrough(e.popup);
    });
  }

  /* ===== Pin Label Zoom Scaling ===== */
  function updatePinScale() {
    var zoom = map.getZoom();
    // minZoom(11) -> 1.0, 每放大一级 +0.05, maxZoom(18) -> 1.35
    var scale = 1 + Math.max(0, zoom - 11) * 0.05;
    if (scale > 1.35) scale = 1.35;
    document.getElementById('map').style.setProperty('--pin-scale', scale);
  }

  /* ===== Tile Layer Switching ===== */
  function getLtypeForZoom(zoom) {
    if (zoom <= 15) return 1;   // 远看：仅自然要素
    return 3;                    // 近看(zoom≥16)：自然要素 + 路网
  }

  function updateTileLayer() {
    var zoom = map.getZoom();
    var ltype = getLtypeForZoom(zoom);

    if (currentLtype === ltype) return;
    currentLtype = ltype;

    var url = TILE_BASE + ltype + TILE_SUFFIX;

    var paneName = 'tilePane_' + (++tilePaneCounter);
    map.createPane(paneName);
    var pane = map.getPane(paneName);
    pane.style.zIndex = 200 + tilePaneCounter;
    pane.style.opacity = '0';
    pane.style.transition = 'opacity 0.4s ease-in';

    var newLayer = L.tileLayer(url, {
      attribution: TILE_ATTR,
      maxZoom: 18,
      subdomains: '1234',
      pane: paneName
    });

    // 先保存旧层引用，再更新 currentTileLayer
    var oldLayer = currentTileLayer;
    currentTileLayer = newLayer;

    newLayer.addTo(map);

    newLayer.once('load', function () {
      pane.style.opacity = '1';
      if (oldLayer) {
        setTimeout(function () {
          map.removeLayer(oldLayer);
        }, 400);
      }
    });

    currentTileLayer = newLayer;
  }

  /* ===== Utility ===== */
  function getDynastyColor(dynasty) {
    var dynastyMap = {
      '三国': '魏晋',
      '西晋': '魏晋',
      '东晋': '魏晋',
      '北宋': '宋元',
      '南宋': '宋元',
      '明': '明朝',
      '清': '清朝',
      '当代': '现代',
      '南朝': '南北朝'
    };
    var mapped = dynastyMap[dynasty] || dynasty;
    for (var i = 0; i < allPeriods.length; i++) {
      if (allPeriods[i].name === mapped) return allPeriods[i].color;
    }
    return '#5B4B6E';
  }

  function renderMarkdown(text) {
    if (!text) return '';
    var html;
    if (typeof marked !== 'undefined') {
      // breaks: 单换行即换行（年表类介绍不用空行分段）
      html = marked.parse(text, { gfm: true, breaks: true });
    } else {
      html = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    }
    // 兜底：漏写协议头的裸链接补 https://，避免 href="www.xxx" 被当相对路径
    html = html.replace(/href="(www\.)/g, 'href="https://$1');
    // open links in new tab
    return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
  }

  /* ===== Markers ===== */
  function createMarkerIcon(point) {
    var color = getDynastyColor(point.dynasty);
    var imageHtml;
    if (point.image) {
      imageHtml =
        '<img src="' + BASE + 'assets/images/' + point.image + '?v=20260824a" ' +
        'onerror="this.style.display=\'none\'">';
    } else {
      imageHtml = '<span class="pin-empty"></span>'; // no image: plain white circle
    }

    var pinPath = 'M18 1C8.6 1 1 8.6 1 18c0 13 17 29 17 29s17-16 17-29c0-9.4-7.6-17-17-17z';

    var html =
      '<div class="map-pin">' +
        '<svg class="pin-svg" width="36" height="48" viewBox="0 0 36 48">' +
          '<path d="' + pinPath + '" fill="none" stroke="' + color + '" stroke-width="2"/>' +
        '</svg>' +
        '<div class="pin-circle" style="border-color:' + color + ';color:' + color + '">' +
          imageHtml +
        '</div>' +
        '<svg class="pin-svg-bg" width="36" height="48" viewBox="0 0 36 48">' +
          '<path d="' + pinPath + '" fill="rgba(245,240,225,0.5)"/>' +
        '</svg>' +
        '<div class="pin-label">' + point.name + '</div>' +
      '</div>';

    return L.divIcon({
      html: html,
      className: 'histmap-marker',
      iconSize: [36, 48],
      iconAnchor: [18, 48],
      popupAnchor: [0, -44]
    });
  }

  function createPopupContent(point) {
    var color = getDynastyColor(point.dynasty);
    var descHtml = renderMarkdown(point.description);
    var imageHtml = point.image
      ? '<img class="popup-image" src="' + BASE + 'assets/images/' + point.image + '?v=20260824a" onerror="this.style.display=\'none\'">'
      : '';
    var yearEndText = point.year_end === 0 ? '至今' : point.year_end + '年';
    var qrHtml = point.channel_qr
      ? '<div class="popup-channel-qr"><img src="' + BASE + 'assets/images/' + point.channel_qr + '?v=20260904d" alt="渠道码" onerror="this.style.display=\'none\'"></div>'
      : '';
    // 导航终点=点位坐标（与底图同为高德坐标系）
    var amapUrl = 'https://uri.amap.com/navigation?to=' + point.lng + ',' + point.lat + ',' +
      encodeURIComponent(point.name) + '&mode=car&coordinate=gaode&src=njhistmap';
    // Android 用 geo: scheme 唤起系统"打开方式"选择器（装了哪些地图就列哪些）；
    // 桌面端与 iOS 默认走高德网页导航
    var navUrl = /Android/i.test(navigator.userAgent)
      ? 'geo:0,0?q=' + point.lat + ',' + point.lng + '(' + encodeURIComponent(point.name) + ')'
      : amapUrl;

    return (
      '<div class="popup-card">' +
        '<span class="popup-dynasty" style="background:' + color + '">' + point.dynasty + '</span>' +
        '<h3 class="popup-name">' + point.name + '</h3>' +
        '<div class="popup-year">' + point.year_start + '年 — ' + yearEndText + '</div>' +
        '<a class="popup-address" href="' + navUrl + '" target="_blank" rel="noopener">' +
          '<span class="popup-addr-text">\u{1F4CD} ' + point.address + '</span>' +
          '<span class="popup-nav-hint">导航 ›</span>' +
        '</a>' +
        imageHtml +
        '<div class="popup-description">' + descHtml + '</div>' +
        qrHtml +
      '</div>'
    );
  }

  function updateMarkers() {
    markerLayer.clearLayers();
    activeCount = 0;

    allPoints.forEach(function (point) {
      var pointYearEnd = point.year_end === 0 ? MAX_YEAR : point.year_end;
      // Time overlap check
      if (point.year_start > filter.yearEnd || pointYearEnd < filter.yearStart) return;
      // Category filter
      if (point.category && !filter.activeCategories.has(point.category)) return;

      var marker = L.marker([point.lat, point.lng], {
        icon: createMarkerIcon(point)
      });

      marker.bindPopup(createPopupContent(point), {
        maxWidth: 300,
        className: 'histmap-popup'
      });

      // 点击地图针后收起时间轴面板
      marker.on('click', function () {
        var panel = document.getElementById('bottom-panel');
        var toggle = document.getElementById('panel-toggle');
        if (panel && !panel.classList.contains('collapsed')) {
          panel.classList.add('collapsed');
          if (toggle) toggle.classList.add('active');
          setTimeout(function () { map.invalidateSize(); }, 300);
        }
      });

      markerLayer.addLayer(marker);
      activeCount++;
    });

    updatePointCount();
  }

  function updatePointCount() {
    var el = document.getElementById('point-count');
    if (el) el.textContent = activeCount + ' 个点位';
  }

  /* ===== Timeline ===== */
  function initTimeline() {
    renderDynastyLabels();
    initSlider();
  }

  function renderDynastyLabels() {
    var container = document.getElementById('dynasty-labels');
    container.innerHTML = '';
    var totalSpan = MAX_YEAR - MIN_YEAR;

    // 时间轴简称映射（省空间），hover 仍显示全名
    var shortNames = { '民国': '民', '现代': '现' };
    // 强制显示全名的朝代（宽度足够，不参与降级）
    var forceFull = ['南北朝'];

    allPeriods.forEach(function (period) {
      var widthPct = ((period.end - period.start) / totalSpan) * 100;
      var label = document.createElement('button');
      label.className = 'dynasty-label';
      label.style.width = widthPct + '%';
      label.style.setProperty('--dynasty-color', period.color);
      if (shortNames[period.name]) {
        label.textContent = shortNames[period.name];
        label.dataset.fullname = period.name;
      } else {
        label.textContent = period.name;
        if (forceFull.indexOf(period.name) !== -1) {
          label.dataset.keep = '1';
        }
      }
      label.dataset.start = period.start;
      label.dataset.end = period.end;
      label.addEventListener('click', function () {
        selectDynasty(period);
      });
      container.appendChild(label);
    });

    // 上屏后实测：真实文字宽度超出格子宽度才降级为 –（简称/强制全名的标签除外）
    container.querySelectorAll('.dynasty-label').forEach(function (label) {
      if (!label.dataset.fullname && !label.dataset.keep && label.scrollWidth > label.clientWidth) {
        label.dataset.fullname = label.textContent;
        label.textContent = '–';
      }
    });

    // Render dynasty color bands on slider track
    var trackBg = document.getElementById('slider-track');
    if (trackBg && !trackBg.querySelector('.slider-track-bands')) {
      var bands = document.createElement('div');
      bands.className = 'slider-track-bands';
      bands.style.display = 'flex';
      bands.style.position = 'absolute';
      bands.style.top = '0';
      bands.style.left = '0';
      bands.style.right = '0';
      bands.style.height = '100%';
      bands.style.borderRadius = '2px';
      bands.style.overflow = 'hidden';
      bands.style.pointerEvents = 'none';
      allPeriods.forEach(function (period) {
        var band = document.createElement('div');
        band.style.flexGrow = period.end - period.start;
        band.style.background = period.color;
        band.style.opacity = '0.25';
        bands.appendChild(band);
      });
      trackBg.appendChild(bands);
    }
  }

  function selectDynasty(period) {
    filter.yearStart = period.start;
    filter.yearEnd = period.end;
    updateSliderUI();
    updateDynastyHighlights();
    updateMarkers();
  }

  function updateDynastyHighlights() {
    var labels = document.querySelectorAll('.dynasty-label');
    labels.forEach(function (label) {
      var start = parseInt(label.dataset.start, 10);
      var end = parseInt(label.dataset.end, 10);
      if (start <= filter.yearEnd && end >= filter.yearStart) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    });
  }

  function initSlider() {
    var track = document.getElementById('slider-track');
    var startHandle = document.getElementById('slider-start');
    var endHandle = document.getElementById('slider-end');
    var rangeBar = document.getElementById('slider-range');
    var dragging = null;

    function yearToPct(year) {
      return ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
    }

    function updateSliderUI() {
      var startPct = yearToPct(filter.yearStart);
      var endPct = yearToPct(filter.yearEnd);
      startHandle.style.left = startPct + '%';
      endHandle.style.left = endPct + '%';
      rangeBar.style.left = startPct + '%';
      rangeBar.style.width = (endPct - startPct) + '%';
    }

    function handlePointerDown(e, which) {
      dragging = which;
      e.preventDefault();
      e.stopPropagation();
    }

    function handlePointerMove(e) {
      if (!dragging) return;
      e.preventDefault();

      var rect = track.getBoundingClientRect();
      var clientX = e.clientX;
      if (clientX === undefined && e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
      }
      if (clientX === undefined) return;

      var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      var pct = rect.width > 0 ? x / rect.width : 0;
      var year = Math.round(MIN_YEAR + pct * (MAX_YEAR - MIN_YEAR));

      if (dragging === 'start') {
        filter.yearStart = Math.min(year, filter.yearEnd - 1);
      } else {
        filter.yearEnd = Math.max(year, filter.yearStart + 1);
      }

      updateSliderUI();
      updateDynastyHighlights();
      updateMarkers();
    }

    function handlePointerUp() {
      dragging = null;
    }

    startHandle.addEventListener('pointerdown', function (e) { handlePointerDown(e, 'start'); });
    endHandle.addEventListener('pointerdown', function (e) { handlePointerDown(e, 'end'); });
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    updateSliderUI();
    updateDynastyHighlights();

    // Expose for selectDynasty
    window._updateSliderUI = updateSliderUI;
  }

  function updateSliderUI() {
    if (window._updateSliderUI) window._updateSliderUI();
  }

  /* ===== Category Filter ===== */
  function initCategoryFilter() {
    var container = document.getElementById('category-section');
    container.innerHTML = '';

    // "全部" chip
    var allChip = document.createElement('button');
    allChip.className = 'category-chip active';
    allChip.textContent = '全部';
    allChip.addEventListener('click', function () {
      var chips = document.querySelectorAll('.category-chip');
      var allOn = allChip.classList.contains('active');
      if (allOn) {
        // 当前全选（"全部"亮着）→ 全取消
        filter.activeCategories = new Set();
        chips.forEach(function (c) { c.classList.remove('active'); });
      } else {
        // 当前未全选 → 全选
        filter.activeCategories = new Set(allCategories);
        chips.forEach(function (c) { c.classList.add('active'); });
      }
      updateMarkers();
    });
    container.appendChild(allChip);

    allCategories.forEach(function (cat) {
      var chip = document.createElement('button');
      chip.className = 'category-chip active';
      chip.textContent = cat;
      chip.addEventListener('click', function () {
        if (filter.activeCategories.has(cat)) {
          if (filter.activeCategories.size === 1) {
            // Only this one selected → select all
            filter.activeCategories = new Set(allCategories);
            document.querySelectorAll('.category-chip').forEach(function (c) {
              c.classList.add('active');
            });
          } else {
            filter.activeCategories.delete(cat);
            chip.classList.remove('active');
            allChip.classList.remove('active');
          }
        } else {
          filter.activeCategories.add(cat);
          chip.classList.add('active');
          if (filter.activeCategories.size === allCategories.length) {
            allChip.classList.add('active');
          }
        }
        updateMarkers();
      });
      container.appendChild(chip);
    });
  }

  /* ===== Panel Toggle ===== */
  function initPanelToggle() {
    var toggle = document.getElementById('panel-toggle');
    var panel = document.getElementById('bottom-panel');

    toggle.addEventListener('click', function () {
      panel.classList.toggle('collapsed');
      toggle.classList.toggle('active');
      setTimeout(function () { map.invalidateSize(); }, 300);
    });
  }

  /* ===== Popup 拖拽穿透 ===== */
  // 按住弹窗卡片拖动时，把拖拽手势转成地图平移；单击（点链接）与长按（复制文本/保存图片）保持浏览器原生行为
  function enablePopupDragThrough(popup) {
    var el = popup.getElement();
    if (!el || el._dragThrough) return;
    el._dragThrough = true;

    var THRESHOLD = 10; // px，超过才判定为拖拽
    var startX = 0, startY = 0, lastX = 0, lastY = 0, dragging = false;

    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { dragging = false; return; }
      startX = lastX = e.touches[0].clientX;
      startY = lastY = e.touches[0].clientY;
      dragging = false;
    }, { passive: true, capture: true });

    el.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1) return;
      var t = e.touches[0];
      if (!dragging) {
        if (Math.abs(t.clientX - startX) + Math.abs(t.clientY - startY) < THRESHOLD) return;
        dragging = true;
        map.fire('movestart');
      }
      e.preventDefault();
      var dx = t.clientX - lastX;
      var dy = t.clientY - lastY;
      map.panBy([-dx, -dy], { animate: false, noMoveStart: true });
      clampCenter();
      lastX = t.clientX;
      lastY = t.clientY;
    }, { passive: false, capture: true });

    function endDrag() {
      dragging = false;
    }
    el.addEventListener('touchend', endDrag, { passive: true, capture: true });
    el.addEventListener('touchcancel', endDrag, { passive: true, capture: true });
  }

  function clampCenter() {
    var mb = map.options.maxBounds;
    if (!mb) return;
    var c = map.getCenter();
    var lat = Math.max(mb.getSouth(), Math.min(mb.getNorth(), c.lat));
    var lng = Math.max(mb.getWest(), Math.min(mb.getEast(), c.lng));
    if (lat !== c.lat || lng !== c.lng) {
      map.setView([lat, lng], map.getZoom(), { animate: false });
    }
  }

  /* ===== Start ===== */
  init();
})();
