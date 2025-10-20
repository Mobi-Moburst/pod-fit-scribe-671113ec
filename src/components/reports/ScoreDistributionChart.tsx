import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { scoreToColor } from '@/lib/reportTheme';

interface ScoreDistributionChartProps {
  data: Array<{ range: string; count: number }>;
}

export const ScoreDistributionChart = ({ data }: ScoreDistributionChartProps) => {
  const getColorForRange = (range: string) => {
    if (range === '9-10') return scoreToColor(9.5);
    if (range === '8-8.9') return scoreToColor(8.5);
    if (range === '7-7.9') return scoreToColor(7.5);
    if (range === '6-6.9') return scoreToColor(6.5);
    return scoreToColor(4);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" />
          <YAxis stroke="hsl(var(--muted-foreground))" />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            formatter={(value: any) => [`${value} shows`, 'Count']}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColorForRange(entry.range)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
