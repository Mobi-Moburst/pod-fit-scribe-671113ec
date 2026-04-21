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
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { AlertTriangle } from "lucide-react";
import { GEOAnalysis } from '@/types/reports';

interface GEODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  geoAnalysis: GEOAnalysis | undefined;
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
    podcast_entries,
    podcast_matches,
    parse_warnings,
  } = geoAnalysis;

  const hasPodcastMatches = podcast_matches && podcast_matches.length > 0;
  const confidenceColors: Record<string, string> = {
    high: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  const matchTypeLabels: Record<string, string> = {
    apple_id: 'Apple ID',
    url_slug: 'URL slug',
    prompt_text: 'Prompt text',
  };

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
            <strong>{total_podcasts_indexed} sources</strong> tracked across <strong>{unique_ai_engines.length} AI engine{unique_ai_engines.length !== 1 ? 's' : ''}</strong> — composite GEO score <strong>{geo_score}/100</strong>
          </DialogDescription>
        </DialogHeader>

        {parse_warnings && parse_warnings.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <ul className="space-y-1">
              {parse_warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <Tabs defaultValue="breakdown" className="w-full">
          <TabsList className={`grid w-full ${hasPodcastMatches ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="breakdown">Score Breakdown</TabsTrigger>
            <TabsTrigger value="engines">AI Engines</TabsTrigger>
            <TabsTrigger value="prompts">Top Prompts</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            {hasPodcastMatches && (
              <TabsTrigger value="podcast_impact">Podcast Impact</TabsTrigger>
            )}
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
                    <strong>Total Sources:</strong> {total_podcasts_indexed} entr{total_podcasts_indexed !== 1 ? 'ies' : 'y'} tracked across AI engines
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
          {/* Tab 5: Podcast Impact */}
          {hasPodcastMatches && (
            <TabsContent value="podcast_impact" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Podcast GEO Impact</CardTitle>
                  <CardDescription>
                    {podcast_matches!.length} podcast{podcast_matches!.length !== 1 ? 's' : ''} from your campaign found in AI engine sources.
                    Match confidence reflects how closely the source references the podcast.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {podcast_matches!.map((match, idx) => (
                    <div key={idx} className="rounded-md border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{match.podcast_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{match.match_reason}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${confidenceColors[match.confidence]}`}>
                            {match.confidence} confidence
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {match.total_appearances} appearance{match.total_appearances !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[90px]">Match type</TableHead>
                            <TableHead>URL</TableHead>
                            <TableHead className="w-[110px]">Engine</TableHead>
                            <TableHead className="w-[120px]">Topic</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {match.matched_entries.map((entry, eIdx) => (
                            <TableRow key={eIdx}>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {matchTypeLabels[entry.match_type] ?? entry.match_type}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-[300px]">
                                <a
                                  href={entry.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline break-all"
                                >
                                  {entry.domain}
                                </a>
                              </TableCell>
                              <TableCell className="text-xs">{entry.llm}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{entry.topic}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
