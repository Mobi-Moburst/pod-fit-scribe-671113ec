import { useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { Card } from '@/components/ui/card';

const Overview = () => {
  useEffect(() => {
    document.title = 'Overview — Kitcaster Campaign Command Center';
  }, []);

  return (
    <div>
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto px-3 py-6">
        <h1 className="text-lg font-semibold mb-1">Overview</h1>
        <p className="text-sm text-muted-foreground mb-4">
          A high-level snapshot of campaign activity will live here.
        </p>
        <Card className="card-surface p-8 flex items-center justify-center min-h-[320px]">
          <p className="text-sm text-muted-foreground">Coming soon.</p>
        </Card>
      </main>
    </div>
  );
};

export default Overview;
