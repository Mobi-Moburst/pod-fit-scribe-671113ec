import { Card } from '@/components/ui/card';
import { scoreToColor } from '@/lib/reportTheme';
import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';

interface CategoryHeatmapProps {
  data: Array<{
    category: string;
    avg_score: number;
    count: number;
    total_reach: number;
    color_intensity: number;
  }>;
}

type SortKey = 'category' | 'avg_score' | 'count' | 'total_reach';

export const CategoryHeatmap = ({ data }: CategoryHeatmapProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('avg_score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'string') {
      return aVal.localeCompare(bVal as string) * multiplier;
    }
    return ((aVal as number) - (bVal as number)) * multiplier;
  });

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Category Performance Heatmap</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th 
                className="text-left py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center gap-2">
                  Category <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('avg_score')}
              >
                <div className="flex items-center justify-center gap-2">
                  Avg Score <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('count')}
              >
                <div className="flex items-center justify-center gap-2">
                  Count <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
              <th 
                className="text-right py-3 px-4 font-semibold cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('total_reach')}
              >
                <div className="flex items-center justify-end gap-2">
                  Total Reach <ArrowUpDown className="w-4 h-4" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => {
              const bgColor = scoreToColor(row.avg_score);
              const opacity = 0.1 + (row.color_intensity * 0.2);
              
              return (
                <tr 
                  key={idx} 
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  style={{ 
                    backgroundColor: `${bgColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
                  }}
                >
                  <td className="py-3 px-4 font-medium">{row.category}</td>
                  <td className="text-center py-3 px-4">
                    <span 
                      className="inline-block px-3 py-1 rounded-full text-sm font-semibold text-background"
                      style={{ backgroundColor: bgColor }}
                    >
                      {row.avg_score.toFixed(2)}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">{row.count}</td>
                  <td className="text-right py-3 px-4">{row.total_reach.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
