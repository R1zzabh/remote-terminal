import { Router, Request, Response } from "express";
import fs from "fs-extra";
import path from "path";
import { verifyToken } from "../auth/index.js";
import { logger } from "../utils/logger.js";

const router = Router();
const MACROS_FILE = path.resolve(process.cwd(), "data", "macros.json");

interface Macro {
    name: string;
    commands: string[];
    isDefault: boolean;
}

interface UserMacros {
    [username: string]: Macro[];
}

router.get("/", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    try {
        await fs.ensureDir(path.dirname(MACROS_FILE));
        if (!(await fs.pathExists(MACROS_FILE))) {
            return res.json([]);
        }

        const allMacros: UserMacros = await fs.readJson(MACROS_FILE);
        const userMacros = allMacros[payload.username] || [];
        res.json(userMacros);
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
        await fs.ensureDir(path.dirname(MACROS_FILE));
        let allMacros: UserMacros = {};
        if (await fs.pathExists(MACROS_FILE)) {
            allMacros = await fs.readJson(MACROS_FILE);
        }

        const userMacros = allMacros[payload.username] || [];

        // If this is set as default, unset others
        if (isDefault) {
            userMacros.forEach(m => m.isDefault = false);
        }

        const existingIndex = userMacros.findIndex(m => m.name === name);
        const newMacro = { name, commands, isDefault };

        if (existingIndex >= 0) {
            userMacros[existingIndex] = newMacro;
        } else {
            userMacros.push(newMacro);
        }

        allMacros[payload.username] = userMacros;
        await fs.writeJson(MACROS_FILE, allMacros, { spaces: 2 });

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
        if (!(await fs.pathExists(MACROS_FILE))) return res.status(404).json({ error: "No macros found" });

        const allMacros: UserMacros = await fs.readJson(MACROS_FILE);
        const userMacros = allMacros[payload.username] || [];

        const filtered = userMacros.filter(m => m.name !== name);
        if (filtered.length === userMacros.length) return res.status(404).json({ error: "Macro not found" });

        allMacros[payload.username] = filtered;
        await fs.writeJson(MACROS_FILE, allMacros, { spaces: 2 });

        logger.info(`Macro deleted for ${payload.username}: ${name}`);
        res.json({ success: true });
    } catch (error) {
        logger.error("Failed to delete macro", { error });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
