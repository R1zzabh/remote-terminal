import * as pty from "node-pty";
import { exec } from "child_process";
import { logger } from "../utils/logger.js";

export interface PTYSession {
    pty: pty.IPty;
    sessionId: string;
    username: string;
    createdAt: Date;
    sshHost?: string;
}

const sessions = new Map<string, PTYSession>();

export function createSession(username: string, sessionId: string, sshHost?: string, cwd?: string): PTYSession {
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
        sshHost
    };

    sessions.set(sessionId, session);
    return session;
}

export function getSession(sessionId: string): PTYSession | undefined {
    return sessions.get(sessionId);
}

export function listSessions(username: string): PTYSession[] {
    return Array.from(sessions.values()).filter(s => s.username === username);
}

export function deleteSession(sessionId: string) {
    const session = sessions.get(sessionId);
    if (session) {
        session.pty.kill();
        sessions.delete(sessionId);
    }
}

export const destroySession = deleteSession;

export function resizeSession(sessionId: string, cols: number, rows: number) {
    const session = sessions.get(sessionId);
    if (session) {
        session.pty.resize(cols, rows);
    }
}

export function writeToSession(sessionId: string, data: string) {
    const session = sessions.get(sessionId);
    if (session) {
        session.pty.write(data);
    }
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
