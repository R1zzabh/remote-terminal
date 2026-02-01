#!/bin/bash

# Ryo Terminal Unified Launcher
# This script ensures the correct Node.js path is set and starts both server and client.

export TOOLING_PATH="/home/ridgehub/shobha/.tooling/node-v22.13.0-linux-x64/bin"
export PATH="$TOOLING_PATH:$PATH"

echo "🚀 Starting Ryo Terminal Subsystems..."

# Kill any stale processes on our ports
echo "🧹 Cleaning up ports 3001 and 5173..."
fuser -k 3001/tcp 2>/dev/null
fuser -k 5173/tcp 2>/dev/null

# Start Backend
echo "📡 Launching Backend Server..."
cd /home/ridgehub/shobha/server
npm run dev > ../server.log 2>&1 &
SERVER_PID=$!

# Start Frontend
echo "💻 Launching Frontend (Vite)..."
cd /home/ridgehub/shobha/client
npm run dev > ../client.log 2>&1 &
CLIENT_PID=$!

echo "✅ Ryo Terminal is firing up!"
echo "   - Backend Logs: server.log"
echo "   - Frontend Logs: client.log"
echo "   - Access UI: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services."

# Handle shutdown
trap "kill $SERVER_PID $CLIENT_PID; echo '🛑 Services stopped.'; exit" INT TERM

# Keep script running
wait
