import { WebSocket } from "ws";
import * as pty from "node-pty";

export interface User {
    username: string;
    passwordHash: string;
    role: "admin" | "user";
    homeDir: string;
}

export interface JWTPayload {
    username: string;
    role: "admin" | "user";
    homeDir: string;
    iat?: number;
    exp?: number;
}

export interface WSMessage {
    type: "input" | "resize" | "ping" | "auth" | "tmux" | "join" | "list-sessions" | "list-host-sessions";
    data?: string;
    cols?: number;
    rows?: number;
    token?: string;
    command?: string;
    sshHost?: string;
    sessionId?: string;
    joinSessionId?: string;
    shareMode?: "collaborative" | "view-only";
    hostSessionName?: string; // tmux session name to attach to
}

export interface WSData {
    username: string;
    sessionId: string;
    authenticated: boolean;
}

export interface AuthenticatedWebSocket extends WebSocket {
    data: WSData;
}

export interface PTYSession {
    pty: pty.IPty;
    sessionId: string;
    username: string;
    createdAt: Date;
    sshHost?: string;
    clients: Set<AuthenticatedWebSocket>;
    owner: string;
    shareMode: "collaborative" | "view-only";
}

export interface TmuxSession {
    name: string;
    windows: number;
    attached: boolean;
}
