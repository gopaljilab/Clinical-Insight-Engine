import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Mail, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/apiClient";

export default function Settings() {
  const { toast } = useToast();
  const [reportFrequency, setReportFrequency] = useState<"none" | "daily" | "weekly">("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Clinical Insight Engine - Settings";
    
    // Fetch current settings
    ApiClient.get("/api/settings")
      .then((data: any) => {
        if (data && data.reportFrequency) {
          setReportFrequency(data.reportFrequency);
        }
      })
      .catch((err) => {
        toast({
          title: "Failed to load settings",
          description: err.message || "An error occurred while loading settings",
          variant: "destructive",
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ApiClient.requestRaw("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportFrequency }),
      });
      toast({
        title: "Settings saved",
        description: "Your report preferences have been updated successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to save settings",
        description: err.message || "An error occurred while saving",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <SettingsIcon className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Settings</h1>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-500" />
                <CardTitle>Email Reports</CardTitle>
              </div>
              <CardDescription>
                Schedule automated summary email reports containing high-level patient metrics like total assessments, new high-risk patients, and cohort trends.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Report Frequency
                  </label>
                  <select
                    className="w-full max-w-md rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={reportFrequency}
                    onChange={(e) => setReportFrequency(e.target.value as any)}
                  >
                    <option value="none">None (Do not send reports)</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {reportFrequency === "daily" && "You will receive a summary email every day at 8:00 AM."}
                    {reportFrequency === "weekly" && "You will receive a summary email every Monday at 8:00 AM."}
                    {reportFrequency === "none" && "You will not receive any summary emails."}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-slate-100 dark:border-gray-800 pt-6">
              <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
