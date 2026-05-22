import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Speaker, Company } from '@/types/clients';
import { Users, Mic, Target, FileText, ExternalLink } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface BookedShow { id: string; show_title: string | null; url: string; created_at: string | null }

interface Props {
  speaker: Speaker;
  company?: Company;
  bookedCount?: number;
  bookedShows?: BookedShow[];
}

export function SpeakerContextRail({ speaker, company, bookedCount, bookedShows = [] }: Props) {
  const [showsOpen, setShowsOpen] = useState(false);
  const initials = speaker.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const latestNote = speaker.quarterly_notes?.[speaker.quarterly_notes.length - 1];

  return (
    <Card className="card-surface p-4 space-y-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={speaker.headshot_url || undefined} alt={speaker.name} />
          <AvatarFallback className="text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{speaker.name}</div>
          {speaker.title && (
            <div className="text-xs text-muted-foreground truncate">{speaker.title}</div>
          )}
          {company?.name && (
            <div className="text-xs text-muted-foreground/80 truncate mt-0.5">{company.name}</div>
          )}
        </div>
      </div>

      {bookedShows.length > 0 ? (
        <Collapsible open={showsOpen} onOpenChange={setShowsOpen}>
          <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <span className="flex items-center gap-2">
              <Mic className="h-3.5 w-3.5" />
              {bookedShows.length} podcasts already in the system
            </span>
            {showsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {bookedShows.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-1.5 text-xs text-foreground/90 hover:text-foreground leading-snug group"
                  >
                    <span className="flex-1 truncate">{s.show_title || s.url}</span>
                    <ExternalLink className="h-3 w-3 mt-0.5 opacity-0 group-hover:opacity-60 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : typeof bookedCount === 'number' && bookedCount > 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mic className="h-3.5 w-3.5" />
          <span>{bookedCount} podcasts already in the system</span>
        </div>
      ) : null}

      {speaker.target_audiences?.length ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
            <Target className="h-3.5 w-3.5" /> Target audiences
          </div>
          <div className="flex flex-wrap gap-1.5">
            {speaker.target_audiences.slice(0, 8).map(a => (
              <Badge key={a} variant="secondary" className="text-xs font-normal">{a}</Badge>
            ))}
          </div>
        </div>
      ) : null}

      {speaker.talking_points?.length ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
            <Users className="h-3.5 w-3.5" /> Talking points
          </div>
          <ul className="space-y-1.5">
            {speaker.talking_points.slice(0, 5).map((tp, i) => (
              <li key={i} className="text-xs text-foreground/90 leading-snug">• {tp}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {latestNote ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
            <FileText className="h-3.5 w-3.5" /> {latestNote.quarter} strategy
          </div>
          <p className="text-xs text-muted-foreground leading-snug line-clamp-6">
            {latestNote.notes}
          </p>
        </div>
      ) : speaker.campaign_strategy ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
            <FileText className="h-3.5 w-3.5" /> Strategy
          </div>
          <p className="text-xs text-muted-foreground leading-snug line-clamp-6">
            {speaker.campaign_strategy}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
