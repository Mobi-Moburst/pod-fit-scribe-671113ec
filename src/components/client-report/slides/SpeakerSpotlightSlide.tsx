import { SpeakerBreakdown, HighlightClip } from "@/types/reports";
import { Calendar, Podcast, Users, TrendingUp, ExternalLink, Play, Video, Headphones } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface SpeakerSpotlightSlideProps {
  speaker: SpeakerBreakdown;
  highlightClips?: HighlightClip[];
  onAirtableClick?: () => void;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

export const SpeakerSpotlightSlide = ({ speaker, highlightClips = [], onAirtableClick }: SpeakerSpotlightSlideProps) => {
  const initials = speaker.speaker_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const kpiItems = [
    {
      label: "Booked",
      value: speaker.kpis.total_booked,
      icon: Calendar,
      color: "hsl(var(--primary))",
    },
    {
      label: "Published",
      value: speaker.kpis.total_published,
      icon: Podcast,
      color: "hsl(var(--accent))",
    },
    {
      label: "Reach",
      value: formatNumber(speaker.kpis.total_reach),
      icon: Users,
      color: "hsl(191 100% 62%)",
    },
    {
      label: "Avg Score",
      value: speaker.kpis.avg_score.toFixed(1),
      icon: TrendingUp,
      color: "hsl(51 100% 61%)",
    },
  ];

  const hasTargetAudiences = speaker.target_audiences && speaker.target_audiences.length > 0;
  const hasTalkingPoints = speaker.talking_points && speaker.talking_points.length > 0;
  const hasAirtable = !!speaker.airtable_embed_url;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {/* Speaker Header */}
      <div className="flex items-center gap-6">
        <Avatar className="h-20 w-20 border-2 border-primary/20">
          <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">{speaker.speaker_name}</h2>
          {speaker.speaker_title && (
            <p className="text-lg text-muted-foreground mt-1">{speaker.speaker_title}</p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiItems.map((kpi, index) => (
          <div
            key={index}
            className="bg-card border border-border rounded-2xl p-5 space-y-2"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${kpi.color}15` }}
            >
              <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold">{kpi.value}</div>
              <div className="text-sm text-muted-foreground">{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Strategy Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Target Audiences */}
        {hasTargetAudiences && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Target Audiences
            </h3>
            <div className="flex flex-wrap gap-2">
              {speaker.target_audiences?.slice(0, 5).map((audience, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                >
                  {audience}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Talking Points */}
        {hasTalkingPoints && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold">Key Talking Points</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {speaker.talking_points?.slice(0, 4).map((point, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-semibold text-foreground shrink-0">{i + 1}.</span>
                  <span className="line-clamp-2">{point}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Airtable Link Card */}
      {hasAirtable && (
        <button
          onClick={onAirtableClick}
          className="w-full group bg-card border border-border rounded-2xl p-6 flex items-center justify-between hover:bg-accent/5 hover:border-primary/30 transition-all duration-200"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ExternalLink className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <div className="font-semibold">Activity Tracking</div>
              <div className="text-sm text-muted-foreground">
                View detailed booking and interview activity
              </div>
            </div>
          </div>
          <div className="text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            Click to open →
          </div>
        </button>
      )}

      {/* Interview Highlights Section */}
      {highlightClips.length > 0 && (
        <div className="space-y-4 pt-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Interview Highlights
          </h3>
          <div className="grid gap-4">
            {highlightClips.map((clip) => (
              <div
                key={clip.id}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Video/Audio Embed */}
                <div className="aspect-video bg-muted relative">
                  {clip.source_type === 'youtube' ? (
                    <iframe
                      src={clip.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={clip.title}
                    />
                  ) : clip.source_type === 'vimeo' ? (
                    <iframe
                      src={clip.url.replace('vimeo.com/', 'player.vimeo.com/video/')}
                      className="w-full h-full"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title={clip.title}
                    />
                  ) : clip.source_type === 'descript' ? (
                    <iframe
                      src={clip.url}
                      className="w-full h-full"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      title={clip.title}
                    />
                  ) : (
                    <a
                      href={clip.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-full flex items-center justify-center group/play hover:bg-muted/80 transition-colors"
                    >
                      {clip.thumbnail_url ? (
                        <img
                          src={clip.thumbnail_url}
                          alt={clip.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          {clip.media_type === 'video' ? (
                            <Video className="h-12 w-12" />
                          ) : (
                            <Headphones className="h-12 w-12" />
                          )}
                          <span className="text-sm">Click to play</span>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center group-hover/play:scale-110 transition-transform">
                          <Play className="h-8 w-8 text-primary-foreground ml-1" />
                        </div>
                      </div>
                    </a>
                  )}
                </div>
                {/* Clip Info */}
                <div className="p-4 space-y-1">
                  <h4 className="font-semibold">{clip.title}</h4>
                  {clip.podcast_name && (
                    <p className="text-sm text-muted-foreground">{clip.podcast_name}</p>
                  )}
                  {clip.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{clip.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
