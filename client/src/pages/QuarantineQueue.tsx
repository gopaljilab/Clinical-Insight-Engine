import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@/lib/apiClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Trash2, CheckCircle, RefreshCcw } from "lucide-react";

export default function QuarantineQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quarantined = [], isLoading } = useQuery({
    queryKey: ["quarantine"],
    queryFn: async () => {
      const res = await ApiClient.get("/api/quarantine");
      if (!res.ok) throw new Error("Failed to fetch quarantine queue");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await ApiClient.delete(`/api/quarantine/${id}`);
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      toast({ title: "Discarded", description: "The anomalous record has been deleted." });
      queryClient.invalidateQueries({ queryKey: ["quarantine"] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete record." });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await ApiClient.post(`/api/quarantine/${id}/resolve`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to resolve");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Resolved", description: "Record successfully fixed and imported." });
      queryClient.invalidateQueries({ queryKey: ["quarantine"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Validation Error", description: err.message });
    },
  });

  const handleFixAndResolve = (id: number, rawData: any) => {
    // Basic auto-fix attempt for common typos:
    const fixedData = { ...rawData };
    if (fixedData.age > 120) fixedData.age = Math.floor(fixedData.age / 10);
    if (fixedData.bmi < 10) fixedData.bmi = fixedData.bmi * 10;
    if (fixedData.bloodGlucoseLevel > 1000) fixedData.bloodGlucoseLevel = Math.floor(fixedData.bloodGlucoseLevel / 10);
    
    resolveMutation.mutate({ id, data: fixedData });
  };

  return (
    <AppLayout>
      <div className="container py-8 max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
              Data Quarantine Queue
            </h1>
            <p className="text-muted-foreground mt-2">
              Review and fix out-of-range lab results and anomalous data before they pollute the ML predictions.
            </p>
          </div>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["quarantine"] })}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Requires Review ({quarantined.length})</CardTitle>
            <CardDescription>Records that failed physiological bounds-checking during import.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading queue...</div>
            ) : quarantined.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium">All clear!</h3>
                <p className="text-muted-foreground">No anomalous records detected.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Anomalous Values</TableHead>
                      <TableHead>Error Reasons</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarantined.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="outline">{item.importSource}</Badge></TableCell>
                        <TableCell className="font-medium">{item.originalData?.patientName || 'Unknown'}</TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            <div>Age: <span className="font-mono bg-muted px-1 rounded">{item.originalData?.age}</span></div>
                            <div>BMI: <span className="font-mono bg-muted px-1 rounded">{item.originalData?.bmi}</span></div>
                            <div>Glucose: <span className="font-mono bg-muted px-1 rounded">{item.originalData?.bloodGlucoseLevel}</span></div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ul className="text-sm text-red-500 list-disc list-inside">
                            {item.anomalyReasons.map((reason: string, i: number) => (
                              <li key={i}>{reason}</li>
                            ))}
                          </ul>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button 
                            variant="default" 
                            size="sm"
                            disabled={resolveMutation.isPending}
                            onClick={() => handleFixAndResolve(item.id, item.originalData)}
                          >
                            Auto-Fix & Submit
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="icon"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
