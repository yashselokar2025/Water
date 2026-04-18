const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const db = require('./db');
const simulation = require('./simulation');

app.get('/', (req, res) => {
    res.send('SmartWater AI Backend (SQLite) is running');
});

// Import and use routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const testingRoutes = require('./routes/testing');
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/testing', testingRoutes);

// Simulation controls (Legacy Support pointing to new override system)
app.post('/api/simulate/leak', async (req, res) => {
    try {
        const database = db.getDB();
        const sensors = await database.all('SELECT id FROM sensors');
        for (const s of sensors) {
            await database.run(`
                INSERT INTO sensor_overrides (sensor_id, pressure, flow, is_active)
                VALUES (?, 1.0, 35.0, 1)
                ON CONFLICT(sensor_id) DO UPDATE SET pressure=1.0, flow=35.0, is_active=1
            `, [s.id]);
        }
        res.json({ message: 'System-wide leak simulation enabled' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/simulate/contamination', async (req, res) => {
    try {
        const database = db.getDB();
        const sensors = await database.all('SELECT id FROM sensors');
        for (const s of sensors) {
            await database.run(`
                INSERT INTO sensor_overrides (sensor_id, ph, turbidity, tds, is_active)
                VALUES (?, 9.8, 35.0, 1250, 1)
                ON CONFLICT(sensor_id) DO UPDATE SET ph=9.8, turbidity=35.0, tds=1250, is_active=1
            `, [s.id]);
        }
        res.json({ message: 'System-wide contamination simulation enabled' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/simulate/reset', async (req, res) => {
    try {
        await db.getDB().run('DELETE FROM sensor_overrides');
        res.json({ message: 'Simulation reset completed' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

async function startServer() {
    await db.initDB();
    simulation.startSimulation();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();
