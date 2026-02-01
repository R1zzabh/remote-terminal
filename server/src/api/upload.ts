import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs-extra";
import { verifyToken } from "../auth/index.js";
import { logger } from "../utils/logger.js";

const router = Router();
const ROOT_DIR = process.env.HOME || process.cwd();

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetPath = req.query.path as string || ROOT_DIR;
        const normalizedPath = path.resolve(targetPath);
        const relative = path.relative(path.resolve(ROOT_DIR), normalizedPath);

        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            return cb(new Error("Access Denied"), "");
        }

        fs.ensureDirSync(normalizedPath);
        cb(null, normalizedPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

router.post("/", (req: Request, res: Response, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });
    next();
}, upload.single("file"), (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    logger.info(`File uploaded: ${req.file.path}`);
    res.json({ success: true, file: req.file.originalname });
});

export default router;
