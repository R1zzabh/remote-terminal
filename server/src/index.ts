import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { config } from "./config.js";
import authRouter from "./api/auth.js";
import filesRouter from "./api/files.js";
import sessionsRouter from "./api/sessions.js";
import uploadRouter from "./api/upload.js";
import systemRouter from "./api/system.js";
import historyRouter from "./api/history.js";
import usersRouter from "./api/users.js";
import macrosRouter from "./api/macros.js";
import { logger } from "./utils/logger.js";
import { initializeAuth } from "./auth/index.js";
import { handleWebSocketOpen, handleWebSocketMessage, handleWebSocketClose } from "./ws/handler.js";
import { shutdownAllSessions, cleanupStaleSessions } from "./pty/manager.js";
import { db } from "./utils/db.js";
import type { AuthenticatedWebSocket } from "./types.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
app.use(helmet());
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: { error: "Too many requests" },
});
app.use(limiter);
app.use(express.json());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));

// Routes
app.use("/api", authRouter);
app.use("/api/files", filesRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/system", systemRouter);
app.use("/api/history", historyRouter);
app.use("/api/users", usersRouter);
app.use("/api/macros", macrosRouter);

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
    try {
        await initializeAuth();

        if (config.jwtSecret === "change-this-secret-in-production") {
            logger.warn("SECURITY WARNING: Using default JWT secret. Change this in production by setting JWT_SECRET environment variable!");
        }

        cleanupStaleSessions();
        server.listen(config.port, config.host, () => {
            logger.info(`Ryo Terminal Server running on ${config.host}:${config.port}`);
            console.log(`📡 WebSocket ready at ws://${config.host}:${config.port}/ws\n`);
        });
    } catch (err: any) {
        logger.error("Failed to start server during initialization", { error: err.message });
        process.exit(1);
    }
};

start().catch((err: any) => {
    logger.error("Failed to start server", { error: err.message });
    process.exit(1);
});

async function gracefulShutdown(signal: string) {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Close HTTP server first
    server.close(() => {
        logger.info("Express/WebSocket server closed.");
    });

    // Cleanup resources
    shutdownAllSessions();
    db.close();

    logger.info("Graceful shutdown complete.");
    process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
