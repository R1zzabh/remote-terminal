import { Router, Request, Response } from "express";
import { verifyToken } from "../auth/index.js";
import { logger } from "../utils/logger.js";
import { db } from "../utils/db.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    try {
        const macros = db.query("SELECT name, commands, isDefault FROM macros WHERE username = ?", [payload.username]);
        const formatted = macros.map((m: any) => ({
            ...m,
            commands: JSON.parse(m.commands),
            isDefault: !!m.isDefault
        }));
        res.json(formatted);
    } catch (error) {
        logger.error("Failed to read macros", { error });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const { name, commands, isDefault } = req.body;
    if (!name || !Array.isArray(commands)) {
        return res.status(400).json({ error: "Invalid macro data" });
    }

    try {
        db.transaction(() => {
            if (isDefault) {
                db.run("UPDATE macros SET isDefault = 0 WHERE username = ?", [payload.username]);
            }

            const existing = db.get("SELECT id FROM macros WHERE username = ? AND name = ?", [payload.username, name]);
            if (existing) {
                db.run("UPDATE macros SET commands = ?, isDefault = ? WHERE id = ?",
                    [JSON.stringify(commands), isDefault ? 1 : 0, (existing as any).id]);
            } else {
                db.run("INSERT INTO macros (username, name, commands, isDefault) VALUES (?, ?, ?, ?)",
                    [payload.username, name, JSON.stringify(commands), isDefault ? 1 : 0]);
            }
        });

        logger.info(`Macro saved for ${payload.username}: ${name}`);
        res.json({ success: true });
    } catch (error) {
        logger.error("Failed to save macro", { error });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.delete("/:name", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const { name } = req.params;

    try {
        const result = db.run("DELETE FROM macros WHERE username = ? AND name = ?", [payload.username, name]);
        if (result.changes === 0) return res.status(404).json({ error: "Macro not found" });

        logger.info(`Macro deleted for ${payload.username}: ${name}`);
        res.json({ success: true });
    } catch (error) {
        logger.error("Failed to delete macro", { error });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
