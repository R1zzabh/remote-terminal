
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

// Mock interface for the socket with attached data
export interface AuthenticatedWebSocket {
    send(data: string): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    data: WSData;
}

export interface PTYSession {
    id: string;
    pty: any; // Mock or node-pty
    username: string;
    createdAt: Date;
    lastActivity: Date;
}

export interface TmuxSession {
    name: string;
    windows: number;
    attached: boolean;
}

