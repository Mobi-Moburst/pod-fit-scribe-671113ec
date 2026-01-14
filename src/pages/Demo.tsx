import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEMO_CLIENT_OPTIONS, DEMO_CLIENTS } from "@/data/demoClients";
import { Loader2, Sparkles, FileText, Radio, TrendingUp, BarChart3, Target } from "lucide-react";
import { KitcasterLogo } from "@/components/KitcasterLogo";

const LOADING_MESSAGES = [
  { message: "Connecting to data sources...", icon: FileText },
  { message: "Analyzing podcast performance...", icon: Radio },
  { message: "Calculating campaign metrics...", icon: TrendingUp },
  { message: "Generating value insights...", icon: BarChart3 },
  { message: "Building strategic recommendations...", icon: Target },
  { message: "Finalizing report...", icon: Sparkles },
];

export default function Demo() {
  const navigate = useNavigate();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("Q1");
  const [reportName, setReportName] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const selectedClient = selectedClientId ? DEMO_CLIENTS[selectedClientId] : null;

  // Auto-populate report name when client is selected
  useEffect(() => {
    if (selectedClient) {
      setReportName(`${selectedClient.company.name} - ${selectedQuarter} ${selectedYear} Campaign Report`);
    }
  }, [selectedClient, selectedQuarter, selectedYear]);

  const handleGenerate = () => {
    if (!selectedClientId || !reportName) return;

    setIsGenerating(true);
    setLoadingStep(0);
    setProgress(0);

    // Animate through loading steps
    const totalDuration = 4000; // 4 seconds
    const stepDuration = totalDuration / LOADING_MESSAGES.length;

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev >= LOADING_MESSAGES.length - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, stepDuration);

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, totalDuration / 50);

    // Navigate after animation completes
    setTimeout(() => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      
      // Store demo state in sessionStorage for the report page
      sessionStorage.setItem("demoState", JSON.stringify({
        clientId: selectedClientId,
        quarter: `${selectedQuarter} ${selectedYear}`,
        reportName,
      }));
      
      navigate("/demo/report");
    }, totalDuration + 500);
  };

  if (isGenerating) {
    const CurrentIcon = LOADING_MESSAGES[loadingStep].icon;
    
    return (
      <div className="min-h-screen bg-background relative flex items-center justify-center">
        <BackgroundFX />
        <div className="relative z-10 text-center space-y-8 max-w-md mx-auto px-4">
          {/* Pulsing Logo */}
          <div className="flex justify-center">
            <div className="animate-pulse">
              <KitcasterLogo className="h-12" />
            </div>
          </div>

          {/* Progress Ring */}
          <div className="relative w-32 h-32 mx-auto">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                className="text-primary transition-all duration-300 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <CurrentIcon className="w-10 h-10 text-primary animate-pulse" />
            </div>
          </div>

          {/* Loading Message */}
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground animate-fade-in">
              {LOADING_MESSAGES[loadingStep].message}
            </p>
            <p className="text-sm text-muted-foreground">
              Generating report for {selectedClient?.company.name}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <BackgroundFX />
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Campaign Report Demo</h1>
          <p className="text-muted-foreground">
            Generate a sample quarterly campaign report with AI-powered insights
          </p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Report Configuration
            </CardTitle>
            <CardDescription>
              Select a demo client and configure the report parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label htmlFor="client">Company</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select a company..." />
                </SelectTrigger>
                <SelectContent>
                  {DEMO_CLIENT_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Speaker Display */}
            {selectedClient && (
              <div className="space-y-2">
                <Label>Speaker</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  {selectedClient.company.logo_url && (
                    <img
                      src={selectedClient.company.logo_url}
                      alt={selectedClient.company.name}
                      className="w-10 h-10 rounded-full object-cover bg-background"
                    />
                  )}
                  <div>
                    <p className="font-medium">{selectedClient.speaker.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedClient.speaker.title}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quarter and Year Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quarter">Quarter</Label>
                <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                  <SelectTrigger id="quarter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">Q1</SelectItem>
                    <SelectItem value="Q2">Q2</SelectItem>
                    <SelectItem value="Q3">Q3</SelectItem>
                    <SelectItem value="Q4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Report Name */}
            <div className="space-y-2">
              <Label htmlFor="reportName">Report Name</Label>
              <Input
                id="reportName"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="Enter report name..."
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!selectedClientId || !reportName}
              className="w-full"
              size="lg"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
