import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DEMO_CLIENT_OPTIONS, DEMO_CLIENTS } from "@/data/demoClients";
import { Loader2, Sparkles, FileText, Radio, TrendingUp, BarChart3, Target, Users } from "lucide-react";
import { KitcasterLogo } from "@/components/KitcasterLogo";
import { Badge } from "@/components/ui/badge";

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
  const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([]);

  const selectedClient = selectedClientId ? DEMO_CLIENTS[selectedClientId] : null;
  const selectedClientOption = DEMO_CLIENT_OPTIONS.find(c => c.id === selectedClientId);

  // Initialize selected speakers when multi-speaker client is selected (default: all)
  useEffect(() => {
    if (selectedClient?.isMultiSpeaker && selectedClient.speakers) {
      setSelectedSpeakerIds(selectedClient.speakers.map(s => s.id));
    } else {
      setSelectedSpeakerIds([]);
    }
  }, [selectedClientId]);

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
        selectedSpeakerIds: selectedClient?.isMultiSpeaker ? selectedSpeakerIds : undefined,
      }));
      
      navigate("/demo/report");
    }, totalDuration + 500);
  };

  if (isGenerating) {
    const CurrentIcon = LOADING_MESSAGES[loadingStep].icon;
    
    return (
      <div className="min-h-screen relative flex items-center justify-center">
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
    <div className="min-h-screen relative">
      <BackgroundFX />
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl relative z-10">
        {/* Header matching Reports page style */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Podcast Campaign Reports</h1>
          <p className="text-muted-foreground">
            Generate quarterly campaign reports with comprehensive performance analytics
          </p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              New Report
            </CardTitle>
            <CardDescription>
              Select a client and configure report parameters
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
                      <div className="flex items-center gap-2">
                        <span>{option.name}</span>
                        {option.isMultiSpeaker && (
                          <Badge variant="secondary" className="text-xs">
                            {option.speakers.length} speakers
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Speaker Display - Single Speaker */}
            {selectedClient && !selectedClient.isMultiSpeaker && selectedClient.speaker && (
              <div className="space-y-2">
                <Label>Speaker</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  {selectedClient.speaker.headshot_url ? (
                    <img
                      src={selectedClient.speaker.headshot_url}
                      alt={selectedClient.speaker.name}
                      className="w-10 h-10 rounded-full object-cover bg-background"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-primary">
                        {selectedClient.speaker.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{selectedClient.speaker.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedClient.speaker.title}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Speaker Display - Multi-Speaker with Selection */}
            {selectedClient && selectedClient.isMultiSpeaker && selectedClient.speakers && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Select Speakers to Include
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Choose which speakers to feature in this report
                </p>
                <div className="space-y-2">
                  {selectedClient.speakers.map((speaker) => {
                    const isChecked = selectedSpeakerIds.includes(speaker.id);
                    return (
                      <div 
                        key={speaker.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          isChecked 
                            ? "bg-primary/5 border-primary/30" 
                            : "bg-muted/50 border-border/50 opacity-60"
                        }`}
                        onClick={() => {
                          setSelectedSpeakerIds(prev => 
                            isChecked
                              ? prev.filter(id => id !== speaker.id)
                              : [...prev, speaker.id]
                          );
                        }}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            setSelectedSpeakerIds(prev => 
                              checked
                                ? [...prev, speaker.id]
                                : prev.filter(id => id !== speaker.id)
                            );
                          }}
                          className="shrink-0"
                        />
                        {speaker.headshot_url ? (
                          <img
                            src={speaker.headshot_url}
                            alt={speaker.name}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-medium text-primary">
                              {speaker.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{speaker.name}</p>
                          <p className="text-sm text-muted-foreground">{speaker.title}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedSpeakerIds.length === 0 && (
                  <p className="text-sm text-destructive">Please select at least one speaker</p>
                )}
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
              disabled={!selectedClientId || !reportName || (selectedClient?.isMultiSpeaker && selectedSpeakerIds.length === 0)}
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
