import React from 'react';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, Users, FileText, Activity, Shield, UserCheck, UserX, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { formatReadableDate } from "@/utils/dateFormat";
import { ApiClient } from "@/lib/apiClient";

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
    active ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-700"
  }`;

function RiskBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    LOW: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900",
    MODERATE: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
    HIGH: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colorMap[category] || "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400"}`}>
      {category}
    </span>
  );
}

function StatusBadge({ active, verified }: { active: boolean; verified: boolean }) {
  if (!active) return <Badge variant="destructive">Inactive</Badge>;
  if (verified) return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900">Active</Badge>;
  return <Badge variant="secondary">Unverified</Badge>;
}

function UsersTab({ active }: { active: boolean }) {
  const { data, isLoading, refetch } = useQuery<{ data: User[]; total: number }>({
    queryKey: ["/api/admin/users"],
    enabled: active,
    queryFn: async () => {
      return ApiClient.get("/api/admin/users");
    },
    // Cache for 2 minutes — prevents redundant refetches when switching
    // back to a previously visited tab within the same session.
    staleTime: 2 * 60 * 1000,
  });
  const { toast } = useToast();

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await ApiClient.requestRaw(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      toast({ title: "User updated", description: "User status changed successfully." });
      refetch();
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Failed to reach server",
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
          <tr className="border-b border-slate-200 dark:border-gray-700 text-left text-slate-500 dark:text-slate-400">
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
            <tr key={user.id} className="border-b border-slate-100 dark:border-gray-800">
              <td className="py-3 pr-4 dark:text-gray-200">{user.fullName}</td>
              <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{user.email}</td>
              <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{user.medicalLicenseNumber}</td>
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
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Showing {data.data.length} of {data.total} users
        </p>
      )}
    </div>
  );
}

function AuditLogsTab({ active }: { active: boolean }) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userId, setUserId] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [status, setStatus] = useState("all");

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append("startDate", startDate);
  if (endDate) queryParams.append("endDate", endDate);
  if (userId) queryParams.append("userId", userId);
  if (ipAddress) queryParams.append("ipAddress", ipAddress);
  if (status !== "all") queryParams.append("status", status);
  
  const queryString = queryParams.toString();
  const queryKey = `/api/admin/audit-logs${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading } = useQuery<{ data: AuditLog[]; total: number }>({
    queryKey: [queryKey],
    enabled: active,
    queryFn: async () => {
      return ApiClient.get(queryKey);
    },
    staleTime: 2 * 60 * 1000,
  });

  const handleExport = async () => {
    try {
      const exportQueryString = queryParams.toString();
      const exportUrl = `/api/admin/audit-logs/export${exportQueryString ? `?${exportQueryString}` : ""}`;
      
      const response = await fetch(exportUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error("Failed to export audit logs");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "Your audit logs have been exported.",
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting the audit logs.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
          <div className="space-y-1">
            <label className="text-sm font-medium">Start Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">End Date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">User ID</label>
            <Input placeholder="Filter by User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">IP Address</label>
            <Input placeholder="Filter by IP" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-end md:ml-auto">
          <Button onClick={handleExport} variant="outline" className="w-full md:w-auto flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : data?.data.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No Audit Logs"
          description="There are currently no security audit logs matching your filters."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-gray-700 text-left text-slate-500 dark:text-slate-400">
                <th className="pb-3 font-medium">Timestamp</th>
                <th className="pb-3 font-medium">User ID</th>
                <th className="pb-3 font-medium">IP Address</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">User Agent</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 dark:border-gray-800">
                  <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                    {formatReadableDate(log.createdAt, { fallback: "-" })}
                  </td>
                  <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{log.userId ? log.userId.slice(0, 8) + "..." : "-"}</td>
                  <td className="py-3 pr-4 dark:text-gray-300">{log.ipAddress || "-"}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={log.loginStatus === "success" ? "default" : "destructive"}>
                      {log.loginStatus || "-"}
                    </Badge>
                  </td>
                  <td className="py-3 max-w-[200px] truncate text-slate-500 dark:text-slate-400" title={log.userAgent || ""}>
                    {log.userAgent || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Showing {data.data.length} of {data.total} log entries
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatsTab({ active }: { active: boolean }) {
  const { data, isLoading } = useQuery<SystemStats>({
    queryKey: ["/api/admin/stats"],
    enabled: active,
    queryFn: async () => {
      return ApiClient.get("/api/admin/stats");
    },
    staleTime: 2 * 60 * 1000,
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
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data?.totalUsers ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Assessments</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data?.totalAssessments ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Risk Categories</CardTitle>
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">Admin Dashboard</h1>
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
            {tab === "users" && <UsersTab active />}
            {tab === "audit" && <AuditLogsTab active />}
            {tab === "stats" && <StatsTab active />}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

