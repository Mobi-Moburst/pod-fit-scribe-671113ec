import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Mic,
  PhoneCall,
  Headphones,
  Users,
  Podcast,
  DollarSign,
  BarChart3,
  Sparkles,
  Database,
  ShieldCheck,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KitcasterLogo } from "@/components/KitcasterLogo";

const layers = [
  {
    label: "Activity",
    title: "Every booking, recording, and intro call.",
    body: "Live Airtable sync tracks the full pipeline — from first conversation to confirmed recording — with strict date boundaries so nothing is double-counted.",
    icon: Calendar,
    bullets: ["Podcasts Booked", "Total Recorded", "Intro Calls"],
  },
  {
    label: "Reach",
    title: "Real listenership. Real social weight.",
    body: "Episode-level listenership from Rephonic, combined with podcast social followings and YouTube subscribers — verified, never estimated.",
    icon: Headphones,
    bullets: ["Total Listenership", "Social Reach", "Episodes Published"],
  },
  {
    label: "Impact",
    title: "Earned media value tied to outcomes.",
    body: "True EMV from episode duration × listenership, Share of Voice against named peers, and brand visibility scores across ChatGPT, Claude, and Gemini.",
    icon: BarChart3,
    bullets: ["EMV", "Share of Voice", "GEO / AEO Score"],
  },
];

const differentiators = [
  {
    icon: DollarSign,
    title: "True EMV, not estimates",
    body: "Calculated from real episode duration multiplied by verified listenership — never a flat per-download guess.",
  },
  {
    icon: Users,
    title: "Share of Voice vs named peers",
    body: "Benchmark against the specific competitors your client actually cares about — not a generic industry average.",
  },
  {
    icon: Brain,
    title: "GEO & AEO scoring",
    body: "How often does your client show up when ChatGPT, Claude, and Gemini answer the questions that matter? We measure it.",
  },
  {
    icon: Database,
    title: "Live Airtable sync",
    body: "Activity flows in directly from the campaign manager's working base — no spreadsheet exports, no stale data.",
  },
  {
    icon: Sparkles,
    title: "AI-generated 'Looking Ahead'",
    body: "Each report ends with a three-pillar forward strategy synthesized from historical notes and quarter-over-quarter performance.",
  },
  {
    icon: ShieldCheck,
    title: "Verifiable by default",
    body: "Every metric is sourced, every number tied to a date range. No vanity numbers — only data we can defend in a client call.",
  },
];

