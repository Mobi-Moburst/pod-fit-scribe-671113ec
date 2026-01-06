import { SpeakerBreakdown } from "@/types/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "./KPICard";
import { AirtableEmbed } from "./AirtableEmbed";
import { PublishedEpisodesCarousel } from "./PublishedEpisodesCarousel";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar, Radio, Users, TrendingUp, User } from "lucide-react";
interface VisibleSections {
  totalBooked?: boolean;
  totalPublished?: boolean;
  totalReach?: boolean;
  socialReach?: boolean;
  averageScore?: boolean;
}

interface SpeakerAccordionProps {
  speakerBreakdowns: SpeakerBreakdown[];
  defaultOpen?: string[];
  visibleSections?: VisibleSections;
}

export function SpeakerAccordion({ speakerBreakdowns, defaultOpen, visibleSections }: SpeakerAccordionProps) {
  // Default all sections to visible if not specified
  const sections = {
    totalBooked: visibleSections?.totalBooked ?? true,
    totalPublished: visibleSections?.totalPublished ?? true,
    totalReach: visibleSections?.totalReach ?? true,
    socialReach: visibleSections?.socialReach ?? true,
    averageScore: visibleSections?.averageScore ?? true,
  };

  // Format numbers with K/M suffix
  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // Format currency
  const formatCurrency = (n: number): string => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
        <User className="h-5 w-5 text-primary" />
        Speaker Breakdowns
      </h3>
      
      <Accordion 
        type="multiple" 
        defaultValue={defaultOpen || [speakerBreakdowns[0]?.speaker_id]}
        className="space-y-3"
      >
        {speakerBreakdowns.map((speaker) => (
          <AccordionItem 
            key={speaker.speaker_id} 
            value={speaker.speaker_id}
            className="border rounded-lg bg-card overflow-hidden"
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between w-full gap-4 text-left">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{speaker.speaker_name}</p>
                    {speaker.speaker_title && (
                      <p className="text-sm text-muted-foreground truncate">{speaker.speaker_title}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 mr-2">
                  {sections.totalBooked && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium text-foreground">{speaker.kpis.total_booked}</span>
                      <span className="text-muted-foreground">booked</span>
                    </div>
                  )}
                  {sections.totalPublished && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-sm">
                      <Radio className="h-3.5 w-3.5 text-accent" />
                      <span className="font-medium text-foreground">{speaker.kpis.total_published}</span>
                      <span className="text-muted-foreground">published</span>
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-6 pt-4">
                {/* Speaker KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {sections.totalBooked && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <Calendar className="h-3 w-3" />
                          Booked
                        </div>
                        <p className="text-2xl font-bold text-foreground">{speaker.kpis.total_booked}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {sections.totalPublished && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <Radio className="h-3 w-3" />
                          Published
                        </div>
                        <p className="text-2xl font-bold text-foreground">{speaker.kpis.total_published}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {sections.totalReach && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <Users className="h-3 w-3" />
                          Total Listenership
                        </div>
                        <p className="text-2xl font-bold text-foreground">{formatNumber(speaker.kpis.total_reach)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Total monthly listeners</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {sections.socialReach && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <TrendingUp className="h-3 w-3" />
                          Social
                        </div>
                        <p className="text-2xl font-bold text-foreground">{formatNumber(speaker.kpis.total_social_reach)}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {sections.averageScore && (
                    <Card className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                          <TrendingUp className="h-3 w-3" />
                          Avg Score
                        </div>
                        <p className="text-2xl font-bold text-foreground">{speaker.kpis.avg_score.toFixed(1)}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                </div>
                
                {/* Published Episodes Carousel */}
                {speaker.podcasts && speaker.podcasts.length > 0 && (
                  <PublishedEpisodesCarousel 
                    podcasts={speaker.podcasts}
                    title="Episodes This Quarter"
                  />
                )}

                {/* Speaker Airtable Embed */}
                {speaker.airtable_embed_url && (
                  <div className="mt-4">
                    <AirtableEmbed embedUrl={speaker.airtable_embed_url} />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
