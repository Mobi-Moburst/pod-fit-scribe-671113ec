import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Table, X } from "lucide-react";

interface AirtableEmbedProps {
  embedUrl?: string;
  onHide?: () => void;
}

export function AirtableEmbed({ embedUrl, onHide }: AirtableEmbedProps) {
  if (!embedUrl) return null;

  // Convert share URL to embed URL if needed
  const getEmbedUrl = (url: string): string => {
    // If it's already an embed URL, return as-is
    if (url.includes('/embed/')) return url;
    // Convert shared view URL to embed format
    // https://airtable.com/appXXX/shrYYY -> https://airtable.com/embed/appXXX/shrYYY
    return url.replace('airtable.com/', 'airtable.com/embed/');
  };

  const embedSrc = getEmbedUrl(embedUrl);

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
        <CardTitle className="flex items-center gap-2">
          <Table className="h-5 w-5 text-primary" />
          Activity Tracking
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Screen: Show iframe */}
        <div className="print:hidden">
          <iframe
            src={embedSrc}
            className="w-full rounded-md border border-border"
            style={{ height: '500px' }}
            title="Airtable Activity View"
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
                  href={embedUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {embedUrl}
                </a>
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
