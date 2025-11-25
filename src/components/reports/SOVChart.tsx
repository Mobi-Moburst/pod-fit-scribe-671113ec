import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ReportData } from '@/types/reports';

interface SOVChartProps {
  sovAnalysis: ReportData['sov_analysis'];
  clientName?: string;
}

export const SOVChart = ({ sovAnalysis, clientName }: SOVChartProps) => {
  if (!sovAnalysis) return null;
  
  // Generate colors for multiple competitors
  const competitorColors = [
    'hsl(var(--secondary))',
    'hsl(var(--accent))',
    'hsl(var(--muted))',
    'hsl(220 70% 60%)',
    'hsl(280 70% 60%)',
    'hsl(340 70% 60%)',
  ];
  
  const data = [
    { 
      name: clientName || 'Your Client', 
      value: sovAnalysis.client_interview_count,
      color: 'hsl(var(--primary))'
    },
    ...sovAnalysis.competitors.map((comp, index) => ({
      name: comp.name,
      value: comp.interview_count,
      color: competitorColors[index % competitorColors.length]
    }))
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Share of Voice</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Your client represents <strong className="text-foreground">{sovAnalysis.client_percentage}%</strong> of 
            total podcast interviews in this analysis.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(entry) => `${entry.name}: ${entry.value}`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
