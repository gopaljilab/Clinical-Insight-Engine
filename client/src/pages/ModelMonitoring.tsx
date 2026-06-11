import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Activity, Brain, RefreshCw, Clock, TrendingUp, Target,
  CheckCircle2, XCircle, Loader2, BarChart3, Database,
  AlertTriangle, ArrowUpDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";

type ModelVersion = {
  id: number;
  version: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1Score: number | null;
  aucRoc: number | null;
  datasetHash: string | null;
  numSamples: number | null;
  numFeatures: number | null;
  classBalance: Record<string, number> | null;
  featureDistributions: Record<string, { mean: number; std: number }> | null;
  trainingDurationMs: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

type DatasetStats = {
  classBalance: Record<string, number>;
  featureStats: Record<string, { mean: number; std: number }>;
  totalSamples: number;
};

function MetricCard({ title, value, icon: Icon, suffix, color }: {
  title: string;
  value: string | number;
  icon: any;
  suffix?: string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">
          {value ?? "—"}
          {suffix && <span className="text-sm font-normal text-slate-400 ml-1">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge className="bg-green-100 text-green-700 border-green-200">Completed</Badge>;
  if (status === "training") return <Badge variant="secondary" className="animate-pulse">Training…</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function ScoreBar({ label, value, maxValue = 1 }: { label: string; value: number | null; maxValue?: number }) {
  const pct = value !== null ? Math.round((value / maxValue) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-bold text-slate-800">{value !== null ? value.toFixed(4) : "—"}</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function RetrainDialog({ onConfirm, isTraining }: { onConfirm: () => void; isTraining: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={isTraining} className="gap-2">
          {isTraining ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isTraining ? "Retraining…" : "Retrain Model"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Model Retraining</DialogTitle>
          <DialogDescription>
            This will re-train the logistic regression model on the full dataset.
            Existing model file will be replaced. Predictions may change slightly.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <span>Retraining may take a few seconds. Predictions will be temporarily unavailable.</span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onConfirm(); setOpen(false); }}>Start Retraining</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricsTab({ versions }: { versions: ModelVersion[] }) {
  const latest = versions[0];

  if (!latest) {
    return (
      <EmptyState
        icon={Brain}
        title="No Model Versions"
        description="Train the model to see performance metrics."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard title="Accuracy" value={latest.accuracy !== null ? (latest.accuracy * 100).toFixed(1) : "—"} icon={Target} suffix="%" color="text-blue-600" />
        <MetricCard title="Precision" value={latest.precision !== null ? (latest.precision * 100).toFixed(1) : "—"} icon={TrendingUp} suffix="%" color="text-emerald-600" />
        <MetricCard title="Recall" value={latest.recall !== null ? (latest.recall * 100).toFixed(1) : "—"} icon={Activity} suffix="%" color="text-violet-600" />
        <MetricCard title="F1 Score" value={latest.f1Score !== null ? (latest.f1Score * 100).toFixed(1) : "—"} icon={Target} suffix="%" color="text-amber-600" />
        <MetricCard title="AUC-ROC" value={latest.aucRoc !== null ? latest.aucRoc.toFixed(4) : "—"} icon={BarChart3} color="text-rose-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metric Scores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScoreBar label="Accuracy" value={latest.accuracy} />
          <ScoreBar label="Precision" value={latest.precision} />
          <ScoreBar label="Recall" value={latest.recall} />
          <ScoreBar label="F1 Score" value={latest.f1Score} />
          {latest.aucRoc !== null && <ScoreBar label="AUC-ROC" value={latest.aucRoc} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Version</dt>
              <dd className="font-semibold">v{latest.version}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd><StatusBadge status={latest.status} /></dd>
            </div>
            <div>
              <dt className="text-slate-500">Samples</dt>
              <dd className="font-semibold">{latest.numSamples?.toLocaleString() ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Features</dt>
              <dd className="font-semibold">{latest.numFeatures ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Training Duration</dt>
              <dd className="font-semibold">{latest.trainingDurationMs ? `${(latest.trainingDurationMs / 1000).toFixed(1)}s` : "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Trained At</dt>
              <dd className="font-semibold">{latest.createdAt ? new Date(latest.createdAt).toLocaleString() : "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function DatasetStatsTab({ stats }: { stats: DatasetStats | null }) {
  if (!stats || !stats.totalSamples) {
    return (
      <EmptyState
        icon={Database}
        title="No Dataset Statistics"
        description="Train the model to see dataset statistics."
      />
    );
  }

  const classEntries = Object.entries(stats.classBalance);
  const total = classEntries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dataset Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">Total Samples</dt>
                <dd className="font-semibold text-lg">{stats.totalSamples.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Features</dt>
                <dd className="font-semibold text-lg">{Object.keys(stats.featureStats).length}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Class Balance</CardTitle>
          <CardDescription>Distribution of diabetes outcomes in the dataset</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {classEntries.map(([label, count]) => {
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">
                    {label === "1" ? "Diabetic (1)" : label === "0" ? "Non-Diabetic (0)" : label}
                  </span>
                  <span className="text-slate-500">{count.toLocaleString()} ({pct}%)</span>
                </div>
                <Progress value={parseFloat(pct)} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature Distributions</CardTitle>
          <CardDescription>Mean and standard deviation per feature</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-3 font-medium">Feature</th>
                  <th className="pb-3 font-medium text-right">Mean</th>
                  <th className="pb-3 font-medium text-right">Std Dev</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.featureStats).map(([name, { mean, std }]) => (
                  <tr key={name} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-700">{name}</td>
                    <td className="py-2 text-right text-slate-500">{mean.toFixed(4)}</td>
                    <td className="py-2 text-right text-slate-500">{std.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function VersionHistoryTab({ versions }: { versions: ModelVersion[] }) {
  if (!versions.length) {
    return (
      <EmptyState
        icon={Clock}
        title="No Version History"
        description="Train the model to start tracking versions."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Model Version History</CardTitle>
        <CardDescription>All past training runs with performance snapshots</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-3 font-medium">Version</th>
                <th className="pb-3 font-medium">Accuracy</th>
                <th className="pb-3 font-medium">Precision</th>
                <th className="pb-3 font-medium">Recall</th>
                <th className="pb-3 font-medium">F1</th>
                <th className="pb-3 font-medium">AUC-ROC</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 font-bold text-slate-700">v{v.version}</td>
                  <td className="py-3">{v.accuracy !== null ? (v.accuracy * 100).toFixed(1) + "%" : "—"}</td>
                  <td className="py-3">{v.precision !== null ? (v.precision * 100).toFixed(1) + "%" : "—"}</td>
                  <td className="py-3">{v.recall !== null ? (v.recall * 100).toFixed(1) + "%" : "—"}</td>
                  <td className="py-3">{v.f1Score !== null ? (v.f1Score * 100).toFixed(1) + "%" : "—"}</td>
                  <td className="py-3">{v.aucRoc !== null ? v.aucRoc.toFixed(4) : "—"}</td>
                  <td className="py-3"><StatusBadge status={v.status} /></td>
                  <td className="py-3 text-slate-500">{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

type Tab = "metrics" | "dataset" | "history";

const tabClass = (active: boolean) =>
  `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
    active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
  }`;

export default function ModelMonitoring() {
  const [tab, setTab] = useState<Tab>("metrics");
  const queryClient = useQueryClient();

  const versionsQuery = useQuery<ModelVersion[]>({
    queryKey: ["/api/admin/model/versions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/model/versions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch model versions");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const datasetStatsQuery = useQuery<DatasetStats>({
    queryKey: ["/api/admin/model/dataset-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/model/dataset-stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dataset stats");
      return res.json();
    },
  });

  const retrainMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/model/retrain", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Retrain failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/model/versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/model/dataset-stats"] });
    },
  });

  const versions = versionsQuery.data ?? [];
  const isTraining = retrainMutation.isPending;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-7 w-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-800">Model Monitoring</h1>
          </div>
          <RetrainDialog onConfirm={() => retrainMutation.mutate()} isTraining={isTraining} />
        </div>

        {retrainMutation.isError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <XCircle className="h-5 w-5" />
            {retrainMutation.error?.message || "Retraining failed"}
          </div>
        )}

        {retrainMutation.isSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 border border-green-200">
            <CheckCircle2 className="h-5 w-5" />
            Model retrained successfully (v{retrainMutation.data?.version})
          </div>
        )}

        <div className="mb-6 flex gap-2">
          <button className={tabClass(tab === "metrics")} onClick={() => setTab("metrics")}>
            Performance Metrics
          </button>
          <button className={tabClass(tab === "dataset")} onClick={() => setTab("dataset")}>
            Dataset Statistics
          </button>
          <button className={tabClass(tab === "history")} onClick={() => setTab("history")}>
            Version History
          </button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {versionsQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                {tab === "metrics" && <MetricsTab versions={versions} />}
                {tab === "dataset" && <DatasetStatsTab stats={datasetStatsQuery.data ?? null} />}
                {tab === "history" && <VersionHistoryTab versions={versions} />}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
