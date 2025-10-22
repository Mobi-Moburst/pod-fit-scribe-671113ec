import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientCombobox } from "@/components/ClientCombobox";
import { MinimalClient } from "@/types/clients";
import { supabase } from "@/integrations/supabase/client";
import { parseCSV } from "@/utils/batchProcessor";
import { generateReportFromCSV } from "@/utils/reportGenerator";
import { ReportData } from "@/types/reports";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { KPICard } from "@/components/reports/KPICard";
import { CampaignOverview } from "@/components/reports/CampaignOverview";
import { PodcastTable } from "@/components/reports/PodcastTable";
import { Upload, FileText, TrendingUp, Users, Target, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Reports() {
  const [clients, setClients] = useState<MinimalClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Error loading clients:', error);
        toast({
          title: "Error loading clients",
          description: "Failed to load client list from database.",
          variant: "destructive",
        });
        return;
      }
      
      setClients((data || []) as MinimalClient[]);
    };
    
    loadClients();
  }, [toast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedClientId) {
      toast({
        title: "Select a client first",
        description: "Please select a client before uploading a CSV.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const csvData = await parseCSV(file);
      const client = clients.find(c => c.id === selectedClientId);
      
      if (!client) {
        throw new Error("Client not found");
      }

      const report = generateReportFromCSV(
        csvData,
        client,
        file.name.replace('.csv', '')
      );
      
      setReportData(report);
      toast({
        title: "Report generated",
        description: `Successfully processed ${report.kpis.total_evaluated} podcasts.`,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error generating report",
        description: error instanceof Error ? error.message : "Failed to process CSV",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen w-full">
      <BackgroundFX />
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Upload Section */}
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Generate Client Report</CardTitle>
              <CardDescription>
                Upload a CSV from batch analysis to generate a client-facing report with KPIs and metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Select Client</Label>
                <ClientCombobox
                  clients={clients}
                  value={selectedClientId}
                  onChange={setSelectedClientId}
                  placeholder="Choose a client..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv-upload">Upload Batch Results CSV</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={!selectedClientId || isProcessing}
                    className="cursor-pointer"
                  />
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              {isProcessing && (
                <p className="text-sm text-muted-foreground">Processing CSV...</p>
              )}
            </CardContent>
          </Card>

          {/* Report Display */}
          {reportData && (
            <>
              <div className="flex justify-between items-center print:hidden">
                <div />
                <Button onClick={handlePrint} variant="outline">
                  <Printer className="mr-2 h-4 w-4" />
                  Print Report
                </Button>
              </div>

              <div className="space-y-8 print:space-y-6">
                <ReportHeader
                  client={reportData.client}
                  generated_at={reportData.generated_at}
                  batch_name={reportData.batch_name}
                />

                {/* KPIs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard
                    title="Total Evaluated"
                    value={reportData.kpis.total_evaluated}
                    icon={FileText}
                  />
                  <KPICard
                    title="Perfect Fits"
                    value={reportData.kpis.fit_count}
                    subtitle={`${Math.round((reportData.kpis.fit_count / reportData.kpis.total_evaluated) * 100)}% of total`}
                    icon={Target}
                  />
                  <KPICard
                    title="Average Score"
                    value={reportData.kpis.avg_score.toFixed(1)}
                    subtitle="Out of 10"
                    icon={TrendingUp}
                  />
                  <KPICard
                    title="Total Reach"
                    value={reportData.kpis.total_reach.toLocaleString()}
                    subtitle="Listeners per episode"
                    icon={Users}
                  />
                </div>

                {/* Campaign Overview */}
                <CampaignOverview
                  strategy={reportData.campaign_overview.strategy}
                  target_audiences={reportData.campaign_overview.target_audiences}
                  talking_points={reportData.campaign_overview.talking_points}
                />

                {/* Top Categories */}
                {reportData.kpis.top_categories.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-3">
                        {reportData.kpis.top_categories.map((cat, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-sm font-medium">{cat.name}</span>
                            <span className="text-xs text-muted-foreground">({cat.count})</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Podcast Breakdown */}
                <PodcastTable podcasts={reportData.podcasts} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
