import { ExternalLink, Table } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityTrackingSlideProps {
  embedUrl: string;
  clientName?: string;
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

export const ActivityTrackingSlide = ({ embedUrl, clientName }: ActivityTrackingSlideProps) => {
  const embeddableUrl = toEmbedUrl(embedUrl);

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Table className="h-8 w-8 text-primary" />
            Activity Tracking
          </h2>
          {clientName && (
            <p className="text-lg text-muted-foreground">Live campaign activity for {clientName}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.open(embedUrl, '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          Open in Airtable
        </Button>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-border overflow-hidden bg-card">
        {embeddableUrl && (
          <iframe
            src={embeddableUrl}
            className="w-full h-full border-0"
            style={{ minHeight: '500px' }}
            title="Activity Tracking"
          />
        )}
      </div>
    </div>
  );
};
