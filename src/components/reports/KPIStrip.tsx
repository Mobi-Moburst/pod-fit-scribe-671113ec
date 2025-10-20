import { Card } from '@/components/ui/card';
import { TrendingUp, Target, Users, Award, Percent } from 'lucide-react';

interface KPIStripProps {
  data: {
    total_evaluated: number;
    avg_score: number;
    high_fit_count: number;
    total_reach: number;
    high_confidence_count?: number;
  };
}

export const KPIStrip = ({ data }: KPIStripProps) => {
  const successRate = ((data.high_fit_count / data.total_evaluated) * 100).toFixed(1);
  
  const stats = [
    {
      label: 'Podcasts Evaluated',
      value: data.total_evaluated.toLocaleString(),
      icon: Target,
      color: 'text-primary'
    },
    {
      label: 'Average Fit Score',
      value: data.avg_score.toFixed(2),
      icon: TrendingUp,
      color: data.avg_score >= 7 ? 'text-green-500' : 'text-amber-500'
    },
    {
      label: 'High-Fit Shows',
      value: data.high_fit_count.toLocaleString(),
      icon: Award,
      color: 'text-green-500'
    },
    {
      label: 'Total Reach',
      value: `${(data.total_reach / 1000).toFixed(0)}K`,
      icon: Users,
      color: 'text-accent'
    },
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      icon: Percent,
      color: 'text-primary'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <Icon className={`w-5 h-5 ${stat.color}`} />
            </div>
          </Card>
        );
      })}
    </div>
  );
};
