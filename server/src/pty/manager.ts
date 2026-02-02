import * as pty from "node-pty";
import { exec } from "child_process";
import { logger } from "../utils/logger.js";
import { killTmuxSession } from "../pty/tmux.js";
import type { AuthenticatedWebSocket, PTYSession } from "../types.js";

const sessions = new Map<string, PTYSession>();

export function createSession(username: string, sessionId: string, sshHost?: string, cwd?: string, shareMode: "collaborative" | "view-only" = "collaborative"): PTYSession {
    const shell = sshHost ? "ssh" : (process.env.SHELL || "/bin/bash");
    const args = sshHost ? [sshHost] : ["-c", `tmux new-session -A -s ryo-${username}-${sessionId} || ${process.env.SHELL || "/bin/bash"}`];

    let ptyProcess: pty.IPty;
    try {
        ptyProcess = pty.spawn(shell, args, {
            name: "xterm-256color",
            cols: 80,
            rows: 24,
            cwd: cwd || process.env.HOME || "/",
            env: {
                ...process.env,
                TERM: "xterm-256color",
                COLORTERM: "truecolor",
                RYO_TERMINAL: "1",
                PS1: `\\[\\e[1;32m\\]ryo\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\] $ `
            } as any,
        });
    } catch (error) {
        logger.error(`Failed to spawn PTY session for ${username}:`, { error, shell, args });
        throw new Error(`Terminal spawn failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    const session: PTYSession = {
        pty: ptyProcess,
        sessionId,
        username,
        createdAt: new Date(),
        sshHost,
        clients: new Set(),
        owner: username,
        shareMode
    };

    // Broadcast PTY output to all connected clients
    ptyProcess.onData((data) => {
        broadcastToSession(session, { type: "output", data });
    });

    ptyProcess.onExit(() => {
        broadcastToSession(session, { type: "exit", message: "Session ended" });
        // Close all sockets
        session.clients.forEach(client => client.close());
        sessions.delete(sessionId);
    });

    sessions.set(sessionId, session);
    return session;
}

export function attachToHostSession(username: string, tmuxSessionName: string, shareMode: "collaborative" | "view-only" = "collaborative"): PTYSession {
    // Create sessionId based on the tmux session name
    const sessionId = `host-${tmuxSessionName}-${Date.now()}`;

    // Spawn a PTY that attaches to the existing tmux session
    let ptyProcess: pty.IPty;
    try {
        ptyProcess = pty.spawn("tmux", ["attach-session", "-t", tmuxSessionName], {
            name: "xterm-256color",
            cols: 80,
            rows: 24,
            cwd: process.env.HOME || "/",
            env: {
                ...process.env,
                TERM: "xterm-256color",
                COLORTERM: "truecolor",
                RYO_TERMINAL: "1",
            } as any,
        });
    } catch (error) {
        logger.error(`Failed to attach to tmux session ${tmuxSessionName}:`, { error });
        throw new Error(`Failed to attach to tmux session: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    const session: PTYSession = {
        pty: ptyProcess,
        sessionId,
        username,
        createdAt: new Date(),
        sshHost: undefined,
        clients: new Set(),
        owner: username,
        shareMode
    };

    // Broadcast PTY output to all connected clients
    ptyProcess.onData((data) => {
        broadcastToSession(session, { type: "output", data });
    });

    ptyProcess.onExit(() => {
        broadcastToSession(session, { type: "exit", message: "Session ended" });
        session.clients.forEach(client => client.close());
        sessions.delete(sessionId);
    });

    sessions.set(sessionId, session);
    return session;
}

export function getSession(sessionId: string): PTYSession | undefined {
    return sessions.get(sessionId);
}

export function listSessions(username?: string): PTYSession[] {
    if (username) {
        return Array.from(sessions.values()).filter(s => s.username === username);
    }
    return Array.from(sessions.values());
}

export function listShareableSessions(): any[] {
    return Array.from(sessions.values()).map(s => ({
        id: s.sessionId,
        username: s.username,
        createdAt: s.createdAt,
        clients: s.clients.size,
        sshHost: s.sshHost,
        shareMode: s.shareMode
    }));
}

export function attachClient(session: PTYSession, ws: AuthenticatedWebSocket) {
    session.clients.add(ws);
    // Send current session state or history if we had a buffer (optional optimization)
    // For now just resize to client's requested size or default
}

export function detachClient(session: PTYSession, ws: AuthenticatedWebSocket) {
    session.clients.delete(ws);
    if (session.clients.size === 0) {
        // Option: Keep session alive for a bit? Or kill immediately?
        // For now, if it's a tmux session, the process might persist, but our node-pty wrapper will die?
        // Actually, we should probably destroy it if no one is watching to save resources,
        // unless it's designed to persist.
        // Given 'tmux new-session -A', it persists in background if we detach.
        // But here we are killing the PTY process wrapper.

        // Let's set a timeout to kill it if no one reconnects in 1 minute?
        // For simplicity in this iteration: KIll immediately if no clients.
        deleteSession(session.sessionId);
    }
}

export function deleteSession(sessionId: string) {
    const session = sessions.get(sessionId);
    if (session) {
        try {
            session.pty.kill();
        } catch (e) {
            // Ignore
        }
        // Also kill the actual tmux session
        killTmuxSession(`ryo-${session.username}-${sessionId}`).catch(err => logger.error("Failed to kill tmux session", { error: err }));
        sessions.delete(sessionId);
    }
}

export const destroySession = deleteSession;

export function resizeSession(sessionId: string, cols: number, rows: number) {
    const session = sessions.get(sessionId);
    if (session) {
        try {
            session.pty.resize(cols, rows);
            // Notify other clients of resize? (Optional, xterm usually handles reflow on data)
            // But good to broadcast resize event if clients need to sync UI
            broadcastToSession(session, { type: "resize", cols, rows }, { excludeSender: false });
        } catch (err) {
            logger.error(`Failed to resize session ${sessionId}`, err);
        }
    }
}

export function writeToSession(sessionId: string, data: string) {
    const session = sessions.get(sessionId);
    if (session) {
        session.pty.write(data);
    }
}

function broadcastToSession(session: PTYSession, message: any, options: { excludeSender?: AuthenticatedWebSocket | boolean } = {}) {
    const msgString = JSON.stringify(message);
    session.clients.forEach(client => {
        if (options.excludeSender === client) return;
        if (client.readyState === 1) { // OPEN
            client.send(msgString);
        }
    });
}

/**
 * Audit: Cleanup stale tmux sessions that might have survived a server crash.
 */
export function cleanupStaleSessions() {
    exec("tmux ls", (err, stdout) => {
        if (err) return; // No tmux sessions or error
        const lines = stdout.split("\n");
        lines.forEach(line => {
            if (line.includes("ryo-")) {
                const sessionName = line.split(":")[0];
                // If it's a ryo session but we don't have it in our Map, it's stale
                const isManaged = Array.from(sessions.keys()).some(id => sessionName.includes(id));
                if (!isManaged) {
                    logger.info(`Cleaning up stale tmux session: ${sessionName}`);
                    exec(`tmux kill-session -t ${sessionName}`);
                }
            }
        });
    });
}

export function shutdownAllSessions() {
    logger.info(`Shutting down ${sessions.size} active PTY sessions...`);
    sessions.forEach(session => {
        try {
            session.pty.kill();
        } catch (e) {
            // Ignore already dead processes
        }
    });
    sessions.clear();
}
