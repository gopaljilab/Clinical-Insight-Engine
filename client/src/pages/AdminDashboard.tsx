import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, Users, FileText, Activity, Shield, UserCheck, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";

type Tab = "users" | "audit" | "stats";

type User = {
  id: string;
  fullName: string;
  email: string;
  medicalLicenseNumber: string;
  isActive: boolean;
  emailVerified: boolean;
  role: string;
  createdAt: string;
};

type AuditLog = {
  id: string;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  loginStatus: string | null;
  createdAt: string;
};

type SystemStats = {
  totalUsers: number;
  totalAssessments: number;
  riskDistribution: { category: string; count: number }[];
};

const tabClass = (active: boolean) =>
  `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
    active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
  }`;

function RiskBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    LOW: "bg-green-100 text-green-700 border-green-200",
    MODERATE: "bg-amber-100 text-amber-700 border-amber-200",
    HIGH: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colorMap[category] || "bg-slate-100 text-slate-600"}`}>
      {category}
    </span>
  );
}

function StatusBadge({ active, verified }: { active: boolean; verified: boolean }) {
  if (!active) return <Badge variant="destructive">Inactive</Badge>;
  if (verified) return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>;
  return <Badge variant="secondary">Unverified</Badge>;
}

function UsersTab() {
  const { data, isLoading, refetch } = useQuery<{ data: User[]; total: number }>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
  const { toast } = useToast();

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          title: "Update failed",
          description: body?.message || `Server returned ${res.status}`,
          variant: "destructive",
        });
        return;
      }

      toast({ title: "User updated", description: "User status changed successfully." });
      refetch();
    } catch (err) {
      toast({
        title: "Network error",
        description: err instanceof Error ? err.message : "Failed to reach server",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (data?.data.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No Users Found"
        description="There are currently no users in the system."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Email</th>
            <th className="pb-3 font-medium">License</th>
            <th className="pb-3 font-medium">Role</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Active</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((user) => (
            <tr key={user.id} className="border-b border-slate-100">
              <td className="py-3 pr-4">{user.fullName}</td>
              <td className="py-3 pr-4 text-slate-500">{user.email}</td>
              <td className="py-3 pr-4 text-slate-500">{user.medicalLicenseNumber}</td>
              <td className="py-3 pr-4">
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </td>
              <td className="py-3 pr-4">
                <StatusBadge active={user.isActive} verified={user.emailVerified} />
              </td>
              <td className="py-3">
                <Switch
                  checked={user.isActive}
                  onCheckedChange={() => handleToggleActive(user.id, user.isActive)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data && (
        <p className="mt-4 text-sm text-slate-500">
          Showing {data.data.length} of {data.total} users
        </p>
      )}
    </div>
  );
}

function AuditLogsTab() {
  const { data, isLoading } = useQuery<{ data: AuditLog[]; total: number }>({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit-logs", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (data?.data.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No Audit Logs"
        description="There are currently no security audit logs recorded."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-3 font-medium">Timestamp</th>
            <th className="pb-3 font-medium">User ID</th>
            <th className="pb-3 font-medium">IP Address</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">User Agent</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((log) => (
            <tr key={log.id} className="border-b border-slate-100">
              <td className="py-3 pr-4 text-slate-500">
                {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
              </td>
              <td className="py-3 pr-4 text-slate-500">{log.userId ? log.userId.slice(0, 8) + "..." : "-"}</td>
              <td className="py-3 pr-4">{log.ipAddress || "-"}</td>
              <td className="py-3 pr-4">
                <Badge variant={log.loginStatus === "success" ? "default" : "destructive"}>
                  {log.loginStatus || "-"}
                </Badge>
              </td>
              <td className="py-3 max-w-[200px] truncate text-slate-500" title={log.userAgent || ""}>
                {log.userAgent || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data && (
        <p className="mt-4 text-sm text-slate-500">
          Showing {data.data.length} of {data.total} log entries
        </p>
      )}
    </div>
  );
}

function StatsTab() {
  const { data, isLoading } = useQuery<SystemStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data?.totalUsers ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Assessments</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data?.totalAssessments ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Risk Categories</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.riskDistribution.map((r) => (
                <div key={r.category} className="flex items-center justify-between">
                  <RiskBadge category={r.category} />
                  <span className="text-lg font-semibold">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("stats");

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
        </div>

        <div className="mb-6 flex gap-2">
          <button className={tabClass(tab === "stats")} onClick={() => setTab("stats")}>
            System Stats
          </button>
          <button className={tabClass(tab === "users")} onClick={() => setTab("users")}>
            Users
          </button>
          <button className={tabClass(tab === "audit")} onClick={() => setTab("audit")}>
            Audit Logs
          </button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {tab === "users" && <UsersTab />}
            {tab === "audit" && <AuditLogsTab />}
            {tab === "stats" && <StatsTab />}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
