import { useMemo, useState, useEffect } from "react";
import { useMqtt, MqttMessage } from "./use-mqtt";

export interface DeviceState {
  battery?: number;       // 0-100
  lat?: number;
  lng?: number;
  ssid?: string;
  rssi?: number;          // typically -30 to -90 dBm
  temperature?: number;
  humidity?: number;
  speed?: number;
  altitude?: number;
  deviceId?: string;
  status?: string;
  extras: Record<string, unknown>;
}

export interface BatteryReading {
  timestamp: number;
  value: number;
}

// Helper to safely get nested property
const getNested = (obj: any, path: string) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// Helper to check aliases and find the first match
const findField = (obj: any, aliases: string[]) => {
  for (const alias of aliases) {
    const val = getNested(obj, alias);
    if (val !== undefined) return val;
  }
  return undefined;
};

export function useTelematics() {
  const { messages, status: mqttStatus } = useMqtt();
  
  const isConnected = mqttStatus.data?.connected ?? false;
  
  const [deviceState, setDeviceState] = useState<DeviceState>({ extras: {} });
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [batteryHistory, setBatteryHistory] = useState<BatteryReading[]>([]);
  
  // Keep track of the last processed message to avoid re-processing
  const [lastProcessedIndex, setLastProcessedIndex] = useState(-1);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    
    // Process new messages
    const newMessages = messages.slice(lastProcessedIndex + 1);
    if (newMessages.length === 0) return;

    let latestState = { ...deviceState };
    let latestExtras = { ...latestState.extras };
    let newBatteryHistory = [...batteryHistory];
    let latestTimestamp = lastSeen;

    for (const msg of newMessages) {
      try {
        const payload = JSON.parse(msg.payload);
        if (!payload || typeof payload !== 'object') continue;

        // Parse fields based on common aliases
        const battery = findField(payload, ['battery', 'bat', 'battery_level', 'batt', 'batteryLevel']);
        const lat = findField(payload, ['lat', 'latitude', 'gps_lat', 'location.lat']);
        const lng = findField(payload, ['lng', 'lon', 'longitude', 'gps_lng', 'location.lng']);
        const ssid = findField(payload, ['ssid', 'wifi_ssid', 'wifi.ssid', 'network']);
        const rssi = findField(payload, ['rssi', 'wifi_rssi', 'signal', 'wifi_signal', 'signalStrength']);
        const temperature = findField(payload, ['temp', 'temperature']);
        const humidity = findField(payload, ['humidity', 'hum']);
        const speed = findField(payload, ['speed', 'gps_speed']);
        const altitude = findField(payload, ['altitude', 'alt']);
        const deviceId = findField(payload, ['device_id', 'deviceId', 'id', 'imei']);
        const deviceStatus = findField(payload, ['status', 'device_status']);

        if (battery !== undefined) {
          latestState.battery = Number(battery);
          newBatteryHistory.push({ timestamp: new Date(msg.timestamp).getTime(), value: Number(battery) });
          // Keep last 20
          if (newBatteryHistory.length > 20) {
            newBatteryHistory = newBatteryHistory.slice(newBatteryHistory.length - 20);
          }
        }
        if (lat !== undefined) latestState.lat = Number(lat);
        if (lng !== undefined) latestState.lng = Number(lng);
        if (ssid !== undefined) latestState.ssid = String(ssid);
        if (rssi !== undefined) latestState.rssi = Number(rssi);
        if (temperature !== undefined) latestState.temperature = Number(temperature);
        if (humidity !== undefined) latestState.humidity = Number(humidity);
        if (speed !== undefined) latestState.speed = Number(speed);
        if (altitude !== undefined) latestState.altitude = Number(altitude);
        if (deviceId !== undefined) latestState.deviceId = String(deviceId);
        if (deviceStatus !== undefined) latestState.status = String(deviceStatus);

        // Collect extras (everything else)
        const knownKeys = new Set([
          'battery', 'bat', 'battery_level', 'batt', 'batteryLevel',
          'lat', 'latitude', 'gps_lat', 'location',
          'lng', 'lon', 'longitude', 'gps_lng',
          'ssid', 'wifi_ssid', 'wifi', 'network',
          'rssi', 'wifi_rssi', 'signal', 'wifi_signal', 'signalStrength',
          'temp', 'temperature',
          'humidity', 'hum',
          'speed', 'gps_speed',
          'altitude', 'alt',
          'device_id', 'deviceId', 'id', 'imei',
          'status', 'device_status'
        ]);

        for (const [key, value] of Object.entries(payload)) {
          if (!knownKeys.has(key)) {
            latestExtras[key] = value;
          }
        }
        
        latestTimestamp = new Date(msg.timestamp);

      } catch (err) {
        // Not JSON or parse error, ignore
      }
    }

    latestState.extras = latestExtras;
    setDeviceState(latestState);
    if (latestTimestamp) setLastSeen(latestTimestamp);
    setMessageCount(prev => prev + newMessages.length);
    setBatteryHistory(newBatteryHistory);
    setLastProcessedIndex(messages.length - 1);

  }, [messages, deviceState, batteryHistory, lastSeen, lastProcessedIndex]);

  // Reset when messages are cleared
  useEffect(() => {
    if (messages.length === 0 && lastProcessedIndex > -1) {
      setDeviceState({ extras: {} });
      setLastSeen(null);
      setMessageCount(0);
      setBatteryHistory([]);
      setLastProcessedIndex(-1);
    }
  }, [messages, lastProcessedIndex]);

  return {
    deviceState,
    lastSeen,
    messageCount,
    batteryHistory,
    isConnected
  };
}
