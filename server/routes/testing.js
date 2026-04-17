const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Reset all overrides for a specific sensor or pipeline
 */
router.post('/reset', async (req, res) => {
    const { sensorId, pipelineId } = req.body;
    try {
        const database = db.getDB();
        if (sensorId) {
            await database.run('DELETE FROM sensor_overrides WHERE sensor_id = ?', [sensorId]);
        } else if (pipelineId) {
            await database.run('DELETE FROM sensor_overrides WHERE sensor_id IN (SELECT id FROM sensors WHERE pipeline_id = ?)', [pipelineId]);
        } else {
            await database.run('DELETE FROM sensor_overrides');
        }
        res.json({ success: true, message: "Simulation state restored to normal" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Apply a leak scenario
 */
router.post('/simulate-leak', async (req, res) => {
    const { sensorId, pipelineId } = req.body;
    try {
        const database = db.getDB();
        const sensorsToUpdate = [];

        if (sensorId) {
            sensorsToUpdate.push(sensorId);
        } else if (pipelineId) {
            const results = await database.all('SELECT id FROM sensors WHERE pipeline_id = ?', [pipelineId]);
            results.forEach(r => sensorsToUpdate.push(r.id));
        }

        for (const id of sensorsToUpdate) {
            await database.run(`
                INSERT INTO sensor_overrides (sensor_id, pressure, flow, is_active)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(sensor_id) DO UPDATE SET
                pressure = excluded.pressure,
                flow = excluded.flow,
                is_active = 1
            `, [id, 1.2, 28.5]); // Low pressure (normal ~3.0), High flow (normal ~15.0)
        }

        res.json({ success: true, message: "Leak scenario activated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Apply a contamination scenario
 */
router.post('/simulate-contamination', async (req, res) => {
    const { sensorId, pipelineId } = req.body;
    try {
        const database = db.getDB();
        const sensorsToUpdate = [];

        if (sensorId) {
            sensorsToUpdate.push(sensorId);
        } else if (pipelineId) {
            const results = await database.all('SELECT id FROM sensors WHERE pipeline_id = ?', [pipelineId]);
            results.forEach(r => sensorsToUpdate.push(r.id));
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
            `, [id, 9.2, 12.5, 1150]); // Extreme pH, High Turbidity, High TDS
        }

        res.json({ success: true, message: "Contamination scenario activated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Manual Data Override
 */
router.post('/override', async (req, res) => {
    const { sensorId, pressure, flow, ph, turbidity, tds } = req.body;
    try {
        const database = db.getDB();
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
        `, [sensorId, pressure, flow, ph, turbidity, tds]);

        res.json({ success: true, message: "Manual override applied" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
