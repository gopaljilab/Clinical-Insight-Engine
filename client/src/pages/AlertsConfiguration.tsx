import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type AlertRule = {
  id: number;
  biomarker: string;
  condition: string;
  thresholdValue: number;
  patientName: string | null;
  isActive: boolean;
};

export default function AlertsConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [biomarker, setBiomarker] = useState("");
  const [condition, setCondition] = useState("");
  const [thresholdValue, setThresholdValue] = useState("");
  const [patientName, setPatientName] = useState("");

  const { data: rules = [], isLoading } = useQuery<AlertRule[]>({
    queryKey: ["/api/alerts/rules"],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (newRule: Partial<AlertRule>) => {
      const res = await apiRequest("POST", "/api/alerts/rules", newRule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/rules"] });
      toast({ title: "Alert rule created successfully" });
      setBiomarker("");
      setCondition("");
      setThresholdValue("");
      setPatientName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/alerts/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/rules"] });
      toast({ title: "Alert rule deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!biomarker || !condition || !thresholdValue) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    createRuleMutation.mutate({
      biomarker,
      condition,
      thresholdValue: parseFloat(thresholdValue),
      patientName: patientName.trim() || null,
      isActive: true,
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alert Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Configure custom alerts for sudden drops or spikes in biomarker trends.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Alert Rule</CardTitle>
          <CardDescription>
            You will be notified when a new assessment breaches these thresholds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateRule} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Biomarker</label>
              <Select value={biomarker} onValueChange={setBiomarker}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hba1cLevel">HbA1c Level</SelectItem>
                  <SelectItem value="bloodGlucoseLevel">Blood Glucose</SelectItem>
                  <SelectItem value="bmi">BMI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Condition</label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=">">Greater than (&gt;)</SelectItem>
                  <SelectItem value="<">Less than (&lt;)</SelectItem>
                  <SelectItem value="=">Equals (=)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Threshold</label>
              <Input
                type="number"
                step="any"
                placeholder="e.g. 7.0"
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Patient (Optional)</label>
              <Input
                placeholder="Leave blank for all"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={createRuleMutation.isPending}>
              {createRuleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Rule
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Alert Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground">
              No alert rules configured.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Biomarker</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.biomarker}</TableCell>
                    <TableCell>{rule.condition}</TableCell>
                    <TableCell>{rule.thresholdValue}</TableCell>
                    <TableCell>{rule.patientName || <span className="text-muted-foreground italic">All Patients</span>}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                        disabled={deleteRuleMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
