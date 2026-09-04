const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Image upload config
var imageDir = path.join(__dirname, '..', 'assets', 'images');
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}
var upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) { cb(null, imageDir); },
    filename: function (req, file, cb) { cb(null, Date.now() + '_' + file.originalname); }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* ===== Points API ===== */

app.get('/api/points', function (req, res) {
  var rows = db.prepare('SELECT * FROM points ORDER BY id').all();
  res.json(rows);
});

app.post('/api/points', function (req, res) {
  var b = req.body;
  var info = db.prepare(
    'INSERT INTO points (name, dynasty, year_start, year_end, address, lat, lng, description, image, category, channel_qr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(b.name, b.dynasty, b.year_start, b.year_end, b.address, b.lat, b.lng, b.description, b.image || '', b.category || '', b.channel_qr || '');
  exportData();
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/points/:id', function (req, res) {
  var b = req.body;
  db.prepare(
    'UPDATE points SET name=?, dynasty=?, year_start=?, year_end=?, address=?, lat=?, lng=?, description=?, image=?, category=?, channel_qr=? WHERE id=?'
  ).run(b.name, b.dynasty, b.year_start, b.year_end, b.address, b.lat, b.lng, b.description, b.image || '', b.category || '', b.channel_qr || '', req.params.id);
  exportData();
  res.json({ ok: true });
});

app.delete('/api/points/:id', function (req, res) {
  db.prepare('DELETE FROM points WHERE id=?').run(req.params.id);
  exportData();
  res.json({ ok: true });
});

/* ===== Periods API ===== */

app.get('/api/periods', function (req, res) {
  var rows = db.prepare('SELECT * FROM periods ORDER BY start').all();
  res.json(rows);
});

app.post('/api/periods', function (req, res) {
  var b = req.body;
  var info = db.prepare('INSERT INTO periods (name, start, end, color) VALUES (?, ?, ?, ?)').run(b.name, b.start, b.end, b.color);
  exportData();
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/periods/:id', function (req, res) {
  var b = req.body;
  db.prepare('UPDATE periods SET name=?, start=?, end=?, color=? WHERE id=?').run(b.name, b.start, b.end, b.color, req.params.id);
  exportData();
  res.json({ ok: true });
});

app.delete('/api/periods/:id', function (req, res) {
  db.prepare('DELETE FROM periods WHERE id=?').run(req.params.id);
  exportData();
  res.json({ ok: true });
});

/* ===== Image Upload ===== */

app.post('/api/upload', upload.single('image'), function (req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename });
});

/* ===== Export ===== */

function exportData() {
  var points = db.prepare('SELECT * FROM points ORDER BY id').all().map(function (r) {
    return {
      id: r.id,
      name: r.name,
      dynasty: r.dynasty,
      year_start: r.year_start,
      year_end: r.year_end,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      description: r.description,
      image: r.image || '',
      category: r.category || '',
      channel_qr: r.channel_qr || ''
    };
  });

  var periods = db.prepare('SELECT * FROM periods ORDER BY start').all().map(function (r) {
    return { name: r.name, start: r.start, end: r.end, color: r.color };
  });

  var dataDir = path.join(__dirname, '..', 'data');
  fs.writeFileSync(path.join(dataDir, 'points.json'), JSON.stringify(points, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dataDir, 'periods.json'), JSON.stringify(periods, null, 2), 'utf-8');

  return { points: points.length, periods: periods.length };
}

app.post('/api/export', function (req, res) {
  try {
    var counts = exportData();
    res.json({ ok: true, points: counts.points, periods: counts.periods });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== Start ===== */

app.listen(PORT, function () {
  console.log('HistMap Admin: http://localhost:' + PORT);
});
