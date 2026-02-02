import { RawData } from "ws";
import fs from "fs-extra";
import path from "path";
import type { AuthenticatedWebSocket, WSMessage, WSData } from "../types.js";
import { verifyToken } from "../auth/index.js";
import { createSession, getSession, destroySession, resizeSession, writeToSession, attachClient, detachClient, listShareableSessions } from "../pty/manager.js";
import { listTmuxSessions } from "../pty/tmux.js";
import { logger } from "../utils/logger.js";
import { db } from "../utils/db.js";

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
const heartbeatTimers = new Map<AuthenticatedWebSocket, NodeJS.Timeout>();

// Resize debounce map
const resizeDebounceTimers = new Map<string, NodeJS.Timeout>();

export function handleWebSocketOpen(ws: AuthenticatedWebSocket) {
    const banner = `\r\n\x1b[32m
   ██████╗ ██╗   ██╗ ██████╗ 
   ██╔══██╗╚██╗ ██╔╝██╔═══██╗
   ██████╔╝ ╚████╔╝ ██║   ██║
   ██╔══██╗  ╚██╔╝  ██║   ██║
   ██║  ██║   ██║   ╚██████╔╝
   ╚═╝  ╚═╝   ╚═╝    ╚═════╝ 
   \x1b[0m\r\n\x1b[1mWelcome to Ryo Terminal v1.0.0\x1b[0m\r\n`;
    logger.info("WebSocket connection opened");
    ws.send(JSON.stringify({ type: "connected", message: "Welcome to Ryo Terminal" }));
    ws.send(JSON.stringify({ type: "output", data: banner }));

    // Start heartbeat
    const heartbeat = setInterval(() => {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        } else {
            clearInterval(heartbeat);
        }
    }, HEARTBEAT_INTERVAL);
    heartbeatTimers.set(ws, heartbeat);
}

export function handleWebSocketMessage(ws: AuthenticatedWebSocket, message: RawData) {
    try {
        const msg: WSMessage = JSON.parse(message.toString());

        switch (msg.type) {
            case "auth":
                handleAuth(ws, msg);
                break;
            case "input":
                handleInput(ws, msg);
                break;
            case "resize":
                handleResize(ws, msg);
                break;
            case "ping":
                ws.send(JSON.stringify({ type: "pong" }));
                break;
            case "tmux":
                handleTmuxCommand(ws, msg);
                break;
            case "list-sessions":
                const sessions = listShareableSessions();
                ws.send(JSON.stringify({ type: "sessions-list", sessions }));
                break;
            default:
                ws.send(JSON.stringify({ type: "error", message: "Unknown message type" }));
        }
    } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
}

export function handleWebSocketClose(ws: AuthenticatedWebSocket) {
    // Clear heartbeat
    const heartbeat = heartbeatTimers.get(ws);
    if (heartbeat) {
        clearInterval(heartbeat);
        heartbeatTimers.delete(ws);
    }

    if (ws.data && ws.data.sessionId) {
        logger.info(`WebSocket detached for ${ws.data.username || "unknown"}`, { sessionId: ws.data.sessionId });
        const session = getSession(ws.data.sessionId);
        if (session) {
            detachClient(session, ws);
        }
    }
}

function handleAuth(ws: AuthenticatedWebSocket, msg: WSMessage) {
    if (!msg.token) {
        ws.send(JSON.stringify({ type: "error", message: "No token provided" }));
        return;
    }

    const payload = verifyToken(msg.token);
    if (!payload) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
        return;
    }

    let sessionId: string;
    let session = undefined;

    // JOIN MODE
    if (msg.joinSessionId) {
        sessionId = msg.joinSessionId;
        session = getSession(sessionId);
        if (!session) {
            ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
            return;
        }
        // Check permissions if needed (currently public)
    }
    // CREATE/ATTACH MODE
    else {
        // Use client-provided sessionId if available, otherwise generate one
        const clientSessionId = msg.sessionId || (ws as any).clientSessionId;
        sessionId = clientSessionId || `${payload.username}-${Date.now()}`;

        session = getSession(sessionId);
        if (!session) {
            session = createSession(payload.username, sessionId, msg.sshHost, payload.homeDir, msg.shareMode);
        }
    }

    ws.data.username = payload.username;
    ws.data.sessionId = sessionId;
    ws.data.authenticated = true;

    // Attach client to session (manager handles broadcasting now)
    attachClient(session, ws);

    logger.info(`Session authenticated: ${payload.username}`, { sessionId, sshHost: msg.sshHost, mode: msg.joinSessionId ? 'JOIN' : 'CREATE' });
    ws.send(JSON.stringify({ type: "authenticated", sessionId }));

    // Run startup macro if creating new non-SSH session
    if (!msg.joinSessionId && !msg.sshHost) {
        // Only if we are the first client/creator? 
        // Logic: if session.clients.size === 1
        if (session.clients.size === 1) {
            runStartupMacro(ws, payload.username, sessionId);
        }
    }
}

