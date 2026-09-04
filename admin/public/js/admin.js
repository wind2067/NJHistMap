(function () {
  'use strict';

  var periods = [];

  /* ===== Init ===== */
  function init() {
    initTabs();
    initPointModal();
    initPeriodModal();
    initExport();
    loadPoints();
    loadPeriods();
  }

  /* ===== Tabs ===== */
  function initTabs() {
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });
  }

  /* ===== Points ===== */
  function loadPoints() {
    fetch('/api/points').then(function (r) { return r.json(); }).then(function (points) {
      var tbody = document.getElementById('points-tbody');
      tbody.innerHTML = '';
      points.forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + p.id + '</td>' +
          '<td class="td-thumb">' + (p.image ? '<img class="row-thumb" src="/assets/images/' + encodeURIComponent(p.image) + '" onerror="this.style.display=\'none\'" data-full="/assets/images/' + encodeURIComponent(p.image) + '">' : '<span class="no-img">-</span>') + '</td>' +
          '<td class="td-name">' + esc(p.name) + '</td>' +
          '<td>' + esc(p.dynasty) + '</td>' +
          '<td>' + esc(p.category || '-') + '</td>' +
          '<td>' + (p.year_start || '?') + ' - ' + (p.year_end === 0 ? '至今' : (p.year_end || '?')) + '</td>' +
          '<td class="td-address">' + esc(p.address || '-') + '</td>' +
          '<td class="td-thumb td-qr">' + (p.channel_qr ? '<img class="row-thumb" src="/assets/images/' + encodeURIComponent(p.channel_qr) + '" onerror="this.style.display=\'none\'" data-full="/assets/images/' + encodeURIComponent(p.channel_qr) + '">' : '<span class="no-img">-</span>') + '</td>' +
          '<td class="td-action"><div class="action-btns">' +
            '<button class="btn btn-sm btn-edit" data-id="' + p.id + '">编辑</button>' +
            '<button class="btn btn-sm btn-danger" data-id="' + p.id + '">删除</button>' +
          '</div></td>';
        tbody.appendChild(tr);
      });
      document.getElementById('points-info').textContent = '共 ' + points.length + ' 个点位';

      tbody.querySelectorAll('.btn-edit').forEach(function (btn) {
        btn.addEventListener('click', function () { editPoint(parseInt(btn.dataset.id, 10)); });
      });
      tbody.querySelectorAll('.btn-danger').forEach(function (btn) {
        btn.addEventListener('click', function () { deletePoint(parseInt(btn.dataset.id, 10)); });
      });
      tbody.querySelectorAll('.row-thumb').forEach(function (img) {
        img.addEventListener('click', function () { previewImage(img.dataset.full); });
      });
    }).catch(function (err) { showToast('加载点位失败: ' + err.message, 'error'); });
  }

  function editPoint(id) {
    fetch('/api/points').then(function (r) { return r.json(); }).then(function (points) {
      var p = points.find(function (x) { return x.id === id; });
      if (!p) return;
      document.getElementById('point-modal-title').textContent = '编辑点位';
      document.getElementById('point-id').value = p.id;
      document.getElementById('point-name').value = p.name;
      document.getElementById('point-dynasty').value = p.dynasty;
      document.getElementById('point-year-start').value = p.year_start;
      document.getElementById('point-year-end').value = p.year_end;
      document.getElementById('point-category').value = p.category || '';
      document.getElementById('point-lat').value = p.lat;
      document.getElementById('point-lng').value = p.lng;
      document.getElementById('point-address').value = p.address || '';
      document.getElementById('point-image').value = p.image || '';
      document.getElementById('point-description').value = p.description || '';
      document.getElementById('point-channel-qr').value = p.channel_qr || '';
      showModal('point-modal');
    });
  }

  function deletePoint(id) {
    if (!confirm('确认删除该点位？')) return;
    fetch('/api/points/' + id, { method: 'DELETE' })
      .then(function (r) { return r.json(); })
      .then(function () { showToast('已删除', 'success'); loadPoints(); })
      .catch(function (err) { showToast('删除失败: ' + err.message, 'error'); });
  }

  function initPointModal() {
    document.getElementById('btn-add-point').addEventListener('click', function () {
      document.getElementById('point-modal-title').textContent = '新增点位';
      document.getElementById('point-form').reset();
      document.getElementById('point-id').value = '';
      showModal('point-modal');
    });

    document.getElementById('point-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var id = document.getElementById('point-id').value;
      var data = {
        name: document.getElementById('point-name').value,
        dynasty: document.getElementById('point-dynasty').value,
        year_start: parseInt(document.getElementById('point-year-start').value, 10) || 0,
        year_end: parseInt(document.getElementById('point-year-end').value, 10) || 0,
        category: document.getElementById('point-category').value,
        lat: Math.round(parseFloat(document.getElementById('point-lat').value) * 1e6) / 1e6 || 0,
        lng: Math.round(parseFloat(document.getElementById('point-lng').value) * 1e6) / 1e6 || 0,
        address: document.getElementById('point-address').value,
        image: document.getElementById('point-image').value,
        channel_qr: document.getElementById('point-channel-qr').value,
        description: document.getElementById('point-description').value
      };

      var url = '/api/points';
      var method = 'POST';
      if (id) { url = '/api/points/' + id; method = 'PUT'; }

      fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json(); })
        .then(function () {
          hideModal('point-modal');
          showToast('保存成功', 'success');
          loadPoints();
        })
        .catch(function (err) { showToast('保存失败: ' + err.message, 'error'); });
    });

    // Image upload (with client-side compression)
    document.getElementById('btn-upload-image').addEventListener('click', function () {
      document.getElementById('point-image-file').click();
    });
    document.getElementById('point-image-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      compressImage(file, 800, 0.85).then(function (blob) {
        var formData = new FormData();
        var filename = Date.now() + '_img.jpg';
        formData.append('image', blob, filename);
        return fetch('/api/upload', { method: 'POST', body: formData });
      }).then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.filename) {
            document.getElementById('point-image').value = res.filename;
            showToast('图片已上传（已压缩）', 'success');
          }
        })
        .catch(function (err) { showToast('上传失败: ' + err.message, 'error'); });
      e.target.value = '';
    });

    // Channel QR upload (compress to 128x128 for list, click to preview original sharp)
    document.getElementById('btn-upload-channel-qr').addEventListener('click', function () {
      document.getElementById('point-channel-qr-file').click();
    });
    document.getElementById('point-channel-qr-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      compressImage(file, 128, 0.92).then(function (blob) {
        var formData = new FormData();
        var filename = Date.now() + '_qr.jpg';
        formData.append('image', blob, filename);
        return fetch('/api/upload', { method: 'POST', body: formData });
      }).then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.filename) {
            document.getElementById('point-channel-qr').value = res.filename;
            showToast('码图已上传（128x128）', 'success');
          }
        })
        .catch(function (err) { showToast('上传失败: ' + err.message, 'error'); });
      e.target.value = '';
    });
  }

  /* ===== Image Compression ===== */
  function compressImage(file, maxEdge, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxEdge / Math.max(w, h));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('压缩失败'));
          }, 'image/jpeg', quality);
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ===== Periods ===== */
  function loadPeriods() {
    fetch('/api/periods').then(function (r) { return r.json(); }).then(function (data) {
      periods = data;
      // Populate dynasty select
      var select = document.getElementById('point-dynasty');
      select.innerHTML = '';
      data.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        select.appendChild(opt);
      });

      // Render table
      var tbody = document.getElementById('periods-tbody');
      tbody.innerHTML = '';
      data.forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + p.id + '</td>' +
          '<td>' + esc(p.name) + '</td>' +
          '<td>' + (p.start || '?') + '</td>' +
          '<td>' + (p.end || '?') + '</td>' +
          '<td><span class="color-dot" style="background:' + p.color + '"></span>' + p.color + '</td>' +
          '<td><div class="action-btns">' +
            '<button class="btn btn-sm btn-edit" data-id="' + p.id + '">编辑</button>' +
            '<button class="btn btn-sm btn-danger" data-id="' + p.id + '">删除</button>' +
          '</div></td>';
        tbody.appendChild(tr);
      });
      document.getElementById('periods-info').textContent = '共 ' + data.length + ' 个朝代';

      tbody.querySelectorAll('.btn-edit').forEach(function (btn) {
        btn.addEventListener('click', function () { editPeriod(parseInt(btn.dataset.id, 10)); });
      });
      tbody.querySelectorAll('.btn-danger').forEach(function (btn) {
        btn.addEventListener('click', function () { deletePeriod(parseInt(btn.dataset.id, 10)); });
      });
    }).catch(function (err) { showToast('加载朝代失败: ' + err.message, 'error'); });
  }

  function editPeriod(id) {
    var p = periods.find(function (x) { return x.id === id; });
    if (!p) return;
    document.getElementById('period-modal-title').textContent = '编辑朝代';
    document.getElementById('period-id').value = p.id;
    document.getElementById('period-name').value = p.name;
    document.getElementById('period-start').value = p.start;
    document.getElementById('period-end').value = p.end;
    document.getElementById('period-color').value = p.color;
    showModal('period-modal');
  }

  function deletePeriod(id) {
    if (!confirm('确认删除该朝代？')) return;
    fetch('/api/periods/' + id, { method: 'DELETE' })
      .then(function (r) { return r.json(); })
      .then(function () { showToast('已删除', 'success'); loadPeriods(); })
      .catch(function (err) { showToast('删除失败: ' + err.message, 'error'); });
  }

  function initPeriodModal() {
    document.getElementById('btn-add-period').addEventListener('click', function () {
      document.getElementById('period-modal-title').textContent = '新增朝代';
      document.getElementById('period-form').reset();
      document.getElementById('period-id').value = '';
      document.getElementById('period-color').value = '#1B4F72';
      showModal('period-modal');
    });

    document.getElementById('period-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var id = document.getElementById('period-id').value;
      var data = {
        name: document.getElementById('period-name').value,
        start: parseInt(document.getElementById('period-start').value, 10) || 0,
        end: parseInt(document.getElementById('period-end').value, 10) || 0,
        color: document.getElementById('period-color').value
      };

      var url = '/api/periods';
      var method = 'POST';
      if (id) { url = '/api/periods/' + id; method = 'PUT'; }

      fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json(); })
        .then(function () {
          hideModal('period-modal');
          showToast('保存成功', 'success');
          loadPeriods();
        })
        .catch(function (err) { showToast('保存失败: ' + err.message, 'error'); });
    });
  }

  /* ===== Export ===== */
  function initExport() {
    document.getElementById('btn-export').addEventListener('click', function () {
      if (!confirm('确认导出数据到 data/ 目录？这将覆盖现有 JSON 文件。')) return;
      fetch('/api/export', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.ok) {
            showToast('导出成功：' + res.points + ' 个点位，' + res.periods + ' 个朝代', 'success');
          } else {
            showToast('导出失败: ' + (res.error || '未知错误'), 'error');
          }
        })
        .catch(function (err) { showToast('导出失败: ' + err.message, 'error'); });
    });
  }

  /* ===== Utility ===== */
  function showModal(id) { document.getElementById(id).classList.add('show'); }
  function hideModal(id) { document.getElementById(id).classList.remove('show'); }

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showToast(msg, type) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(function () { toast.className = 'toast'; }, 2500);
  }

  function previewImage(src) {
    var overlay = document.getElementById('image-preview');
    var img = document.getElementById('image-preview-img');
    img.src = src;
    overlay.classList.add('show');
  }

  // Modal close buttons
  document.getElementById('point-modal-close').addEventListener('click', function () { hideModal('point-modal'); });
  document.getElementById('point-cancel').addEventListener('click', function () { hideModal('point-modal'); });
  document.getElementById('period-modal-close').addEventListener('click', function () { hideModal('period-modal'); });
  document.getElementById('period-cancel').addEventListener('click', function () { hideModal('period-modal'); });

  // Image preview close
  document.getElementById('image-preview').addEventListener('click', function () { this.classList.remove('show'); });

  init();
})();
