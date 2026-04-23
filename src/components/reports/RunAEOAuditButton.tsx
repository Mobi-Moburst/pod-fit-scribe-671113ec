import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReportData } from "@/types/reports";

interface RunAEOAuditButtonProps {
  report: any;
  onComplete: (updates: {
    content_gap_analysis: any;
    geo_analysis: any;
  }) => Promise<void> | void;
  variant?: "default" | "outline" | "compact";
}

const MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5 (~$2/run)", recommended: true },
  { id: "claude-sonnet-4-5", label: "Sonnet 4.5 (~$10/run)" },
];

export function RunAEOAuditButton({ report, onComplete, variant = "outline" }: RunAEOAuditButtonProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);

  const runAudit = async (model: string) => {
    if (!report) return;
    const reportData = report.report_data as ReportData;

    setIsRunning(true);
    try {
      const competitors = reportData.sov_analysis?.competitors?.map((c) => ({
        name: c.name,
      })) ?? [];

      // Pull topics from talking points / target audiences / categories
      const topics = Array.from(
        new Set([
          ...(reportData.campaign_overview?.target_audiences ?? []),
          ...(reportData.kpis?.top_categories ?? []).map((c) => c.name),
        ]),
      ).slice(0, 8);

      const { data, error } = await supabase.functions.invoke("run-aeo-audit", {
        body: {
          company_id: report.company_id,
          org_id: report.org_id,
          company_name:
            reportData.company_name ?? reportData.client?.company ?? reportData.client?.name,
          client_domain: reportData.client?.company_url,
          speaker_name:
            reportData.report_type === "single" ? reportData.client?.name : undefined,
          topics,
          competitors,
          model,
          prompt_cap: 25,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await onComplete({
        content_gap_analysis: data.content_gap_analysis,
        geo_analysis: data.geo_analysis,
      });

      toast({
        title: "AEO audit complete",
        description: `Ran ${data.prompts_run} prompts via Claude${
          data.prompts_failed ? ` (${data.prompts_failed} failed)` : ""
        }.`,
      });
    } catch (err) {
      console.error("[run-aeo-audit] error:", err);
      toast({
        title: "Audit failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === "compact" ? "outline" : variant}
          size={variant === "compact" ? "sm" : "default"}
          disabled={isRunning}
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 mr-1" />
          )}
          {isRunning ? "Running audit…" : "Run AEO Audit"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Choose Claude model</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODELS.map((m) => (
          <DropdownMenuItem key={m.id} onClick={() => runAudit(m.id)}>
            {m.label}
            {m.recommended && (
              <span className="ml-auto text-xs text-muted-foreground">default</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
