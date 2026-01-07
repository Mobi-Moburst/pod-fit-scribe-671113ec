import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ReportData } from '@/types/reports';
import { Linkedin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface SOVChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sovAnalysis: ReportData['sov_analysis'];
  clientName?: string;
}

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

// Competitor info popover content
const CompetitorInfoCard = ({ competitor }: { competitor: { name: string; role?: string; peer_reason?: string; linkedin_url?: string; interview_count: number; color: string } }) => {
  return (
    <div className="space-y-3 min-w-[240px]">
      <div className="flex items-start gap-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: competitor.color }}
        >
          {competitor.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{competitor.name}</p>
          {competitor.role && (
            <p className="text-sm text-muted-foreground truncate">{competitor.role}</p>
          )}
        </div>
      </div>
      
      {competitor.peer_reason && (
        <div className="bg-muted/50 rounded-md p-3">
          <p className="text-xs text-muted-foreground mb-1">Peer Reason</p>
          <p className="text-sm text-foreground">{competitor.peer_reason}</p>
        </div>
      )}
      
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div>
          <span className="text-lg font-bold text-foreground">{competitor.interview_count}</span>
          <span className="text-sm text-muted-foreground ml-1">interviews</span>
        </div>
        {competitor.linkedin_url && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => window.open(competitor.linkedin_url, '_blank')}
          >
            <Linkedin className="h-4 w-4" />
            LinkedIn
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

export const SOVChartDialog = ({ open, onOpenChange, sovAnalysis, clientName }: SOVChartDialogProps) => {
  const [activeCompetitor, setActiveCompetitor] = useState<string | null>(null);

  if (!sovAnalysis) return null;

  // Vibrant, distinct colors that work on dark backgrounds
  const competitorColors = [
    'hsl(240, 5%, 45%)',     // Muted grey
    'hsl(280, 70%, 65%)',    // Purple
    'hsl(160, 70%, 50%)',    // Teal
    'hsl(30, 90%, 60%)',     // Orange
    'hsl(340, 80%, 60%)',    // Pink
  ];
  
  const clientColor = 'hsl(190, 90%, 55%)'; // Bright cyan for client

  interface ChartDataItem {
    name: string;
    value: number;
    color: string;
    isClient: boolean;
    role?: string;
    peer_reason?: string;
    linkedin_url?: string;
    interview_count?: number;
  }
  
  const data: ChartDataItem[] = [
    { 
      name: clientName || 'Your Client', 
      value: sovAnalysis.client_interview_count,
      color: clientColor,
      isClient: true
    },
    ...sovAnalysis.competitors.map((comp, index) => ({
      name: comp.name,
      value: comp.interview_count,
      color: competitorColors[index % competitorColors.length],
      role: comp.role,
      peer_reason: comp.peer_reason,
      linkedin_url: comp.linkedin_url,
      interview_count: comp.interview_count,
      isClient: false
    }))
  ];

  const totalInterviews = data.reduce((sum, item) => sum + item.value, 0);

  // Custom legend with clickable competitor names
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-6">
        {payload?.map((entry: any, index: number) => {
          const dataItem = data.find(d => d.name === entry.value);
          const isCompetitor = dataItem && !dataItem.isClient;
          
          if (isCompetitor && dataItem) {
            return (
              <Popover key={index} open={activeCompetitor === entry.value} onOpenChange={(open) => setActiveCompetitor(open ? entry.value : null)}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-foreground font-medium hover:underline">{entry.value}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="center">
                  <CompetitorInfoCard 
                    competitor={{
                      name: dataItem.name,
                      role: dataItem.role,
                      peer_reason: dataItem.peer_reason,
                      linkedin_url: dataItem.linkedin_url,
                      interview_count: dataItem.interview_count || dataItem.value,
                      color: dataItem.color
                    }} 
                  />
                </PopoverContent>
              </Popover>
            );
          }
          
          // Client entry (not clickable)
          return (
            <div key={index} className="flex items-center gap-2 px-3 py-1.5">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-foreground font-medium">{entry.value}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Custom label renderer with better visibility
  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, name, percent } = props;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    // Only show label if segment is large enough
    if (percent < 0.08) return null;
    
    return (
      <text
        x={x}
        y={y}
        fill="hsl(var(--foreground))"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Peer Comparison Analysis</DialogTitle>
          <DialogDescription className="text-base">
            <span className="text-primary font-semibold">{clientName || 'Your client'}</span> represents{' '}
            <span className="text-primary font-bold">{sovAnalysis.client_percentage}%</span> of 
            podcast interviews compared to selected peers.
            <span className="block text-sm mt-1 text-muted-foreground">Click on a competitor name below to see more details.</span>
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
