const dbConfig = require('../db');

/**
 * SmartWater SMS Service
 * Handles critical alert dispatch and prevent duplicates via cooldown logic
 */

const COOLDOWN_MINUTES = 10;
const lastSent = new Map(); // Store key: "userId_type", value: timestamp

const sendSMS = async (userId, phone, message, type) => {
    const key = `${userId}_${type}`;
    const now = Date.now();

    // 1. Cooldown Check
    if (lastSent.has(key)) {
        const diff = (now - lastSent.get(key)) / (1000 * 60);
        if (diff < COOLDOWN_MINUTES) {
            console.log(`[SMS SKIP] Cooldown active for User ${userId} (${type}). Skipping...`);
            return;
        }
    }

    try {
        // 2. Mock SMS Dispatch (Simulating Twilio/Fast2SMS)
        console.log("-----------------------------------------");
        console.log(`📡 [SMS DISPATCH] TO: ${phone}`);
        console.log(`MESSAGE: ${message}`);
        console.log("-----------------------------------------");

        // 3. Log to Database
        await dbConfig.execute(
            'INSERT INTO sms_logs (user_id, type, message, phone, status) VALUES (?, ?, ?, ?, ?)',
            [userId, type, message, phone, 'Sent']
        );

        // 4. Update Cooldown
        lastSent.set(key, now);

        return true;
    } catch (err) {
        console.error("SMS Dispatch Error:", err);
        return false;
    }
};

const notifyAffectedUsers = async (pipelineId, message, type) => {
    try {
        // Find users mapped to this pipeline with a phone number
        const users = await dbConfig.query(
            'SELECT id, phone FROM users WHERE pipeline_id = ? AND phone IS NOT NULL',
            [pipelineId]
        );

        console.log(`[SMS NOTIFY] Found ${users.length} users for Pipeline ${pipelineId}`);

        for (const user of users) {
            await sendSMS(user.id, user.phone, message, type);
        }
    } catch (err) {
        console.error("Batch SMS Notification Error:", err);
    }
};

module.exports = {
    sendSMS,
    notifyAffectedUsers
};
