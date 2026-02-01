import { Router } from "express";
import { handleLogin } from "../auth/index.js";

const router = Router();

router.post("/login", async (req, res) => {
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
