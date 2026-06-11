import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2, Linkedin } from "lucide-react";

const LINKEDIN_CPM = 60.0;
const LINKEDIN_COLOR = "hsl(201 100% 35%)";
const VISIBILITY_FACTOR = 1.5;
const PREMIUM_CONTENT_FACTOR = 1.2;

interface SocialValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalSocialReach: number;
  hideMethodology?: boolean;
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

export const SocialValueDialog = ({ open, onOpenChange, totalSocialReach, hideMethodology = false }: SocialValueDialogProps) => {
  const baseValue = (totalSocialReach / 1000) * LINKEDIN_CPM;
  const totalSocialValue = baseValue * VISIBILITY_FACTOR * PREMIUM_CONTENT_FACTOR;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Social Value Analysis
          </DialogTitle>
          <DialogDescription>
            Equivalent LinkedIn advertising cost to reach your social audience.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
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
                Equivalent LinkedIn ad spend
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
        </div>

        <Card className="mt-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundColor: LINKEDIN_COLOR }} />
          <CardHeader className="pb-2 relative">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Linkedin className="h-4 w-4" style={{ color: LINKEDIN_COLOR }} />
                LinkedIn
              </CardTitle>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${LINKEDIN_COLOR}20`, color: LINKEDIN_COLOR }}
              >
                ${LINKEDIN_CPM.toFixed(2)} CPM
              </span>
            </div>
          </CardHeader>
          <CardContent className="relative space-y-2">
            <div className="text-2xl font-bold">{formatCurrency(totalSocialValue)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(totalSocialReach)} reach × ${LINKEDIN_CPM.toFixed(2)} CPM × {VISIBILITY_FACTOR}× visibility × {PREMIUM_CONTENT_FACTOR}× premium content
            </p>
            <div className="text-xs text-muted-foreground pt-2 border-t border-[rgba(255,255,255,0.05)]">
              Base ad cost: {formatCurrency(baseValue)} → with multipliers: {formatCurrency(totalSocialValue)}
            </div>
          </CardContent>
        </Card>

        {!hideMethodology && (
          <div className="mt-6 p-4 bg-[rgba(18,20,24,0.5)] rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Methodology:</strong> Total social reach × LinkedIn CPM ($60), adjusted with a visibility factor (1.5×) for feed resurfacing and cross-posting, plus a premium content factor (1.2×) for podcast-driven thought leadership content.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
