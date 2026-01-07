import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2 } from "lucide-react";

// CPM rates (midpoint values from industry benchmarks) and reach allocation
const PLATFORM_DATA = {
  linkedin: { name: "LinkedIn", cpm: 60.00, allocation: 0.60, color: "hsl(201 100% 35%)" },
  meta: { name: "Meta (FB/IG)", cpm: 10.50, allocation: 0.20, color: "hsl(221 83% 53%)" },
  youtube: { name: "YouTube", cpm: 4.50, allocation: 0.10, color: "hsl(0 72% 51%)" },
  tiktok: { name: "TikTok", cpm: 5.50, allocation: 0.07, color: "hsl(348 83% 47%)" },
  x: { name: "X (Twitter)", cpm: 1.50, allocation: 0.03, color: "hsl(0 0% 0%)" },
} as const;

// Multipliers for media valuation
const VISIBILITY_FACTOR = 1.5; // Feed resurfacing, cross-posting, episode promotion, guest reposts
const PREMIUM_CONTENT_FACTOR = 1.2; // Podcast-driven, editorial, thought leadership, non-interruptive

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
  // Calculate value for each platform using allocated reach and multipliers
  const platformBreakdown = Object.entries(PLATFORM_DATA).map(([key, platform]) => {
    const allocatedReach = totalSocialReach * platform.allocation;
    const baseValue = (allocatedReach / 1000) * platform.cpm;
    const adjustedValue = baseValue * VISIBILITY_FACTOR * PREMIUM_CONTENT_FACTOR;
    return {
      key,
      name: platform.name,
      cpm: platform.cpm,
      allocation: platform.allocation,
      allocatedReach,
      value: adjustedValue,
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
            Equivalent advertising cost to reach your allocated social audience across platforms, 
            adjusted for visibility (1.5×) and premium content factors (1.2×).
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
            Reach allocated by platform, with visibility (1.5×) and premium content (1.2×) multipliers applied.
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
                      {(platform.allocation * 100).toFixed(0)}% reach
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-2xl font-bold">
                    {formatCurrency(platform.value)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(platform.allocatedReach)} reach × ${platform.cpm} CPM
                  </p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Share of total value</span>
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

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Methodology:</strong> Total reach allocated by platform (LinkedIn 60%, Meta 20%, YouTube 10%, TikTok 7%, X 3%), 
            then multiplied by platform CPM rates and adjusted with visibility factor (1.5×) for feed resurfacing and cross-posting, 
            plus premium content factor (1.2×) for podcast-driven thought leadership content.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};