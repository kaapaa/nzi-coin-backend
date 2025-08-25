
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
