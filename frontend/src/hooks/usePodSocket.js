import { useState, useRef, useEffect, useCallback } from 'react';
import { normalizeSignalMessage } from '../components/pods/podProtocol';

export function usePodSocket({ pod, myClientId, user, enteredPasscode }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [wsReconnectAttempts, setWsReconnectAttempts] = useState(0);
  const [wsReady, setWsReady] = useState(false);
  
  const wsRef = useRef(null);
  const pingTimerRef = useRef(null);
  const subscribersRef = useRef([]);

  const subscribe = useCallback((handler) => {
    subscribersRef.current.push(handler);
    return () => {
      subscribersRef.current = subscribersRef.current.filter((h) => h !== handler);
    };
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const connectWebSocket = useCallback((targetPod, attempt = 0) => {
    return new Promise((resolve, reject) => {
      let wsUrl = '';
      const apiBase = import.meta.env.VITE_API_BASE_URL;
      const token = localStorage.getItem('cognipath_token');
      const passcodeParam = (targetPod.has_passcode && enteredPasscode) ? `&passcode=${encodeURIComponent(enteredPasscode)}` : '';
      
      if (apiBase && (apiBase.startsWith('http://') || apiBase.startsWith('https://'))) {
        const parsed = new URL(apiBase);
        const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProto}//${parsed.host}/api/v1/pods/ws/${targetPod.id}?client_id=${myClientId}&token=${token}${passcodeParam}`;
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        wsUrl = `${protocol}//${host}/api/v1/pods/ws/${targetPod.id}?client_id=${myClientId}&token=${token}${passcodeParam}`;
      }

      console.log(`[usePodSocket] Connecting to ${wsUrl} (Attempt ${attempt + 1})`);
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error("Connection timeout"));
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('[usePodSocket] Pod signaling connected');
        setConnectionError(null);
        setWsReconnectAttempts(0);
        wsRef.current = ws;
        setWsReady(true);
        
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
          }
        }, 25000);
        
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const data = normalizeSignalMessage(raw);
          subscribersRef.current.forEach((handler) => {
            try { handler(data); } catch (e) { console.warn('[usePodSocket] Subscriber error:', e); }
          });
        } catch (e) {
          console.error('[usePodSocket] Failed to parse message:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('[usePodSocket] Error:', err);
      };

      ws.onclose = (event) => {
        console.log('[usePodSocket] Connection closed', event.code, event.reason);
        setWsReady(false);
        if (wsRef.current === ws) wsRef.current = null;

        if (event.code === 4401) {
          setConnectionError("Authentication failed. Please log in again.");
          return reject(new Error("Auth failed"));
        } else if (event.code === 4403) {
          setConnectionError("You have been blacklisted from this pod.");
          return reject(new Error("Blacklisted"));
        } else if (event.code === 4404) {
          setConnectionError("Pod not found.");
          return reject(new Error("Not found"));
        } else if (event.code === 4409) {
          setConnectionError("Pod is full (Max 6 peers).");
          return reject(new Error("Full"));
        } else if (event.code === 4410) {
          setConnectionError("Pod has ended or expired.");
          return reject(new Error("Expired"));
        }

        // Exponential backoff reconnect
        if (targetPod) {
          setWsReconnectAttempts((prev) => {
            const next = prev + 1;
            if (next <= 6) {
              const delay = Math.min(1000 * Math.pow(2, next - 1), 15000);
              setConnectionError(`Connection lost. Reconnecting (Attempt ${next}/6)...`);
              setTimeout(() => {
                connectWebSocket(targetPod, next).catch((e) => console.error("Reconnect failed", e));
              }, delay);
            } else {
              setConnectionError("Failed to connect after multiple attempts.");
            }
            return next;
          });
        }
      };
    });
  }, [myClientId, enteredPasscode]);

  const disconnect = useCallback(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsReady(false);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    wsRef,
    wsReady,
    isConnecting,
    setIsConnecting,
    connectionError,
    wsReconnectAttempts,
    connectWebSocket,
    disconnect,
    send,
    subscribe
  };
}
