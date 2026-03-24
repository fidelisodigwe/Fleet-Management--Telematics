import { useState, useEffect } from "react";
import { useMqtt } from "./use-mqtt";

export interface FleetDevice {
  topicKey: string;           // full topic, e.g. /topic/transittag/ABC123
  deviceId: string;           // last segment of topic or id field
  battery?: number;
  lat?: number;
  lng?: number;
  ssid?: string;
  rssi?: number;
  temperature?: number;
  humidity?: number;
  speed?: number;
  altitude?: number;
  status?: string;
  lastSeen: Date;
  messageCount: number;
  extras: Record<string, unknown>;
  batteryHistory: { timestamp: number; value: number }[];
  rawPayload?: string;
}

export interface FleetStats {
  total: number;
  online: number;
  offline: number;
  lowBattery: number;
  totalMessages: number;
}

const getNested = (obj: unknown, path: string): unknown => {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
};

const findField = (obj: unknown, aliases: string[]): unknown => {
  for (const alias of aliases) {
    const val = getNested(obj, alias);
    if (val !== undefined && val !== null) return val;
  }
  return undefined;
};

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const LOW_BATTERY_THRESHOLD = 20;
const MAX_BATTERY_HISTORY = 20;
const MAX_DEVICES = 200;

export function useFleet() {
  const { messages, status: mqttStatus } = useMqtt();
  const isConnected = mqttStatus.data?.connected ?? false;

  const [devices, setDevices] = useState<Map<string, FleetDevice>>(new Map());
  const [lastProcessedIndex, setLastProcessedIndex] = useState(-1);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const newMessages = messages.slice(lastProcessedIndex + 1);
    if (newMessages.length === 0) return;

    setDevices(prev => {
      const next = new Map(prev);

      for (const msg of newMessages) {
        const topicKey = msg.topic;
        // Derive a display-friendly device ID from the last segment of the topic
        const segments = topicKey.split('/').filter(Boolean);
        const defaultDeviceId = segments[segments.length - 1] || topicKey;

        let payload: Record<string, unknown> | null = null;
        try {
          const parsed = JSON.parse(msg.payload);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            payload = parsed as Record<string, unknown>;
          }
        } catch {
          // non-JSON payload — skip structured parsing
        }

        const existing = next.get(topicKey) ?? {
          topicKey,
          deviceId: defaultDeviceId,
          lastSeen: new Date(msg.timestamp),
          messageCount: 0,
          extras: {},
          batteryHistory: [],
        } as FleetDevice;

        const updated: FleetDevice = {
          ...existing,
          lastSeen: new Date(msg.timestamp),
          messageCount: existing.messageCount + 1,
          rawPayload: msg.payload,
        };

        if (payload) {
          const battery = findField(payload, ['battery', 'bat', 'battery_level', 'batt', 'batteryLevel']);
          const lat = findField(payload, ['lat', 'latitude', 'gps_lat', 'location.lat']);
          const lng = findField(payload, ['lng', 'lon', 'longitude', 'gps_lng', 'location.lng']);
          const ssid = findField(payload, ['ssid', 'wifi_ssid', 'wifi.ssid', 'network']);
          const rssi = findField(payload, ['rssi', 'wifi_rssi', 'signal', 'wifi_signal', 'signalStrength']);
          const temperature = findField(payload, ['temp', 'temperature']);
          const humidity = findField(payload, ['humidity', 'hum']);
          const speed = findField(payload, ['speed', 'gps_speed']);
          const altitude = findField(payload, ['altitude', 'alt']);
          const deviceId = findField(payload, ['device_id', 'deviceId', 'id', 'imei', 'tag_id', 'tagId']);
          const status = findField(payload, ['status', 'device_status', 'state']);

          if (battery !== undefined) {
            const b = Number(battery);
            updated.battery = b;
            const hist = [...existing.batteryHistory, { timestamp: new Date(msg.timestamp).getTime(), value: b }];
            updated.batteryHistory = hist.length > MAX_BATTERY_HISTORY ? hist.slice(hist.length - MAX_BATTERY_HISTORY) : hist;
          }
          if (lat !== undefined) updated.lat = Number(lat);
          if (lng !== undefined) updated.lng = Number(lng);
          if (ssid !== undefined) updated.ssid = String(ssid);
          if (rssi !== undefined) updated.rssi = Number(rssi);
          if (temperature !== undefined) updated.temperature = Number(temperature);
          if (humidity !== undefined) updated.humidity = Number(humidity);
          if (speed !== undefined) updated.speed = Number(speed);
          if (altitude !== undefined) updated.altitude = Number(altitude);
          if (deviceId !== undefined) updated.deviceId = String(deviceId);
          if (status !== undefined) updated.status = String(status);

          // Collect extras
          const knownKeys = new Set([
            'battery','bat','battery_level','batt','batteryLevel',
            'lat','latitude','gps_lat','location',
            'lng','lon','longitude','gps_lng',
            'ssid','wifi_ssid','wifi','network',
            'rssi','wifi_rssi','signal','wifi_signal','signalStrength',
            'temp','temperature','humidity','hum',
            'speed','gps_speed','altitude','alt',
            'device_id','deviceId','id','imei','tag_id','tagId',
            'status','device_status','state',
          ]);
          const extras: Record<string, unknown> = { ...existing.extras };
          for (const [k, v] of Object.entries(payload)) {
            if (!knownKeys.has(k)) extras[k] = v;
          }
          updated.extras = extras;
        }

        next.set(topicKey, updated);

        // Cap device count to avoid memory issues
        if (next.size > MAX_DEVICES) {
          const oldest = [...next.entries()].sort((a, b) => a[1].lastSeen.getTime() - b[1].lastSeen.getTime())[0];
          next.delete(oldest[0]);
        }
      }

      return next;
    });

    setLastProcessedIndex(messages.length - 1);
  }, [messages, lastProcessedIndex]);

  // Reset on clear
  useEffect(() => {
    if (messages.length === 0 && lastProcessedIndex > -1) {
      setDevices(new Map());
      setLastProcessedIndex(-1);
    }
  }, [messages, lastProcessedIndex]);

  const deviceList = Array.from(devices.values()).sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());

  const now = Date.now();
  const stats: FleetStats = {
    total: deviceList.length,
    online: deviceList.filter(d => now - d.lastSeen.getTime() < ONLINE_THRESHOLD_MS).length,
    offline: deviceList.filter(d => now - d.lastSeen.getTime() >= ONLINE_THRESHOLD_MS).length,
    lowBattery: deviceList.filter(d => d.battery !== undefined && d.battery <= LOW_BATTERY_THRESHOLD).length,
    totalMessages: deviceList.reduce((sum, d) => sum + d.messageCount, 0),
  };

  return { deviceList, stats, isConnected };
}
