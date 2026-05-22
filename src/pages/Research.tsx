import { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Layers, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tool = {
  id: 'evaluate' | 'batch' | 'history';
  label: string;
  description: string;
  path: string;
  icon: typeof Search;
};

const tools: Tool[] = [
  {
    id: 'evaluate',
    label: 'Evaluate',
    description: 'Score a single podcast against a speaker profile.',
    path: '/evaluate?embedded=1',
    icon: Search,
  },
  {
    id: 'batch',
    label: 'Batch',
    description: 'Upload a CSV and evaluate many podcasts at once.',
    path: '/batch?embedded=1',
    icon: Layers,
  },
  {
    id: 'history',
    label: 'History',
    description: 'Browse and manage past evaluations and batches.',
    path: '/history?embedded=1',
    icon: Clock,
  },
];

const Research = () => {
  useEffect(() => {
    document.title = 'Research — Kitcaster Campaign Command Center';
  }, []);

  const [active, setActive] = useState<Tool | null>(null);

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6">
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Left rail */}
          <aside>
            <h1 className="text-lg font-semibold mb-1">Research</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Tools for evaluating and tracking podcast fit.
            </p>
            <nav className="flex flex-col gap-2">
              {tools.map((t) => {
                const Icon = t.icon;
                const isActive = active?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActive(t)}
                    className={cn(
                      'group flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50',
                      isActive && 'border-primary/40 bg-muted/40'
                    )}
                  >
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground group-hover:text-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t.label}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right pane — intro / empty state */}
          <Card className="card-surface p-8 flex items-center justify-center min-h-[320px]">
            <div className="max-w-md text-center">
              <h2 className="text-base font-semibold mb-2">Select a tool to get started</h2>
              <p className="text-sm text-muted-foreground">
                Choose Evaluate, Batch, or History from the left to open it in a focused workspace.
              </p>
            </div>
          </Card>
        </div>
      </main>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-3 border-b border-border shrink-0">
            <DialogTitle className="text-base">{active?.label}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-background">
            {active && (
              <iframe
                key={active.id}
                src={active.path}
                title={active.label}
                className="w-full h-full border-0"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Research;
