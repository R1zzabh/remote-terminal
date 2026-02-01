import { Router, Request, Response } from "express";
import fs from "fs-extra";
import path from "path";
import { verifyToken } from "../auth/index.js";
import { logger } from "../utils/logger.js";

const router = Router();
const ROOT_DIR = process.env.HOME || process.cwd();

router.get("/", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const targetPath = (req.query.path as string) || ROOT_DIR;

    // Security check: Normalize and prevent traversal
    const normalizedPath = path.resolve(targetPath);
    if (!normalizedPath.startsWith(path.resolve(ROOT_DIR))) {
        return res.status(403).json({ error: "Access Denied" });
    }

    try {
        const items = await fs.readdir(normalizedPath, { withFileTypes: true });
        const result = items.map(item => ({
            name: item.name,
            isDirectory: item.isDirectory(),
            path: path.join(normalizedPath, item.name),
            size: item.isFile() ? fs.statSync(path.join(normalizedPath, item.name)).size : 0
        })).sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
            return a.isDirectory ? -1 : 1;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Failed to read directory" });
    }
});

router.get("/content", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    const targetPath = req.query.path as string;
    if (!targetPath) return res.status(400).json({ error: "Path required" });

    const normalizedPath = path.resolve(targetPath);
    if (!normalizedPath.startsWith(path.resolve(ROOT_DIR))) return res.status(403).json({ error: "Access Denied" });

    try {
        const content = await fs.readFile(normalizedPath, "utf-8");
        res.json({ content });
    } catch (error) {
        res.status(500).json({ error: "Failed to read file" });
    }
});

router.post("/content", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    const { path: targetPath, content } = req.body;
    if (!targetPath) return res.status(400).json({ error: "Path required" });

    const normalizedPath = path.resolve(targetPath);
    if (!normalizedPath.startsWith(path.resolve(ROOT_DIR))) return res.status(403).json({ error: "Access Denied" });

    try {
        await fs.writeFile(normalizedPath, content, "utf-8");
        logger.info(`File saved: ${normalizedPath}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`Failed to save file: ${normalizedPath}`, { error });
        res.status(500).json({ error: "Failed to save file" });
    }
});

router.post("/create", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    const { path: targetPath, isDirectory } = req.body;
    if (!targetPath) return res.status(400).json({ error: "Path required" });

    const normalizedPath = path.resolve(targetPath);
    if (!normalizedPath.startsWith(path.resolve(ROOT_DIR))) return res.status(403).json({ error: "Access Denied" });

    try {
        if (isDirectory) {
            await fs.ensureDir(normalizedPath);
        } else {
            await fs.ensureFile(normalizedPath);
        }
        logger.info(`Item created: ${normalizedPath} (dir: ${isDirectory})`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`Failed to create item: ${normalizedPath}`, { error });
        res.status(500).json({ error: "Failed to create item" });
    }
});

router.post("/rename", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ error: "Paths required" });

    const normOld = path.resolve(oldPath);
    const normNew = path.resolve(newPath);

    if (!normOld.startsWith(path.resolve(ROOT_DIR)) || !normNew.startsWith(path.resolve(ROOT_DIR))) {
        return res.status(403).json({ error: "Access Denied" });
    }

    try {
        await fs.move(normOld, normNew);
        logger.info(`Item renamed: ${normOld} -> ${normNew}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`Failed to rename: ${normOld}`, { error });
        res.status(500).json({ error: "Failed to rename item" });
    }
});

router.delete("/", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    const targetPath = req.query.path as string;
    if (!targetPath) return res.status(400).json({ error: "Path required" });

    const normalizedPath = path.resolve(targetPath);
    if (!normalizedPath.startsWith(path.resolve(ROOT_DIR))) return res.status(403).json({ error: "Access Denied" });

    try {
        await fs.remove(normalizedPath);
        logger.info(`Item deleted: ${normalizedPath}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`Failed to delete: ${normalizedPath}`, { error });
        res.status(500).json({ error: "Failed to delete item" });
    }
});

export default router;