export default function Showcase() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Kitcaster Campaign Command Center — The dashboard that proves ROI";

    const ensureMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
      return tag;
    };
    const desc = ensureMeta(
      "description",
      "Every booking, every download, every dollar of earned media — tracked, measured, and tied to outcomes in the Kitcaster Campaign Command Center."
    );

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const createdCanonical = !canonical;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}/showcase`);

    return () => {
      document.title = prevTitle;
      if (createdCanonical && canonical?.parentNode) canonical.parentNode.removeChild(canonical);
      if (desc) desc.setAttribute("content", "");
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/showcase" className="flex items-center gap-2">
            <KitcasterLogo className="h-7 w-auto" />
            <span className="text-sm font-medium tracking-tight">Campaign Command Center</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/demo/report">
              <Button variant="ghost" size="sm" className="text-sm">
                See the demo report
              </Button>
            </Link>
            <a href="mailto:hello@kitcaster.com?subject=Campaign%20Command%20Center">
              <Button size="sm" className="text-sm">
                Book a call
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,hsl(var(--background)))]" />
        </div>
        <div className="container mx-auto px-4 pt-24 pb-28 md:pt-32 md:pb-36 max-w-5xl">
          <p
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-6"
          >
            The Kitcaster Campaign Command Center
          </p>
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]"
          >
            Every booking, every download,
            <br />
            <span className="text-muted-foreground">every dollar of earned media —</span>
            <br />
            tracked in one place.
          </h1>
          <p
            className="mt-8 text-base md:text-lg text-muted-foreground max-w-2xl"
          >
            A purpose-built campaign dashboard for podcast PR. Verifiable metrics, named-peer
            benchmarks, and AI-driven strategy — delivered as a beautiful report your client can
            actually read.
          </p>
          <div
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Link to="/demo/report">
              <Button size="lg" className="text-sm">
                Open a live demo report
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="mailto:hello@kitcaster.com?subject=Campaign%20Command%20Center">
              <Button variant="soft" size="lg" className="text-sm">
                Talk to the team
              </Button>
            </a>
          </div>

          {/* Mini KPI strip */}
          <div
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {[
              { icon: Calendar, label: "Podcasts Booked" },
              { icon: Mic, label: "Episodes Recorded" },
              { icon: Podcast, label: "Episodes Published" },
              { icon: DollarSign, label: "Earned Media Value" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 flex items-center gap-3"
              >
                <div className="rounded-lg bg-muted/60 p-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Three layers */}
      <section className="border-t border-border/60">
        <div className="container mx-auto px-4 py-24 md:py-32 max-w-6xl">
          <div className="max-w-3xl mb-16">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-4">
              What gets measured
            </p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
              Three layers. One source of truth.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Activity proves we're working. Reach proves it landed. Impact proves it mattered.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {layers.map((layer, i) => (
              <div
                key={layer.label}
                className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col"
              >
                <div className="flex items-center gap-2 mb-6">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <layer.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {layer.label}
                  </span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{layer.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground flex-1">{layer.body}</p>
                <ul className="mt-6 space-y-1.5">
                  {layer.bullets.map((b) => (
                    <li key={b} className="text-sm text-foreground/80 flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo embed */}
      <section className="border-t border-border/60 bg-muted/20">
        <div className="container mx-auto px-4 py-24 md:py-32 max-w-6xl">
          <div className="max-w-3xl mb-12">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-4">
              See it in action
            </p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
              A real report. No screenshots, no slides.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Click through a fully interactive quarterly report — same one we deliver to clients,
              populated with representative data.
            </p>
          </div>

          <div className="relative">
            <Link
              to="/demo/report"
              className="group block rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-border transition-colors"
            >
              <div className="aspect-[16/9] relative bg-gradient-to-br from-background via-card to-muted/30 flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(40%_50%_at_50%_50%,hsl(var(--primary)/0.12),transparent_70%)]" />
                <div className="relative grid grid-cols-3 gap-3 p-8 w-full max-w-2xl">
                  {[
                    { label: "Booked", value: "42" },
                    { label: "Published", value: "31" },
                    { label: "Listenership", value: "8.4M" },
                    { label: "Social Reach", value: "12.1M" },
                    { label: "EMV", value: "$1.2M" },
                    { label: "Share of Voice", value: "34%" },
                  ].map((k) => (
                    <div
                      key={k.label}
                      className="rounded-xl border border-border/60 bg-background/80 backdrop-blur p-4"
                    >
                      <div className="text-xs text-muted-foreground">{k.label}</div>
                      <div className="text-2xl font-semibold tracking-tight mt-1">{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between px-6 py-5 border-t border-border/60">
                <div>
                  <div className="text-sm font-medium">Open the full interactive report</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    KPIs, charts, EMV breakdown, peer comparison, GEO scores, "Looking Ahead"
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="border-t border-border/60">
        <div className="container mx-auto px-4 py-24 md:py-32 max-w-6xl">
          <div className="max-w-3xl mb-16">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-4">
              What makes it different
            </p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
              Built for PR teams who get asked, "but what did it actually do?"
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {differentiators.map((d, i) => (
              <div
                key={d.title}
                className="rounded-2xl border border-border/60 bg-card p-6"
              >
                <div className="rounded-lg bg-muted/60 p-2 w-fit">
                  <d.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="mt-5 text-base font-semibold tracking-tight">{d.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-border/60 bg-muted/20">
        <div className="container mx-auto px-4 py-20 max-w-4xl text-center">
          <p
            className="text-2xl md:text-3xl font-medium tracking-tight text-balance"
          >
            Every metric is sourced, verifiable, and tied to a date range.
            <br />
            <span className="text-muted-foreground">No vanity numbers.</span>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="container mx-auto px-4 py-24 md:py-32 max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Ready to see your campaigns this way?
          </h2>
          <p
            className="mt-5 text-base text-muted-foreground max-w-xl mx-auto"
          >
            Walk through a live report with the Kitcaster team and see how the Command Center would
            tell your client's story.
          </p>
          <div
            className="mt-10 flex flex-wrap justify-center items-center gap-3"
          >
            <Link to="/demo/report">
              <Button size="lg" className="text-sm">
                Explore the demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="mailto:hello@kitcaster.com?subject=Campaign%20Command%20Center">
              <Button variant="soft" size="lg" className="text-sm">
                Book an intro call
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="container mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-70">
            <KitcasterLogo className="h-6 w-auto" />
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Kitcaster. Campaign Command Center.
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/demo/report" className="hover:text-foreground transition-colors">
              Demo report
            </Link>
            <a
              href="mailto:hello@kitcaster.com"
              className="hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
