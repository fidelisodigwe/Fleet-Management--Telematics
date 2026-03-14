import { useEffect, useRef } from "react";
import { Terminal, Trash2, Clock, Hash } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { Badge } from "@/components/ui/badge";
import { useMqtt, MqttMessage } from "@/hooks/use-mqtt";

// Utility to attempt pretty printing JSON payloads
function formatPayload(payload: string) {
  try {
    const obj = JSON.parse(payload);
    return JSON.stringify(obj, null, 2);
  } catch {
    return payload;
  }
}

export function MessageFeed() {
  const { messages, clearMessages, status } = useMqtt();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isConnected = status.data?.connected ?? false;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  return (
    <div className="flex-1 h-full flex flex-col glass-panel rounded-xl overflow-hidden border border-border/40 shadow-2xl">
      {/* Header */}
      <div className="h-14 border-b border-border/40 bg-background/40 backdrop-blur-md flex items-center justify-between px-5 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg tracking-tight">Live Event Feed</h2>
          <Badge variant="outline" className="ml-2 bg-background/50 font-mono text-[10px]">
            {messages.length} messages
          </Badge>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearMessages}
          disabled={messages.length === 0}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear
        </Button>
      </div>

      {/* Feed Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-5 font-mono text-sm bg-[#0a0a0c]"
      >
        {!isConnected && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-50">
            <Terminal className="w-16 h-16" />
            <p>Connect to a broker to start receiving messages</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-50">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-primary/20 rounded-full animate-[spin_3s_linear_infinite]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              </div>
            </div>
            <p>Waiting for messages on subscribed topics...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const date = new Date(msg.timestamp);
                const isJson = msg.payload.startsWith('{') || msg.payload.startsWith('[');
                
                return (
                  <motion.div
                    key={`${msg.timestamp}-${idx}`}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="group flex flex-col gap-1.5 p-3 rounded-md bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 text-primary/80">
                        <Clock className="w-3.5 h-3.5" />
                        {format(date, 'HH:mm:ss.SSS')}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-foreground/80">
                        <Hash className="w-3.5 h-3.5 text-primary/50" />
                        {msg.topic}
                      </span>
                    </div>
                    <div className={`mt-1 text-foreground/90 whitespace-pre-wrap break-all ${isJson ? 'text-primary/90' : ''}`}>
                      {formatPayload(msg.payload)}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={bottomRef} className="h-1" />
          </div>
        )}
      </div>
    </div>
  );
}
