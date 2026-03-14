import { Router, type IRouter, type Request, type Response } from "express";
import mqtt, { type MqttClient } from "mqtt";
import {
  MqttConnectBody,
  MqttConnectResponse,
  MqttDisconnectResponse,
  MqttSubscribeBody,
  MqttSubscribeResponse,
  MqttStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

interface MqttState {
  client: MqttClient | null;
  brokerUrl: string;
  clientId: string;
  subscribedTopics: Set<string>;
  sseClients: Set<Response>;
}

const state: MqttState = {
  client: null,
  brokerUrl: "",
  clientId: "",
  subscribedTopics: new Set(),
  sseClients: new Set(),
};

function broadcastMessage(topic: string, payload: string) {
  const data = JSON.stringify({ topic, payload, timestamp: new Date().toISOString() });
  for (const res of state.sseClients) {
    res.write(`data: ${data}\n\n`);
  }
}

router.post("/mqtt/connect", async (req: Request, res: Response): Promise<void> => {
  const parsed = MqttConnectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (state.client) {
    state.client.end(true);
    state.client = null;
    state.subscribedTopics.clear();
  }

  const { brokerUrl, username, password, clientId } = parsed.data;
  const resolvedClientId = clientId || `mqtt-dashboard-${Math.random().toString(16).slice(2, 8)}`;

  try {
    const options: mqtt.IClientOptions = {
      clientId: resolvedClientId,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
      connectTimeout: 10000,
      reconnectPeriod: 0,
    };

    const client = mqtt.connect(brokerUrl, options);
    state.client = client;
    state.brokerUrl = brokerUrl;
    state.clientId = resolvedClientId;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timed out"));
      }, 10000);

      client.once("connect", () => {
        clearTimeout(timeout);
        resolve();
      });

      client.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    client.on("message", (topic, message) => {
      broadcastMessage(topic, message.toString());
    });

    client.on("error", (err) => {
      console.error("MQTT error:", err.message);
    });

    res.json(MqttConnectResponse.parse({ success: true, message: `Connected to ${brokerUrl}` }));
  } catch (err: unknown) {
    if (state.client) {
      state.client.end(true);
      state.client = null;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: `Failed to connect: ${message}` });
  }
});

router.post("/mqtt/disconnect", async (_req: Request, res: Response): Promise<void> => {
  if (state.client) {
    state.client.end(true);
    state.client = null;
    state.subscribedTopics.clear();
    state.brokerUrl = "";
    state.clientId = "";
  }
  res.json(MqttDisconnectResponse.parse({ success: true, message: "Disconnected" }));
});

router.post("/mqtt/subscribe", async (req: Request, res: Response): Promise<void> => {
  if (!state.client || !state.client.connected) {
    res.status(400).json({ error: "Not connected to any MQTT broker" });
    return;
  }

  const parsed = MqttSubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { topic } = parsed.data;

  await new Promise<void>((resolve, reject) => {
    state.client!.subscribe(topic, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  state.subscribedTopics.add(topic);
  res.json(MqttSubscribeResponse.parse({ success: true, message: `Subscribed to ${topic}` }));
});

router.get("/mqtt/status", async (_req: Request, res: Response): Promise<void> => {
  res.json(
    MqttStatusResponse.parse({
      connected: state.client?.connected ?? false,
      brokerUrl: state.brokerUrl || undefined,
      clientId: state.clientId || undefined,
      subscribedTopics: Array.from(state.subscribedTopics),
    })
  );
});

router.get("/mqtt/messages/stream", (req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  state.sseClients.add(res);

  req.on("close", () => {
    state.sseClients.delete(res);
  });
});

export default router;
