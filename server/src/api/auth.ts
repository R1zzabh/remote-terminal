import { Router } from "express";
import { handleLogin } from "../auth/index.js";
import rateLimit from "express-rate-limit";

const router = Router();

// Rate limiter for login: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: "Too many login attempts, please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Missing credentials" });
    }

    try {
        const result = await handleLogin(username, password);

        if (!result.success) {
            return res.status(401).json({ error: result.error });
        }

        return res.json({ token: result.token });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
