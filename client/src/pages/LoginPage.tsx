import { useEffect } from "react";
import { useLocation } from "wouter";
import { AuthFlowModal } from "@/components/AuthFlowModal";

/**
 * /login is kept as a navigable route so that direct links and bookmarks
 * continue to work. It renders the canonical AuthFlowModal rather than
 * duplicating the auth logic inline.
 */
export default function LoginPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Clinical Insight Engine - Sign In";
  }, []);

  return (
    <AuthFlowModal
      initialMode="login"
      isOpen={true}
      onClose={() => setLocation("/")}
    />
  );
}
