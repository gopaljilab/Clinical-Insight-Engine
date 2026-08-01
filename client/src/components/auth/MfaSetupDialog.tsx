import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/apiClient";
import { Loader2 } from "lucide-react";

interface MfaSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MfaSetupDialog({ open, onOpenChange, onSuccess }: MfaSetupDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"fetch" | "scan" | "verify">("fetch");
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [token, setToken] = useState("");

  const startSetup = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to setup MFA");

      setQrCodeUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setStep("scan");
    } catch (err: any) {
      toast({ title: "Setup Failed", description: err.message, variant: "destructive" });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (token.length !== 6) return;
    setLoading(true);
    try {
      const response = await fetch("/api/auth/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, secret }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Invalid token");

      toast({ title: "MFA Enabled", description: "Two-factor authentication has been successfully enabled." });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Trigger setup on open if step is fetch
  if (open && step === "fetch" && !loading) {
    startSetup();
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) { setTimeout(() => { setStep("fetch"); setToken(""); }, 300); }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Secure your account with an authenticator app like Google Authenticator or Authy.
          </DialogDescription>
        </DialogHeader>

        {loading && step === "fetch" ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : step === "scan" ? (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              {qrCodeUrl && <img src={qrCodeUrl} alt="MFA QR Code" className="border-4 border-white rounded-lg shadow-sm w-48 h-48" />}
            </div>
            <p className="text-sm text-center text-slate-600 dark:text-slate-400">
              Scan this QR code with your authenticator app.
            </p>
            <DialogFooter>
              <Button onClick={() => setStep("verify")} className="w-full">Next</Button>
            </DialogFooter>
          </div>
        ) : step === "verify" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token">Verification Code</Label>
              <Input
                id="token"
                placeholder="Enter 6-digit code"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStep("scan")}>Back</Button>
              <Button onClick={verifySetup} disabled={token.length !== 6 || loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Enable
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
