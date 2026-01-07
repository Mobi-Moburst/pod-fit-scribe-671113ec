import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ReportData } from '@/types/reports';

interface SOVChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sovAnalysis: ReportData['sov_analysis'];
  clientName?: string;
}

// Custom label renderer with better visibility
const renderCustomLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, name, value, percent } = props;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  // Only show label if segment is large enough
  if (percent < 0.05) return null;
  
  return (
    <text
      x={x}
      y={y}
      fill="hsl(var(--foreground))"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-sm font-medium"
    >
      {`${name}: ${value}`}
    </text>
  );
};

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-lg">
        <p className="font-semibold text-foreground">{data.name}</p>
        <p className="text-muted-foreground">
          <span className="text-foreground font-medium">{data.value}</span> interviews
        </p>
      </div>
    );
  }
  return null;
};

// Custom legend
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-6">
      {payload?.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-foreground font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const SOVChartDialog = ({ open, onOpenChange, sovAnalysis, clientName }: SOVChartDialogProps) => {
  if (!sovAnalysis) return null;

  // Vibrant, distinct colors that work on dark backgrounds
  const competitorColors = [
    'hsl(240 5% 45%)',     // Muted grey
    'hsl(280 70% 65%)',    // Purple
    'hsl(160 70% 50%)',    // Teal
    'hsl(30 90% 60%)',     // Orange
    'hsl(340 80% 60%)',    // Pink
  ];
  
  const data = [
    { 
      name: clientName || 'Your Client', 
      value: sovAnalysis.client_interview_count,
      color: 'hsl(190 90% 55%)'  // Bright cyan for client
    },
    ...sovAnalysis.competitors.map((comp, index) => ({
      name: comp.name,
      value: comp.interview_count,
      color: competitorColors[index % competitorColors.length]
    }))
  ];

  const totalInterviews = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Peer Comparison Analysis</DialogTitle>
          <DialogDescription className="text-base">
            <span className="text-primary font-semibold">{clientName || 'Your client'}</span> represents{' '}
            <span className="text-primary font-bold">{sovAnalysis.client_percentage}%</span> of 
            podcast interviews compared to selected peers.
          </DialogDescription>
        </DialogHeader>
        
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-4 mt-2">
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-primary">{sovAnalysis.client_interview_count}</p>
            <p className="text-xs text-muted-foreground mt-1">Client Interviews</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalInterviews}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Interviews</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{sovAnalysis.competitors.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Peers Tracked</p>
          </div>
        </div>
        
        <div className="w-full h-[420px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={140}
                innerRadius={60}
                paddingAngle={2}
                label={renderCustomLabel}
                labelLine={false}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </DialogContent>
    </Dialog>
  );
};