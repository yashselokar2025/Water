const express = require('express');
const router = express.Router();
const db = require('../db');
const aiEngine = require('../services/aiEngine');

// --- Dashboard KPIs ---
router.get('/dashboard/kpis', async (req, res) => {
    try {
        const sensors = await db.query('SELECT COUNT(*) as count FROM sensors');
        const villages = await db.query('SELECT COUNT(*) as count FROM villages WHERE water_quality = "Poor"');
        const complaints = await db.query('SELECT COUNT(*) as count FROM complaints WHERE status = "Pending"');
        const alerts = await db.query('SELECT COUNT(*) as count FROM alerts WHERE is_resolved = 0');

        res.json({
            activeSensors: sensors[0].count,
            unsafeSources: villages[0].count,
            leakAlerts: alerts[0].count,
            pendingComplaints: complaints[0].count,
            outbreakRisks: villages[0].count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SMS Logs (Moved Higher for Routing Priority) ---
router.get('/sms-logs', async (req, res) => {
    try {
        const rows = await db.query('SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 50');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Village Performance ---
router.get('/villages', async (req, res) => {
    try {
        const rows = await db.query('SELECT * FROM villages');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Sensors & Latest Readings ---
router.get('/sensors', async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT s.*, p.name as pipeline_name, 
                   COALESCE(o.pressure, r.pressure) as pressure, 
                   COALESCE(o.flow, r.flow) as flow, 
                   COALESCE(o.ph, r.ph) as ph, 
                   COALESCE(o.turbidity, r.turbidity) as turbidity, 
                   COALESCE(o.tds, r.tds) as tds,
                   o.is_active as isTesting
            FROM sensors s
            LEFT JOIN pipelines p ON s.pipeline_id = p.id
            LEFT JOIN (
                SELECT * FROM sensor_readings 
                WHERE id IN (SELECT MAX(id) FROM sensor_readings GROUP BY sensor_id)
            ) r ON s.id = r.sensor_id
            LEFT JOIN sensor_overrides o ON s.id = o.sensor_id AND o.is_active = 1
        `);

        // Enriched loop using 6-layer AI logic
        const enrichedSensors = rows.map(sensor => {
            const neighbors = rows.filter(s => s.pipeline_id === sensor.pipeline_id && s.id !== sensor.id);

            // Layer 1-3 Detection and prediction (Mocking trend for now)
            const mockHistory = [sensor, { ...sensor, pressure: (sensor.pressure || 0) + 0.5 }];
            const detection = aiEngine.detectAnomalies(sensor, neighbors);
            const prediction = aiEngine.predictTrends(sensor, mockHistory);
            const risk = aiEngine.evaluateRisk(detection, prediction);
            const recommendations = aiEngine.getRecommendations(risk.level, detection.detectionInsights);
            const decision = aiEngine.generateExecutiveDecision(risk.level, prediction);

            return {
                ...sensor,
                isAnomaly: detection.isAnomaly,
                leakScore: detection.leakScore,
                riskScore: risk.score,
                riskLevel: risk.level,
                trend: prediction.trend,
                forecast: prediction.prediction,
                recommendations,
                decision,
                reason: detection.detectionInsights.join(' | ') || 'Stability confirmed by peer nodes'
            };
        });

        res.json(enrichedSensors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Analytics (Historical) ---
router.get('/analytics/:sensorId', async (req, res) => {
    const { sensorId } = req.params;
    try {
        const rows = await db.query(
            'SELECT * FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 50',
            [sensorId]
        );
        res.json(rows.reverse());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Complaints ---
router.post('/complaints', async (req, res) => {
    const { type, description, location, priority } = req.body;
    try {
        await db.execute(
            'INSERT INTO complaints (type, description, location, priority) VALUES (?, ?, ?, ?)',
            [type, description, location, priority]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Health Data ---
router.post('/health', async (req, res) => {
    const { name, contact, symptoms, village_id } = req.body;
    try {
        await db.execute(
            'INSERT INTO health_data (name, contact, symptoms, village_id) VALUES (?, ?, ?, ?)',
            [name, contact, symptoms, village_id]
        );
        await db.execute('UPDATE villages SET health_cases = health_cases + 1 WHERE id = ?', [village_id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AI Logic: Leak Detection ---
router.get('/ai/leak-detection', async (req, res) => {
    try {
        const sensors = await db.query('SELECT id, name FROM sensors');
        const leakScores = [];

        for (const sensor of sensors) {
            const readings = await db.query(
                'SELECT pressure, flow FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 2',
                [sensor.id]
            );

            if (readings.length < 2) continue;

            const curr = readings[0];
            const prev = readings[1];

            const pressure_drop = Math.max(0, prev.pressure - curr.pressure) * 10;
            const flow_anomaly = Math.abs(curr.flow - prev.flow) * 5;

            const otherReadings = await db.query(
                'SELECT pressure FROM sensor_readings WHERE sensor_id != ? ORDER BY id DESC LIMIT 1',
                [sensor.id]
            );
            const neighbor_difference = Math.abs(curr.pressure - (otherReadings[0]?.pressure || curr.pressure)) * 5;

            const leak_score = (pressure_drop + flow_anomaly + neighbor_difference) / 3;

            let status = 'Low';
            if (leak_score > 30) status = 'Medium';
            if (leak_score > 60) status = 'High';

            leakScores.push({
                sensorId: sensor.id,
                sensorName: sensor.name,
                leakProbability: Math.min(100, Math.round(leak_score)),
                status
            });
        }
        res.json(leakScores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AI Logic: Outbreak Risk ---
router.get('/ai/outbreak-risk', async (req, res) => {
    try {
        const villages = await db.query('SELECT * FROM villages');
        const risks = [];

        for (const village of villages) {
            const water_quality_score = village.water_quality === 'Poor' ? 80 : (village.water_quality === 'Fair' ? 40 : 10);
            const health_score = Math.min(100, village.health_cases * 5);

            const complaints = await db.query(
                'SELECT COUNT(*) as count FROM complaints WHERE location LIKE ? AND status != "Resolved"',
                [`%${village.name}%`]
            );
            const complaint_score = Math.min(100, complaints[0].count * 10);

            const risk_score = (water_quality_score + health_score + complaint_score) / 3;

            let level = 'Low';
            if (risk_score > 30) level = 'Medium';
            if (risk_score > 60) level = 'High';

            let explanation = `Risk is ${level} based on ${village.water_quality} water quality and ${village.health_cases} health cases.`;

            risks.push({
                villageId: village.id,
                villageName: village.name,
                riskScore: Math.round(risk_score),
                level,
                explanation
            });
        }
        res.json(risks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Predictive Analysis ---
router.get('/ai/predict/:sensorId', async (req, res) => {
    const { sensorId } = req.params;
    try {
        const readings = await db.query(
            'SELECT pressure, turbidity FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 5',
            [sensorId]
        );

        if (readings.length < 2) return res.json({ message: "Not enough data for prediction" });

        const p_diff = readings[0].pressure - readings[1].pressure;
        const t_diff = readings[0].turbidity - readings[1].turbidity;

        let predictions = [];
        if (p_diff < -0.1) predictions.push("Pressure expected to drop in next 10 minutes");
        if (t_diff > 0.2) predictions.push("Contamination risk increasing (turbidity rising)");
        if (predictions.length === 0) predictions.push("No significant anomalies predicted");

        res.json({ sensorId, predictions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Priority System ---
router.get('/ai/priority-list', async (req, res) => {
    try {
        const villages = await db.query('SELECT * FROM villages');
        const priorityList = villages.map(v => {
            const riskWeight = v.risk_level === 'High' ? 30 : (v.risk_level === 'Medium' ? 15 : 5);
            const priorityScore = riskWeight + (v.population / 100);
            return {
                village: v.name,
                priorityScore,
                risk: v.risk_level,
                affectedPopulation: v.population
            };
        }).sort((a, b) => b.priorityScore - a.priorityScore);

        res.json(priorityList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Pipelines (Infrastructure) ---
router.get('/pipelines', async (req, res) => {
    try {
        const rows = await db.query('SELECT * FROM pipelines');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/pipelines', async (req, res) => {
    const { name, start_location, end_location, coordinates } = req.body;
    try {
        await db.execute(
            'INSERT INTO pipelines (name, start_location, end_location, coordinates) VALUES (?, ?, ?, ?)',
            [name, start_location, end_location, JSON.stringify(coordinates)]
        );
        res.json({ success: true, message: 'Pipeline created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Pipeline Deletion (Cascading) ---
router.delete('/pipelines/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const database = db.getDB();
        // 1. Delete Overrides for all sensors in this pipeline
        await database.run('DELETE FROM sensor_overrides WHERE sensor_id IN (SELECT id FROM sensors WHERE pipeline_id = ?)', [id]);

        // 2. Delete Readings for all sensors in this pipeline
        await database.run('DELETE FROM sensor_readings WHERE sensor_id IN (SELECT id FROM sensors WHERE pipeline_id = ?)', [id]);

        // 3. Delete Alerts for all sensors in this pipeline
        await database.run('DELETE FROM alerts WHERE sensor_id IN (SELECT id FROM sensors WHERE pipeline_id = ?)', [id]);

        // 4. Delete Sensors
        await database.run('DELETE FROM sensors WHERE pipeline_id = ?', [id]);

        // 5. Delete Pipeline
        await database.run('DELETE FROM pipelines WHERE id = ?', [id]);

        res.json({ success: true, message: 'Infrastructure segment and all associated assets decommissioned' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Enhanced Sensor Addition ---
router.post('/sensors', async (req, res) => {
    const { name, location, lat, lng, pipeline_id } = req.body;
    try {
        await db.execute(
            'INSERT INTO sensors (name, location, lat, lng, pipeline_id) VALUES (?, ?, ?, ?, ?)',
            [name, location, lat, lng, pipeline_id]
        );
        res.json({ success: true, message: 'Sensor added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AI Intelligence Layer 5: Resource Allocation ---
router.get('/ai/priority-maintenance', async (req, res) => {
    try {
        const pipelines = await db.query('SELECT * FROM pipelines');
        const sensors = await db.query('SELECT * FROM sensors');
        // Note: In production, use the enriched sensors from the /sensors logic
        // For now, re-enrich for the ranking
        const enrichedSensors = sensors.map(s => {
            const neighbors = sensors.filter(n => n.pipeline_id === s.pipeline_id && n.id !== s.id);
            const detection = aiEngine.detectAnomalies(s, neighbors);
            const risk = aiEngine.evaluateRisk(detection, { trend: 'Stable', prediction: '' });
            return { ...s, riskScore: risk.score };
        });

        const ranking = await aiEngine.rankPipelines(pipelines, enrichedSensors);
        res.json(ranking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/ai/insights', async (req, res) => {
    try {
        const sensors = await db.query('SELECT * FROM sensors');
        const highRisk = sensors.filter(s => s.leakScore > 70).length;
        const mediumRisk = sensors.filter(s => s.leakScore > 40 && s.leakScore <= 70).length;

        res.json({
            highRiskCount: highRisk,
            mediumRiskCount: mediumRisk,
            globalStatus: highRisk > 0 ? 'CRITICAL' : (mediumRisk > 0 ? 'WARNING' : 'STABLE'),
            updateTime: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;
