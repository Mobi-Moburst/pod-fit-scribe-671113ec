import { PodcastReportEntry } from "@/types/reports";
import { Calendar, ExternalLink, Podcast } from "lucide-react";

interface PublishedEpisodesSlideProps {
  podcasts: PodcastReportEntry[];
}

export const PublishedEpisodesSlide = ({ podcasts }: PublishedEpisodesSlideProps) => {
  const publishedEpisodes = podcasts
    .filter(p => p.date_published)
    .sort((a, b) => new Date(b.date_published!).getTime() - new Date(a.date_published!).getTime())
    .slice(0, 8);

  if (publishedEpisodes.length === 0) return null;

  return (
    <div className="w-full space-y-8 max-w-5xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-4xl md:text-5xl font-bold">Published Episodes</h2>
        <p className="text-xl text-muted-foreground">Episodes that went live this quarter</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {publishedEpisodes.map((episode, idx) => (
          <a
            key={idx}
            href={episode.episode_link || episode.apple_podcast_link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 p-4 rounded-2xl bg-card border border-border hover:bg-muted/50 transition-colors group"
          >
            {(episode as any).cover_art_url ? (
              <img
                src={(episode as any).cover_art_url}
                alt={episode.show_title}
                className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Podcast className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                {episode.show_title}
              </p>
              {(episode as any).episode_title && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">{(episode as any).episode_title}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {episode.date_published && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(episode.date_published).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                {(episode.episode_link || episode.apple_podcast_link) && (
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
