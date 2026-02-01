import * as pty from "node-pty";
import type { PTYSession } from "../types";
import { config } from "../config";

const sessions = new Map<string, PTYSession>();

export function createSession(username: string, sessionId: string): PTYSession {
    // Spawn a shell with tmux
    const shell = process.env.SHELL || "/bin/bash";

    const ptyProcess = pty.spawn(shell, ["-c", "tmux new-session -A -s main"], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || "/",
        env: process.env as any,
    });

    const session: PTYSession = {
        id: sessionId,
        pty: ptyProcess,
        username,
        createdAt: new Date(),
        lastActivity: new Date(),
    };

    sessions.set(sessionId, session);
    console.log(`✓ PTY session created: ${sessionId} for ${username}`);

    return session;
}

export function getSession(sessionId: string): PTYSession | undefined {
    return sessions.get(sessionId);
}

export function updateActivity(sessionId: string) {
    const session = sessions.get(sessionId);
    if (session) {
        session.lastActivity = new Date();
    }
}

export function destroySession(sessionId: string) {
    const session = sessions.get(sessionId);
    if (session) {
        session.pty.kill();
        sessions.delete(sessionId);
        console.log(`✓ PTY session destroyed: ${sessionId}`);
    }
}

export function resizeSession(sessionId: string, cols: number, rows: number) {
    const session = sessions.get(sessionId);
    if (session) {
        session.pty.resize(cols, rows);
        updateActivity(sessionId);
    }
}

export function writeToSession(sessionId: string, data: string) {
    const session = sessions.get(sessionId);
    if (session) {
        session.pty.write(data);
        updateActivity(sessionId);
    }
}

// Cleanup inactive sessions
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now - session.lastActivity.getTime() > config.sessionTimeout) {
            console.log(`⚠ Session timeout: ${id}`);
            destroySession(id);
        }
    }
}, 60000); // Check every minute
