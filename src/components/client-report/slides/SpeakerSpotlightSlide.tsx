import { SpeakerBreakdown, HighlightClip } from "@/types/reports";
import { Calendar, Podcast, Users, TrendingUp, ExternalLink, Play, Video, Headphones } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PublishedEpisodesCarousel } from "@/components/reports/PublishedEpisodesCarousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

interface VisibleSections {
  totalBooked?: boolean;
  totalPublished?: boolean;
  totalReach?: boolean;
  socialReach?: boolean;
  averageScore?: boolean;
}

interface SpeakerSpotlightSlideProps {
  speaker: SpeakerBreakdown;
  highlightClips?: HighlightClip[];
  onAirtableClick?: () => void;
  visibleSections?: VisibleSections;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

const getYouTubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const getVimeoVideoId = (url: string): string | null => {
  const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

const ClipMediaPlayer = ({ clip }: { clip: HighlightClip }) => {
  // YouTube
  if (clip.source_type === 'youtube') {
    const videoId = getYouTubeVideoId(clip.url);
    if (videoId) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={clip.title}
        />
      );
    }
  }

  // Vimeo
  if (clip.source_type === 'vimeo') {
    const videoId = getVimeoVideoId(clip.url);
    if (videoId) {
      return (
        <iframe
          src={`https://player.vimeo.com/video/${videoId}`}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={clip.title}
        />
      );
    }
  }

  // Descript
  if (clip.source_type === 'descript') {
    return (
      <iframe
        src={clip.url}
        className="w-full h-full"
        allow="autoplay; fullscreen"
        allowFullScreen
        title={clip.title}
      />
    );
  }

  // Direct upload - video
  if (clip.source_type === 'upload' && clip.media_type === 'video') {
    return (
      <video
        src={clip.url}
        controls
        poster={clip.thumbnail_url || undefined}
        className="w-full h-full object-contain bg-black"
      />
    );
  }

  // Direct upload - audio
  if (clip.source_type === 'upload' && clip.media_type === 'audio') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 p-4">
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt={clip.title}
            className="w-24 h-24 rounded-xl object-cover mb-4"
          />
        ) : (
          <Headphones className="w-16 h-16 text-primary mb-4" />
        )}
        <audio src={clip.url} controls className="w-full max-w-xs" />
      </div>
    );
  }

  // Fallback - external link with thumbnail
  return (
    <a
      href={clip.url}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full h-full flex items-center justify-center relative group/play"
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
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/play:bg-black/30 transition-colors">
        <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center group-hover/play:scale-110 transition-transform">
          <Play className="h-6 w-6 text-primary-foreground ml-1" />
        </div>
      </div>
    </a>
  );
};

export const SpeakerSpotlightSlide = ({ speaker, highlightClips = [], onAirtableClick, visibleSections }: SpeakerSpotlightSlideProps) => {
  // Default all sections to visible if not specified
  const sections = {
    totalBooked: visibleSections?.totalBooked ?? true,
    totalPublished: visibleSections?.totalPublished ?? true,
    totalReach: visibleSections?.totalReach ?? true,
    socialReach: visibleSections?.socialReach ?? true,
    averageScore: visibleSections?.averageScore ?? true,
  };

  const initials = speaker.speaker_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const kpiItems = [];
  
  if (sections.totalBooked) {
    kpiItems.push({
      label: "Booked",
      value: speaker.kpis.total_booked,
      icon: Calendar,
      color: "hsl(var(--primary))",
    });
  }
  
  if (sections.totalPublished) {
    kpiItems.push({
      label: "Published",
      value: speaker.kpis.total_published,
      icon: Podcast,
      color: "hsl(var(--accent))",
    });
  }
  
  if (sections.totalReach) {
    kpiItems.push({
      label: "Listenership",
      value: formatNumber(speaker.kpis.total_reach),
      icon: Users,
      color: "hsl(191 100% 62%)",
    });
  }
  
  if (sections.socialReach) {
    kpiItems.push({
      label: "Social Reach",
      value: formatNumber(speaker.kpis.total_social_reach),
      icon: Users,
      color: "hsl(280 70% 60%)",
    });
  }
  
  if (sections.averageScore) {
    kpiItems.push({
      label: "Avg Score",
      value: speaker.kpis.avg_score.toFixed(1),
      icon: TrendingUp,
      color: "hsl(51 100% 61%)",
    });
  }

  const normalizeListValue = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

  const talkingPointsSet = new Set(
    (speaker.talking_points ?? []).map(normalizeListValue).filter(Boolean)
  );

  const cleanedTargetAudiences = (speaker.target_audiences ?? []).filter((audience) => {
    const normalized = normalizeListValue(audience);
    if (!normalized) return false;

    // Prevent accidental headers/labels from showing as audiences
    if (normalized.includes("talking points")) return false;

    // Prevent talking points accidentally stored in target_audiences from showing
    if (talkingPointsSet.has(normalized)) return false;

    return true;
  });

  const hasTargetAudiences = cleanedTargetAudiences.length > 0;
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

      {/* Main Content Grid - Target Audiences/Talking Points + Published Episodes */}
      <div className="grid md:grid-cols-5 gap-6">
        {/* Left Column - Target Audiences & Talking Points */}
        <div className="md:col-span-3 space-y-4">
          {/* Target Audiences */}
          {hasTargetAudiences && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Target Audiences
              </h3>
              <div className="flex flex-wrap gap-2">
                {cleanedTargetAudiences.slice(0, 5).map((audience, i) => (
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
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="text-base font-semibold">Key Talking Points</h3>
              <ol className="space-y-1.5 text-sm text-muted-foreground">
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

        {/* Right Column - Published Episodes Carousel */}
        {speaker.podcasts && speaker.podcasts.length > 0 && (
          <div className="md:col-span-2 bg-card border border-border rounded-2xl p-5">
            <PublishedEpisodesCarousel 
              podcasts={speaker.podcasts}
              title="Published Episodes"
              compact
              variant="carousel"
            />
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

      {/* Interview Highlights Carousel */}
      {highlightClips.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              Interview Highlights
            </h3>
            <span className="text-xs text-muted-foreground">
              {highlightClips.length} clip{highlightClips.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="px-8">
            <Carousel
              opts={{
                align: "start",
                loop: highlightClips.length > 2,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-3">
                {highlightClips.map((clip) => (
                  <CarouselItem 
                    key={clip.id} 
                    className={`pl-3 ${
                      highlightClips.length === 1 
                        ? "basis-full" 
                        : highlightClips.length === 2 
                          ? "basis-1/2" 
                          : "basis-1/2 lg:basis-1/3"
                    }`}
                  >
                    <div className="bg-muted/50 border border-border/50 rounded-xl overflow-hidden h-full">
                      <div className="aspect-video bg-black relative">
                        <ClipMediaPlayer clip={clip} />
                      </div>
                      <div className="p-3 space-y-1">
                        <h4 className="font-medium text-sm line-clamp-1">{clip.title}</h4>
                        {clip.podcast_name && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{clip.podcast_name}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                            {clip.media_type}
                          </span>
                          {clip.duration_seconds && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.floor(clip.duration_seconds / 60)}:{String(clip.duration_seconds % 60).padStart(2, '0')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {highlightClips.length > 2 && (
                <>
                  <CarouselPrevious className="-left-6 h-7 w-7" />
                  <CarouselNext className="-right-6 h-7 w-7" />
                </>
              )}
            </Carousel>
          </div>
        </div>
      )}
    </div>
  );
};
