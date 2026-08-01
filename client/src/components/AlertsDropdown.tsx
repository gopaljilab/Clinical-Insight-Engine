import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export function AlertsDropdown() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000, // Refresh every 30s
  });

  const unreadAlerts = alerts.filter(a => !a.isRead);

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/alerts/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          {unreadAlerts.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
            >
              {unreadAlerts.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {unreadAlerts.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No new alerts
          </div>
        ) : (
          unreadAlerts.map(alert => (
            <DropdownMenuItem
              key={alert.id}
              className="flex flex-col items-start p-3 gap-1 cursor-pointer"
              onClick={() => markReadMutation.mutate(alert.id)}
            >
              <span className="font-semibold text-sm">{alert.patientName}</span>
              <span className="text-xs text-muted-foreground line-clamp-2">
                {alert.message}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuItem 
          className="justify-center border-t border-border mt-1 pt-2 font-medium text-blue-600 dark:text-blue-400 cursor-pointer"
          onClick={() => setLocation("/alerts-config")}
        >
          Configure Alerts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
