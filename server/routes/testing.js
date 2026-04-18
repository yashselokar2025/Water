const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Reset all overrides for a specific sensor or pipeline
 */
router.post('/reset', async (req, res) => {
    const { sensorId, pipelineId } = req.body;
    console.log(`Reset Request: sensorId=${sensorId}, pipelineId=${pipelineId}`);
    try {
        const database = db.getDB();
        if (sensorId && sensorId !== '') {
            await database.run('DELETE FROM sensor_overrides WHERE sensor_id = ?', [parseInt(sensorId)]);
        } else if (pipelineId && pipelineId !== '') {
            await database.run('DELETE FROM sensor_overrides WHERE sensor_id IN (SELECT id FROM sensors WHERE pipeline_id = ?)', [parseInt(pipelineId)]);
        } else {
            await database.run('DELETE FROM sensor_overrides');
        }
        res.json({ success: true, message: "Simulation state restored to normal" });
    } catch (err) {
        console.error('Reset error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Apply a leak scenario with intensity control
 */
router.post('/simulate-leak', async (req, res) => {
    const { sensorId, pipelineId, intensity = 'high' } = req.body;
    console.log(`Leak Simulation Request: sensorId=${sensorId}, pipelineId=${pipelineId}, intensity=${intensity}`);
    try {
        const database = db.getDB();
        const sensorsToUpdate = [];

        if (sensorId && sensorId !== '') {
            sensorsToUpdate.push(parseInt(sensorId));
        } else if (pipelineId && pipelineId !== '') {
            const results = await database.all('SELECT id FROM sensors WHERE pipeline_id = ?', [parseInt(pipelineId)]);
            results.forEach(r => sensorsToUpdate.push(r.id));
        } else {
            const results = await database.all('SELECT id FROM sensors');
            results.forEach(r => sensorsToUpdate.push(r.id));
        }

        console.log(`Updating ${sensorsToUpdate.length} sensors with leak scenario`);

        const level = (intensity || 'high').toLowerCase();
        let p, f;
        switch (level) {
            case 'low': p = 2.8; f = 18.0; break;
            case 'medium': p = 2.0; f = 24.0; break;
            case 'high':
            default: p = 1.0; f = 35.0; break;
        }

        for (const id of sensorsToUpdate) {
            await database.run(`
                INSERT INTO sensor_overrides (sensor_id, pressure, flow, is_active)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(sensor_id) DO UPDATE SET
                pressure = excluded.pressure,
                flow = excluded.flow,
                is_active = 1
            `, [id, p, f]);
        }

        res.json({ success: true, message: `Leak scenario (${intensity.toUpperCase()}) activated` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Apply a contamination scenario with intensity control
 */
router.post('/simulate-contamination', async (req, res) => {
    const { sensorId, pipelineId, intensity = 'high' } = req.body;
    try {
        const database = db.getDB();
        const sensorsToUpdate = [];

        if (sensorId) {
            sensorsToUpdate.push(sensorId);
        } else if (pipelineId) {
            const results = await database.all('SELECT id FROM sensors WHERE pipeline_id = ?', [pipelineId]);
            results.forEach(r => sensorsToUpdate.push(r.id));
        } else {
            const results = await database.all('SELECT id FROM sensors');
            results.forEach(r => sensorsToUpdate.push(r.id));
        }

        let ph, turb, tds;
        switch (intensity.toLowerCase()) {
            case 'low': ph = 8.4; turb = 6.0; tds = 450; break;
            case 'medium': ph = 8.9; turb = 12.0; tds = 650; break;
            case 'high':
            default: ph = 9.8; turb = 35.0; tds = 1250; break;
        }

        for (const id of sensorsToUpdate) {
            await database.run(`
                INSERT INTO sensor_overrides (sensor_id, ph, turbidity, tds, is_active)
                VALUES (?, ?, ?, ?, 1)
                ON CONFLICT(sensor_id) DO UPDATE SET
                ph = excluded.ph,
                turbidity = excluded.turbidity,
                tds = excluded.tds,
                is_active = 1
            `, [id, ph, turb, tds]);
        }

        res.json({ success: true, message: `Contamination scenario (${intensity.toUpperCase()}) activated` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Manual Data Override
 */
router.post('/override', async (req, res) => {
    const { sensorId, pressure, flow, ph, turbidity, tds } = req.body;
    console.log(`Manual Override Request for sensor ${sensorId}`);
    try {
        const database = db.getDB();
        const id = parseInt(sensorId);
        if (isNaN(id)) throw new Error("Invalid Sensor ID");

        await database.run(`
            INSERT INTO sensor_overrides (sensor_id, pressure, flow, ph, turbidity, tds, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(sensor_id) DO UPDATE SET
            pressure = COALESCE(excluded.pressure, sensor_overrides.pressure),
            flow = COALESCE(excluded.flow, sensor_overrides.flow),
            ph = COALESCE(excluded.ph, sensor_overrides.ph),
            turbidity = COALESCE(excluded.turbidity, sensor_overrides.turbidity),
            tds = COALESCE(excluded.tds, sensor_overrides.tds),
            is_active = 1
        `, [id, pressure, flow, ph, turbidity, tds]);

        res.json({ success: true, message: "Manual override applied" });
    } catch (err) {
        console.error('Override error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
