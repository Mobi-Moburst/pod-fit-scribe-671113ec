import { useState } from 'react';
import { BatchRow } from '@/types/batch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResultsTableProps {
  rows: BatchRow[];
  selectedRows: Set<string>;
  onRowSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onRowClick: (row: BatchRow) => void;
  onRetry: (row: BatchRow) => void;
  loading?: boolean;
}

export function ResultsTable({ 
  rows, 
  selectedRows, 
  onRowSelect, 
  onSelectAll, 
  onRowClick, 
  onRetry,
  loading = false 
}: ResultsTableProps) {
  const allSelected = rows.length > 0 && rows.every(row => selectedRows.has(row.id));
  const someSelected = rows.some(row => selectedRows.has(row.id));
  
  const getVerdictColor = (verdict?: string) => {
    switch (verdict) {
      case 'Fit': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'Consider': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'Not': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };
  
  const isStale = (date?: string) => {
    if (!date) return false;
    const publishDate = new Date(date);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return publishDate < ninetyDaysAgo;
  };
  
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead className="min-w-[200px]">Podcast</TableHead>
            <TableHead>Listeners</TableHead>
            <TableHead>Reach</TableHead>
            <TableHead className="min-w-[150px]">Categories</TableHead>
            <TableHead>Last Published</TableHead>
            <TableHead>Verdict</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Eligibility</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(row)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedRows.has(row.id)}
                  onCheckedChange={(checked) => onRowSelect(row.id, !!checked)}
                />
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium truncate max-w-[300px]">
                    {row.show_title || new URL(row.podcast_url).hostname}
                  </div>
                  <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                    {row.podcast_url}
                  </div>
                </div>
              </TableCell>
              
              {/* Listeners Per Episode */}
              <TableCell>
                {row.metadata?.listeners_per_episode !== undefined && (
                  <div className="text-sm">
                    <div className="font-medium">
                      {row.metadata.listeners_per_episode.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      per ep
                    </div>
                  </div>
                )}
              </TableCell>

              {/* Social Reach */}
              <TableCell>
                {row.metadata?.social_reach !== undefined && (
                  <div className="text-sm">
                    <div className="font-medium">
                      {row.metadata.social_reach.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      followers
                    </div>
                  </div>
                )}
              </TableCell>

              {/* Categories */}
              <TableCell>
                {row.metadata?.categories && (
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {row.metadata.categories.split(',').slice(0, 2).map((cat, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {cat.trim()}
                      </Badge>
                    ))}
                    {row.metadata.categories.split(',').length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{row.metadata.categories.split(',').length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </TableCell>
              
              {/* Last Published Date */}
              <TableCell>
                {row.last_publish_date ? (
                  <div className="text-sm">
                    <div className="font-medium">
                      {new Date(row.last_publish_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    {isStale(row.last_publish_date) && (
                      <div className="text-xs text-amber-600">
                        Stale
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Unknown</span>
                )}
              </TableCell>
              
              <TableCell>
                {row.verdict && (
                  <Badge className={cn('text-xs', getVerdictColor(row.verdict))}>
                    {row.verdict}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {row.overall_score !== undefined && (
                  <span className="font-mono">
                    {Math.round(row.overall_score)}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {row.confidence !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    {Math.round(row.confidence * 100)}%
                  </span>
                )}
              </TableCell>
              <TableCell>
                {row.eligibility_class && (
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">
                      {row.eligibility_class.replace('_', ' ')}
                    </Badge>
                    {row.eligibility_action && (
                      <div className="text-xs text-muted-foreground">
                        {row.eligibility_action}
                      </div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getStatusIcon(row.status)}
                  {row.error && (
                    <span className="text-xs text-red-600 truncate max-w-[100px]">
                      {row.error}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                {row.status === 'error' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRetry(row)}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {rows.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No results to display
        </div>
      )}
    </div>
  );
}