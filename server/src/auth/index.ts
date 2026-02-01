import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs-extra";
import path from "path";
import type { User, JWTPayload } from "../types.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

import { db } from "../utils/db.js";

export async function initializeAuth() {
    const userCount = (db.get("SELECT COUNT(*) as count FROM users") as any).count;

    if (userCount === 0) {
        // Create default admin user
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(config.defaultUser.password, salt);

        const defaultAdmin: User = {
            username: config.defaultUser.username,
            passwordHash: passwordHash,
            role: "admin",
            homeDir: process.env.HOME || process.cwd()
        };

        db.run("INSERT INTO users (username, passwordHash, role, homeDir) VALUES (?, ?, ?, ?)",
            [defaultAdmin.username, defaultAdmin.passwordHash, defaultAdmin.role, defaultAdmin.homeDir]);

        logger.info(`✓ Auth initialized. Default admin created: ${defaultAdmin.username}`);
    } else {
        logger.info(`Auth initialized. ${userCount} users found in database.`);
    }
}

export async function getUserByUsername(username: string): Promise<User | null> {
    const user = db.get("SELECT * FROM users WHERE username = ?", [username]);
    return (user as User) || null;
}

export async function verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await getUserByUsername(username);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
}

export function generateToken(user: User): string {
    const payload: JWTPayload = {
        username: user.username,
        role: user.role,
        homeDir: user.homeDir
    };
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
    const user = await verifyPassword(username, password);

    if (!user) {
        return { success: false, error: "Invalid credentials" };
    }

    const token = generateToken(user);
    return { success: true, token };
}

// Admin only: Add a new user
export async function addUser(newUser: User): Promise<boolean> {
    try {
        db.run("INSERT INTO users (username, passwordHash, role, homeDir) VALUES (?, ?, ?, ?)",
            [newUser.username, newUser.passwordHash, newUser.role, newUser.homeDir]);
        return true;
    } catch (e) {
        return false;
    }
}

// Admin only: Remove a user
export async function removeUser(username: string): Promise<boolean> {
    const result = db.run("DELETE FROM users WHERE username = ?", [username]);
    return result.changes > 0;
}
