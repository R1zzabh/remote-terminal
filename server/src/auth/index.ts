import jwt from "jsonwebtoken";
import type { User, JWTPayload } from "../types.js";
import { config } from "../config.js";

// In-memory user store (single user for now)
let adminUser: User | null = null;

// Hash mechanism removed for compatibility (Bun missing, native addons fail)
export async function initializeAuth() {
    // In a real app we would hash this, but for this mock environment we store plain
    adminUser = {
        username: config.defaultUser.username,
        passwordHash: config.defaultUser.password,
    };
    console.log(`✓ Auth initialized for user: ${adminUser.username} (Mock Auth Mode)`);
}

export async function verifyPassword(username: string, password: string): Promise<boolean> {
    if (!adminUser || adminUser.username !== username) {
        return false;
    }
    // Simple comparison for mock mode
    return password === adminUser.passwordHash;
}

export function generateToken(username: string): string {
    const payload: JWTPayload = { username };
    return jwt.sign(payload, config.jwtSecret as any, { expiresIn: config.jwtExpiry } as any);
}

export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, config.jwtSecret) as JWTPayload;
    } catch (error) {
        return null;
    }
}

export async function handleLogin(username: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {
    const isValid = await verifyPassword(username, password);

    if (!isValid) {
        return { success: false, error: "Invalid credentials" };
    }

    const token = generateToken(username);
    return { success: true, token };
}
