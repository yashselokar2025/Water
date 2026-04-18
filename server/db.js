const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

const initDB = async () => {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    // Create Tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT,
            email TEXT,
            role TEXT NOT NULL DEFAULT 'citizen',
            phone TEXT,
            pipeline_id INTEGER,
            FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
        );

        CREATE TABLE IF NOT EXISTS pipelines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_location TEXT,
            end_location TEXT,
            coordinates TEXT, -- JSON string of [[lat,lng], ...]
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS villages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            population INTEGER DEFAULT 0,
            health_cases INTEGER DEFAULT 0,
            risk_level TEXT DEFAULT 'Low',
            water_quality TEXT DEFAULT 'Good'
        );

        CREATE TABLE IF NOT EXISTS sensors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            lat REAL,
            lng REAL,
            status TEXT DEFAULT 'Active',
            pipeline_id INTEGER,
            village_id INTEGER,
            last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pipeline_id) REFERENCES pipelines(id),
            FOREIGN KEY (village_id) REFERENCES villages(id)
        );

        CREATE TABLE IF NOT EXISTS sensor_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id INTEGER,
            pressure REAL,
            flow REAL,
            ph REAL,
            turbidity REAL,
            tds REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sensor_id) REFERENCES sensors(id)
        );

        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            description TEXT,
            location TEXT,
            lat REAL,
            lng REAL,
            priority TEXT DEFAULT 'Low',
            status TEXT DEFAULT 'Pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            pipeline_id INTEGER,
            user_id INTEGER,
            FOREIGN KEY (pipeline_id) REFERENCES pipelines(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS health_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            contact TEXT,
            symptoms TEXT,
            village_id INTEGER,
            recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (village_id) REFERENCES villages(id)
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id INTEGER,
            type TEXT,
            severity TEXT,
            message TEXT,
            is_resolved BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sensor_id) REFERENCES sensors(id)
        );

        CREATE TABLE IF NOT EXISTS sms_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT,
            message TEXT,
            phone TEXT,
            status TEXT DEFAULT 'Sent',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS sensor_overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id INTEGER UNIQUE,
            pressure REAL,
            flow REAL,
            ph REAL,
            turbidity REAL,
            tds REAL,
            is_active INTEGER DEFAULT 0,
            FOREIGN KEY (sensor_id) REFERENCES sensors(id)
        );
    `);

    // --- MIGRATIONS ---
    try { await db.run('ALTER TABLE sensors ADD COLUMN pipeline_id INTEGER'); } catch (e) { }
    try { await db.run('ALTER TABLE pipelines ADD COLUMN coordinates TEXT'); } catch (e) { }
    try { await db.run('ALTER TABLE sensors ADD COLUMN village_id INTEGER'); } catch (e) { }
    try { await db.run('ALTER TABLE sensors ADD COLUMN last_update DATETIME DEFAULT CURRENT_TIMESTAMP'); } catch (e) { }
    try { await db.run('ALTER TABLE users ADD COLUMN phone TEXT'); } catch (e) { }
    try { await db.run('ALTER TABLE users ADD COLUMN pipeline_id INTEGER'); } catch (e) { }
    try { await db.run('ALTER TABLE users ADD COLUMN full_name TEXT'); } catch (e) { }
    try { await db.run('ALTER TABLE users ADD COLUMN email TEXT'); } catch (e) { }
    try { await db.run('ALTER TABLE users ADD COLUMN profile_picture TEXT'); } catch (e) { }
    try { await db.run('ALTER TABLE complaints ADD COLUMN pipeline_id INTEGER'); } catch (e) { }
    try { await db.run('ALTER TABLE complaints ADD COLUMN user_id INTEGER'); } catch (e) { }
    try { await db.run('ALTER TABLE complaints ADD COLUMN lat REAL'); } catch (e) { }
    try { await db.run('ALTER TABLE complaints ADD COLUMN lng REAL'); } catch (e) { }
    try { await db.run('ALTER TABLE complaints ADD COLUMN symptoms TEXT'); } catch (e) { }
    try { await db.run('ALTER TABLE complaints ADD COLUMN image TEXT'); } catch (e) { }

    // Create Indexes for Performance
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sensor_readings_id_time ON sensor_readings (sensor_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts (is_resolved) WHERE is_resolved = 0;
    `);

    console.log('SQLite Database initialized');
    return db;
};

module.exports = {
    getDB: () => db,
    initDB,
    query: (sql, params) => db.all(sql, params),
    execute: (sql, params) => db.run(sql, params)
};
