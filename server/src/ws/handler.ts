import { RawData } from "ws";
import type { AuthenticatedWebSocket, WSMessage, WSData } from "../types.js";
import { verifyToken } from "../auth/index.js";
import { createSession, getSession, destroySession, resizeSession, writeToSession } from "../pty/manager.js";
import { listTmuxSessions } from "../pty/tmux.js";
import { logger } from "../utils/logger.js";

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
            default:
                ws.send(JSON.stringify({ type: "error", message: "Unknown message type" }));
        }
    } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
}

export function handleWebSocketClose(ws: AuthenticatedWebSocket) {
    if (ws.data.sessionId) {
        destroySession(ws.data.sessionId);
    }
    logger.info(`WebSocket closed for ${ws.data.username || "unknown"}`, { sessionId: ws.data.sessionId });
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

    // Create a unique session ID
    const sessionId = `${payload.username}-${Date.now()}`;

    ws.data.username = payload.username;
    ws.data.sessionId = sessionId;
    ws.data.authenticated = true;

    // Create PTY session
    const session = createSession(payload.username, sessionId, msg.sshHost);

    // Forward PTY output to WebSocket
    session.pty.onData((data: string) => {
        ws.send(JSON.stringify({ type: "output", data }));
    });

    session.pty.onExit(() => {
        ws.send(JSON.stringify({ type: "exit", message: "Session ended" }));
        ws.close();
    });

    logger.info(`Session authenticated: ${payload.username}`, { sessionId, sshHost: msg.sshHost });
    ws.send(JSON.stringify({ type: "authenticated", sessionId }));
}

function handleInput(ws: AuthenticatedWebSocket, msg: WSMessage) {
    if (!ws.data.authenticated || !ws.data.sessionId) {
        ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
        return;
    }

    if (msg.data) {
        writeToSession(ws.data.sessionId, msg.data);
    }
}

function handleResize(ws: AuthenticatedWebSocket, msg: WSMessage) {
    if (!ws.data.authenticated || !ws.data.sessionId) {
        return;
    }

    if (msg.cols && msg.rows) {
        resizeSession(ws.data.sessionId, msg.cols, msg.rows);
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
