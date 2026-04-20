import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableNumber } from "./EditableNumber";

import { PodcastReportEntry } from "@/types/reports";

interface PodcastTableProps {
  podcasts: PodcastReportEntry[];
  /**
   * When provided, enables inline editing of per-row listeners_per_episode.
   * Receives the index in the *original* podcasts array and the new value.
   */
  onEditReach?: (originalIndex: number, next: number) => void;
}

export const PodcastTable = ({ podcasts, onEditReach }: PodcastTableProps) => {
  const [sortBy, setSortBy] = useState<'score' | 'reach'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Track original indices so edits map back even after sorting
  const indexed = podcasts.map((p, i) => ({ podcast: p, originalIndex: i }));
  const sortedPodcasts = [...indexed].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'score') {
      return multiplier * (a.podcast.overall_score - b.podcast.overall_score);
    } else {
      const aReach = a.podcast.listeners_per_episode || 0;
      const bReach = b.podcast.listeners_per_episode || 0;
      return multiplier * (aReach - bReach);
    }
  });

  const toggleSort = (field: 'score' | 'reach') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null || num === 0) return '-';
    return num.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Podcast Breakdown ({podcasts.length} Total)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Show Title</TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => toggleSort('score')}
                  className="h-auto p-0 hover:bg-transparent"
                >
                  Score <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => toggleSort('reach')}
                  className="h-auto p-0 hover:bg-transparent"
                >
                  Reach <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Date Published</TableHead>
              <TableHead>Episode Link</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Categories</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPodcasts.map(({ podcast, originalIndex }) => (
              <TableRow key={originalIndex}>
                <TableCell className="font-medium">{podcast.show_title}</TableCell>
                <TableCell>
                  {podcast.overall_score > 0 ? (
                    <Badge variant="outline">{podcast.overall_score.toFixed(1)}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {onEditReach ? (
                    <EditableNumber
                      value={podcast.listeners_per_episode || 0}
                      onSave={(next) => onEditReach(originalIndex, next)}
                      format={(n) => (n > 0 ? n.toLocaleString() : '-')}
                      ariaLabel={`Edit reach for ${podcast.show_title}`}
                    />
                  ) : (
                    formatNumber(podcast.listeners_per_episode)
                  )}
                </TableCell>
                <TableCell>
                  {podcast.action ? (
                    <Badge variant={
                      podcast.action.toLowerCase().includes('podcast recording') 
                        ? 'default' 
                        : 'secondary'
                    }>
                      {podcast.action}
                    </Badge>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {podcast.date_published 
                    ? new Date(podcast.date_published).toLocaleDateString() 
                    : '-'}
                </TableCell>
                <TableCell>
                  {podcast.episode_link && 
                   podcast.episode_link.trim() !== '' && 
                   podcast.episode_link.toLowerCase() !== 'n/f' &&
                   podcast.episode_link.toLowerCase() !== 'na' &&
                   podcast.episode_link.toLowerCase() !== 'n/a' ? (
                    <a 
                      href={podcast.episode_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      Listen
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {podcast.episode_duration_minutes 
                    ? `${podcast.episode_duration_minutes} min`
                    : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {podcast.categories || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
