import { type ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { MedicalLoader } from "@/components/ui/medical-loader";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <MedicalLoader type="heartbeat" size="lg" className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (requireAdmin && user?.role !== "ADMIN") {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}
