import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { config } from "./config.js";
import authRouter from "./api/auth.js";
import filesRouter from "./api/files.js";
import sessionsRouter from "./api/sessions.js";
import { logger } from "./utils/logger.js";
import { initializeAuth } from "./auth/index.js";
import { handleWebSocketOpen, handleWebSocketMessage, handleWebSocketClose } from "./ws/handler.js";
import type { AuthenticatedWebSocket } from "./types.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));

// Routes
app.use("/api", authRouter);
app.use("/api/files", filesRouter);
app.use("/api/sessions", sessionsRouter);

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
    });
});

wss.on("connection", (ws: AuthenticatedWebSocket) => {
    ws.data = { authenticated: false } as any;

    handleWebSocketOpen(ws);

    ws.on("message", (message) => {
        handleWebSocketMessage(ws, message);
    });

    ws.on("close", () => {
        handleWebSocketClose(ws);
    });

    ws.on("error", (error) => {
        logger.error("WebSocket error", { error: error.message });
    });
});

const start = async () => {
    await initializeAuth();
    server.listen(config.port, () => {
        logger.info(`Ryo Terminal Server running on port ${config.port}`);
        console.log(`📡 WebSocket ready at ws://localhost:${config.port}/ws\n`);
    });
};

start().catch(err => {
    logger.error("Failed to start server", { error: err.message });
    process.exit(1);
});
