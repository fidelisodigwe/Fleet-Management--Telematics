import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  Battery, BatteryFull, BatteryLow, MapPin, Wifi, WifiOff, 
  Thermometer, Droplets, Gauge, Mountain, Activity, 
  Radio, Clock, Signal, Copy, Check, ExternalLink, Hash, Truck
} from "lucide-react";
import { 
  LineChart, Line, AreaChart, Area, ResponsiveContainer 
} from "recharts";

import { useTelematics } from "@/hooks/use-telematics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectionPanel } from "@/components/ConnectionPanel";
import { Link, useLocation } from "wouter";

export default function TelematicsDashboard() {
  const [location] = useLocation();
  const { 
    deviceState, 
    lastSeen, 
    messageCount, 
    batteryHistory, 
    isConnected 
  } = useTelematics();

  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(new Date());

  // Force re-render every minute for timeago
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOnline = lastSeen ? (now.getTime() - lastSeen.getTime()) < 60000 : false;
  
  const hasData = messageCount > 0;

  // Battery color determination
  const getBatteryColor = (level?: number) => {
    if (level === undefined) return "text-muted-foreground";
    if (level > 50) return "text-green-500";
    if (level > 20) return "text-yellow-500";
    return "text-destructive";
  };

  const getBatteryStroke = (level?: number) => {
    if (level === undefined) return "hsl(var(--muted-foreground))";
    if (level > 50) return "#22c55e";
    if (level > 20) return "#eab308";
    return "hsl(var(--destructive))";
  };

  // Battery radial calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const batteryPct = deviceState.battery !== undefined ? deviceState.battery : 0;
  const strokeDashoffset = circumference - (batteryPct / 100) * circumference;

  return (
    <div className="min-h-screen w-full flex flex-col p-4 md:p-6 lg:p-8 overflow-y-auto">
      {/* Header & Nav */}
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight glow-text text-foreground flex items-center gap-3">
            <Radio className="w-8 h-8 text-primary" />
            Telematics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            Device state & telemetry visualization
          </p>
        </div>
        
        <div className="flex gap-2 bg-secondary/50 p-1 rounded-lg border border-border/50 overflow-x-auto">
          <Link href="/live-feed">
            <Button variant={location === "/live-feed" ? "secondary" : "ghost"} size="sm" className="w-32 shrink-0">
              <Activity className="w-4 h-4 mr-2" />
              Live Feed
            </Button>
          </Link>
          <Link href="/">
            <Button variant={location === "/" ? "secondary" : "ghost"} size="sm" className="w-32 shrink-0">
              <Gauge className="w-4 h-4 mr-2" />
              Telematics
            </Button>
          </Link>
          <Link href="/fleet">
            <Button variant={location === "/fleet" ? "secondary" : "ghost"} size="sm" className="w-32 shrink-0">
              <Truck className="w-4 h-4 mr-2" />
              Fleet
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Controls (hidden on mobile, expandable) */}
        <div className="hidden lg:block w-96 shrink-0 h-[600px]">
          <ConnectionPanel />
        </div>

        {/* Right Column: Dashboard grid */}
        <div className="flex-1">
          {!isConnected || !hasData ? (
            <div className="glass-panel rounded-xl border border-border/50 flex flex-col items-center justify-center h-[600px] text-center p-8">
              <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-6 border border-border">
                {!isConnected ? (
                  <WifiOff className="w-10 h-10 text-muted-foreground" />
                ) : (
                  <Activity className="w-10 h-10 text-primary animate-pulse" />
                )}
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {!isConnected ? "Not Connected" : "Waiting for data"}
              </h2>
              <p className="text-muted-foreground max-w-md">
                {!isConnected 
                  ? "Connect to a broker and subscribe to a topic to see device telemetry." 
                  : "Connected and listening. Publish messages with JSON payloads to populate the dashboard."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Device Header Info */}
              <div className="glass-panel p-4 md:p-6 rounded-xl border border-border/50 flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${isOnline ? 'bg-primary/10 border-primary/30' : 'bg-muted border-border'}`}>
                      <Hash className={`w-6 h-6 ${isOnline ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    {isOnline && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background bg-green-500 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {deviceState.deviceId || "Unknown Device"}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={isOnline ? "default" : "secondary"} className={isOnline ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20" : ""}>
                        {isOnline ? "ONLINE" : "OFFLINE"}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last seen: {lastSeen ? formatDistanceToNow(lastSeen, { addSuffix: true }) : "Never"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="flex flex-col items-end">
                    <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Messages</span>
                    <span className="font-mono font-bold text-lg">{messageCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Grid Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* 1. Battery Widget */}
                <Card className="glass-panel border-border/50 overflow-hidden relative">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
                      <Battery className="w-4 h-4" /> Battery
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center pt-2">
                    <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                      {/* Radial progress background */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r={radius}
                          fill="transparent"
                          stroke="hsl(var(--secondary))"
                          strokeWidth="12"
                        />
                        {/* Radial progress foreground */}
                        {deviceState.battery !== undefined && (
                          <circle
                            cx="64"
                            cy="64"
                            r={radius}
                            fill="transparent"
                            stroke={getBatteryStroke(deviceState.battery)}
                            strokeWidth="12"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                          />
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-3xl font-bold ${getBatteryColor(deviceState.battery)}`}>
                          {deviceState.battery !== undefined ? `${Math.round(deviceState.battery)}%` : "--"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-full h-12 opacity-50">
                      {batteryHistory.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={batteryHistory}>
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke={getBatteryStroke(deviceState.battery)} 
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          Not enough history
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Location Widget */}
                <Card className="glass-panel border-border/50 lg:col-span-2 overflow-hidden flex flex-col">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location
                    </CardTitle>
                    {deviceState.lat !== undefined && deviceState.lng !== undefined && (
                      <a 
                        href={`https://maps.google.com/?q=${deviceState.lat},${deviceState.lng}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Open in Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-4">
                    {deviceState.lat !== undefined && deviceState.lng !== undefined ? (
                      <>
                        <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg border border-border/50">
                          <div className="flex-1 font-mono text-sm">
                            {deviceState.lat.toFixed(6)}, {deviceState.lng.toFixed(6)}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(`${deviceState.lat}, ${deviceState.lng}`)}
                          >
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                        {/* Fake Map */}
                        <div className="relative flex-1 min-h-[140px] bg-secondary/20 rounded-lg border border-border overflow-hidden">
                          <div className="absolute inset-0" style={{ 
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                          }}></div>
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                              <MapPin className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]" />
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 min-h-[180px]">
                        <MapPin className="w-8 h-8 opacity-20" />
                        <span>No location data</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 3. WiFi Widget */}
                <Card className="glass-panel border-border/50 flex flex-col justify-center">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center gap-4">
                      {deviceState.ssid || deviceState.rssi !== undefined ? (
                        <>
                          <div className="flex gap-1 h-12 items-end">
                            {[1, 2, 3, 4, 5].map((bar) => {
                              const rssi = deviceState.rssi ?? -100;
                              let bars = 1;
                              if (rssi >= -50) bars = 5;
                              else if (rssi >= -60) bars = 4;
                              else if (rssi >= -70) bars = 3;
                              else if (rssi >= -80) bars = 2;
                              
                              const isActive = bar <= bars;
                              
                              return (
                                <div 
                                  key={bar} 
                                  className={`w-3 rounded-t-sm transition-all duration-300 ${isActive ? 'bg-primary shadow-[0_0_8px_rgba(0,255,255,0.5)]' : 'bg-secondary'}`}
                                  style={{ height: `${bar * 20}%` }}
                                />
                              );
                            })}
                          </div>
                          <div>
                            <div className="font-bold text-xl mb-1">{deviceState.ssid || "Unknown Network"}</div>
                            <Badge variant="outline" className="font-mono">
                              {deviceState.rssi !== undefined ? `${deviceState.rssi} dBm` : "No RSSI"}
                            </Badge>
                          </div>
                        </>
                      ) : (
                        <div className="py-8 flex flex-col items-center text-muted-foreground gap-2">
                          <WifiOff className="w-8 h-8 opacity-20" />
                          <span>No network data</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Env Widget */}
                <Card className="glass-panel border-border/50 flex flex-col justify-center">
                  <CardContent className="pt-6 p-0 h-full">
                    <div className="grid grid-cols-2 h-full divide-x divide-border/50">
                      <div className="flex flex-col items-center justify-center p-4 gap-2">
                        <Thermometer className="w-8 h-8 text-orange-500" />
                        <div className="text-3xl font-bold">
                          {deviceState.temperature !== undefined ? `${deviceState.temperature.toFixed(1)}°` : "--"}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">Temp</div>
                      </div>
                      <div className="flex flex-col items-center justify-center p-4 gap-2">
                        <Droplets className="w-8 h-8 text-blue-500" />
                        <div className="text-3xl font-bold">
                          {deviceState.humidity !== undefined ? `${deviceState.humidity.toFixed(0)}%` : "--"}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">Humidity</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 5. Speed / Alt Widget */}
                <Card className="glass-panel border-border/50 flex flex-col justify-center">
                  <CardContent className="pt-6 p-0 h-full">
                    <div className="grid grid-cols-2 h-full divide-x divide-border/50">
                      <div className="flex flex-col items-center justify-center p-4 gap-2">
                        <Gauge className="w-8 h-8 text-primary" />
                        <div className="text-3xl font-bold">
                          {deviceState.speed !== undefined ? deviceState.speed.toFixed(0) : "--"}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">km/h</div>
                      </div>
                      <div className="flex flex-col items-center justify-center p-4 gap-2">
                        <Mountain className="w-8 h-8 text-purple-500" />
                        <div className="text-3xl font-bold">
                          {deviceState.altitude !== undefined ? deviceState.altitude.toFixed(0) : "--"}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">Meters</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 6. Status Widget */}
                <Card className="glass-panel border-border/50 flex flex-col justify-center">
                  <CardHeader className="pb-2 text-center">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase">
                      Device Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center pt-0 pb-6">
                    {deviceState.status ? (
                      <Badge variant="outline" className={`text-lg px-4 py-2 uppercase tracking-widest ${
                        deviceState.status.toLowerCase() === 'error' || deviceState.status.toLowerCase() === 'fault'
                          ? 'border-destructive text-destructive'
                          : deviceState.status.toLowerCase() === 'idle'
                          ? 'border-yellow-500 text-yellow-500'
                          : 'border-primary text-primary shadow-[0_0_10px_rgba(0,255,255,0.2)]'
                      }`}>
                        {deviceState.status}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">No status reported</span>
                    )}
                  </CardContent>
                </Card>

                {/* 7. Live Data Stream */}
                <Card className="glass-panel border-border/50 lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Battery Stream
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 w-full">
                      {batteryHistory.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={batteryHistory} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <Area 
                              type="monotone" 
                              dataKey="value" 
                              stroke="hsl(var(--primary))" 
                              fillOpacity={1} 
                              fill="url(#colorValue)" 
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-secondary/20 rounded-lg border border-border/50 border-dashed">
                          Waiting for stream data...
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 8. Extra Fields */}
                <Card className="glass-panel border-border/50 lg:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
                      <Signal className="w-4 h-4" /> Additional Telemetry
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(deviceState.extras).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(deviceState.extras).map(([key, val]) => (
                          <div key={key} className="bg-secondary/30 p-3 rounded-lg border border-border/50 flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground font-mono">{key}</span>
                            <span className="font-mono text-sm font-bold truncate">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm italic">
                        No additional telemetry fields found
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
