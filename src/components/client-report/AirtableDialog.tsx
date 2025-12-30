import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AirtableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedUrl: string;
  speakerName: string;
}

// Convert Airtable share URL to embed URL if needed
function toEmbedUrl(url: string): string {
  if (!url) return "";
  
  // If already an embed URL, return as-is
  if (url.includes("/embed/")) return url;
  
  // Convert share URL to embed URL
  // Example: https://airtable.com/app.../shr... → https://airtable.com/embed/app.../shr...
  const airtableMatch = url.match(/airtable\.com\/(app[^/]+)\/(shr[^/?]+)/);
  if (airtableMatch) {
    return `https://airtable.com/embed/${airtableMatch[1]}/${airtableMatch[2]}`;
  }
  
  return url;
}

export const AirtableDialog = ({
  open,
  onOpenChange,
  embedUrl,
  speakerName,
}: AirtableDialogProps) => {
  const embeddableUrl = toEmbedUrl(embedUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>{speakerName} - Activity Tracking</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {embeddableUrl && (
            <iframe
              src={embeddableUrl}
              className="w-full h-full border-0"
              title={`${speakerName} Activity Tracking`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
