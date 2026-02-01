import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { User, JWTPayload } from "../types.js";
import { config } from "../config.js";

// In-memory user store
let adminUser: User | null = null;

export async function initializeAuth() {
    // Generate salt and hash for the default password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(config.defaultUser.password, salt);

    adminUser = {
        username: config.defaultUser.username,
        passwordHash: passwordHash,
    };
    console.log(`✓ Auth initialized. Secure password hashing enabled for: ${adminUser.username}`);
}

export async function verifyPassword(username: string, password: string): Promise<boolean> {
    if (!adminUser || adminUser.username !== username) {
        return false;
    }
    return await bcrypt.compare(password, adminUser.passwordHash);
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
