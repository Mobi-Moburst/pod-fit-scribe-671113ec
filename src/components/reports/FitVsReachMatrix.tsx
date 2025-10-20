import { Card } from '@/components/ui/card';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { scoreToColor } from '@/lib/reportTheme';

interface FitVsReachMatrixProps {
  data: Array<{
    show_title: string;
    fit_score: number;
    reach: number;
    engagement: number;
    url: string;
  }>;
}

export const FitVsReachMatrix = ({ data }: FitVsReachMatrixProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Fit Score × Reach Matrix</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Quadrant analysis: High-fit, high-reach shows are ideal targets
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            type="number" 
            dataKey="fit_score" 
            name="Fit Score" 
            domain={[0, 10]}
            stroke="hsl(var(--muted-foreground))"
            label={{ value: 'Fit Score', position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            type="number" 
            dataKey="reach" 
            name="Reach" 
            stroke="hsl(var(--muted-foreground))"
            label={{ value: 'Listeners', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            formatter={(value: any, name: string) => {
              if (name === 'Reach') return [value.toLocaleString(), 'Listeners'];
              if (name === 'Fit Score') return [value.toFixed(1), 'Score'];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.show_title;
              }
              return '';
            }}
          />
          <ReferenceLine x={7.5} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
          <Scatter name="Podcasts" data={data}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={scoreToColor(entry.fit_score)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </Card>
  );
};
