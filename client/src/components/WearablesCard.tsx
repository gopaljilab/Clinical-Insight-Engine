import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/apiClient";
import { Loader2, Activity, Heart, Moon, Watch } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";

interface WearableDevice {
  id: number;
  deviceType: string;
  lastSyncAt: string | null;
}

interface WearableMetric {
  id: number;
  date: string;
  steps: number;
  averageHeartRate: number;
  sleepHours: number;
}

export function WearablesCard() {
  const [devices, setDevices] = useState<WearableDevice[]>([]);
  const [metrics, setMetrics] = useState<WearableMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, metricsRes] = await Promise.all([
        ApiClient.requestRaw("/api/patient/wearables/status"),
        ApiClient.requestRaw("/api/patient/wearables/metrics"),
      ]);

      if (statusRes.ok && metricsRes.ok) {
        const statusData = await statusRes.json();
        const metricsData = await metricsRes.json();
        setDevices(statusData.devices || []);
        
        // Reverse metrics so chronological order for chart
        const sortedMetrics = (metricsData.metrics || []).sort(
          (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setMetrics(sortedMetrics);
      }
    } catch (error) {
      console.error("Failed to fetch wearable data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (deviceType: string) => {
    setConnecting(deviceType);
    try {
      const res = await ApiClient.requestRaw("/api/patient/wearables/connect", "POST", { deviceType });
      if (res.ok) {
        toast({
          title: "Device Connected",
          description: `Successfully connected to ${deviceType === 'apple_health' ? 'Apple Health' : 'Fitbit'}.`,
        });
        fetchData();
      } else {
        throw new Error("Failed to connect");
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Could not connect the device. Please try again.",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await ApiClient.requestRaw("/api/patient/wearables/sync", "POST");
      if (res.ok) {
        toast({
          title: "Sync Complete",
          description: "Wearable data has been successfully updated.",
        });
        fetchData();
      } else {
        throw new Error("Failed to sync");
      }
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Could not sync data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = devices.length > 0;
  
  const chartData = metrics.map(m => ({
    ...m,
    formattedDate: format(new Date(m.date), "MMM d")
  }));

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Watch className="h-5 w-5" />
              Wearable Devices
            </CardTitle>
            <CardDescription>
              Connect your smartwatch or fitness tracker to sync health data
            </CardDescription>
          </div>
          {isConnected && (
            <Button 
              variant="outline" 
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
              {syncing ? "Syncing..." : "Sync Data"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/20">
            <Watch className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Devices Connected</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Connect your wearable device to automatically sync steps, heart rate, and sleep data for better health insights.
            </p>
            <div className="flex gap-4">
              <Button 
                onClick={() => handleConnect("apple_health")}
                disabled={connecting !== null}
              >
                {connecting === "apple_health" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Connect Apple Health
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleConnect("fitbit")}
                disabled={connecting !== null}
              >
                {connecting === "fitbit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Connect Fitbit
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Latest Steps</p>
                    <p className="text-2xl font-bold">
                      {metrics.length > 0 ? metrics[metrics.length - 1].steps.toLocaleString() : "--"}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500 opacity-75" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Avg Heart Rate</p>
                    <p className="text-2xl font-bold">
                      {metrics.length > 0 ? `${metrics[metrics.length - 1].averageHeartRate} bpm` : "--"}
                    </p>
                  </div>
                  <Heart className="h-8 w-8 text-red-500 opacity-75" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Sleep</p>
                    <p className="text-2xl font-bold">
                      {metrics.length > 0 ? `${metrics[metrics.length - 1].sleepHours} hrs` : "--"}
                    </p>
                  </div>
                  <Moon className="h-8 w-8 text-indigo-500 opacity-75" />
                </CardContent>
              </Card>
            </div>

            {metrics.length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-4">Activity Trends (Last 7 Days)</h4>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="formattedDate" fontSize={12} tickMargin={10} />
                      <YAxis yAxisId="left" fontSize={12} orientation="left" />
                      <YAxis yAxisId="right" fontSize={12} orientation="right" />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="steps" stroke="#3b82f6" name="Steps" strokeWidth={2} dot={{ r: 4 }} />
                      <Line yAxisId="right" type="monotone" dataKey="averageHeartRate" stroke="#ef4444" name="Heart Rate (bpm)" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            <div className="text-sm text-muted-foreground text-center">
              Last synced: {devices[0].lastSyncAt ? new Date(devices[0].lastSyncAt).toLocaleString() : 'Never'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
