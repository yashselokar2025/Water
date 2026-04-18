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

        // Enriched loop using AI logic with historical context
        const enrichedSensors = [];
        for (const sensor of rows) {
            const neighbors = rows.filter(s => s.pipeline_id === sensor.pipeline_id && s.id !== sensor.id);

            // Fetch one previous reading to calculate ∆P/∆F
            const history = await db.query(
                'SELECT pressure, flow, ph, turbidity, tds FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 1 OFFSET 1',
                [sensor.id]
            );

            const detection = aiEngine.detectAnomalies(sensor, neighbors, history);
            const prediction = aiEngine.predictTrends(sensor, history); // Optional: history could be larger if needed
            const risk = aiEngine.evaluateRisk({
                insights: detection.detectionInsights.map(msg => ({ level: detection.leakScore > 75 ? 'High' : 'Medium', explanation: msg })),
                confidence: 85
            });

            enrichedSensors.push({
                ...sensor,
                isAnomaly: detection.isAnomaly,
                leakScore: detection.leakScore,
                riskScore: risk.score,
                riskLevel: risk.level,
                anomalyReason: detection.detectionInsights.join(' | ') || 'Stability confirmed by peer nodes'
            });
        }

        res.json(enrichedSensors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Pipeline Aggregate Analytics ---
router.get('/analytics/pipeline/:pipelineId', async (req, res) => {
    const { pipelineId } = req.params;
    try {
        const rows = await db.query(`
            SELECT timestamp as time, 
                   AVG(pressure) as pressure, 
                   AVG(flow) as flow, 
                   AVG(ph) as ph, 
                   AVG(turbidity) as turbidity, 
                   AVG(tds) as tds
            FROM sensor_readings 
            WHERE sensor_id IN (SELECT id FROM sensors WHERE pipeline_id = ?)
            GROUP BY timestamp
            ORDER BY timestamp DESC
            LIMIT 50
        `, [pipelineId]);

        const data = rows.reverse().map(r => ({
            ...r,
            time: new Date(r.time.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Analytics (Historical) - Fixed path ---
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
router.post('/complaint/add', async (req, res) => {
    let { user_id, pipeline_id, type, description, location, priority, lat, lng, symptoms, image } = req.body;

    // Ensure symptoms is stored as a JSON string for SQLite TEXT column
    const symptomsStr = Array.isArray(symptoms) ? JSON.stringify(symptoms) : (symptoms || '[]');

    try {
        await db.execute(
            'INSERT INTO complaints (user_id, pipeline_id, type, description, location, priority, lat, lng, symptoms, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, pipeline_id, type, description, location, priority || 'Low', lat, lng, symptomsStr, image]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/complaint/all', async (req, res) => {
    try {
        const complaints = await db.query(`
            SELECT c.*, p.name as pipeline_name, u.username as user_name 
            FROM complaints c 
            LEFT JOIN pipelines p ON c.pipeline_id = p.id
            LEFT JOIN users u ON c.user_id = u.id
            ORDER BY c.created_at DESC
        `);
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/complaint/status/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    console.log(`[API] Updating status for complaint ${id} to ${status}`);
    try {
        await db.execute('UPDATE complaints SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (error) {
        console.error(`[API ERROR] Update status failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/complaint/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[API] Deleting complaint ${id}`);
    try {
        await db.execute('DELETE FROM complaints WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error(`[API ERROR] Delete failed: ${error.message}`);
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
        const sensors = await db.query('SELECT * FROM sensors');
        const leakScores = [];

        for (const sensor of sensors) {
            // Get history for ∆P and ∆F
            const history = await db.query(
                'SELECT pressure, flow, ph, turbidity, tds FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 2',
                [sensor.id]
            );

            // Get latest reading (including overrides)
            const latestRes = await db.query(`
                SELECT s.id, 
                       COALESCE(o.pressure, r.pressure) as pressure, 
                       COALESCE(o.flow, r.flow) as flow, 
                       COALESCE(o.ph, r.ph) as ph, 
                       COALESCE(o.turbidity, r.turbidity) as turbidity, 
                       COALESCE(o.tds, r.tds) as tds
                FROM sensors s
                LEFT JOIN (
                    SELECT * FROM sensor_readings 
                    WHERE id IN (SELECT MAX(id) FROM sensor_readings GROUP BY sensor_id)
                ) r ON s.id = r.sensor_id
                LEFT JOIN sensor_overrides o ON s.id = o.sensor_id AND o.is_active = 1
                WHERE s.id = ?
            `, [sensor.id]);

            const latest = latestRes[0] || sensor;
            const neighbors = sensors.filter(s => s.pipeline_id === sensor.pipeline_id && s.id !== sensor.id);

            // Use unified AI engine logic
            const detection = aiEngine.detectAnomalies(latest, neighbors, history);

            leakScores.push({
                sensorId: sensor.id,
                sensorName: sensor.name,
                leakProbability: Math.min(100, Math.round(detection.leakScore)),
                status: detection.leakScore > 60 ? 'High' : (detection.leakScore > 30 ? 'Medium' : 'Low'),
                insights: detection.detectionInsights
            });
        }
        res.json(leakScores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AI Logic: Outbreak Risk (Trend Analysis Overhaul) ---
router.get('/ai/outbreak-risk', async (req, res) => {
    try {
        const pipelines = await db.query('SELECT * FROM pipelines');
        const risks = [];

        for (const pipeline of pipelines) {
            // 1. Current Window (last 10 minutes)
            const currentRes = await db.query(
                `SELECT COUNT(*) as count FROM complaints 
                 WHERE pipeline_id = ? AND created_at >= datetime('now', '-10 minutes')`,
                [pipeline.id]
            );
            const currentCount = currentRes[0]?.count || 0;

            // 2. Previous Window (10-20 minutes ago)
            const previousRes = await db.query(
                `SELECT COUNT(*) as count FROM complaints 
                 WHERE pipeline_id = ? AND created_at >= datetime('now', '-20 minutes') 
                 AND created_at < datetime('now', '-10 minutes')`,
                [pipeline.id]
            );
            const previousCount = previousRes[0]?.count || 0;

            // 3. Top Issue Type
            const topIssueRes = await db.query(
                `SELECT type, COUNT(*) as count FROM complaints 
                 WHERE pipeline_id = ? AND created_at >= datetime('now', '-10 minutes')
                 GROUP BY type ORDER BY count DESC LIMIT 1`,
                [pipeline.id]
            );
            const topIssue = topIssueRes[0]?.type || 'N/A';

            // 3b. Total Complaints (Lifetime)
            const totalRes = await db.query(
                'SELECT COUNT(*) as count FROM complaints WHERE pipeline_id = ?',
                [pipeline.id]
            );
            const totalCount = totalRes[0]?.count || 0;

            // 4. Trend Calculation
            let trend = 'STABLE';
            let trendIcon = '➖';
            if (currentCount > previousCount) {
                trend = 'INCREASING';
                trendIcon = '📈';
            } else if (currentCount < previousCount && currentCount > 0) {
                trend = 'DECREASING';
                trendIcon = '📉';
            } else if (currentCount === 0 && previousCount > 0) {
                trend = 'DECREASING';
                trendIcon = '📉';
            }

            // 5. Risk Calculation
            let level = 'Low';
            let riskScore = 20;
            if (currentCount > 3 && trend === 'INCREASING') {
                level = 'High';
                riskScore = 85;
            } else if (currentCount > 0 || trend === 'STABLE') {
                level = 'Medium';
                riskScore = 50;
            }

            // 6. AI Insight
            let insight = 'Stable parameters detected in this sector.';
            if (trend === 'INCREASING') insight = `Rapid spike in ${topIssue} reports suggests immediate network breach.`;
            else if (trend === 'STABLE' && currentCount > 0) insight = `Persistent ${topIssue} incidents indicate recurring structural weakness.`;
            else if (trend === 'DECREASING') insight = `Clustered ${topIssue} issues are subsiding; localized containment successful.`;

            risks.push({
                pipelineId: pipeline.id,
                pipelineName: pipeline.name,
                riskScore,
                currentCount,
                previousCount,
                totalCount,
                trend,
                trendIcon,
                level,
                topIssue,
                insight,
                alertTriggered: level === 'High' && trend === 'INCREASING'
            });
        }
        res.json(risks.sort((a, b) => b.riskScore - a.riskScore));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Predictive Analysis ---
router.get('/ai/predict/:sensorId', async (req, res) => {
    const { sensorId } = req.params;
    try {
        const history = await db.query(
            'SELECT pressure, flow, ph, turbidity, tds FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 30',
            [sensorId]
        );

        if (history.length < 3) return res.json({ status: 'Insufficient Data' });

        const sensor = history[0];
        const past = history.slice(1);

        const advancedAnalytics = aiEngine.getAdvancedAnalytics(sensor, past);
        const risk = aiEngine.evaluateRisk(advancedAnalytics);

        res.json({
            sensorId,
            ...advancedAnalytics,
            riskCalculated: risk
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Analytics Data ---
router.get('/analytics/:sensorId', async (req, res) => {
    const { sensorId } = req.params;
    try {
        const history = await db.query(
            'SELECT timestamp as time, pressure, flow, ph, turbidity, tds FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 20',
            [sensorId]
        );

        const data = history.reverse().map(r => ({
            ...r,
            time: new Date(r.time.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        // Add Forecast Points
        if (data.length > 5) {
            const latestReadings = [...history].reverse(); // history is sorted ASC at this point in the code (due to .reverse() on line 274) but wait...
            // Actually history.reverse() on line 274 MUTATED the array!
            // So history is now ASC.
            const lastDataPoint = data[data.length - 1];
            const forecast = [];

            for (let i = 1; i <= 3; i++) {
                const fPoint = {
                    time: `Forecast +${i * 5}m`,
                    isForecast: true
                };

                ['pressure', 'flow', 'ph', 'turbidity', 'tds'].forEach(m => {
                    // predictTrends expects history in DESC order (latest first)
                    const trend = aiEngine.predictTrends([...history].reverse(), m);
                    const lastVal = lastDataPoint[m];
                    const change = trend.direction === 'Increasing' ? 0.04 : (trend.direction === 'Decreasing' ? -0.04 : 0);
                    fPoint[m] = parseFloat((lastVal + (lastVal * change * i)).toFixed(2));
                });
                forecast.push(fPoint);
            }
            res.json([...data, ...forecast]);
        } else {
            res.json(data);
        }
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

// Anti-Spam Cache for AI Actions
const actionCache = new Map();

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

router.get('/ai/actions/:sensorId', async (req, res) => {
    const { sensorId } = req.params;
    try {
        const sensors = await db.query('SELECT * FROM sensors');
        const now = Date.now();
        let diagnosticResults = [];

        if (sensorId === 'all') {
            // Global Aggregator: Fetch anomalies from ALL sensors
            for (const sensor of sensors) {
                const history = await db.query(
                    'SELECT pressure, flow, ph, turbidity, tds FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 5',
                    [sensor.id]
                );
                const neighbors = sensors.filter(s => s.pipeline_id === sensor.pipeline_id && s.id !== sensor.id);
                const actions = aiEngine.getPrescriptiveActions(sensor, neighbors, history);

                // Only collect non-stable actions for global mode to reduce noise
                diagnosticResults.push(...actions.filter(a => a.type !== 'STABLE'));
            }
            // Sort by priority and limit
            diagnosticResults.sort((a, b) => (a.type === 'CRITICAL' ? -1 : 1));
            diagnosticResults = diagnosticResults.slice(0, 5);
        } else {
            // Specific Sensor Mode
            const sensor = sensors.find(s => String(s.id) === String(sensorId));
            if (!sensor) return res.status(404).json({ error: 'Sensor not found' });

            const history = await db.query(
                'SELECT pressure, flow, ph, turbidity, tds FROM sensor_readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT 5',
                [sensorId]
            );
            const neighbors = sensors.filter(s => s.pipeline_id === sensor.pipeline_id && s.id !== sensor.id);
            diagnosticResults = aiEngine.getPrescriptiveActions(sensor, neighbors, history);
        }

        // Anti-Spam: 3 second cooldown
        const filteredActions = diagnosticResults.filter(action => {
            const cacheKey = `${sensorId}-${action.atNode}-${action.condition}`;
            const lastSeen = actionCache.get(cacheKey);
            if (lastSeen && (now - lastSeen) < 3000) return false;
            actionCache.set(cacheKey, now);
            return true;
        });

        // Default if empty
        if (filteredActions.length === 0) {
            filteredActions.push({
                type: 'STABLE',
                condition: 'SYSTEM NOMINAL',
                atNode: 'NETWORK',
                explanation: 'Operational parameters across active sectors are within statistical equilibrium.',
                impact: 'Continuous service reliability maintained at 99.9%.',
                priority: 'TARGET'
            });
        }

        res.json(filteredActions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Search Functionality ---
router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);

    try {
        const query = `%${q}%`;

        // Search sensors
        const sensors = await db.query(
            'SELECT id, name, location, lat, lng FROM sensors WHERE name LIKE ? OR location LIKE ? LIMIT 10',
            [query, query]
        );
        const sensorResults = sensors.map(s => ({
            id: s.id,
            name: s.name,
            location: s.location,
            type: 'sensor',
            lat: s.lat,
            lng: s.lng
        }));

        // Search pipelines
        const pipelines = await db.query(
            'SELECT id, name, start_location, end_location, coordinates FROM pipelines WHERE name LIKE ? LIMIT 10',
            [query]
        );
        const pipelineResults = pipelines.map(p => {
            let lat = 0, lng = 0;
            try {
                const coords = typeof p.coordinates === 'string' ? JSON.parse(p.coordinates || '[]') : (p.coordinates || []);
                if (coords.length > 0) {
                    lat = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
                    lng = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;
                }
            } catch (e) { /* Fallback handled below */ }

            return {
                id: p.id,
                name: p.name,
                location: `${p.start_location} → ${p.end_location}`,
                type: 'pipeline',
                lat: lat || 12.9716,
                lng: lng || 77.5946
            };
        });

        res.json([...sensorResults, ...pipelineResults]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
