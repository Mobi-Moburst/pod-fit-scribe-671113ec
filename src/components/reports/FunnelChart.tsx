import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface FunnelChartProps {
  data: {
    qualified: { count: number; percentage: string };
    consider: { count: number; percentage: string };
    not_fit: { count: number; percentage: string };
  };
}

export const FunnelChart = ({ data }: FunnelChartProps) => {
  const chartData = [
    { name: 'High Fit (8+)', value: data.qualified.count, percentage: data.qualified.percentage, color: '#10b981' },
    { name: 'Consider (6-7.9)', value: data.consider.count, percentage: data.consider.percentage, color: '#f59e0b' },
    { name: 'Not Fit (<6)', value: data.not_fit.count, percentage: data.not_fit.percentage, color: '#ef4444' }
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Fit Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
          <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={120} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            formatter={(value: any, name: any, props: any) => [
              `${value} shows (${props.payload.percentage}%)`,
              ''
            ]}
          />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
