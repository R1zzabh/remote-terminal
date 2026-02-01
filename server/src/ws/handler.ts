import type { ServerWebSocket } from "bun";
import type { WSMessage, WSData } from "../types";
import { verifyToken } from "../auth";
import { createSession, getSession, destroySession, resizeSession, writeToSession } from "../pty/manager";
import { listTmuxSessions } from "../pty/tmux";

export function handleWebSocketOpen(ws: ServerWebSocket<WSData>) {
    console.log("WebSocket connection opened");
    ws.send(JSON.stringify({ type: "connected", message: "Welcome to Shobha Terminal" }));
}

export function handleWebSocketMessage(ws: ServerWebSocket<WSData>, message: string | Buffer) {
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

export function handleWebSocketClose(ws: ServerWebSocket<WSData>) {
    if (ws.data.sessionId) {
        destroySession(ws.data.sessionId);
    }
    console.log(`WebSocket closed for ${ws.data.username || "unknown"}`);
}

function handleAuth(ws: ServerWebSocket<WSData>, msg: WSMessage) {
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
    const session = createSession(payload.username, sessionId);

    // Forward PTY output to WebSocket
    session.pty.onData((data: string) => {
        ws.send(JSON.stringify({ type: "output", data }));
    });

    session.pty.onExit(() => {
        ws.send(JSON.stringify({ type: "exit", message: "Session ended" }));
        ws.close();
    });

    ws.send(JSON.stringify({ type: "authenticated", sessionId }));
}

function handleInput(ws: ServerWebSocket<WSData>, msg: WSMessage) {
    if (!ws.data.authenticated || !ws.data.sessionId) {
        ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
        return;
    }

    if (msg.data) {
        writeToSession(ws.data.sessionId, msg.data);
    }
}

function handleResize(ws: ServerWebSocket<WSData>, msg: WSMessage) {
    if (!ws.data.authenticated || !ws.data.sessionId) {
        return;
    }

    if (msg.cols && msg.rows) {
        resizeSession(ws.data.sessionId, msg.cols, msg.rows);
    }
}

async function handleTmuxCommand(ws: ServerWebSocket<WSData>, msg: WSMessage) {
    if (!ws.data.authenticated) {
        ws.send(JSON.stringify({ type: "error", message: "Not authenticated" }));
        return;
    }

    if (msg.command === "list") {
        const sessions = await listTmuxSessions();
        ws.send(JSON.stringify({ type: "tmux-sessions", sessions }));
    }
}
