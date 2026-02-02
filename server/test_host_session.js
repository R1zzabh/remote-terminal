import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

const SECRET = "change-this-secret-in-production";
const PORT = 3001;

function createToken(username) {
    return jwt.sign({ username, role: 'admin', homeDir: '/tmp' }, SECRET, { expiresIn: '1h' });
}

const token = createToken('testuser');

console.log("🚀 Starting Host Session Attachment Test");

const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

ws.on('open', () => {
    console.log("Connected to server");
    // We authenticate AND attach to a host tmux session
    ws.send(JSON.stringify({ type: 'auth', token, hostSessionName: 'test_host_session' }));
});

let receivedOutput = false;

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'authenticated') {
        console.log("Authenticated with session:", msg.sessionId);
        if (msg.sessionId.startsWith('host-test_host_session')) {
            console.log("✅ Session ID correctly indicates host attachment");
        }
        // Send a command to the tmux session
        setTimeout(() => {
            console.log("Sending test command...");
            ws.send(JSON.stringify({ type: 'input', data: 'echo HOST_ATTACHED_OK\r' }));
        }, 500);
    } else if (msg.type === 'output') {
        if (msg.data.includes('HOST_ATTACHED_OK')) {
            console.log("✅ Received expected output from host tmux session");
            console.log("🎉 TEST PASSED");
            ws.close();
            process.exit(0);
        }
    } else if (msg.type === 'error') {
        console.error("❌ Error:", msg.message);
        process.exit(1);
    }
});

ws.on('error', (err) => {
    console.error("WebSocket Error:", err);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.error("❌ Test Timeout");
    process.exit(1);
}, 8000);
