import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ReportData } from '@/types/reports';

interface SOVChartProps {
  sovAnalysis: ReportData['sov_analysis'];
}

export const SOVChart = ({ sovAnalysis }: SOVChartProps) => {
  if (!sovAnalysis) return null;
  
  const data = [
    { 
      name: sovAnalysis.client_name, 
      value: sovAnalysis.client_interview_count,
      color: 'hsl(var(--primary))'
    },
    ...sovAnalysis.competitors.map(comp => ({
      name: comp.name,
      value: comp.interview_count,
      color: 'hsl(var(--secondary))'
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
            <strong className="text-foreground">{sovAnalysis.client_name}</strong> represents <strong className="text-foreground">{sovAnalysis.client_percentage}%</strong> of 
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
