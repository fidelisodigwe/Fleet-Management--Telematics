import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Activity, Power, Unplug, Server, User, Key, Hash, Info, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "@/components/ui/badge";
import { useMqtt } from "@/hooks/use-mqtt";
import { useToast } from "@/hooks/use-toast";
import { MqttConnectRequest } from "@workspace/api-client-react";

const connectSchema = z.object({
  brokerUrl: z.string().url("Must be a valid URL (e.g. mqtt://broker.hivemq.com:1883)"),
  username: z.string().optional(),
  password: z.string().optional(),
  clientId: z.string().optional(),
});

type ConnectFormValues = z.infer<typeof connectSchema>;

export function ConnectionPanel() {
  const { status, connect, disconnect, subscribe } = useMqtt();
  const { toast } = useToast();
  const [topicInput, setTopicInput] = useState("");

  const isConnected = status.data?.connected ?? false;

  const form = useForm<ConnectFormValues>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      brokerUrl: "mqtt://byte-iot.net",
      username: "wayne123",
      password: "",
      clientId: `web_client_${Math.random().toString(16).slice(2, 8)}`,
    },
  });

  // Reset form when already connected to match current server state (optional, just good UX)
  useEffect(() => {
    if (status.data?.brokerUrl) {
      form.setValue("brokerUrl", status.data.brokerUrl);
    }
    if (status.data?.clientId) {
      form.setValue("clientId", status.data.clientId);
    }
  }, [status.data?.brokerUrl, status.data?.clientId, form]);

  const onConnect = (values: ConnectFormValues) => {
    connect.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({
            title: "Connected",
            description: `Successfully connected to ${values.brokerUrl}`,
          });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Connection Failed",
            description: err?.error?.error || err.message || "Failed to connect to broker",
          });
        },
      }
    );
  };

  const onDisconnect = () => {
    disconnect.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Disconnected",
          description: "Disconnected from the MQTT broker",
        });
      },
    });
  };

  const onSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;

    subscribe.mutate(
      { data: { topic: topicInput.trim() } },
      {
        onSuccess: () => {
          setTopicInput("");
          toast({
            title: "Subscribed",
            description: `Now listening to ${topicInput}`,
          });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Subscription Failed",
            description: err?.error?.error || err.message,
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm h-full overflow-y-auto pr-2 pb-8">
      
      {/* Status Card */}
      <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="w-6 h-6 text-muted-foreground" />
            <span 
              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${
                isConnected ? "bg-primary animate-pulse" : "bg-destructive"
              }`} 
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">STATUS</h2>
            <p className={`text-lg font-bold ${isConnected ? "text-primary glow-text" : "text-destructive"}`}>
              {isConnected ? "CONNECTED" : "DISCONNECTED"}
            </p>
          </div>
        </div>
      </div>

      {/* Connection Form */}
      <div className="glass-panel p-5 rounded-xl flex flex-col gap-4 relative overflow-hidden">
        {isConnected && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4">
            <Badge variant="outline" className="px-4 py-1.5 text-sm bg-background/80">
              <Server className="w-4 h-4 mr-2" />
              {status.data?.brokerUrl}
            </Badge>
            <Button variant="destructive" onClick={onDisconnect} disabled={disconnect.isPending}>
              <Unplug className="w-4 h-4 mr-2" />
              {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <Power className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Connection</h3>
        </div>

        <form onSubmit={form.handleSubmit(onConnect)} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" /> Broker URL
            </label>
            <Input
              placeholder="mqtt://broker.example.com:1883"
              {...form.register("brokerUrl")}
              className={form.formState.errors.brokerUrl ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {form.formState.errors.brokerUrl && (
              <p className="text-[10px] text-destructive">{form.formState.errors.brokerUrl.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Username
              </label>
              <Input placeholder="Optional" {...form.register("username")} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" /> Password
              </label>
              <Input type="password" placeholder="Optional" {...form.register("password")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" /> Client ID
            </label>
            <Input placeholder="Auto-generated if empty" {...form.register("clientId")} />
          </div>

          <Button type="submit" className="w-full mt-2" disabled={connect.isPending || isConnected}>
            {connect.isPending ? "Connecting..." : "Connect to Broker"}
          </Button>
        </form>
      </div>

      {/* Subscriptions */}
      <div className={`glass-panel p-5 rounded-xl flex flex-col gap-4 transition-opacity duration-300 ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Subscriptions</h3>
        </div>

        <form onSubmit={onSubscribe} className="flex gap-2">
          <Input 
            placeholder="e.g. sensors/temp/#" 
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
          />
          <Button type="submit" size="icon" disabled={subscribe.isPending || !topicInput.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </form>

        <div className="flex flex-wrap gap-2 mt-2">
          {!status.data?.subscribedTopics?.length ? (
            <p className="text-xs text-muted-foreground italic w-full text-center py-4 bg-background/30 rounded-lg border border-border/30">
              No active subscriptions
            </p>
          ) : (
            status.data.subscribedTopics.map((topic) => (
              <Badge key={topic} variant="secondary" className="px-3 py-1 text-xs font-mono bg-secondary/50 border border-border/50">
                {topic}
              </Badge>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
