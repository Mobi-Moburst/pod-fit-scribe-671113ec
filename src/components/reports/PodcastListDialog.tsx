import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, Radio } from "lucide-react";
import { PodcastReportEntry } from "@/types/reports";
import { format, parseISO } from "date-fns";

interface PodcastListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  icon: typeof Calendar;
  podcasts: PodcastReportEntry[];
  dateField: 'date_booked' | 'date_published';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export const PodcastListDialog = ({ open, onOpenChange, title, description, icon: Icon, podcasts, dateField }: PodcastListDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {podcasts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No podcasts found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Podcast</TableHead>
                <TableHead>{dateField === 'date_booked' ? 'Date Booked' : 'Date Published'}</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {podcasts.map((podcast, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-medium">{podcast.show_title}</div>
                    {podcast.action && (
                      <Badge variant="secondary" className="mt-1 text-xs font-normal">
                        {podcast.action}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(dateField === 'date_booked' ? podcast.date_booked : podcast.date_published)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(podcast.episode_link || podcast.apple_podcast_link) && (
                      <a
                        href={podcast.episode_link || podcast.apple_podcast_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
