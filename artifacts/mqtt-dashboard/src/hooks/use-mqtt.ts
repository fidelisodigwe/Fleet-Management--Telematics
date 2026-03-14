import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMqttStatus,
  useMqttConnect,
  useMqttDisconnect,
  useMqttSubscribe,
  getMqttStatusQueryKey,
} from "@workspace/api-client-react";

export interface MqttMessage {
  topic: string;
  payload: string;
  timestamp: string;
}

export function useMqtt() {
  const queryClient = useQueryClient();

  // Polling status slightly less aggressively since SSE won't tell us about connection drops reliably
  const status = useMqttStatus({
    query: {
      refetchInterval: 5000, 
    },
  });

  const connect = useMqttConnect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getMqttStatusQueryKey() });
      },
    },
  });

  const disconnect = useMqttDisconnect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getMqttStatusQueryKey() });
      },
    },
  });

  const subscribe = useMqttSubscribe({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getMqttStatusQueryKey() });
      },
    },
  });

  // Real-time messages state
  const [messages, setMessages] = useState<MqttMessage[]>([]);
  const isConnected = status.data?.connected ?? false;

  useEffect(() => {
    // Only connect to the SSE stream if the MQTT client itself is connected
    if (!isConnected) {
      return;
    }

    let es: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout;

    const connectSSE = () => {
      es = new EventSource("/api/mqtt/messages/stream");

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as MqttMessage;
          setMessages((prev) => {
            // Keep last 1000 messages to prevent memory leaks in browser
            const next = [...prev, msg];
            if (next.length > 1000) return next.slice(next.length - 1000);
            return next;
          });
        } catch (err) {
          console.error("Failed to parse MQTT message from SSE", err);
        }
      };

      es.onerror = () => {
        es?.close();
        // Simple exponential backoff or fixed retry could go here.
        // For now, fixed 3s retry if SSE drops while MQTT is supposedly connected
        retryTimeout = setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      clearTimeout(retryTimeout);
      if (es) es.close();
    };
  }, [isConnected]);

  const clearMessages = () => setMessages([]);

  return {
    status,
    connect,
    disconnect,
    subscribe,
    messages,
    clearMessages,
  };
}
