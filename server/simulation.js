const db = require('./db');
const smsService = require('./services/smsService');

let simulationInterval = null;
let simulationState = {
    leak: false,
    contamination: false
};

const simulateReadings = async () => {
    try {
        const sensors = await db.query('SELECT id FROM sensors');
        for (const sensor of sensors) {
            // Check for overrides
            const queries = await db.query('SELECT * FROM sensor_overrides WHERE sensor_id = ? AND is_active = 1', [sensor.id]);
            const override = queries[0];

            let pressure, flow, ph, turbidity, tds;

            if (override) {
                console.log(`Applying OVERRIDE to sensor ${sensor.id}: P=${override.pressure}, F=${override.flow}`);
                // Apply override with small jitter (+/- 2%)
                pressure = override.pressure + (Math.random() - 0.5) * (override.pressure * 0.04);
                flow = override.flow + (Math.random() - 0.5) * (override.flow * 0.04);
                ph = (override.ph !== null && override.ph !== undefined) ? override.ph + (Math.random() - 0.5) * 0.1 : 7.2 + (Math.random() - 0.5) * 0.4;
                turbidity = (override.turbidity !== null && override.turbidity !== undefined) ? override.turbidity + (Math.random() - 0.5) * 0.5 : 1.2 + (Math.random() - 0.5) * 0.5;
                tds = (override.tds !== null && override.tds !== undefined) ? override.tds + (Math.random() - 0.5) * 10 : 250 + (Math.random() - 0.5) * 50;
            } else {
                // Normal generation
                pressure = 3.5 + (Math.random() - 0.5) * 0.2;
                flow = 15 + (Math.random() - 0.5) * 2;
                ph = 7.2 + (Math.random() - 0.5) * 0.4;
                turbidity = 1.2 + (Math.random() - 0.5) * 0.5;
                tds = 250 + (Math.random() - 0.5) * 50;
            }

            await db.execute(
                'INSERT INTO sensor_readings (sensor_id, pressure, flow, ph, turbidity, tds) VALUES (?, ?, ?, ?, ?, ?)',
                [sensor.id, pressure, flow, ph, turbidity, tds]
            );

            let status = 'Active';
            if (pressure < 2.5 || ph < 6.8 || ph > 8.2 || turbidity > 3 || tds > 400) status = 'Warning';
            if (pressure < 1.5 || turbidity > 8 || ph > 9.2 || ph < 5.8 || tds > 800) status = 'Critical';

            await db.execute('UPDATE sensors SET status = ? WHERE id = ?', [status, sensor.id]);

            // --- SMS ALERT TRIGGER LOGIC ---
            if (status === 'Critical') {
                const sensorDataRes = await db.query('SELECT name, pipeline_id FROM sensors WHERE id = ?', [sensor.id]);
                const sensorData = sensorDataRes[0];
                const pipeDataRes = await db.query('SELECT name FROM pipelines WHERE id = ?', [sensorData.pipeline_id]);
                const pipeData = pipeDataRes[0];

                let smsType = 'Leak Alert';
                let message = `🚨 LEAK ALERT | ${pipeData?.name || 'Network Segment'}\nHigh pressure drop detected at ${sensorData.name}\nAction: Inspect immediately`;

                if (turbidity > 10) {
                    smsType = 'Contamination Alert';
                    message = `⚠️ WATER ALERT | ${pipeData?.name || 'Supply Line'}\nHigh turbidity detected at ${sensorData.name}\nAction: Avoid usage`;
                }

                if (sensorData.pipeline_id) {
                    await smsService.notifyAffectedUsers(sensorData.pipeline_id, message, smsType);
                }
            }
        }
    } catch (error) {
        console.error('Simulation error:', error);
    }
};

const startSimulation = () => {
    if (!simulationInterval) {
        simulationInterval = setInterval(simulateReadings, 3000); // Every 3 seconds
        console.log('Sensor simulation started');
    }
};

const setSimulationState = (state) => {
    simulationState = { ...simulationState, ...state };
};

module.exports = { startSimulation, setSimulationState };
