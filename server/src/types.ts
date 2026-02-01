import { WebSocket } from "ws";
import * as pty from "node-pty";

export interface User {
    username: string;
    passwordHash: string;
}

export interface JWTPayload {
    username: string;
    iat?: number;
    exp?: number;
}

export interface WSMessage {
    type: "input" | "resize" | "ping" | "auth" | "tmux";
    data?: string;
    cols?: number;
    rows?: number;
    token?: string;
    command?: string;
    sshHost?: string;
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
    id: string;
    pty: pty.IPty;
    username: string;
    createdAt: Date;
    lastActivity: Date;
}

export interface TmuxSession {
    name: string;
    windows: number;
    attached: boolean;
}
