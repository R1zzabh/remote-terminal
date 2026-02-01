# ⚡ Ryo Terminal

A premium, high-performance web-based terminal emulator with real shell execution and persistent sessions.

![Ryo Terminal](https://img.shields.io/badge/Status-Perfected-brightgreen)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20Xterm.js-blue)

## 🌟 Features

- **Real Shell Interaction**: Not a mock! Executes actual commands on your server.
- **Tmux Persistence**: Sessions stay alive even if you disconnect.
- **Glassmorphic Design**: Sleek, modern interface with translucent panels and blur effects.
- **CRT Aesthetics**: High-fidelity terminal glow and scanlines for a professional look.
- **Robust Reconnection**: Automatically stays connected with exponential backoff.
- **Secure Architecture**: JWT-based authentication and built-in rate limiting.

## 🚀 Quick Start

### Prerequisites
- Node.js (v20+)
- build-essential (make, g++)

### Installation
1. **Server**
   ```bash
   cd server
   npm install
   npm run dev
   ```

2. **Client**
   ```bash
   cd client
   npm install
   npm run dev
   ```

### Default Credentials
- **Username**: `admin`
- **Password**: `admin123`

## 🛠 Tech Stack
- **Frontend**: React 19, Vite, Xterm.js, TypeScript.
- **Backend**: Node.js, WebSockets, `node-pty`, JWT.
- **Styling**: Vanilla CSS with Glassmorphism and @keyframes.

---
Built with ❤️ for a professional terminal experience.
