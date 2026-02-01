export const config = {
    port: parseInt(process.env.PORT || "3001"),
    host: process.env.HOST || "0.0.0.0",
    jwtSecret: process.env.JWT_SECRET || "change-this-secret-in-production",
    jwtExpiry: "24h",
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173", "http://localhost:5174"],
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    rateLimit: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
    },
    defaultUser: {
        username: process.env.ADMIN_USERNAME || "admin",
        password: process.env.ADMIN_PASSWORD || "admin123", // CHANGE THIS!
    },
};
