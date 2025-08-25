
const express = require('express');
const { getDatabase } = require('../database/init');
const router = express.Router();

// Add friend (referral)
router.post('/add', (req, res) => {
    try {
        const { user_telegram_id, friend_telegram_id } = req.body;
        const db = getDatabase();

        // Get user IDs
        db.get('SELECT id FROM users WHERE telegram_id = ?', [user_telegram_id], (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'User not found' });
            }

            db.get('SELECT id FROM users WHERE telegram_id = ?', [friend_telegram_id], (err, friend) => {
                if (err || !friend) {
                    return res.status(404).json({ error: 'Friend not found' });
                }

                // Add friendship
                db.run(
                    'INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)',
                    [user.id, friend.id],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Failed to add friend' });
                        }

                        // Give referral bonus (500 coins each)
                        if (this.changes > 0) {
                            db.run('UPDATE game_progress SET coins = coins + 500 WHERE user_id = ?', [user.id]);
                            db.run('UPDATE game_progress SET coins = coins + 500 WHERE user_id = ?', [friend.id]);
                        }

                        res.json({ success: true, bonus_given: this.changes > 0 });
                    }
                );
            });
        });
    } catch (error) {
        console.error('Add friend error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user's friends
router.get('/list/:telegram_id', (req, res) => {
    try {
        const { telegram_id } = req.params;
        const db = getDatabase();

        db.get('SELECT id FROM users WHERE telegram_id = ?', [telegram_id], (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'User not found' });
            }

            db.all(`
                SELECT 
                    u.telegram_id,
                    u.username,
                    u.first_name,
                    gp.total_earned,
                    f.created_at as friend_since
                FROM friends f
                JOIN users u ON f.friend_id = u.id
                JOIN game_progress gp ON u.id = gp.user_id
                WHERE f.user_id = ?
                ORDER BY gp.total_earned DESC
            `, [user.id], (err, friends) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                res.json(friends);
            });
        });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
