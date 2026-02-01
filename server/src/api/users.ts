import { Router, Request, Response } from "express";
import { verifyToken, addUser, removeUser, getUserByUsername } from "../auth/index.js";
import { logger } from "../utils/logger.js";
import bcrypt from "bcryptjs";

const router = Router();

// Middleware to check if user is admin
const adminOnly = (req: Request, res: Response, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    const payload = token ? verifyToken(token) : null;

    if (!payload || payload.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
};

router.post("/", adminOnly, async (req: Request, res: Response) => {
    const { username, password, role, homeDir } = req.body;

    if (!username || !password || !role || !homeDir) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const success = await addUser({
            username,
            passwordHash,
            role,
            homeDir
        });

        if (!success) return res.status(400).json({ error: "User already exists" });

        logger.info(`New user created by admin: ${username} (role: ${role})`);
        res.json({ success: true });
    } catch (error) {
        logger.error("Failed to create user", { error });
        res.status(500).json({ error: "Internal server error" });
    }
});

router.delete("/:username", adminOnly, async (req: Request, res: Response) => {
    const { username } = req.params;

    try {
        const success = await removeUser(username as string);
        if (!success) return res.status(404).json({ error: "User not found" });

        logger.info(`User deleted by admin: ${username}`);
        res.json({ success: true });
    } catch (error) {
        logger.error("Failed to delete user", { error });
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
