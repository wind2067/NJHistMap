const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data.db');
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
    category TEXT DEFAULT '',
    channel_qr TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start INTEGER,
    end INTEGER,
    color TEXT
  );
`);

// Seed periods if empty
var periodCount = db.prepare('SELECT COUNT(*) as count FROM periods').get();
if (periodCount.count === 0) {
  var periodsFile = path.join(__dirname, '..', 'data', 'periods.json');
  var seedPeriods = JSON.parse(fs.readFileSync(periodsFile, 'utf-8'));
  var insertPeriod = db.prepare('INSERT INTO periods (name, start, end, color) VALUES (?, ?, ?, ?)');
  seedPeriods.forEach(function (p) {
    insertPeriod.run(p.name, p.start, p.end, p.color);
  });
  console.log('Seeded ' + seedPeriods.length + ' periods');
}

// Points are seeded via import_data.js, not here

module.exports = db;
