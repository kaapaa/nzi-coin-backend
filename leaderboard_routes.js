
const express = require('express');
const { getDatabase } = require('../database/init');
const router = express.Router();

// Get top players
router.get('/top/:limit?', (req, res) => {
    try {
        const limit = parseInt(req.params.limit) || 50;
        const db = getDatabase();

        db.all(`
            SELECT 
                telegram_id,
                username,
                first_name,
                total_earned,
                total_taps,
                rank
            FROM leaderboard
            LIMIT ?
        `, [limit], (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json(results);
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user rank
router.get('/rank/:telegram_id', (req, res) => {
    try {
        const { telegram_id } = req.params;
        const db = getDatabase();

        db.get(`
            SELECT rank, total_earned, total_taps
            FROM leaderboard
            WHERE telegram_id = ?
        `, [telegram_id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!result) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(result);
        });
    } catch (error) {
        console.error('Rank error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
