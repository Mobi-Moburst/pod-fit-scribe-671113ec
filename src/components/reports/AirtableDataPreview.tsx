import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AirtableCSVRow } from "@/hooks/use-airtable-connection";

interface AirtableDataPreviewProps {
  data: AirtableCSVRow[];
  className?: string;
}

export const AirtableDataPreview = ({ data, className }: AirtableDataPreviewProps) => {
  const [open, setOpen] = useState(false);

  if (!data || data.length === 0) return null;

  const truncate = (str?: string, len = 50) => {
    if (!str) return "-";
    return str.length > len ? str.slice(0, len) + "…" : str;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
          {open ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {open ? "Hide records" : "Preview records"}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 border rounded-md overflow-auto max-h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs whitespace-nowrap">Podcast Name</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Action</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Recording Date</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Date Booked</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Date Published</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Episode Link</TableHead>
                <TableHead className="text-xs whitespace-nowrap">Show Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs py-1.5 font-medium">{row.podcast_name || "-"}</TableCell>
                  <TableCell className="text-xs py-1.5">{row.action || "-"}</TableCell>
                  <TableCell className="text-xs py-1.5">{row.scheduled_date_time || "-"}</TableCell>
                  <TableCell className="text-xs py-1.5">{row.date_booked || "-"}</TableCell>
                  <TableCell className="text-xs py-1.5">{row.date_published || "-"}</TableCell>
                  <TableCell className="text-xs py-1.5">
                    {row.link_to_episode ? (
                      <a href={row.link_to_episode} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {truncate(row.link_to_episode, 30)}
                      </a>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-xs py-1.5 text-muted-foreground">{truncate(row.show_notes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
