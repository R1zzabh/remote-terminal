import { useState, useEffect, useRef, useCallback } from "react";

interface UseWebSocketOptions {
    url: string;
    token: string | null;
    onMessage: (data: any) => void;
    onOpen?: () => void;
    onClose?: () => void;
}

export function useWebSocket({ url, token, onMessage, onOpen, onClose }: UseWebSocketOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | undefined>(undefined);
    const reconnectAttempts = useRef(0);

    const connect = useCallback(() => {
        if (!token) return;

        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WebSocket connected");
                setIsConnected(true);
                reconnectAttempts.current = 0;

                // Authenticate
                ws.send(JSON.stringify({ type: "auth", token }));

                onOpen?.();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessage(data);
                } catch (error) {
                    console.error("Failed to parse message:", error);
                }
            };

            ws.onclose = () => {
                console.log("WebSocket disconnected");
                setIsConnected(false);
                wsRef.current = null;
                onClose?.();

                // Exponential backoff reconnect
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                reconnectAttempts.current++;

                console.log(`Reconnecting in ${delay}ms...`);
                reconnectTimeoutRef.current = window.setTimeout(() => {
                    connect();
                }, delay);
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
            };
        } catch (error) {
            console.error("Failed to create WebSocket:", error);
        }
    }, [url, token, onMessage, onOpen, onClose]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const send = useCallback((data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return { isConnected, send, disconnect };
}
