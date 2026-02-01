# Ryo Terminal API Specification

This document outlines the REST API and WebSocket protocols used by Ryo Terminal.

## Authentication

All API requests (except login) require a JSON Web Token (JWT) in the `Authorization` header.

```http
Authorization: Bearer <token>
```

### POST `/api/login`
**Description**: Authenticate user and receive a JWT.
- **Body**: `{ "username": "...", "password": "..." }`
- **Response**: `{ "success": true, "token": "..." }` or `401 Unauthorized`.

---

## File System API

### GET `/api/files?path=<path>`
**Description**: List files and directories at the specified path.
- **Query Params**: `path` (optional, defaults to home dir).
- **Response**: `Array<{ name: string, isDirectory: boolean, path: string, size: number }>`

### GET `/api/files/content?path=<path>`
**Description**: Fetch the text content of a file.

### POST `/api/files/content`
**Description**: Save content to a file.
- **Body**: `{ "path": "...", "content": "..." }`

### POST `/api/files/create`
**Description**: Create a new file or directory.
- **Body**: `{ "path": "...", "isDirectory": boolean }`

### POST `/api/files/rename`
**Description**: Rename/Move a file or directory.
- **Body**: `{ "oldPath": "...", "newPath": "..." }`

### DELETE `/api/files?path=<path>`
**Description**: Delete a file or directory.

---

## Macros API

### GET `/api/macros`
**Description**: Fetch all macros for the authenticated user.

### POST `/api/macros`
**Description**: Save or update a macro.
- **Body**: `{ "name": "...", "commands": ["..."], "isDefault": boolean }`

---

## WebSocket Protocol

**Endpoint**: `ws://<host>:<port>/ws?sessionId=<paneId>`

### Client -> Server Messages

| Type | Data | Description |
| :--- | :--- | :--- |
| `auth` | `{ token, sshHost? }` | Authenticate the WebSocket session. |
| `input` | `{ data }` | Send raw keyboard input to the shell. |
| `resize`| `{ cols, rows }` | Resize the PTY terminal window. |
| `ping` | `{}` | Heartbeat to keep connection alive. |

### Server -> Client Messages

| Type | Data | Description |
| :--- | :--- | :--- |
| `output` | `{ data }` | Raw terminal output from the shell. |
| `authenticated` | `{ sessionId }` | Confirmation of successful auth. |
| `error` | `{ message }` | Error notification. |
| `exit` | `{ message }` | Shell process termination notification. |
