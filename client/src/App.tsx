import { Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import ImportData from "./pages/ImportData";
import AdminDashboard from "./pages/AdminDashboard";
import ModelMonitoring from "./pages/ModelMonitoring";
import ProgressTracking from "./pages/ProgressTracking";

import LoginPage from "./pages/LoginPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./i18n";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute>
          <Analytics />
        </ProtectedRoute>
      </Route>
      <Route path="/import">
        <ProtectedRoute>
          <ImportData />
        </ProtectedRoute>
      </Route>
      <Route path="/history">
        <ProtectedRoute>
          <History />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute requireAdmin>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/model-monitoring">
        <ProtectedRoute requireAdmin>
          <ModelMonitoring />
        </ProtectedRoute>
      </Route>
      <Route path="/progress">
        <ProtectedRoute>
          <ProgressTracking />
        </ProtectedRoute>
      </Route>
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms" component={Terms} />
      <Route component={NotFound} />
    </Switch>
  );
}
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ErrorBoundary>
          <Suspense fallback={null}>
            <Router />
          </Suspense>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
export default App;
