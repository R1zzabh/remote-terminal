import { Router, Request, Response } from "express";
import fs from "fs-extra";
import path from "path";
import { verifyToken } from "../auth/index.js";
import { logger } from "../utils/logger.js";

const router = Router();
const HOME = process.env.HOME || process.cwd();

import { db } from "../utils/db.js";

router.get("/", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const query = (req.query.q as string || "").toLowerCase();

    try {
        let allHistory: string[] = [];

        // 1. Fetch from Database
        const dbHistory = db.query("SELECT command FROM history WHERE username = ? ORDER BY timestamp DESC LIMIT 500", [payload.username]);
        allHistory = dbHistory.map((h: any) => h.command);

        // 2. Fetch from Common shell history files
        const historyFiles = [
            path.join(payload.homeDir, ".bash_history"),
            path.join(payload.homeDir, ".zsh_history"),
        ];

        for (const file of historyFiles) {
            if (await fs.pathExists(file)) {
                try {
                    const content = await fs.readFile(file, "utf-8");
                    const lines = content.split("\n")
                        .map(line => line.trim())
                        .filter(line => line.length > 0);
                    allHistory = [...allHistory, ...lines];
                } catch (e) {
                    // Ignore read errors for individual files
                }
            }
        }

        // De-duplicate and filter
        const uniqueHistory = Array.from(new Set(allHistory)).reverse();
        const filtered = query
            ? uniqueHistory.filter(line => line.toLowerCase().includes(query))
            : uniqueHistory.slice(0, 100);

        res.json(filtered);
    } catch (error) {
        logger.error("Failed to read history", { error });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
