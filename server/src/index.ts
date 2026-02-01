import { config } from "./config";
import { initializeAuth, handleLogin } from "./auth";
import { handleWebSocketOpen, handleWebSocketMessage, handleWebSocketClose } from "./ws/handler";
import type { WSData } from "./types";

// Initialize authentication
await initializeAuth();

// Rate limiting store
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + config.rateLimit.windowMs });
        return true;
    }

    if (record.count >= config.rateLimit.maxRequests) {
        return false;
    }

    record.count++;
    return true;
}

// CORS headers
function getCorsHeaders(origin: string | null) {
    const allowedOrigin = origin && config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0];

    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
    };
}

const server = Bun.serve<WSData>({
    port: config.port,

    async fetch(req, server) {
        const url = new URL(req.url);
        const origin = req.headers.get("origin");
        const corsHeaders = getCorsHeaders(origin);

        // Handle CORS preflight
        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // WebSocket upgrade
        if (url.pathname === "/ws") {
            const upgraded = server.upgrade(req, {
                data: {
                    username: "",
                    sessionId: "",
                    authenticated: false,
                },
            });

            if (upgraded) {
                return undefined;
            }

            return new Response("WebSocket upgrade failed", { status: 400 });
        }

        // Login endpoint
        if (url.pathname === "/api/login" && req.method === "POST") {
            const ip = server.requestIP(req)?.address || "unknown";

            if (!checkRateLimit(ip)) {
                return new Response(JSON.stringify({ error: "Too many requests" }), {
                    status: 429,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            try {
                const body = await req.json();
                const { username, password } = body;

                if (!username || !password) {
                    return new Response(JSON.stringify({ error: "Missing credentials" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                const result = await handleLogin(username, password);

                if (!result.success) {
                    return new Response(JSON.stringify({ error: result.error }), {
                        status: 401,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                return new Response(JSON.stringify({ token: result.token }), {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: "Invalid request" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        // Health check
        if (url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    },

    websocket: {
        open: handleWebSocketOpen,
        message: handleWebSocketMessage,
        close: handleWebSocketClose,
    },
});

console.log(`
╔════════════════════════════════════════╗
║   Shobha Terminal Server Running      ║
╚════════════════════════════════════════╝

🚀 Server: http://localhost:${server.port}
🔌 WebSocket: ws://localhost:${server.port}/ws
🔐 Login: POST /api/login

Default credentials:
  Username: ${config.defaultUser.username}
  Password: ${config.defaultUser.password}

⚠️  CHANGE THE DEFAULT PASSWORD IN PRODUCTION!
`);
