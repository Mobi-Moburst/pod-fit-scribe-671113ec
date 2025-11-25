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

export const SOVChartDialog = ({ open, onOpenChange, sovAnalysis, clientName }: SOVChartDialogProps) => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share of Voice Analysis</DialogTitle>
          <DialogDescription>
            {clientName || 'Your client'} represents <strong>{sovAnalysis.client_percentage}%</strong> of 
            total podcast interviews in this competitive analysis.
          </DialogDescription>
        </DialogHeader>
        
        <div className="w-full h-[500px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={150}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
