const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

const Database = {
    // 初始化数据库
    init() {
        const dbPath = path.join(__dirname, '../data/chatroom.db');
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('数据库连接失败:', err);
                process.exit(1);
            }
            console.log('✅ 数据库连接成功');
        });

        this.createTables();
    },

    // 创建表
    createTables() {
        db.serialize(() => {
            // 用户表
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 群组表
            db.run(`
                CREATE TABLE IF NOT EXISTS groups (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    owner_id INTEGER NOT NULL,
                    mute_all INTEGER DEFAULT 0,
                    announcement TEXT,
                    pinned_message_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (owner_id) REFERENCES users(id)
                )
            `);

            // 群组成员表
            db.run(`
                CREATE TABLE IF NOT EXISTS group_members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    role TEXT DEFAULT 'member',
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (group_id) REFERENCES groups(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(group_id, user_id)
                )
            `);

            // 消息表
            db.run(`
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    type TEXT DEFAULT 'text',
                    reply_to INTEGER,
                    edited INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (group_id) REFERENCES groups(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (reply_to) REFERENCES messages(id)
                )
            `);

            // 创建索引
            db.run(`CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id, created_at DESC)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_group_members ON group_members(group_id, user_id)`);
        });
    },

    // 通用查询方法
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    // 通用执行方法
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    },

    // 获取单行
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // 关闭数据库
    close() {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('关闭数据库失败:', err);
                } else {
                    console.log('✅ 数据库已关闭');
                }
            });
        }
    }
};

module.exports = Database;
