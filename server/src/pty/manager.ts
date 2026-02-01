import type { PTYSession } from "../types.js";
import { config } from "../config.js";

// Mock PTY implementation since node-pty cannot be built in this environment
class MockPty {
    callbacks: Function[] = [];
    exitCallbacks: Function[] = [];
    pid = 12345;

    constructor(shell: string, args: string[], options: any) {
        console.log(`[MockPTY] Spawning ${shell} with args ${args.join(' ')}`);
        setTimeout(() => this.emitData("Welcome to Shobha Terminal (Mock Mode)\r\n"), 100);
        setTimeout(() => this.emitData("node-pty failed to load, using mock.\r\n"), 200);
        setTimeout(() => this.emitData("$ "), 300);
    }

    onData(cb: Function) {
        this.callbacks.push(cb);
        return { dispose: () => { } };
    }

    onExit(cb: Function) {
        this.exitCallbacks.push(cb);
        return { dispose: () => { } };
    }

    resize(cols: number, rows: number) {
        console.log(`[MockPTY] Resize to ${cols}x${rows}`);
    }

    write(data: string) {
        // Echo back input characters for basic interaction
        this.emitData(data);
        // If Enter key (CR), add new line and prompt
        if (data.includes('\r')) {
            this.emitData('\n[Mock Shell] Execcuting...\r\n$ ');
        }
    }

    kill() {
        console.log("[MockPTY] Killed");
        this.exitCallbacks.forEach(cb => cb());
    }

    emitData(data: string) {
        this.callbacks.forEach(cb => cb(data));
    }
}

const sessions = new Map<string, PTYSession>();

export function createSession(username: string, sessionId: string): PTYSession {
    // Spawn a shell with tmux
    const shell = process.env.SHELL || "/bin/bash";

    // const ptyProcess = pty.spawn(shell, ["-c", "tmux new-session -A -s main"], {
    //     name: "xterm-256color",
    //     cols: 80,
    //     rows: 24,
    //     cwd: process.env.HOME || "/",
    //     env: process.env as any,
    // });

    const ptyProcess = new MockPty(shell, ["-c", "tmux new-session -A -s main"], {});

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
