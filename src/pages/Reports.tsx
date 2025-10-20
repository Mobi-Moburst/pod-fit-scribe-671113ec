import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { BackgroundFX } from '@/components/BackgroundFX';
import { ReportHeader } from '@/components/reports/ReportHeader';
import { KPIStrip } from '@/components/reports/KPIStrip';
import { FunnelChart } from '@/components/reports/FunnelChart';
import { ScoreDistributionChart } from '@/components/reports/ScoreDistributionChart';
import { CategoryHeatmap } from '@/components/reports/CategoryHeatmap';
import { FitVsReachMatrix } from '@/components/reports/FitVsReachMatrix';
import { NotableEpisodesCarousel } from '@/components/reports/NotableEpisodesCarousel';
import { ExecutiveSummary } from '@/components/reports/ExecutiveSummary';
import { InsightsPanel } from '@/components/reports/InsightsPanel';
import { HiddenGemsSection } from '@/components/reports/HiddenGemsSection';
import { supabase } from '@/integrations/supabase/client';
import { applyReportTheme } from '@/lib/reportTheme';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Reports = () => {
  const { batch_id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Performance Report — Podcast Fit Rater';
  }, []);

  useEffect(() => {
    if (!batch_id) {
      setError('No batch ID provided');
      setLoading(false);
      return;
    }

    const loadReport = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('batch_sessions')
          .select('*')
          .eq('id', batch_id)
          .single();

        if (error) throw error;

        if (!(data as any).report_data) {
          setError('No report has been generated for this batch yet.');
          setLoading(false);
          return;
        }

        setReportData((data as any).report_data);
        
        // Apply theme
        if ((data as any).report_theme) {
          applyReportTheme((data as any).report_theme);
        }
      } catch (err: any) {
        console.error('Failed to load report:', err);
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [batch_id]);

  const handleExportPDF = () => {
    toast({ description: 'PDF export coming soon!' });
  };

  const handleExportCSV = () => {
    if (!reportData) return;
    
    // Export notable episodes as CSV
    const csvContent = [
      ['Show Title', 'Fit Score', 'Reach', 'Engagement', 'URL'],
      ...reportData.notable_episodes.map((ep: any) => [
        ep.show_title,
        ep.fit_score.toFixed(2),
        ep.reach,
        ep.engagement,
        ep.url
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportData.report_meta.batch_name}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    toast({ description: 'Share link functionality coming soon!' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <BackgroundFX />
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <BackgroundFX />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertDescription>{error || 'Failed to load report'}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { report_meta, kpis, visual_blocks, notable_episodes, hidden_gems, ai_insights } = reportData;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackgroundFX />
      
      <div className="container mx-auto px-4 py-8" id="report-container">
        <ReportHeader
          clientName={report_meta.client_name}
          company={report_meta.company}
          period={report_meta.period}
          batchName={report_meta.batch_name}
          logoUrl={report_meta.theme?.logo}
          onExportPDF={handleExportPDF}
          onExportCSV={handleExportCSV}
          onShare={handleShare}
        />

        {visual_blocks?.kpi_strip?.enabled && visual_blocks.kpi_strip.data && (
          <KPIStrip data={visual_blocks.kpi_strip.data} />
        )}

        {ai_insights?.executive_summary && (
          <ExecutiveSummary summary={ai_insights.executive_summary} />
        )}

        {notable_episodes?.length > 0 && (
          <NotableEpisodesCarousel episodes={notable_episodes} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {visual_blocks?.funnel_bars?.enabled && visual_blocks.funnel_bars.data && (
            <FunnelChart data={visual_blocks.funnel_bars.data} />
          )}
          
          {visual_blocks?.score_distribution?.enabled && visual_blocks.score_distribution.data && (
            <ScoreDistributionChart data={visual_blocks.score_distribution.data} />
          )}
        </div>

        {visual_blocks?.fit_vs_reach_matrix?.enabled && visual_blocks.fit_vs_reach_matrix.data && (
          <div className="mb-8">
            <FitVsReachMatrix data={visual_blocks.fit_vs_reach_matrix.data} />
          </div>
        )}

        {visual_blocks?.category_heatmap?.enabled && visual_blocks.category_heatmap.data && (
          <div className="mb-8">
            <CategoryHeatmap data={visual_blocks.category_heatmap.data} />
          </div>
        )}

        {ai_insights && (
          <InsightsPanel insights={ai_insights} />
        )}

        {hidden_gems?.length > 0 && (
          <HiddenGemsSection gems={hidden_gems} />
        )}
      </div>
    </div>
  );
};

export default Reports;
