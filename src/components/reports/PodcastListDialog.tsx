import { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, Radio } from "lucide-react";
import { PodcastReportEntry } from "@/types/reports";
import { format, parseISO, isWithinInterval } from "date-fns";

interface PodcastListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  icon: typeof Calendar;
  podcasts: PodcastReportEntry[];
  dateField: 'date_booked' | 'date_published' | 'scheduled_date_time';
  dateRange?: { start: string; end: string };
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function isDateInRange(dateStr: string | undefined, range: { start: string; end: string }): boolean {
  if (!dateStr) return false;
  try {
    const date = parseISO(dateStr);
    return isWithinInterval(date, { start: parseISO(range.start), end: parseISO(range.end) });
  } catch {
    return false;
  }
}

export const PodcastListDialog = ({ open, onOpenChange, title, description, icon: Icon, podcasts, dateField, dateRange }: PodcastListDialogProps) => {
  const filtered = useMemo(() => {
    if (!dateRange) return podcasts;
    return podcasts.filter(p => {
      const dateVal = dateField === 'date_booked' ? p.date_booked 
        : dateField === 'date_published' ? p.date_published 
        : p.scheduled_date_time;
      return isDateInRange(dateVal, dateRange);
    });
  }, [podcasts, dateField, dateRange]);

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

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No podcasts found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Podcast</TableHead>
                <TableHead>{dateField === 'date_booked' ? 'Date Booked' : dateField === 'date_published' ? 'Date Published' : 'Recording Date'}</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((podcast, i) => (
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
                    {formatDate(dateField === 'date_booked' ? podcast.date_booked : dateField === 'date_published' ? podcast.date_published : podcast.scheduled_date_time)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      const link = dateField === 'date_published' 
                        ? (podcast.episode_link || podcast.apple_podcast_link)
                        : (podcast.apple_podcast_link || podcast.episode_link);
                      return link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null;
                    })()}
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