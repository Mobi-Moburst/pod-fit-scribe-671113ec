import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContentGapAnalysis } from "@/types/reports";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ContentGapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gapAnalysis: ContentGapAnalysis | null;
  hasSOVPeers?: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--destructive))', '#8884d8', '#82ca9d', '#ffc658'];

export function ContentGapDialog({ open, onOpenChange, gapAnalysis, hasSOVPeers = true }: ContentGapDialogProps) {
  if (!gapAnalysis) return null;

  const stageData = gapAnalysis.gaps_by_stage.map(s => ({
    name: s.stage,
    gaps: s.gap_count,
    total: s.total,
    coverage: Math.round(((s.total - s.gap_count) / s.total) * 100)
  }));

  const topicData = gapAnalysis.gaps_by_topic.slice(0, 10).map(t => ({
    name: t.topic.length > 25 ? t.topic.substring(0, 25) + '...' : t.topic,
    fullName: t.topic,
    gaps: t.gap_count,
    total: t.total
  }));

  const competitorData = gapAnalysis.top_competitors.slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Content Gap Analysis</DialogTitle>
          <DialogDescription>
            Analyzing {gapAnalysis.total_prompts} prompts • {gapAnalysis.coverage_percentage}% coverage • {gapAnalysis.total_gaps} gaps identified
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="summary" className="mt-4">
          <TabsList className={`grid w-full ${hasSOVPeers ? "grid-cols-4" : "grid-cols-3"}`}>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            {hasSOVPeers && <TabsTrigger value="competitors">Competitors</TabsTrigger>}
            <TabsTrigger value="priority">Priority Gaps</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6 mt-4">
            {/* Coverage Overview */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Coverage</span>
                <span className="font-semibold">{gapAnalysis.coverage_percentage}%</span>
              </div>
              <Progress value={gapAnalysis.coverage_percentage} className="h-3" />
              <p className="text-xs text-muted-foreground">
                Present in at least one AI engine for {gapAnalysis.total_prompts - gapAnalysis.total_gaps} of {gapAnalysis.total_prompts} prompts
              </p>
            </div>

            {/* Journey Stage Breakdown */}
            <div className="space-y-3">
              <h4 className="font-medium">Coverage by Customer Journey Stage</h4>
              {stageData.map((stage, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{stage.name}</span>
                    <span className="text-muted-foreground">
                      {stage.coverage}% ({stage.total - stage.gaps}/{stage.total})
                    </span>
                  </div>
                  <Progress value={stage.coverage} className="h-2" />
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div className={`grid gap-4 pt-4 border-t ${hasSOVPeers ? "grid-cols-3" : "grid-cols-2"}`}>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{gapAnalysis.total_prompts}</p>
                <p className="text-xs text-muted-foreground">Total Prompts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{gapAnalysis.total_gaps}</p>
                <p className="text-xs text-muted-foreground">Content Gaps</p>
              </div>
              {hasSOVPeers && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent">{gapAnalysis.top_competitors.length}</p>
                  <p className="text-xs text-muted-foreground">Competitors Visible</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Topics Tab */}
          <TabsContent value="topics" className="mt-4">
            <div className="space-y-4">
              <h4 className="font-medium">Gaps by Topic (Top 10)</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topicData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name === 'gaps' ? 'Gaps' : 'Total']}
                    labelFormatter={(label) => topicData.find(t => t.name === label)?.fullName || label}
                  />
                  <Bar dataKey="gaps" fill="hsl(var(--destructive))" name="Gaps" />
                </BarChart>
              </ResponsiveContainer>
              
              {/* Full topic list */}
              <div className="max-h-[200px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead className="text-right">Gaps</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Coverage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gapAnalysis.gaps_by_topic.map((topic, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{topic.topic}</TableCell>
                        <TableCell className="text-right text-destructive">{topic.gap_count}</TableCell>
                        <TableCell className="text-right">{topic.total}</TableCell>
                        <TableCell className="text-right">
                          {Math.round(((topic.total - topic.gap_count) / topic.total) * 100)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Competitors Tab — only when SOV peers configured */}
          {hasSOVPeers && (
            <TabsContent value="competitors" className="mt-4">
              <div className="space-y-4">
                <h4 className="font-medium">Top Competitors Appearing in Your Gaps</h4>
                <p className="text-sm text-muted-foreground">
                  These competitors are showing up in AI responses where you're not present.
                </p>

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={competitorData} margin={{ left: 20, right: 20, bottom: 60 }}>
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mention_count" fill="hsl(var(--primary))" name="Mentions" />
                  </BarChart>
                </ResponsiveContainer>

                {/* Competitor list with badges */}
                <div className="flex flex-wrap gap-2 pt-4">
                  {gapAnalysis.top_competitors.slice(0, 20).map((comp, idx) => (
                    <Badge key={idx} variant="secondary" className="text-sm">
                      {comp.name} ({comp.mention_count})
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>
          )}

          {/* Priority Gaps Tab */}
          <TabsContent value="priority" className="mt-4">
            <div className="space-y-4">
              <h4 className="font-medium">Priority Prompts to Address</h4>
              <p className="text-sm text-muted-foreground">
                Prompts where you're missing and competitors are present. Focus on these for maximum impact.
              </p>
              
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[300px]">Prompt</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Missing Engines</TableHead>
                      {hasSOVPeers && <TableHead>Competitors</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gapAnalysis.priority_prompts.slice(0, 20).map((gap, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">{gap.prompt}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{gap.topic}</Badge>
                        </TableCell>
                        <TableCell className="capitalize text-xs">{gap.stage}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {gap.engines_missing.slice(0, 3).map((engine, i) => (
                              <Badge key={i} variant="destructive" className="text-xs">
                                {engine}
                              </Badge>
                            ))}
                            {gap.engines_missing.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{gap.engines_missing.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        {hasSOVPeers && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {gap.competitors_present.slice(0, 2).map((comp, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {comp.length > 15 ? comp.substring(0, 15) + '...' : comp}
                                </Badge>
                              ))}
                              {gap.competitors_present.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{gap.competitors_present.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
