import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReportData } from "@/types/reports";

interface RunAEOAuditButtonProps {
  report: any;
  onComplete: (updates: {
    content_gap_analysis: any;
    geo_analysis: any;
    last_aeo_audit_at?: string;
  }) => Promise<void> | void;
  variant?: "default" | "outline" | "compact";
  label?: string;
}

const MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5", recommended: true },
  { id: "claude-sonnet-4-5", label: "Sonnet 4.5" },
];

export function RunAEOAuditButton({ report, onComplete, variant = "outline", label }: RunAEOAuditButtonProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [pendingModel, setPendingModel] = useState<string | null>(null);

  const competitorCount = (report?.report_data as ReportData | undefined)
    ?.sov_analysis?.competitors?.length ?? 0;

  const handleSelectModel = (model: string) => {
    if (competitorCount === 0) {
      setPendingModel(model);
      return;
    }
    runAudit(model);
  };

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

      // Aggregate richer context — multi-speaker reports merge across speakers
      const isMulti = reportData.report_type === "multi";
      const breakdowns = reportData.speaker_breakdowns ?? [];
      const dedupe = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

      const talking_points = isMulti
        ? dedupe(breakdowns.flatMap((s) => s.talking_points ?? []))
        : dedupe([
            ...(reportData.campaign_overview?.talking_points ?? []),
            ...(breakdowns[0]?.talking_points ?? []),
          ]);

      const professional_credentials = isMulti
        ? dedupe(breakdowns.flatMap((s) => s.professional_credentials ?? []))
        : dedupe(breakdowns[0]?.professional_credentials ?? []);

      const campaign_strategy = isMulti
        ? breakdowns
            .map((s) => (s.campaign_strategy ? `${s.speaker_name}: ${s.campaign_strategy}` : ""))
            .filter(Boolean)
            .join("\n\n")
        : breakdowns[0]?.campaign_strategy ?? reportData.campaign_overview?.strategy ?? "";

      const { data: { user } } = await supabase.auth.getUser();

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
          campaign_strategy,
          talking_points,
          professional_credentials,
          model,
          prompt_cap: 25,
          triggered_by: user?.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.run_id) throw new Error("No run_id returned");

      // Poll for completion. Multi-engine audits can take longer, so only fail
      // if the run truly stalls instead of using a short fixed timeout.
      const runId = data.run_id;
      const pollIntervalMs = 4000;
      const absoluteTimeoutMs = 20 * 60 * 1000;
      const stallTimeoutMs = 2 * 60 * 1000;
      const startedAt = Date.now();
      let lastProgressAt = Date.now();
      let lastProcessed = -1;
      let lastTotal = 0;
      let final: any = null;
      while (Date.now() - startedAt < absoluteTimeoutMs) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        const { data: poll, error: pollErr } = await supabase.functions.invoke(
          "run-aeo-audit",
          { body: { run_id: runId } },
        );
        if (pollErr) {
          console.warn("[run-aeo-audit] poll error:", pollErr);
          continue;
        }
        if (poll?.status === "completed") {
          final = poll;
          break;
        }
        if (poll?.status === "failed") {
          throw new Error(poll.error_message || "Audit failed");
        }

        const processed = poll?.progress?.processed ?? 0;
        const total = poll?.progress?.total ?? 0;

        if (processed > lastProcessed) {
          lastProcessed = processed;
          lastTotal = total;
          lastProgressAt = Date.now();
        }

        if (Date.now() - lastProgressAt > stallTimeoutMs) {
          throw new Error(
            total > 0
              ? `Audit stalled at ${processed}/${total} prompts. Please try again.`
              : "Audit stalled before processing prompts. Please try again.",
          );
        }
      }
      if (!final) {
        throw new Error(
          lastTotal > 0
            ? `Audit is taking longer than expected (${lastProcessed}/${lastTotal} prompts processed). Please try again.`
            : "Audit is taking longer than expected. Please try again.",
        );
      }

      await onComplete({
        content_gap_analysis: final.content_gap_analysis,
        geo_analysis: final.geo_analysis,
        last_aeo_audit_at: final.completed_at ?? new Date().toISOString(),
      });

      toast({
        title: "AEO audit complete",
        description: `Ran ${final.prompts_run} prompts${
          final.prompts_failed ? ` (${final.prompts_failed} failed)` : ""
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
    <>
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
            {isRunning ? "Running audit…" : (label ?? "Run AEO Audit")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Choose Claude model</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {MODELS.map((m) => (
            <DropdownMenuItem key={m.id} onClick={() => handleSelectModel(m.id)}>
              {m.label}
              {m.recommended && (
                <span className="ml-auto text-xs text-muted-foreground">default</span>
              )}
            </DropdownMenuItem>
          ))}
          {competitorCount === 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-accent" />
                <span>No SOV peers configured — competitor analysis will be limited.</span>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!pendingModel} onOpenChange={(o) => !o && setPendingModel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-accent" />
              No competitors configured
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This report has no Share-of-Voice peers set. Without competitors, the audit
                can still measure your AI visibility, but it won't be able to surface where
                rivals out-rank you or identify head-to-head positioning gaps.
              </span>
              <span className="block">
                For richer intelligence, add 4–6 peers in the Peer Comparison section first.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const m = pendingModel;
                setPendingModel(null);
                if (m) runAudit(m);
              }}
            >
              Run anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
