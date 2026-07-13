const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const empty = { licenses: {}, sessions: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('db.json تالف، جارٍ إعادة تهيئته.', e);
    const empty = { licenses: {}, sessions: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = { loadDB, saveDB, DB_PATH };
