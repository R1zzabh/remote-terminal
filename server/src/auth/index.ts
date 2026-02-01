import jwt from "jsonwebtoken";
import type { User, JWTPayload } from "../types";
import { config } from "../config";

// In-memory user store (single user for now)
let adminUser: User | null = null;

export async function initializeAuth() {
    // Hash the default password using Bun's built-in Argon2
    const passwordHash = await Bun.password.hash(config.defaultUser.password);
    adminUser = {
        username: config.defaultUser.username,
        passwordHash,
    };
    console.log(`✓ Auth initialized for user: ${adminUser.username}`);
}

export async function verifyPassword(username: string, password: string): Promise<boolean> {
    if (!adminUser || adminUser.username !== username) {
        return false;
    }
    return await Bun.password.verify(password, adminUser.passwordHash);
}

export function generateToken(username: string): string {
    const payload: JWTPayload = { username };
    return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiry });
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
