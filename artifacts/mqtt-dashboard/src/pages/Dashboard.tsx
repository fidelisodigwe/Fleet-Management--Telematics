import { ConnectionPanel } from "@/components/ConnectionPanel";
import { MessageFeed } from "@/components/MessageFeed";
import { Link, useLocation } from "wouter";
import { Activity, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [location] = useLocation();

  return (
    <div className="min-h-screen w-full flex flex-col p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight glow-text text-foreground">MQTT Dashboard</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            Real-time telemetry & protocol monitoring
          </p>
        </div>
        
        <div className="flex gap-2 bg-secondary/50 p-1 rounded-lg border border-border/50">
          <Link href="/live-feed">
            <Button variant={location === "/live-feed" ? "secondary" : "ghost"} size="sm" className="w-32">
              <Activity className="w-4 h-4 mr-2" />
              Live Feed
            </Button>
          </Link>
          <Link href="/">
            <Button variant={location === "/" ? "secondary" : "ghost"} size="sm" className="w-32">
              <Gauge className="w-4 h-4 mr-2" />
              Telematics
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
        {/* Left Column: Controls */}
        <div className="w-full lg:w-96 shrink-0 h-full">
          <ConnectionPanel />
        </div>

        {/* Right Column: Data Feed */}
        <div className="flex-1 h-[600px] lg:h-full min-w-0">
          <MessageFeed />
        </div>
      </main>
    </div>
  );
}
