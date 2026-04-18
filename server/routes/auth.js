const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = 'smart_water_secret_key_123';

router.post('/register', async (req, res) => {
    const { username, password, role, fullName, email, phone, pipelineId } = req.body;
    try {
        const existingRes = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        const existing = existingRes[0];
        if (existing) return res.status(400).json({ error: 'Username already exists' });

        if (!phone) return res.status(400).json({ error: 'Phone number is required for SMS alerts' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute(
            'INSERT INTO users (username, password, role, full_name, email, phone, pipeline_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, role || 'citizen', fullName, email, phone, pipelineId]
        );
        res.json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    const { username, password, captchaAnswer, captchaQuestion } = req.body;

    // Simple CAPTCHA validation
    if (parseInt(captchaAnswer) !== eval(captchaQuestion)) {
        return res.status(400).json({ error: 'Incorrect CAPTCHA answer' });
    }

    try {
        const userRes = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = userRes[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ 
            token, 
            role: user.role, 
            username: user.username,
            fullName: user.full_name,
            email: user.email,
            phone: user.phone,
            profilePicture: user.profile_picture,
            pipelineId: user.pipeline_id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Current User Profile
router.get('/me/:username', async (req, res) => {
    try {
        const userRes = await db.query('SELECT username, role, full_name as fullName, email, phone, profile_picture as profilePicture, pipeline_id as pipelineId FROM users WHERE username = ?', [req.params.username]);
        const user = userRes[0];
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Profile
router.post('/profile/update', async (req, res) => {
    const { username, fullName, email, phone, profilePicture } = req.body;
    try {
        await db.execute(
            'UPDATE users SET full_name = ?, email = ?, phone = ?, profile_picture = ? WHERE username = ?',
            [fullName, email, phone, profilePicture, username]
        );
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
