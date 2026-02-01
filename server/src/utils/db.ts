import Database from "better-sqlite3";
import path from "path";
import fs from "fs-extra";
import { logger } from "./logger.js";

const DB_PATH = path.resolve(process.cwd(), "data", "ryo.db");

class DB {
    private db: Database.Database;

    constructor() {
        fs.ensureDirSync(path.dirname(DB_PATH));
        this.db = new Database(DB_PATH);
        this.init();
        this.runMigration();
    }

    private init() {
        // Users Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                passwordHash TEXT NOT NULL,
                role TEXT NOT NULL,
                homeDir TEXT NOT NULL
            )
        `);

        // Macros Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS macros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                name TEXT NOT NULL,
                commands TEXT NOT NULL, -- JSON string
                isDefault INTEGER DEFAULT 0,
                FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
            )
        `);

        // History Table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                command TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
            )
        `);

        // Indices
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_macros_user ON macros(username)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_history_user ON history(username)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_history_ts ON history(timestamp DESC)`);

        this.db.exec("VACUUM"); // Compact and optimize on startup
        logger.info("Database initialized and vacuumed.");
    }

    private runMigration() {
        const USERS_FILE = path.resolve(process.cwd(), "data", "users.json");
        const MACROS_FILE = path.resolve(process.cwd(), "data", "macros.json");

        // Migrate Users
        if (fs.existsSync(USERS_FILE)) {
            try {
                const users = fs.readJsonSync(USERS_FILE);
                const insertUser = this.db.prepare("INSERT OR IGNORE INTO users (username, passwordHash, role, homeDir) VALUES (?, ?, ?, ?)");
                this.db.transaction(() => {
                    for (const user of users) {
                        insertUser.run(user.username, user.passwordHash, user.role, user.homeDir);
                    }
                })();
                logger.info(`Migrated ${users.length} users from JSON.`);
                fs.moveSync(USERS_FILE, USERS_FILE + ".bak", { overwrite: true });
            } catch (error) {
                logger.error("Failed to migrate users", { error });
            }
        }

        // Migrate Macros
        if (fs.existsSync(MACROS_FILE)) {
            try {
                const allMacros = fs.readJsonSync(MACROS_FILE);
                const insertMacro = this.db.prepare("INSERT INTO macros (username, name, commands, isDefault) VALUES (?, ?, ?, ?)");
                this.db.transaction(() => {
                    for (const [username, macros] of Object.entries(allMacros)) {
                        for (const macro of (macros as any)) {
                            insertMacro.run(username, macro.name, JSON.stringify(macro.commands), macro.isDefault ? 1 : 0);
                        }
                    }
                })();
                logger.info("Migrated macros from JSON.");
                fs.moveSync(MACROS_FILE, MACROS_FILE + ".bak", { overwrite: true });
            } catch (error) {
                logger.error("Failed to migrate macros", { error });
            }
        }
    }

    // Generic methods
    query(sql: string, params: any[] = []) {
        return this.db.prepare(sql).all(params);
    }

    get(sql: string, params: any[] = []) {
        return this.db.prepare(sql).get(params);
    }

    run(sql: string, params: any[] = []) {
        return this.db.prepare(sql).run(params);
    }

    transaction(fn: () => void) {
        this.db.transaction(fn)();
    }
}

export const db = new DB();
