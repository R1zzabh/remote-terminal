import { Router, Request, Response } from "express";
import fs from "fs-extra";
import path from "path";
import { verifyToken } from "../auth/index.js";
import { logger } from "../utils/logger.js";

const router = Router();
const HOME = process.env.HOME || process.cwd();

router.get("/", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    const query = (req.query.q as string || "").toLowerCase();

    // Check for common shell history files
    const historyFiles = [
        path.join(HOME, ".bash_history"),
        path.join(HOME, ".zsh_history"),
        path.join(HOME, ".history")
    ];

    try {
        let allHistory: string[] = [];

        for (const file of historyFiles) {
            if (await fs.pathExists(file)) {
                const content = await fs.readFile(file, "utf-8");
                const lines = content.split("\n")
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                allHistory = [...allHistory, ...lines];
            }
        }

        // De-duplicate and filter
        const uniqueHistory = Array.from(new Set(allHistory)).reverse();
        const filtered = query
            ? uniqueHistory.filter(line => line.toLowerCase().includes(query))
            : uniqueHistory.slice(0, 100);

        res.json(filtered);
    } catch (error) {
        logger.error("Failed to read shell history", { error });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
