import { createServer } from "http";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { initializeAuth, handleLogin } from "./auth/index.js";
import { handleWebSocketOpen, handleWebSocketMessage, handleWebSocketClose } from "./ws/handler.js";
import type { AuthenticatedWebSocket } from "./types.js";

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
function getCorsHeaders(origin: string | undefined) {
    const allowedOrigin = origin && config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0];

    return {
        "Access-Control-Allow-Origin": allowedOrigin || "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
    };
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const origin = req.headers.origin as string | undefined;
    const corsHeaders = getCorsHeaders(origin);

    // Helper to send JSON
    const json = (status: number, data: any) => {
        res.writeHead(status, { ...corsHeaders, "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }

    // Login endpoint
    if (url.pathname === "/api/login" && req.method === "POST") {
        const ip = req.socket.remoteAddress || "unknown";

        if (!checkRateLimit(ip)) {
            return json(429, { error: "Too many requests" });
        }

        try {
            // Read body
            const buffers = [];
            for await (const chunk of req) {
                buffers.push(chunk);
            }
            const body = JSON.parse(Buffer.concat(buffers).toString());
            const { username, password } = body;

            if (!username || !password) {
                return json(400, { error: "Missing credentials" });
            }

            const result = await handleLogin(username, password);

            if (!result.success) {
                return json(401, { error: result.error });
            }

            return json(200, { token: result.token });
        } catch (error) {
            return json(400, { error: "Invalid request" });
        }
    }

    // Health check
    if (url.pathname === "/health") {
        return json(200, { status: "ok" });
    }

    // Not Found
    res.writeHead(404, corsHeaders);
    res.end("Not Found");
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);

    if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            const authWs = ws as unknown as AuthenticatedWebSocket;
            authWs.data = {
                username: "",
                sessionId: "",
                authenticated: false,
            };

            wss.emit('connection', authWs, request);
        });
    } else {
        socket.destroy();
    }
});

wss.on('connection', (ws) => {
    const authWs = ws as unknown as AuthenticatedWebSocket;
    handleWebSocketOpen(authWs);

    ws.on('message', (message) => {
        handleWebSocketMessage(authWs, message as any);
    });

    ws.on('close', () => {
        handleWebSocketClose(authWs);
    });
});

server.on('error', (err) => {
    console.error('SERVER ERROR:', err);
    process.exit(1);
});

wss.on('error', (err) => {
    console.error('WSS ERROR:', err);
});

server.listen(config.port, () => {
    console.log(`
╔════════════════════════════════════════╗
║    Ryo Terminal Server Running        ║

🚀 Server: http://localhost:${config.port}
🔌 WebSocket: ws://localhost:${config.port}/ws
🔐 Login: POST /api/login

Default credentials:
  Username: ${config.defaultUser.username}
  Password: ${config.defaultUser.password}

⚠️  CHANGE THE DEFAULT PASSWORD IN PRODUCTION!
`);
});
