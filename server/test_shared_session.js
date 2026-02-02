import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

const SECRET = "change-this-secret-in-production";
const PORT = 3001;

function createToken(username) {
    return jwt.sign({ username, role: 'admin', homeDir: '/tmp' }, SECRET, { expiresIn: '1h' });
}

const token = createToken('testuser');

console.log("🚀 Starting Shared Session Test");

const wsCreator = new WebSocket(`ws://localhost:${PORT}/ws`);
let sessionId = null;

wsCreator.on('open', () => {
    console.log("Creator: Connected");
    wsCreator.send(JSON.stringify({ type: 'auth', token }));
});

wsCreator.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'authenticated') {
        console.log("Creator: Authenticated, Session ID:", msg.sessionId);
        sessionId = msg.sessionId;
        startJoiner(sessionId);
    } else if (msg.type === 'output') {
        // console.log("Creator output:", JSON.stringify(msg.data));
    }
});

function startJoiner(targetSessionId) {
    console.log("Joiner: Connecting to session", targetSessionId);
    const wsJoiner = new WebSocket(`ws://localhost:${PORT}/ws`);

    wsJoiner.on('open', () => {
        console.log("Joiner: Connected");
        // Authenticate AND join
        wsJoiner.send(JSON.stringify({ type: 'auth', token, joinSessionId: targetSessionId }));
    });

    wsJoiner.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'authenticated') {
            console.log("Joiner: Authenticated and Joined!");

            // Now test communication
            // Creator types something
            console.log("Creator: Sending input 'echo SHARED_SUCCESS'");
            wsCreator.send(JSON.stringify({ type: 'input', data: 'echo SHARED_SUCCESS\r' }));
        } else if (msg.type === 'output') {
            const text = msg.data;
            if (text.includes("SHARED_SUCCESS")) {
                console.log("✅ Joiner received expected output!");
                console.log("🎉 TEST PASSED");
                process.exit(0);
            }
        }
    });

    wsJoiner.on('error', (err) => {
        console.error("Joiner Error:", err);
        process.exit(1);
    });
}

// Timeout
setTimeout(() => {
    console.error("❌ Test Timeout");
    process.exit(1);
}, 5000);