async function runStartupMacro(ws: AuthenticatedWebSocket, username: string, sessionId: string) {
    try {
        const defaultMacro = db.get("SELECT name, commands FROM macros WHERE username = ? AND isDefault = 1", [username]);

        if (defaultMacro) {
            const commands = JSON.parse((defaultMacro as any).commands);
            if (commands.length > 0) {
                logger.info(`Running startup macro for ${username}: ${(defaultMacro as any).name}`);
                for (const cmd of commands) {
                    writeToSession(sessionId, cmd + "\r");
                    await new Promise(r => setTimeout(r, 100));
                }
            }
        }
    } catch (error) {
        logger.error("Failed to run startup macro", { error });
    }
}

const inputBuffers: Map<string, string> = new Map();
const MAX_BUFFER_SIZE = 1024 * 10; // 10KB per session

function handleInput(ws: AuthenticatedWebSocket, msg: WSMessage) {
    if (!ws.data.authenticated || !ws.data.sessionId) {
        ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
        return;
    }

    const session = getSession(ws.data.sessionId);
    if (!session) return;

    if (session.shareMode === "view-only" && session.owner !== ws.data.username) {
        // Allow owner to type, viewers blocked
        return;
    }

    if (msg.data) {
        writeToSession(ws.data.sessionId, msg.data);

        // Record history on enter
        if (msg.data.includes("\r") || msg.data.includes("\n")) {
            const currentBuffer = inputBuffers.get(ws.data.sessionId) || "";
            const command = currentBuffer.trim();
            if (command.length > 0 && ws.data.username) {
                db.run("INSERT INTO history (username, command) VALUES (?, ?)", [ws.data.username, command]);
            }
            inputBuffers.set(ws.data.sessionId, "");
        } else {
            const currentBuffer = inputBuffers.get(ws.data.sessionId) || "";

            // Handle Backspace (ASCII 127) for simple history capture
            if (msg.data === "\x7f") {
                inputBuffers.set(ws.data.sessionId, currentBuffer.slice(0, -1));
            }
            // Only buffer printable characters and enforce limit
            else if (msg.data.length === 1 && msg.data.charCodeAt(0) >= 32) {
                if (currentBuffer.length < MAX_BUFFER_SIZE) {
                    inputBuffers.set(ws.data.sessionId, currentBuffer + msg.data);
                }
            }
        }
    }
}

function handleResize(ws: AuthenticatedWebSocket, msg: WSMessage) {
    if (!ws.data.authenticated || !ws.data.sessionId) {
        return;
    }

    if (msg.cols && msg.rows) {
        // Debounce resize (100ms)
        const existing = resizeDebounceTimers.get(ws.data.sessionId);
        if (existing) clearTimeout(existing);

        resizeDebounceTimers.set(ws.data.sessionId, setTimeout(() => {
            resizeSession(ws.data.sessionId!, msg.cols!, msg.rows!);
            resizeDebounceTimers.delete(ws.data.sessionId!);
        }, 100));
    }
}

async function handleTmuxCommand(ws: AuthenticatedWebSocket, msg: WSMessage) {
    if (!ws.data.authenticated) {
        ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
        return;
    }

    if (msg.command === "list") {
        const sessions = await listTmuxSessions();
        ws.send(JSON.stringify({ type: "tmux-sessions", sessions }));
    }
}
