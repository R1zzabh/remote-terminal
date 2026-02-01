import fs from "fs-extra";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "logs", "access.log");

// Ensure log directory exists
fs.ensureDirSync(path.dirname(LOG_FILE));

export enum LogLevel {
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
    SECURITY = "SECURITY"
}

export function log(level: LogLevel, message: string, meta: any = {}) {
    const timestamp = new Date().toISOString();
    const entry = JSON.stringify({ timestamp, level, message, ...meta });

    console.log(`[${level}] ${message}`, Object.keys(meta).length ? meta : "");

    fs.appendFileSync(LOG_FILE, entry + "\n");
}

export const logger = {
    info: (msg: string, meta?: any) => log(LogLevel.INFO, msg, meta),
    warn: (msg: string, meta?: any) => log(LogLevel.WARN, msg, meta),
    error: (msg: string, meta?: any) => log(LogLevel.ERROR, msg, meta),
    security: (msg: string, meta?: any) => log(LogLevel.SECURITY, msg, meta)
};
