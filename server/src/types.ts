import type { ServerWebSocket } from "bun";

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
}

export interface WSData {
    username: string;
    sessionId: string;
    authenticated: boolean;
}

export type AuthenticatedWebSocket = ServerWebSocket<WSData>;

export interface PTYSession {
    id: string;
    pty: any; // node-pty IPty type
    username: string;
    createdAt: Date;
    lastActivity: Date;
}

export interface TmuxSession {
    name: string;
    windows: number;
    attached: boolean;
}
