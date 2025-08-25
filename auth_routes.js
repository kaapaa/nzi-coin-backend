
const express = require('express');
const crypto = require('crypto');
const { getDatabase } = require('../database/init');
const router = express.Router();

// Validate Telegram WebApp init data
function validateTelegramWebAppData(initData, botToken) {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return calculatedHash === hash;
}

// Login/Register user
router.post('/login', async (req, res) => {
    try {
        const { initData } = req.body;

        // In production, uncomment this validation
        // if (!validateTelegramWebAppData(initData, process.env.BOT_TOKEN)) {
        //     return res.status(401).json({ error: 'Invalid Telegram data' });
        // }

        const urlParams = new URLSearchParams(initData);
        const userParam = urlParams.get('user');

        if (!userParam) {
            return res.status(400).json({ error: 'No user data found' });
        }

        const userData = JSON.parse(userParam);
        const db = getDatabase();

        // Check if user exists
        db.get('SELECT * FROM users WHERE telegram_id = ?', [userData.id], (err, existingUser) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (existingUser) {
                // Update last active
                db.run('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = ?', [existingUser.id]);

                // Get game progress
                db.get('SELECT * FROM game_progress WHERE user_id = ?', [existingUser.id], (err, progress) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    res.json({
                        user: existingUser,
                        progress: progress || null,
                        token: generateToken(existingUser.id)
                    });
                });
            } else {
                // Create new user
                db.run(
                    'INSERT INTO users (telegram_id, username, first_name, last_name) VALUES (?, ?, ?, ?)',
                    [userData.id, userData.username || null, userData.first_name || null, userData.last_name || null],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Database error' });
                        }

                        const userId = this.lastID;

                        // Create initial game progress
                        db.run(
                            'INSERT INTO game_progress (user_id) VALUES (?)',
                            [userId],
                            (err) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Database error' });
                                }

                                const newUser = {
                                    id: userId,
                                    telegram_id: userData.id,
                                    username: userData.username,
                                    first_name: userData.first_name,
                                    last_name: userData.last_name
                                };

                                res.json({
                                    user: newUser,
                                    progress: {
                                        coins: 0,
                                        energy: 100,
                                        max_energy: 100,
                                        coins_per_tap: 1,
                                        energy_regen_rate: 1800000,
                                        total_earned: 0,
                                        total_taps: 0,
                                        boosters: '{"energyCapacity":0,"energyRegen":0,"coinsPerTap":0}'
                                    },
                                    token: generateToken(userId)
                                });
                            }
                        );
                    }
                );
            }
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

function generateToken(userId) {
    return crypto.createHash('sha256').update(userId + process.env.JWT_SECRET || 'fallback-secret').digest('hex');
}

module.exports = router;
