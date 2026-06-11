import { useEffect } from "react";
import { AuthFlow } from "@/components/auth/AuthFlow";

export default function LoginPage() {
  useEffect(() => {
    document.title = "Clinical Insight Engine - Authentication";
  }, []);

  // Use URL params to determine initial mode if desired
  const searchParams = new URLSearchParams(window.location.search);
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";

  return (
    <AuthFlow initialMode={initialMode} />
  );
}
