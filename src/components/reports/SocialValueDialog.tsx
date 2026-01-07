import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2 } from "lucide-react";

// CPM rates (midpoint values from industry benchmarks)
const PLATFORM_CPM_RATES = {
  meta: { name: "Meta (FB/IG)", cpm: 10.50, color: "hsl(221 83% 53%)" },
  tiktok: { name: "TikTok", cpm: 5.50, color: "hsl(348 83% 47%)" },
  youtube: { name: "YouTube", cpm: 4.50, color: "hsl(0 72% 51%)" },
  linkedin: { name: "LinkedIn", cpm: 60.00, color: "hsl(201 100% 35%)" },
  x: { name: "X (Twitter)", cpm: 1.50, color: "hsl(0 0% 0%)" },
} as const;

interface SocialValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalSocialReach: number;
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

export const SocialValueDialog = ({ open, onOpenChange, totalSocialReach }: SocialValueDialogProps) => {
  // Calculate value for each platform using the total social reach
  const platformBreakdown = Object.entries(PLATFORM_CPM_RATES).map(([key, platform]) => {
    const value = (totalSocialReach / 1000) * platform.cpm;
    return {
      key,
      name: platform.name,
      cpm: platform.cpm,
      value,
      color: platform.color,
    };
  });

  // Calculate total social value (sum of all platforms)
  const totalSocialValue = platformBreakdown.reduce((sum, p) => sum + p.value, 0);
  
  // Calculate percentage for each platform
  const platformsWithPercentage = platformBreakdown.map(p => ({
    ...p,
    percentage: totalSocialValue > 0 ? (p.value / totalSocialValue) * 100 : 0,
  }));

  // Find highest value platform
  const highestValuePlatform = platformsWithPercentage.reduce(
    (max, p) => (p.value > max.value ? p : max),
    platformsWithPercentage[0]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Social Value Analysis
          </DialogTitle>
          <DialogDescription>
            Equivalent advertising cost to reach your combined social audience across platforms.
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Social Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {formatCurrency(totalSocialValue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Equivalent ad spend across all platforms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Social Reach
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(totalSocialReach)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Combined social following
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Highest Value Platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {highestValuePlatform?.name || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(highestValuePlatform?.value || 0)} ({highestValuePlatform?.percentage.toFixed(0)}%)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Platform Breakdown */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Platform Breakdown</h3>
          <p className="text-sm text-muted-foreground mb-4">
            What it would cost to reach your {formatNumber(totalSocialReach)} followers through paid advertising on each platform.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformsWithPercentage.map((platform) => (
              <Card key={platform.key} className="relative overflow-hidden">
                <div 
                  className="absolute inset-0 opacity-5"
                  style={{ backgroundColor: platform.color }}
                />
                <CardHeader className="pb-2 relative">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {platform.name}
                    </CardTitle>
                    <span 
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ 
                        backgroundColor: `${platform.color}20`,
                        color: platform.color,
                      }}
                    >
                      ${platform.cpm} CPM
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-2xl font-bold">
                    {formatCurrency(platform.value)}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Share of total</span>
                      <span>{platform.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${platform.percentage}%`,
                          backgroundColor: platform.color,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Values calculated using industry-average CPM rates. Meta: $10.50, TikTok: $5.50, 
            YouTube: $4.50, LinkedIn: $60.00, X: $1.50. Actual advertising costs may vary based on targeting, 
            ad format, audience demographics, and market conditions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};