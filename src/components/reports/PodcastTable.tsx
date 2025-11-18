import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

import { PodcastReportEntry } from "@/types/reports";

interface PodcastTableProps {
  podcasts: PodcastReportEntry[];
}

export const PodcastTable = ({ podcasts }: PodcastTableProps) => {
  const [sortBy, setSortBy] = useState<'score' | 'reach'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedPodcasts = [...podcasts].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'score') {
      return multiplier * (a.overall_score - b.overall_score);
    } else {
      const aReach = a.listeners_per_episode || 0;
      const bReach = b.listeners_per_episode || 0;
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

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'Fit': return 'default';
      case 'Consider': return 'secondary';
      case 'Not': return 'outline';
      default: return 'outline';
    }
  };

  const formatNumber = (num?: number) => {
    if (!num) return '-';
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
            {sortedPodcasts.map((podcast, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{podcast.show_title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{podcast.overall_score.toFixed(1)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatNumber(podcast.listeners_per_episode)}
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
                  {podcast.episode_link ? (
                    <a 
                      href={podcast.episode_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      Listen
                    </a>
                  ) : '-'}
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
