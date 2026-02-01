import { Router, Request, Response } from "express";
import fs from "fs-extra";
import path from "path";
import { verifyToken } from "../auth/index.js";
import { logger } from "../utils/logger.js";
import { JWTPayload } from "../types.js";

const router = Router();

const getNormalizedPath = (targetPath: string, userHome: string) => {
    const resolvedPath = path.resolve(targetPath);
    const resolvedHome = path.resolve(userHome);

    if (!resolvedPath.startsWith(resolvedHome)) {
        throw new Error("Access Denied");
    }
    return resolvedPath;
};

router.get("/", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const userHome = payload.homeDir;
    const targetPath = (req.query.path as string) || userHome;

    try {
        const normalizedPath = getNormalizedPath(targetPath, userHome);
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
    } catch (error: any) {
        if (error.message === "Access Denied") return res.status(403).json({ error: "Access Denied" });
        res.status(500).json({ error: "Failed to read directory" });
    }
});

router.get("/content", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const targetPath = req.query.path as string;
    if (!targetPath) return res.status(400).json({ error: "Path required" });

    try {
        const normalizedPath = getNormalizedPath(targetPath, payload.homeDir);
        const content = await fs.readFile(normalizedPath, "utf-8");
        res.json({ content });
    } catch (error: any) {
        if (error.message === "Access Denied") return res.status(403).json({ error: "Access Denied" });
        res.status(500).json({ error: "Failed to read file" });
    }
});

router.post("/content", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const { path: targetPath, content } = req.body;
    if (!targetPath) return res.status(400).json({ error: "Path required" });

    try {
        const normalizedPath = getNormalizedPath(targetPath, payload.homeDir);
        await fs.writeFile(normalizedPath, content, "utf-8");
        logger.info(`File saved: ${normalizedPath} by ${payload.username}`);
        res.json({ success: true });
    } catch (error: any) {
        if (error.message === "Access Denied") return res.status(403).json({ error: "Access Denied" });
        logger.error(`Failed to save file: ${targetPath}`, { error });
        res.status(500).json({ error: "Failed to save file" });
    }
});

router.post("/create", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const { path: targetPath, isDirectory } = req.body;
    if (!targetPath) return res.status(400).json({ error: "Path required" });

    try {
        const normalizedPath = getNormalizedPath(targetPath, payload.homeDir);
        if (isDirectory) {
            await fs.ensureDir(normalizedPath);
        } else {
            await fs.ensureFile(normalizedPath);
        }
        logger.info(`Item created: ${normalizedPath} by ${payload.username}`);
        res.json({ success: true });
    } catch (error: any) {
        if (error.message === "Access Denied") return res.status(403).json({ error: "Access Denied" });
        logger.error(`Failed to create item: ${targetPath}`, { error });
        res.status(500).json({ error: "Failed to create item" });
    }
});

router.post("/rename", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ error: "Paths required" });

    try {
        const normOld = getNormalizedPath(oldPath, payload.homeDir);
        const normNew = getNormalizedPath(newPath, payload.homeDir);
        await fs.move(normOld, normNew);
        logger.info(`Item renamed: ${normOld} -> ${normNew} by ${payload.username}`);
        res.json({ success: true });
    } catch (error: any) {
        if (error.message === "Access Denied") return res.status(403).json({ error: "Access Denied" });
        logger.error(`Failed to rename: ${oldPath}`, { error });
        res.status(500).json({ error: "Failed to rename item" });
    }
});

router.delete("/", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Unauthorized" });

    const targetPath = req.query.path as string;
    if (!targetPath) return res.status(400).json({ error: "Path required" });

    try {
        const normalizedPath = getNormalizedPath(targetPath, payload.homeDir);
        await fs.remove(normalizedPath);
        logger.info(`Item deleted: ${normalizedPath} by ${payload.username}`);
        res.json({ success: true });
    } catch (error: any) {
        if (error.message === "Access Denied") return res.status(403).json({ error: "Access Denied" });
        logger.error(`Failed to delete: ${targetPath}`, { error });
        res.status(500).json({ error: "Failed to delete item" });
    }
});

export default router;
