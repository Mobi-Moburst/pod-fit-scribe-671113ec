import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientCombobox } from "@/components/ClientCombobox";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Navbar } from "@/components/layout/Navbar";
import { toast } from "sonner";
import { Loader2, Download, Calendar, LinkIcon } from "lucide-react";
import { callPrepSheetAnalyze, generatePrepSheetPDF } from "@/utils/prepSheet";

const PrepSheet = () => {
  const [url, setUrl] = useState("");
  const [recordingDate, setRecordingDate] = useState("");
  const [recordingTime, setRecordingTime] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [manualLinkedIn, setManualLinkedIn] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [prepSheetData, setPrepSheetData] = useState<any>(null);

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const selectedClientData = clients?.find(c => c.id === selectedClient);

  const handleGenerate = async () => {
    if (!url || !recordingDate || !recordingTime || !selectedClient) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await callPrepSheetAnalyze({
        url,
        client: selectedClientData,
        recordingDateTime: `${recordingDate} ${recordingTime}`,
        manualLinkedIn: manualLinkedIn || undefined
      });

      if (result.success) {
        setPrepSheetData(result.data);
        toast.success("Prep sheet generated successfully!");
      } else {
        toast.error(result.error || "Failed to generate prep sheet");
      }
    } catch (error) {
      console.error("Error generating prep sheet:", error);
      toast.error("Failed to generate prep sheet");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!prepSheetData) return;
    
    try {
      await generatePrepSheetPDF(prepSheetData, selectedClientData);
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <BackgroundFX />
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 gradient-text">
              Prep Sheet Generator
            </h1>
            <p className="text-muted-foreground text-lg">
              Generate professional interview preparation sheets for your clients
            </p>
          </div>

          <Card className="card-surface p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="url" className="text-sm font-medium flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Podcast URL *
                  </Label>
                  <Input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/podcast-episode"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="client" className="text-sm font-medium">
                    Client *
                  </Label>
                  <ClientCombobox 
                    value={selectedClient} 
                    onChange={setSelectedClient}
                    clients={clients || []}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="recordingDate" className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Recording Date *
                  </Label>
                  <Input
                    id="recordingDate"
                    type="date"
                    value={recordingDate}
                    onChange={(e) => setRecordingDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="recordingTime" className="text-sm font-medium">
                    Recording Time *
                  </Label>
                  <Input
                    id="recordingTime"
                    type="time"
                    value={recordingTime}
                    onChange={(e) => setRecordingTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {prepSheetData?.needsManualLinkedIn && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <Label htmlFor="manualLinkedIn" className="text-sm font-medium text-foreground">
                  Manual Research Needed: Host LinkedIn URL
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  We couldn't automatically find the host's LinkedIn profile. Please provide it manually for better prep sheet quality.
                </p>
                <Input
                  id="manualLinkedIn"
                  type="url"
                  value={manualLinkedIn}
                  onChange={(e) => setManualLinkedIn(e.target.value)}
                  placeholder="https://linkedin.com/in/host-name"
                  className="mt-1"
                />
                <Button 
                  onClick={handleGenerate} 
                  className="mt-3" 
                  size="sm"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    "Regenerate with LinkedIn"
                  )}
                </Button>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !url || !recordingDate || !recordingTime || !selectedClient}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Prep Sheet"
                )}
              </Button>

              {prepSheetData && (
                <Button 
                  onClick={handleDownloadPDF}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
              )}
            </div>
          </Card>

          {prepSheetData && (
            <Card className="card-surface p-6">
              <h2 className="text-2xl font-semibold mb-4">Generated Prep Sheet</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-medium text-foreground">Show Title:</h3>
                  <p className="text-muted-foreground">{prepSheetData.showTitle}</p>
                </div>
                
                <div>
                  <h3 className="font-medium text-foreground">Host Information:</h3>
                  <p className="text-muted-foreground">{prepSheetData.hostName}</p>
                  {prepSheetData.hostLinkedIn && (
                    <a 
                      href={prepSheetData.hostLinkedIn} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      LinkedIn Profile
                    </a>
                  )}
                </div>

                {prepSheetData.talkingPoints && (
                  <div>
                    <h3 className="font-medium text-foreground">Key Talking Points:</h3>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      {prepSheetData.talkingPoints.map((point: string, index: number) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {prepSheetData.metrics && (
                  <div>
                    <h3 className="font-medium text-foreground">Notable Metrics:</h3>
                    <p className="text-muted-foreground">{prepSheetData.metrics}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrepSheet;