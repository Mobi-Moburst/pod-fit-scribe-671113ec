import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Sparkles, Target, MessageSquareQuote, Layers, TrendingUp } from "lucide-react";
import { ReportData } from "@/types/reports";
import { getGEOFraming } from "@/lib/geoFraming";

interface GEODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  geoAnalysis: ReportData["geo_analysis"];
  speakerName?: string;
}

const TIER_STYLES: Record<number, string> = {
  4: "bg-gradient-to-br from-primary/20 to-primary/5 border-primary/40 text-primary",
  3: "bg-gradient-to-br from-primary/15 to-primary/5 border-primary/30 text-primary",
  2: "bg-gradient-to-br from-accent/15 to-accent/5 border-accent/30 text-accent-foreground",
  1: "bg-muted/40 border-border text-foreground",
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(220 70% 60%)",
  "hsl(280 70% 60%)",
  "hsl(340 70% 60%)",
  "hsl(160 70% 60%)",
  "hsl(40 70% 60%)",
  "hsl(190 70% 60%)",
];

// Renders **bold** segments inside achievement lines.
function renderRichText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-foreground font-semibold">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export const GEODialog = ({ open, onOpenChange, geoAnalysis, speakerName }: GEODialogProps) => {
  if (!geoAnalysis) return null;

  const framing = getGEOFraming(geoAnalysis, speakerName);
  if (!framing) return null;

  const { top_prompts = [], topic_distribution = [] } = geoAnalysis;
  const tierStyle = TIER_STYLES[framing.tier.rank];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Visibility Intelligence
            {framing.primaryEngineLabel && (
              <Badge variant="outline" className="ml-1 font-normal">
                {framing.primaryEngineLabel}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-base text-foreground/80 pt-1 leading-relaxed">
            {framing.headline}
          </DialogDescription>
        </DialogHeader>

        {/* Tier hero card */}
        <div className={`rounded-xl border p-5 ${tierStyle}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Visibility Tier</p>
              <h3 className="text-2xl font-semibold">{framing.tier.label}</h3>
              <p className="text-sm opacity-80 mt-1">{framing.tier.description}</p>
            </div>
            <TrendingUp className="h-8 w-8 opacity-40 shrink-0" />
          </div>
          {framing.achievements.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              {framing.achievements.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span>{renderRichText(a)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Tabs defaultValue="prompts" className="w-full">
          <TabsList className={`grid w-full ${framing.showEngineFraming ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="prompts">
              <MessageSquareQuote className="h-3.5 w-3.5 mr-1.5" />
              Buyer Questions
            </TabsTrigger>
            <TabsTrigger value="topics">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Authority Domains
            </TabsTrigger>
            {framing.showEngineFraming && (
              <TabsTrigger value="engines">
                <Target className="h-3.5 w-3.5 mr-1.5" />
                AI Coverage
              </TabsTrigger>
            )}
          </TabsList>

          {/* Buyer Questions */}
          <TabsContent value="prompts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Buyer Questions Where You Surface</CardTitle>
                <CardDescription>
                  These are the actual high-intent queries decision-makers are asking AI assistants — and your
                  podcast appearances are part of the answer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {top_prompts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No buyer questions captured yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Question</TableHead>
                        {!framing.uniformPromptCounts && (
                          <TableHead className="text-right w-[100px]">Frequency</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {top_prompts.map((prompt, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="text-sm leading-relaxed">{prompt.prompt}</TableCell>
                          {!framing.uniformPromptCounts && (
                            <TableCell className="text-right text-sm">{prompt.count}</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">What this means:</strong> Each question represents a
                  decision-stage moment where buyers are looking for credible voices. Surfacing here means your
                  thought leadership is shaping the conversation before a sales call ever happens.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authority Domains */}
          <TabsContent value="topics" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Authority Domains</CardTitle>
                <CardDescription>
                  Strategic topic areas where AI assistants recognize you as a credible source.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={topic_distribution.slice(0, 8)}
                          dataKey="count"
                          nameKey="topic"
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          label={(entry) => entry.topic}
                        >
                          {topic_distribution.slice(0, 8).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-auto max-h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domain</TableHead>
                          <TableHead className="text-right">Mentions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topic_distribution.map((topic, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-sm">{topic.topic}</TableCell>
                            <TableCell className="text-right text-sm">{topic.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">What this means:</strong> Authority domains are the
                  strategic categories where you've earned algorithmic credibility. Expanding into adjacent
                  domains compounds AI visibility over time.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Coverage — only when 2+ engines tested */}
          {framing.showEngineFraming && (
            <TabsContent value="engines" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">AI Assistant Coverage</CardTitle>
                  <CardDescription>
                    Indexed across {framing.enginesTested.length} leading AI assistants:{" "}
                    {framing.enginesTested.join(", ")}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {framing.enginesTested.map((engine) => (
                      <div
                        key={engine}
                        className="p-4 rounded-lg border border-border bg-card flex items-center gap-3"
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{engine}</p>
                          <p className="text-xs text-muted-foreground">Surfaces your content</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
