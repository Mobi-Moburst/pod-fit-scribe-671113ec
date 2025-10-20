import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { batch_session_id, client_brand, visual_toggles, comparison_batch_ids, competitor_names } = await req.json();
    console.log('📊 Generate Report - Processing batch:', batch_session_id);

    if (!batch_session_id) {
      throw new Error('batch_session_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch batch metadata and client data
    const { data: batch, error: batchError } = await supabase
      .from('batch_sessions')
      .select('*, clients(*)')
      .eq('id', batch_session_id)
      .single();

    if (batchError) throw batchError;

    // Fetch all evaluations for this batch
    const { data: evaluations, error: evalsError } = await supabase
      .from('evaluations')
      .select('*')
      .eq('batch_session_id', batch_session_id);

    if (evalsError) throw evalsError;
    if (!evaluations || evaluations.length === 0) {
      throw new Error('No evaluations found for this batch');
    }

    // Helper functions
    const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const max = (arr: number[]) => Math.max(...arr);

    // KPI aggregation
    const scores = evaluations.map(e => e.overall_score || 0);
    const kpis = {
      total_evaluated: evaluations.length,
      high_fit_count: evaluations.filter(e => (e.overall_score || 0) >= 8).length,
      consider_count: evaluations.filter(e => (e.overall_score || 0) >= 6 && (e.overall_score || 0) < 8).length,
      not_fit_count: evaluations.filter(e => (e.overall_score || 0) < 6).length,
      avg_score: mean(scores),
      median_score: median(scores),
      top_score: max(scores),
      total_reach: sum(evaluations.map(e => e.rubric_json?.metadata?.listeners_per_episode || 0)),
      avg_reach: mean(evaluations.map(e => e.rubric_json?.metadata?.listeners_per_episode || 0)),
      avg_engagement: mean(evaluations.filter(e => e.rubric_json?.metadata?.engagement).map(e => e.rubric_json.metadata.engagement)),
      avg_confidence: mean(evaluations.map(e => e.confidence || 0)),
      high_confidence_count: evaluations.filter(e => (e.confidence || 0) >= 0.8).length,
    };

    // Visual data blocks
    const funnel_bars = {
      qualified: { count: kpis.high_fit_count, percentage: ((kpis.high_fit_count / kpis.total_evaluated) * 100).toFixed(1) },
      consider: { count: kpis.consider_count, percentage: ((kpis.consider_count / kpis.total_evaluated) * 100).toFixed(1) },
      not_fit: { count: kpis.not_fit_count, percentage: ((kpis.not_fit_count / kpis.total_evaluated) * 100).toFixed(1) }
    };

    const score_distribution = [
      { range: "9-10", count: evaluations.filter(e => (e.overall_score || 0) >= 9).length },
      { range: "8-8.9", count: evaluations.filter(e => (e.overall_score || 0) >= 8 && (e.overall_score || 0) < 9).length },
      { range: "7-7.9", count: evaluations.filter(e => (e.overall_score || 0) >= 7 && (e.overall_score || 0) < 8).length },
      { range: "6-6.9", count: evaluations.filter(e => (e.overall_score || 0) >= 6 && (e.overall_score || 0) < 7).length },
      { range: "<6", count: evaluations.filter(e => (e.overall_score || 0) < 6).length }
    ];

    // Category aggregation
    const categoryStats: Record<string, any> = {};
    evaluations.forEach(e => {
      const categories = e.rubric_json?.metadata?.categories || '';
      categories.split(',').forEach((cat: string) => {
        const category = cat.trim();
        if (!category) return;
        if (!categoryStats[category]) {
          categoryStats[category] = { scores: [], reaches: [], count: 0 };
        }
        categoryStats[category].scores.push(e.overall_score || 0);
        categoryStats[category].reaches.push(e.rubric_json?.metadata?.listeners_per_episode || 0);
        categoryStats[category].count += 1;
      });
    });

    const category_heatmap = Object.entries(categoryStats).map(([category, stats]: [string, any]) => ({
      category,
      avg_score: mean(stats.scores),
      count: stats.count,
      total_reach: sum(stats.reaches),
      color_intensity: mean(stats.scores) / 10
    })).sort((a, b) => b.avg_score - a.avg_score).slice(0, 15);

    const fit_vs_reach_matrix = evaluations.map(e => ({
      show_title: e.show_title,
      fit_score: e.overall_score || 0,
      reach: e.rubric_json?.metadata?.listeners_per_episode || 0,
      engagement: e.rubric_json?.metadata?.engagement || 0,
      url: e.url
    }));

    // Notable episodes (top 5 by composite score)
    const notable_episodes = evaluations
      .map(e => ({
        show_title: e.show_title,
        fit_score: e.overall_score || 0,
        reach: e.rubric_json?.metadata?.listeners_per_episode || 0,
        engagement: e.rubric_json?.metadata?.engagement || 0,
        why_fit_summary: e.rubric_json?.why_fit?.slice(0, 2).join(' • ') || '',
        url: e.url,
        categories: e.rubric_json?.metadata?.categories || '',
        composite_score: (e.overall_score || 0) * 0.6 + ((e.rubric_json?.metadata?.listeners_per_episode || 0) / 10000) * 0.4
      }))
      .sort((a, b) => b.composite_score - a.composite_score)
      .slice(0, 5);

    // Hidden gems (high fit, lower reach)
    const hidden_gems = evaluations
      .filter(e => (e.overall_score || 0) >= 7.5 && (e.rubric_json?.metadata?.listeners_per_episode || 0) < 5000)
      .map(e => ({
        show_title: e.show_title,
        fit_score: e.overall_score || 0,
        reach: e.rubric_json?.metadata?.listeners_per_episode || 0,
        why_fit_summary: e.rubric_json?.why_fit?.slice(0, 2).join(' • ') || '',
        url: e.url
      }))
      .slice(0, 3);

    // AI-powered insights
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    let aiInsights = {
      executive_summary: '',
      key_insights: [],
      category_analysis: '',
      notable_patterns: [],
      risk_recommendations: [],
      action_items: []
    };

    if (lovableApiKey) {
      try {
        const topShows = notable_episodes.slice(0, 5);
        const aiPrompt = `You are analyzing podcast performance data for ${batch.clients?.name} (${batch.clients?.company || 'N/A'}).

CAMPAIGN STRATEGY:
${batch.clients?.campaign_strategy || 'Not provided'}

BATCH DATA:
- Total podcasts evaluated: ${kpis.total_evaluated}
- High-fit shows (8+): ${kpis.high_fit_count}
- Average fit score: ${kpis.avg_score.toFixed(2)}
- Total reach: ${kpis.total_reach.toLocaleString()} listeners
- Category breakdown: ${category_heatmap.slice(0, 5).map(c => `${c.category} (${c.avg_score.toFixed(1)})`).join(', ')}

TOP 5 SHOWS:
${topShows.map(s => `- ${s.show_title} (Score: ${s.fit_score.toFixed(1)}, Reach: ${s.reach.toLocaleString()})`).join('\n')}

Generate a comprehensive performance report with:
1. Executive Summary (3-4 paragraphs, client-friendly tone)
2. Key Insights (5-7 bullet points with specific evidence)
3. Category Performance Analysis
4. Notable Patterns (what types of shows scored highest)
5. Risk Mitigation Recommendations
6. Action Items for Campaign Manager

Format as JSON with keys: executive_summary, key_insights (array), category_analysis, notable_patterns (array), risk_recommendations (array), action_items (array)`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a podcast campaign analyst. Generate concise, actionable insights in valid JSON format.' },
              { role: 'user', content: aiPrompt }
            ],
            temperature: 0.25
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          // Extract JSON from markdown code blocks if present
          const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
          if (jsonMatch) {
            aiInsights = JSON.parse(jsonMatch[1]);
          }
        }
      } catch (error) {
        console.error('AI insights generation failed:', error);
      }
    }

    // Report output
    const reportOutput = {
      report_meta: {
        batch_id: batch_session_id,
        batch_name: batch.name,
        client_name: batch.clients?.name,
        company: batch.clients?.company,
        created_at: new Date().toISOString(),
        period: client_brand?.quarter || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        theme: {
          primary: client_brand?.primary_color || '#9b87f5',
          secondary: client_brand?.secondary_color || '#7E69AB',
          accent: client_brand?.accent_color || '#6E59A5',
          font: client_brand?.font_family || 'Inter, sans-serif',
          logo: client_brand?.logo_url || null
        }
      },
      kpis,
      visual_blocks: {
        kpi_strip: { enabled: visual_toggles?.show_kpi_strip !== false, data: kpis },
        funnel_bars: { enabled: visual_toggles?.show_funnel_bars !== false, data: funnel_bars },
        score_distribution: { enabled: visual_toggles?.show_score_distribution !== false, data: score_distribution },
        category_heatmap: { enabled: visual_toggles?.show_heatmap !== false, data: category_heatmap },
        fit_vs_reach_matrix: { enabled: visual_toggles?.show_fit_vs_reach_matrix !== false, data: fit_vs_reach_matrix },
      },
      notable_episodes,
      hidden_gems,
      ai_insights: aiInsights,
    };

    // Save to database
    const { error: updateError } = await supabase
      .from('batch_sessions')
      .update({
        report_data: reportOutput,
        report_generated_at: new Date().toISOString(),
        report_theme: reportOutput.report_meta.theme
      })
      .eq('id', batch_session_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify(reportOutput), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
