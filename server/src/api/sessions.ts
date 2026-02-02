import { Router } from "express";
import { verifyToken } from "../auth/index.js";
import { listSessions, deleteSession, listShareableSessions } from "../pty/manager.js";

const router = Router();

router.get("/", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const sessions = listSessions(payload.username).map(s => ({
        id: s.sessionId,
        username: s.username,
        createdAt: s.createdAt
    }));

    res.json(sessions);
});

router.get("/shared", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const sessions = listShareableSessions();
    res.json(sessions);
});

router.delete("/:id", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    deleteSession(req.params.id);
    res.json({ success: true });
});

export default router;
