
const express = require('express');
const { getDatabase } = require('../database/init');
const router = express.Router();

// Save game progress
router.post('/save', (req, res) => {
    try {
        const {
            telegram_id,
            coins,
            energy,
            max_energy,
            coins_per_tap,
            energy_regen_rate,
            total_earned,
            total_taps,
            boosters
        } = req.body;

        const db = getDatabase();

        // First, get user ID from telegram_id
        db.get('SELECT id FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Update game progress
            db.run(`
                UPDATE game_progress 
                SET coins = ?, energy = ?, max_energy = ?, coins_per_tap = ?, 
                    energy_regen_rate = ?, total_earned = ?, total_taps = ?, 
                    boosters = ?, last_save = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `, [
                coins, energy, max_energy, coins_per_tap,
                energy_regen_rate, total_earned, total_taps,
                JSON.stringify(boosters), user.id
            ], function(err) {
                if (err) {
                    console.error('Save error:', err);
                    return res.status(500).json({ error: 'Failed to save progress' });
                }

                res.json({ success: true, saved_at: new Date().toISOString() });
            });
        });
    } catch (error) {
        console.error('Save game error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Load game progress
router.get('/load/:telegram_id', (req, res) => {
    try {
        const { telegram_id } = req.params;
        const db = getDatabase();

        db.get(`
            SELECT gp.*, u.username, u.first_name 
            FROM game_progress gp
            JOIN users u ON gp.user_id = u.id
            WHERE u.telegram_id = ?
        `, [telegram_id], (err, progress) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!progress) {
                return res.status(404).json({ error: 'Progress not found' });
            }

            // Parse boosters JSON
            try {
                progress.boosters = JSON.parse(progress.boosters);
            } catch {
                progress.boosters = { energyCapacity: 0, energyRegen: 0, coinsPerTap: 0 };
            }

            res.json(progress);
        });
    } catch (error) {
        console.error('Load game error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Purchase booster
router.post('/purchase-booster', (req, res) => {
    try {
        const { telegram_id, booster_type, cost } = req.body;
        const db = getDatabase();

        db.get('SELECT id FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get current progress
            db.get('SELECT * FROM game_progress WHERE user_id = ?', [user.id], (err, progress) => {
                if (err || !progress) {
                    return res.status(404).json({ error: 'Progress not found' });
                }

                if (progress.coins < cost) {
                    return res.status(400).json({ error: 'Insufficient coins' });
                }

                const boosters = JSON.parse(progress.boosters);
                boosters[booster_type] = (boosters[booster_type] || 0) + 1;

                const newCoins = progress.coins - cost;

                db.run(
                    'UPDATE game_progress SET coins = ?, boosters = ? WHERE user_id = ?',
                    [newCoins, JSON.stringify(boosters), user.id],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Purchase failed' });
                        }

                        res.json({
                            success: true,
                            new_coins: newCoins,
                            boosters: boosters
                        });
                    }
                );
            });
        });
    } catch (error) {
        console.error('Purchase booster error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
