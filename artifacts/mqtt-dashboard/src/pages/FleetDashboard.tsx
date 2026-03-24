import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, Activity, Gauge, Wifi, WifiOff, BatteryLow, Tag,
  Search, MapPin, AlertTriangle, Battery, Hash, MessageSquare
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip as RechartsTooltip } from "recharts";

import { useFleet } from "@/hooks/use-fleet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export default function FleetDashboard() {
  const [location] = useLocation();
  const { deviceList, stats, isConnected } = useFleet();
  const [search, setSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(new Date());

  // Keep 'now' updated for timeago
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const toggleRow = (deviceId: string) => {
    const next = new Set(expandedRows);
    if (next.has(deviceId)) next.delete(deviceId);
    else next.add(deviceId);
    setExpandedRows(next);
  };

  const filteredDevices = useMemo(() => {
    if (!search.trim()) return deviceList;
    const lowerSearch = search.toLowerCase();
    return deviceList.filter(d => 
      d.deviceId.toLowerCase().includes(lowerSearch) || 
      d.topicKey.toLowerCase().includes(lowerSearch)
    );
  }, [deviceList, search]);

  const offlineDevices = deviceList.filter(d => (now.getTime() - d.lastSeen.getTime()) >= ONLINE_THRESHOLD_MS);
  const lowBatteryDevices = deviceList.filter(d => d.battery !== undefined && d.battery <= 20);

  // Map Bounds Calculation
  const mapData = useMemo(() => {
    const devicesWithLocation = deviceList.filter(d => d.lat !== undefined && d.lng !== undefined);
    if (devicesWithLocation.length === 0) return { devices: [], minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    devicesWithLocation.forEach(d => {
      if (d.lat! < minLat) minLat = d.lat!;
      if (d.lat! > maxLat) maxLat = d.lat!;
      if (d.lng! < minLng) minLng = d.lng!;
      if (d.lng! > maxLng) maxLng = d.lng!;
    });
    
    // Add small padding
    const latPad = Math.max((maxLat - minLat) * 0.1, 0.01);
    const lngPad = Math.max((maxLng - minLng) * 0.1, 0.01);
    
    return {
      devices: devicesWithLocation,
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLng: minLng - lngPad,
      maxLng: maxLng + lngPad
    };
  }, [deviceList]);

  // Activity Chart Data (Rolling Window)
  const [activityData, setActivityData] = useState<{ time: string; count: number }[]>([]);
  const [lastTotalMsgs, setLastTotalMsgs] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActivityData(prev => {
        const nowStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        // Instead of true total messages, we should track messages per interval.
        // We'll calculate the difference since last interval.
        // Due to closures, we need a ref or state wrapper, but for simplicity we can estimate
        // active devices or messages. We'll just track unique active devices in the last 5s.
        return [...prev, { time: nowStr, count: 0 }]; // Updated below
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update the last data point with the delta
  useEffect(() => {
    const currentTotal = stats.totalMessages;
    const delta = Math.max(0, currentTotal - lastTotalMsgs);
    
    setActivityData(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], count: delta };
      if (next.length > 20) return next.slice(next.length - 20);
      return next;
    });
    setLastTotalMsgs(currentTotal);
  }, [stats.totalMessages]);

  if (!isConnected) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mb-6 border border-border">
          <Truck className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-3xl font-bold mb-3">Not Connected</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Connect to your MQTT broker and subscribe to <code className="text-primary bg-primary/10 px-1 rounded">/topic/transittag/#</code> to start tracking your fleet.
        </p>
        <Link href="/">
          <Button variant="default">Go to Setup</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col p-4 md:p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight glow-text text-foreground flex items-center gap-3">
            <Truck className="w-8 h-8 text-primary" />
            Fleet Management
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            Real-time tracking · <span className="text-primary/80">/topic/transittag/#</span>
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

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
        <Card className="glass-panel border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/80 flex items-center justify-center border border-border">
              <Tag className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Tags</div>
              <div className="text-2xl font-bold font-mono">{stats.total}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
              <Wifi className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Online</div>
              <div className="text-2xl font-bold font-mono text-green-500">{stats.online}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
              <WifiOff className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Offline</div>
              <div className="text-2xl font-bold font-mono text-destructive">{stats.offline}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
              <BatteryLow className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Low Battery</div>
              <div className="text-2xl font-bold font-mono text-yellow-500">{stats.lowBattery}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Banner */}
      {(offlineDevices.length > 0 || lowBatteryDevices.length > 0) && (
        <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 flex flex-col md:flex-row items-start md:items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 text-yellow-500 font-semibold shrink-0">
            <AlertTriangle className="w-5 h-5" />
            <span>Alerts:</span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {offlineDevices.slice(0, 5).map(d => (
              <Badge key={`off-${d.deviceId}`} variant="outline" className="border-destructive/50 text-destructive bg-destructive/10 font-mono">
                {d.deviceId} (offline)
              </Badge>
            ))}
            {offlineDevices.length > 5 && (
              <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10 font-mono">
                +{offlineDevices.length - 5} more
              </Badge>
            )}
            {lowBatteryDevices.slice(0, 5).map(d => (
              <Badge key={`bat-${d.deviceId}`} variant="outline" className="border-yellow-500/50 text-yellow-500 bg-yellow-500/10 font-mono">
                {d.deviceId} (low bat)
              </Badge>
            ))}
            {lowBatteryDevices.length > 5 && (
              <Badge variant="outline" className="border-yellow-500/50 text-yellow-500 bg-yellow-500/10 font-mono">
                +{lowBatteryDevices.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Left Column: Device Table */}
        <div className="w-full lg:w-3/5 flex flex-col min-h-0 glass-panel border border-border/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 bg-secondary/20">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              Device Roster
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search by device ID..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary h-9 font-mono text-sm"
              />
            </div>
          </div>
          
          {deviceList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Truck className="w-12 h-12 opacity-20 mb-4" />
              <p>Waiting for devices...</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="w-full">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-1/4">Device</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Battery</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold text-right">Messages</th>
                      <th className="px-4 py-3 font-semibold text-right">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredDevices.map(device => {
                        const isDeviceOnline = (now.getTime() - device.lastSeen.getTime()) < ONLINE_THRESHOLD_MS;
                        const isExpanded = expandedRows.has(device.deviceId);
                        
                        return (
                          <motion.Fragment key={device.deviceId}>
                            <motion.tr 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer"
                              onClick={() => toggleRow(device.deviceId)}
                            >
                              <td className="px-4 py-3 font-mono">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDeviceOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-destructive'}`} />
                                  <span className="truncate max-w-[120px]" title={device.deviceId}>{device.deviceId}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {device.status ? (
                                  <Badge variant="outline" className={`text-[10px] ${
                                    device.status.toLowerCase() === 'idle' ? 'text-yellow-500 border-yellow-500/30' : 
                                    device.status.toLowerCase() === 'error' ? 'text-destructive border-destructive/30' : 
                                    'text-primary border-primary/30'
                                  }`}>
                                    {device.status}
                                  </Badge>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                {device.battery !== undefined ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${device.battery > 50 ? 'bg-green-500' : device.battery > 20 ? 'bg-yellow-500' : 'bg-destructive'}`}
                                        style={{ width: `${device.battery}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-xs">{Math.round(device.battery)}%</span>
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {device.lat !== undefined && device.lng !== undefined ? (
                                  <div className="text-muted-foreground">
                                    <span className="text-foreground">{device.lat.toFixed(4)}</span>, {device.lng.toFixed(4)}
                                    {device.speed !== undefined && <span className="ml-2 text-primary">{device.speed.toFixed(0)}km/h</span>}
                                  </div>
                                ) : <span className="text-muted-foreground">No GPS</span>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Badge variant="secondary" className="font-mono bg-secondary/50">
                                  {device.messageCount}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(device.lastSeen, { addSuffix: true })}
                              </td>
                            </motion.tr>
                            {isExpanded && (
                              <tr className="bg-background/40">
                                <td colSpan={6} className="px-4 py-4 border-b border-border/50">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="text-xs uppercase text-muted-foreground font-semibold mb-2 flex items-center gap-2">
                                        <Tag className="w-3 h-3" /> Topic
                                      </h4>
                                      <div className="bg-black/50 p-2 rounded border border-border/50 font-mono text-xs break-all text-primary/80">
                                        {device.topicKey}
                                      </div>
                                    </div>
                                    {device.rawPayload && (
                                      <div>
                                        <h4 className="text-xs uppercase text-muted-foreground font-semibold mb-2 flex items-center gap-2">
                                          <MessageSquare className="w-3 h-3" /> Last Payload
                                        </h4>
                                        <div className="bg-black/50 p-2 rounded border border-border/50 font-mono text-xs max-h-32 overflow-y-auto">
                                          <pre className="text-[10px] text-muted-foreground m-0">
                                            {(() => {
                                              try {
                                                return JSON.stringify(JSON.parse(device.rawPayload), null, 2);
                                              } catch {
                                                return device.rawPayload;
                                              }
                                            })()}
                                          </pre>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </motion.Fragment>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right Column: Map + Chart */}
        <div className="w-full lg:w-2/5 flex flex-col gap-6 min-h-[600px] lg:min-h-0">
          
          {/* Fleet Map */}
          <Card className="glass-panel border-border/50 flex-1 flex flex-col overflow-hidden min-h-[300px]">
            <div className="p-3 border-b border-border/50 bg-secondary/20 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Live Fleet Map
              </h3>
              <div className="flex gap-3 text-xs">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Online</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive"></span> Offline</div>
              </div>
            </div>
            <div className="flex-1 relative bg-[#0a0a0c] overflow-hidden">
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ 
                backgroundImage: 'linear-gradient(rgba(13, 148, 136, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(13, 148, 136, 0.2) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                backgroundPosition: 'center center'
              }}></div>
              
              {mapData.devices.length > 0 ? (
                <>
                  {mapData.devices.map(device => {
                    if (device.lat === undefined || device.lng === undefined) return null;
                    
                    // Normalize position 0-100%
                    const x = ((device.lng - mapData.minLng) / (mapData.maxLng - mapData.minLng)) * 100;
                    const y = ((device.lat - mapData.minLat) / (mapData.maxLat - mapData.minLat)) * 100;
                    // Invert Y because latitude increases upwards, but CSS top increases downwards
                    const invertedY = 100 - y;
                    
                    const isDeviceOnline = (now.getTime() - device.lastSeen.getTime()) < ONLINE_THRESHOLD_MS;

                    return (
                      <Tooltip key={`map-${device.deviceId}`} delayDuration={100}>
                        <TooltipTrigger asChild>
                          <div 
                            className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full cursor-pointer hover:scale-150 transition-transform z-10"
                            style={{ 
                              left: `${x}%`, 
                              top: `${invertedY}%`,
                              backgroundColor: isDeviceOnline ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
                              boxShadow: `0 0 10px ${isDeviceOnline ? 'hsla(var(--primary)/0.8)' : 'hsla(var(--destructive)/0.8)'}`,
                              border: '2px solid hsl(var(--background))'
                            }}
                          >
                            {isDeviceOnline && (
                              <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75"></div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="glass-panel border-border/50 text-xs p-2 space-y-1">
                          <div className="font-bold text-sm mb-1">{device.deviceId}</div>
                          {device.battery !== undefined && <div>Battery: {Math.round(device.battery)}%</div>}
                          {device.speed !== undefined && <div>Speed: {device.speed.toFixed(0)} km/h</div>}
                          <div className="text-muted-foreground font-mono mt-1">
                            {device.lat.toFixed(4)}, {device.lng.toFixed(4)}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <MapPin className="w-12 h-12 opacity-20 mb-2" />
                  <p className="text-sm">No GPS data available</p>
                </div>
              )}
            </div>
          </Card>

          {/* Activity Chart */}
          <Card className="glass-panel border-border/50 h-64 flex flex-col shrink-0">
            <div className="p-3 border-b border-border/50 bg-secondary/20 shrink-0">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" /> Message Activity
              </h3>
            </div>
            <div className="flex-1 p-2 min-h-0">
              {activityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={30}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorActivity)" 
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  Waiting for activity...
                </div>
              )}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
