import * as pty from "node-pty";

export interface PTYSession {
    pty: pty.IPty;
    sessionId: string;
    username: string;
    createdAt: Date;
    sshHost?: string;
}

const sessions = new Map<string, PTYSession>();

export function createSession(username: string, sessionId: string, sshHost?: string): PTYSession {
    const shell = sshHost ? "ssh" : (process.env.SHELL || "/bin/bash");
    const args = sshHost ? [sshHost] : ["-c", `tmux new-session -A -s ryo-${username}-${sessionId} || ${process.env.SHELL || "/bin/bash"}`];

    const ptyProcess = pty.spawn(shell, args, {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || "/",
        env: {
            ...process.env,
            TERM: "xterm-256color",
            COLORTERM: "truecolor",
            RYO_TERMINAL: "1",
            PS1: `\\[\\e[1;32m\\]ryo\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\] $ `
        } as any,
    });

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
