# Create backend files for the NZI Coin Telegram mini app

# 1. Package.json
package_json = """
{
  "name": "nzi-coin-backend",
  "version": "1.0.0",
  "description": "Backend API for NZI Coin Telegram Mini App",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "migrate": "node migrations/init.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "express-rate-limit": "^7.1.5",
    "sqlite3": "^5.1.6",
    "crypto": "^1.0.1",
    "node-telegram-bot-api": "^0.64.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
"""

# 2. Server.js - Main backend server
server_js = """
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');
const friendsRoutes = require('./routes/friends');
const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://t.me',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/friends', friendsRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`NZI Coin Backend running on port ${PORT}`);
});

module.exports = app;
"""

# 3. Database initialization
database_init = """
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../nzi_coin.db');
let db;

function initDatabase() {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
        } else {
            console.log('Connected to SQLite database');
            createTables();
        }
    });
}

function createTables() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT UNIQUE NOT NULL,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Game progress table
    db.run(`
        CREATE TABLE IF NOT EXISTS game_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            coins INTEGER DEFAULT 0,
            energy INTEGER DEFAULT 100,
            max_energy INTEGER DEFAULT 100,
            coins_per_tap INTEGER DEFAULT 1,
            energy_regen_rate INTEGER DEFAULT 1800000,
            total_earned INTEGER DEFAULT 0,
            total_taps INTEGER DEFAULT 0,
            last_save DATETIME DEFAULT CURRENT_TIMESTAMP,
            boosters TEXT DEFAULT '{"energyCapacity":0,"energyRegen":0,"coinsPerTap":0}',
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // Friends/referrals table
    db.run(`
        CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            friend_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            bonus_claimed BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (friend_id) REFERENCES users (id),
            UNIQUE(user_id, friend_id)
        )
    `);

    // Tasks/achievements table
    db.run(`
        CREATE TABLE IF NOT EXISTS user_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_id TEXT NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            progress INTEGER DEFAULT 0,
            completed_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(user_id, task_id)
        )
    `);

    // Leaderboard view
    db.run(`
        CREATE VIEW IF NOT EXISTS leaderboard AS
        SELECT 
            u.telegram_id,
            u.username,
            u.first_name,
            gp.total_earned,
            gp.total_taps,
            RANK() OVER (ORDER BY gp.total_earned DESC) as rank
        FROM users u
        JOIN game_progress gp ON u.id = gp.user_id
        ORDER BY gp.total_earned DESC
    `);

    console.log('Database tables created successfully');
}

function getDatabase() {
    return db;
}

module.exports = {
    initDatabase,
    getDatabase
};
"""

# 4. Auth routes
auth_routes = """
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
        .join('\\n');
    
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
"""

# 5. Game routes
game_routes = """
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
"""

# 6. Leaderboard routes
leaderboard_routes = """
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
"""

# 7. Friends routes
friends_routes = """
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
"""

# 8. Environment file
env_file = """
# Server Configuration
PORT=3000
NODE_ENV=production

# Telegram Bot Configuration
BOT_TOKEN=your_bot_token_here

# Frontend URL (Telegram WebApp)
FRONTEND_URL=https://t.me

# JWT Secret for token generation
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Database Configuration
DATABASE_PATH=./nzi_coin.db

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Security
CORS_ORIGIN=https://t.me
"""

# 9. PM2 Ecosystem file
ecosystem_file = """
module.exports = {
  apps: [{
    name: 'nzi-coin-backend',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
"""

# Write all files
files_created = []

with open('package.json', 'w') as f:
    f.write(package_json)
    files_created.append('package.json')

with open('server.js', 'w') as f:
    f.write(server_js)
    files_created.append('server.js')

with open('database_init.js', 'w') as f:
    f.write(database_init)
    files_created.append('database_init.js')

with open('auth_routes.js', 'w') as f:
    f.write(auth_routes)
    files_created.append('auth_routes.js')

with open('game_routes.js', 'w') as f:
    f.write(game_routes)
    files_created.append('game_routes.js')

with open('leaderboard_routes.js', 'w') as f:
    f.write(leaderboard_routes)
    files_created.append('leaderboard_routes.js')

with open('friends_routes.js', 'w') as f:
    f.write(friends_routes)
    files_created.append('friends_routes.js')

with open('.env.example', 'w') as f:
    f.write(env_file)
    files_created.append('.env.example')

with open('ecosystem.config.js', 'w') as f:
    f.write(ecosystem_file)
    files_created.append('ecosystem.config.js')

print("Backend files created successfully:")
for file in files_created:
    print(f"- {file}")