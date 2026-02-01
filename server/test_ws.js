import WebSocket from 'ws';

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzY5OTEwMTkwLCJleHAiOjE3Njk5OTY1OTB9.hcHBq5DkBbiZ6258ReMk9UUP1mRuy9oI2VXe0QSwilE";
const ws = new WebSocket('ws://localhost:3006/ws');

ws.on('open', () => {
    console.log('WS OPEN');
    ws.send(JSON.stringify({ type: 'auth', token }));
});

ws.on('message', (data) => {
    console.log('WS MESSAGE:', data.toString());
    const msg = JSON.parse(data.toString());
    if (msg.type === 'authenticated') {
        console.log('AUTH SUCCESS');
        ws.send(JSON.stringify({ type: 'input', data: 'ls\r' }));
    }
    if (msg.type === 'output') {
        console.log('PTY OUTPUT:', msg.data);
        process.exit(0);
    }
});

ws.on('error', (err) => {
    console.error('WS ERROR:', err);
    process.exit(1);
});

setTimeout(() => {
    console.log('TIMEOUT');
    process.exit(1);
}, 5000);
