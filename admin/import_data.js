const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data.db');

// Delete old database
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Old database deleted');
}

const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dynasty TEXT NOT NULL,
    year_start INTEGER,
    year_end INTEGER,
    address TEXT,
    lat REAL,
    lng REAL,
    description TEXT,
    image TEXT DEFAULT '',
    category TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start INTEGER,
    end INTEGER,
    color TEXT
  );
`);

// Import periods from periods.json
var periodsPath = path.join(__dirname, '..', 'data', 'periods.json');
var periods = JSON.parse(fs.readFileSync(periodsPath, 'utf-8'));
var insertPeriod = db.prepare('INSERT INTO periods (name, start, end, color) VALUES (?, ?, ?, ?)');
periods.forEach(function (p) {
  insertPeriod.run(p.name, p.start, p.end, p.color);
});
console.log('Imported ' + periods.length + ' periods');

// Import points from points.json
var pointsPath = path.join(__dirname, '..', 'data', 'points.json');
var points = JSON.parse(fs.readFileSync(pointsPath, 'utf-8'));
var insertPoint = db.prepare(
  'INSERT INTO points (name, dynasty, year_start, year_end, address, lat, lng, description, image, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
points.forEach(function (p) {
  insertPoint.run(p.name, p.dynasty, p.year_start, p.year_end, p.address, p.lat, p.lng, p.description || '', p.image || '', p.category || '');
});
console.log('Imported ' + points.length + ' points');

// Verify
var count = db.prepare('SELECT COUNT(*) as count FROM points').get();
console.log('Database now has ' + count.count + ' points');
var pcount = db.prepare('SELECT COUNT(*) as count FROM periods').get();
console.log('Database now has ' + pcount.count + ' periods');

db.close();
console.log('Done!');
