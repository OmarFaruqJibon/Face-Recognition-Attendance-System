//src/hooks/useWebsocket.jsx

import { useEffect, useRef } from "react";

export default function useWebsocket({ onMessage, url }) {
  const wsRef = useRef(null);
  useEffect(() => {
    if (!url) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      console.log("[ws] connected");
      // Optionally send pings or auth here
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        onMessage && onMessage(data);
      } catch (e) {
        console.warn("ws parse error", e);
      }
    };
    ws.onclose = () => console.log("[ws] closed");
    ws.onerror = (e) => console.warn("[ws] error", e);
    // keep connection alive by sending periodic pings if needed
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [url, onMessage]);
  return wsRef;
}
