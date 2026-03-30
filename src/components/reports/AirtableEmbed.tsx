import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Table, X, Users } from "lucide-react";

interface SpeakerEmbed {
  speaker_name: string;
  embed_url: string;
  headshot_url?: string;
}

interface AirtableEmbedProps {
  embedUrl?: string;
  onHide?: () => void;
  speakerEmbeds?: SpeakerEmbed[];
}

export function AirtableEmbed({ embedUrl, onHide, speakerEmbeds }: AirtableEmbedProps) {
  // Determine if we have unique per-speaker embeds
  const uniqueSpeakerEmbeds = useMemo(() => {
    if (!speakerEmbeds || speakerEmbeds.length === 0) return null;
    const uniqueUrls = new Set(speakerEmbeds.map(s => s.embed_url));
    // Only show dropdown if there are multiple distinct URLs
    if (uniqueUrls.size <= 1) return null;
    return speakerEmbeds;
  }, [speakerEmbeds]);

  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(
    uniqueSpeakerEmbeds?.[0]?.speaker_name || ""
  );

  // Resolve current embed URL
  const currentEmbedUrl = useMemo(() => {
    if (uniqueSpeakerEmbeds) {
      const selected = uniqueSpeakerEmbeds.find(s => s.speaker_name === selectedSpeaker);
      return selected?.embed_url || uniqueSpeakerEmbeds[0]?.embed_url;
    }
    return embedUrl;
  }, [uniqueSpeakerEmbeds, selectedSpeaker, embedUrl]);

  if (!currentEmbedUrl) return null;

  // Convert share URL to embed URL if needed
  const getEmbedUrl = (url: string): string => {
    if (url.includes('/embed/')) return url;
    return url.replace('airtable.com/', 'airtable.com/embed/');
  };

  const embedSrc = getEmbedUrl(currentEmbedUrl);

  return (
    <Card className="relative group">
      {onHide && (
        <button
          onClick={onHide}
          className="absolute top-4 right-4 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
          title="Hide this section"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Table className="h-5 w-5 text-primary" />
            Activity Tracking
          </CardTitle>
          {uniqueSpeakerEmbeds && (
            <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
              <SelectTrigger className="w-[220px] print:hidden">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select speaker" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {uniqueSpeakerEmbeds.map((speaker) => (
                  <SelectItem key={speaker.speaker_name} value={speaker.speaker_name}>
                    {speaker.speaker_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Screen: Show iframe */}
        <div className="print:hidden">
          <iframe
            src={embedSrc}
            className="w-full rounded-md border border-border"
            style={{ height: '500px' }}
            title={`Airtable Activity View${uniqueSpeakerEmbeds ? ` - ${selectedSpeaker}` : ''}`}
          />
        </div>
        
        {/* Print: Show link message */}
        <div className="hidden print:block">
          <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-md border border-border">
            <ExternalLink className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Live Activity View</p>
              <p className="text-sm text-muted-foreground">
                View the full activity table at:{" "}
                <a 
                  href={currentEmbedUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {currentEmbedUrl}
                </a>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
