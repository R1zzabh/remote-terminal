import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs-extra";
import path from "path";
import type { User, JWTPayload } from "../types.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const USERS_FILE = path.resolve(process.cwd(), "data", "users.json");
let users: User[] = [];

export async function initializeAuth() {
    await fs.ensureDir(path.dirname(USERS_FILE));

    if (await fs.pathExists(USERS_FILE)) {
        users = await fs.readJson(USERS_FILE);
        logger.info("Users loaded from storage.");
    } else {
        // Create default admin user
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(config.defaultUser.password, salt);

        const defaultAdmin: User = {
            username: config.defaultUser.username,
            passwordHash: passwordHash,
            role: "admin",
            homeDir: process.env.HOME || process.cwd()
        };

        users = [defaultAdmin];
        await fs.writeJson(USERS_FILE, users, { spaces: 2 });
        logger.info(`✓ Auth initialized. Default admin created: ${defaultAdmin.username}`);
    }
}

export async function getUserByUsername(username: string): Promise<User | null> {
    return users.find(u => u.username === username) || null;
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
    if (users.some(u => u.username === newUser.username)) return false;

    users.push(newUser);
    await fs.writeJson(USERS_FILE, users, { spaces: 2 });
    return true;
}

// Admin only: Remove a user
export async function removeUser(username: string): Promise<boolean> {
    const initialLength = users.length;
    users = users.filter(u => u.username !== username);
    if (users.length === initialLength) return false;

    await fs.writeJson(USERS_FILE, users, { spaces: 2 });
    return true;
}
