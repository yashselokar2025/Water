const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Helper functions to intercept SQLite's '?' bindings and convert them to Postgres '$1, $2'
const replaceParams = (sql) => {
    let count = 0;
    return sql.replace(/\?/g, () => {
        count++;
        return `$${count}`;
    });
};

const query = async (sql, params = []) => {
    const text = replaceParams(sql);
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res.rows;
    } finally {
        client.release();
    }
};

const execute = async (sql, params = []) => {
    const text = replaceParams(sql);
    const client = await pool.connect();
    try {
        await client.query(text, params);
    } finally {
        client.release();
    }
};

const initDB = async () => {
    const client = await pool.connect();
    try {
        // Create Tables
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                full_name TEXT,
                email TEXT,
                role TEXT NOT NULL DEFAULT 'citizen',
                phone TEXT,
                profile_picture TEXT,
                pipeline_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS pipelines (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                start_location TEXT,
                end_location TEXT,
                coordinates TEXT,
                status TEXT DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS villages (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                population INTEGER DEFAULT 0,
                health_cases INTEGER DEFAULT 0,
                risk_level TEXT DEFAULT 'Low',
                water_quality TEXT DEFAULT 'Good'
            );

            CREATE TABLE IF NOT EXISTS sensors (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                lat REAL,
                lng REAL,
                status TEXT DEFAULT 'Active',
                pipeline_id INTEGER,
                village_id INTEGER,
                last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sensor_readings (
                id SERIAL PRIMARY KEY,
                sensor_id INTEGER,
                pressure REAL,
                flow REAL,
                ph REAL,
                turbidity REAL,
                tds REAL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS complaints (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL,
                description TEXT,
                location TEXT,
                lat REAL,
                lng REAL,
                symptoms TEXT,
                image TEXT,
                priority TEXT DEFAULT 'Low',
                status TEXT DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                pipeline_id INTEGER,
                user_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS health_data (
                id SERIAL PRIMARY KEY,
                name TEXT,
                contact TEXT,
                symptoms TEXT,
                village_id INTEGER,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id SERIAL PRIMARY KEY,
                sensor_id INTEGER,
                type TEXT,
                severity TEXT,
                message TEXT,
                is_resolved BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sms_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                type TEXT,
                message TEXT,
                phone TEXT,
                status TEXT DEFAULT 'Sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sensor_overrides (
                id SERIAL PRIMARY KEY,
                sensor_id INTEGER UNIQUE,
                pressure REAL,
                flow REAL,
                ph REAL,
                turbidity REAL,
                tds REAL,
                is_active INTEGER DEFAULT 0
            );
        `);

        // Create Indexes for Performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_sensor_readings_id_time ON sensor_readings (sensor_id, timestamp DESC);
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts (is_resolved) WHERE is_resolved = false;
        `);

        console.log('Postgres Database initialized');
    } catch (err) {
        console.error('Database initialization error:', err);
    } finally {
        client.release();
    }
    return pool;
};

module.exports = {
    getDB: () => pool,
    initDB,
    query,
    execute
};
