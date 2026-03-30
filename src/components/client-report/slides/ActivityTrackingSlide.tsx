import { useState, useMemo } from "react";
import { ExternalLink, Table, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SpeakerEmbed {
  speaker_name: string;
  embed_url: string;
}

interface ActivityTrackingSlideProps {
  embedUrl: string;
  clientName?: string;
  speakerEmbeds?: SpeakerEmbed[];
}

// Convert Airtable share URL to embed URL if needed
function toEmbedUrl(url: string): string {
  if (!url) return "";
  if (url.includes("/embed/")) return url;
  const airtableMatch = url.match(/airtable\.com\/(app[^/]+)\/(shr[^/?]+)/);
  if (airtableMatch) {
    return `https://airtable.com/embed/${airtableMatch[1]}/${airtableMatch[2]}`;
  }
  return url;
}

export const ActivityTrackingSlide = ({ embedUrl, clientName, speakerEmbeds }: ActivityTrackingSlideProps) => {
  // Determine if we have unique per-speaker embeds
  const uniqueSpeakerEmbeds = useMemo(() => {
    if (!speakerEmbeds || speakerEmbeds.length === 0) return null;
    const uniqueUrls = new Set(speakerEmbeds.map(s => s.embed_url));
    if (uniqueUrls.size <= 1) return null;
    return speakerEmbeds;
  }, [speakerEmbeds]);

  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(
    uniqueSpeakerEmbeds?.[0]?.speaker_name || ""
  );

  const currentEmbedUrl = useMemo(() => {
    if (uniqueSpeakerEmbeds) {
      const selected = uniqueSpeakerEmbeds.find(s => s.speaker_name === selectedSpeaker);
      return selected?.embed_url || uniqueSpeakerEmbeds[0]?.embed_url;
    }
    return embedUrl;
  }, [uniqueSpeakerEmbeds, selectedSpeaker, embedUrl]);

  const embeddableUrl = toEmbedUrl(currentEmbedUrl);

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Table className="h-8 w-8 text-primary" />
            Activity Tracking
          </h2>
          {clientName && (
            <p className="text-lg text-muted-foreground">
              Live campaign activity for {clientName}
              {uniqueSpeakerEmbeds && selectedSpeaker ? ` — ${selectedSpeaker}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {uniqueSpeakerEmbeds && (
            <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
              <SelectTrigger className="w-[220px]">
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
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open(currentEmbedUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Open in Airtable
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-border overflow-hidden bg-card">
        {embeddableUrl && (
          <iframe
            src={embeddableUrl}
            className="w-full h-full border-0"
            style={{ minHeight: '500px' }}
            title={`Activity Tracking${uniqueSpeakerEmbeds ? ` - ${selectedSpeaker}` : ''}`}
          />
        )}
      </div>
    </div>
  );
};
