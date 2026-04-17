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

// Simulation controls
app.post('/api/simulate/leak', (req, res) => {
    simulation.setSimulationState({ leak: true });
    res.json({ message: 'Leak simulation enabled' });
});

app.post('/api/simulate/contamination', (req, res) => {
    simulation.setSimulationState({ contamination: true });
    res.json({ message: 'Contamination simulation enabled' });
});

app.post('/api/simulate/reset', (req, res) => {
    simulation.setSimulationState({ leak: false, contamination: false });
    res.json({ message: 'Simulation reset' });
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
