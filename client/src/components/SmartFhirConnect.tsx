import React, { useState, useEffect } from "react";
import FHIR from "fhirclient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/apiClient";
import { Loader2, Link as LinkIcon, Database } from "lucide-react";

interface SmartFhirConnectProps {
  onDataLoaded: (data: any) => void;
}

export function SmartFhirConnect({ onDataLoaded }: SmartFhirConnectProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if we are returning from an OAuth redirect
    if (window.location.search.includes("state=") || window.location.search.includes("code=")) {
      setIsLoading(true);
      FHIR.oauth2
        .ready()
        .then(async (client) => {
          setIsConnected(true);
          toast({
            title: "EHR Connected",
            description: "Successfully authenticated with EHR. Fetching patient data...",
          });

          // Fetch Patient
          const patient = await client.patient.read();

          // Fetch Observations
          const observationsBundle = await client.request(`Observation?patient=${client.patient.id}`);
          const observations = observationsBundle.entry || [];

          // Fetch Documents if any
          let documents: any[] = [];
          try {
            const docBundle = await client.request(`DocumentReference?patient=${client.patient.id}`);
            documents = docBundle.entry || [];
          } catch (e) {
            console.log("No documents found or unsupported.");
          }

          // Build Bundle
          const bundle = {
            resourceType: "Bundle",
            type: "collection",
            entry: [
              { resource: patient },
              ...observations,
              ...documents
            ],
          };

          // Send to backend for parsing
          const response = await ApiClient.post("/api/fhir/parse", bundle);
          if (response.status === "success" && response.data) {
            onDataLoaded(response.data);
            toast({
              title: "Data Synced",
              description: "Patient demographics and vitals have been populated.",
            });
            // Clean up URL so refresh doesn't trigger oauth again
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            throw new Error(response.message || "Failed to parse FHIR data.");
          }
        })
        .catch((error) => {
          console.error("FHIR Ready Error:", error);
          toast({
            title: "EHR Connection Failed",
            description: error.message || "Could not complete SMART on FHIR authorization.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [onDataLoaded, toast]);

  const handleConnect = () => {
    setIsLoading(true);
    FHIR.oauth2.authorize({
      clientId: "clinical-insight-engine-app",
      scope: "patient/*.read launch/patient openid fhirUser",
      iss: "https://launch.smarthealthit.org/v/r4/fhir",
      redirectUri: window.location.origin + window.location.pathname,
    }).catch(error => {
      console.error(error);
      toast({
        title: "Launch Error",
        description: error.message || "Failed to initiate SMART on FHIR launch.",
        variant: "destructive"
      });
      setIsLoading(false);
    });
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900 text-sm font-bold w-max">
        <Database className="w-4 h-4" />
        Connected to EHR
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/50"
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <LinkIcon className="w-4 h-4" />
      )}
      {isLoading ? "Connecting..." : "Connect EHR (SMART on FHIR)"}
    </Button>
  );
}
