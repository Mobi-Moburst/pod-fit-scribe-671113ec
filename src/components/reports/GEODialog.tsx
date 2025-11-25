import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ReportData } from '@/types/reports';

interface GEODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  geoAnalysis: ReportData['geo_analysis'];
}

export const GEODialog = ({ open, onOpenChange, geoAnalysis }: GEODialogProps) => {
  if (!geoAnalysis) return null;

  const { 
    geo_score, 
    score_breakdown,
    total_podcasts_indexed,
    unique_ai_engines,
    ai_engine_counts,
    top_prompts,
    topic_distribution,
    podcast_entries
  } = geoAnalysis;

  // Colors for pie chart
  const COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(var(--accent))',
    'hsl(220 70% 60%)',
    'hsl(280 70% 60%)',
    'hsl(340 70% 60%)',
    'hsl(160 70% 60%)',
    'hsl(40 70% 60%)',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>GEO Score Analysis</DialogTitle>
          <DialogDescription>
            Your podcasts are indexed across <strong>{unique_ai_engines.length} AI engines</strong> with a composite score of <strong>{geo_score}/100</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="breakdown" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="breakdown">Score Breakdown</TabsTrigger>
            <TabsTrigger value="engines">AI Engines</TabsTrigger>
            <TabsTrigger value="prompts">Top Prompts</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
          </TabsList>

          {/* Tab 1: Score Breakdown */}
          <TabsContent value="breakdown" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Composite GEO Score: {geo_score}/100</CardTitle>
                <CardDescription>
                  Based on AI coverage, topic relevance, and prompt diversity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AI Coverage */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">AI Coverage</span>
                    <span className="text-sm text-muted-foreground">
                      {score_breakdown.ai_coverage}/40 points
                    </span>
                  </div>
                  <Progress value={(score_breakdown.ai_coverage / 40) * 100} />
                  <p className="text-xs text-muted-foreground">
                    Your podcasts appear across {unique_ai_engines.length} AI engine{unique_ai_engines.length !== 1 ? 's' : ''}. 
                    Maximum score (40 pts) achieved at 5+ engines.
                  </p>
                </div>

                {/* Topic Relevance */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Topic Relevance</span>
                    <span className="text-sm text-muted-foreground">
                      {score_breakdown.topic_relevance}/30 points
                    </span>
                  </div>
                  <Progress value={(score_breakdown.topic_relevance / 30) * 100} />
                  <p className="text-xs text-muted-foreground">
                    Your content appears in {topic_distribution.length} unique topic{topic_distribution.length !== 1 ? 's' : ''}. 
                    Maximum score (30 pts) achieved at 10+ topics.
                  </p>
                </div>

                {/* Prompt Diversity */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Prompt Diversity</span>
                    <span className="text-sm text-muted-foreground">
                      {score_breakdown.prompt_diversity}/30 points
                    </span>
                  </div>
                  <Progress value={(score_breakdown.prompt_diversity / 30) * 100} />
                  <p className="text-xs text-muted-foreground">
                    Your content is discovered through {top_prompts.length} unique search quer{top_prompts.length !== 1 ? 'ies' : 'y'}. 
                    Maximum score (30 pts) achieved at 20+ queries.
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm">
                    <strong>Total Indexed:</strong> {total_podcasts_indexed} podcast{total_podcasts_indexed !== 1 ? 's' : ''} on podcasts.apple.com
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: AI Engine Coverage */}
          <TabsContent value="engines" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Engine Coverage</CardTitle>
                <CardDescription>
                  Distribution of podcast mentions across {unique_ai_engines.length} AI engine{unique_ai_engines.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ai_engine_counts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="engine" 
                        angle={-45} 
                        textAnchor="end" 
                        height={100}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Top Prompts */}
          <TabsContent value="prompts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Search Prompts</CardTitle>
                <CardDescription>
                  Most common queries that surface your podcast content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Rank</TableHead>
                      <TableHead>Prompt Text</TableHead>
                      <TableHead className="text-right w-[100px]">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top_prompts.map((prompt, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">#{index + 1}</TableCell>
                        <TableCell className="text-sm">{prompt.prompt}</TableCell>
                        <TableCell className="text-right">{prompt.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Topic Distribution */}
          <TabsContent value="topics" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Topic Distribution</CardTitle>
                <CardDescription>
                  Content category breakdown across {topic_distribution.length} topic{topic_distribution.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  {/* Pie Chart */}
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={topic_distribution.slice(0, 8)}
                          dataKey="count"
                          nameKey="topic"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          label={(entry) => `${entry.topic}: ${entry.count}`}
                        >
                          {topic_distribution.slice(0, 8).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Table */}
                  <div className="overflow-auto max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Topic</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topic_distribution.map((topic, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-sm">{topic.topic}</TableCell>
                            <TableCell className="text-right">{topic.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
