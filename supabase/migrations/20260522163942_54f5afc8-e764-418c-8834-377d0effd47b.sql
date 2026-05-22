
CREATE TABLE public.research_shortlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  speaker_id UUID NOT NULL,
  show_name TEXT NOT NULL,
  show_url TEXT,
  itunes_id TEXT,
  rephonic_id TEXT,
  cover_art_url TEXT,
  host_name TEXT,
  description TEXT,
  categories TEXT[] DEFAULT '{}'::text[],
  est_listeners INTEGER,
  last_episode_date DATE,
  guest_cadence_score NUMERIC,
  guest_cadence_label TEXT,
  niche_fit_score NUMERIC,
  fit_rationale TEXT,
  source TEXT NOT NULL DEFAULT 'ai',
  status TEXT NOT NULL DEFAULT 'new',
  passed_reason TEXT,
  added_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_research_shortlists_speaker ON public.research_shortlists(speaker_id);
CREATE INDEX idx_research_shortlists_org ON public.research_shortlists(org_id);
CREATE INDEX idx_research_shortlists_status ON public.research_shortlists(status);

ALTER TABLE public.research_shortlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org" ON public.research_shortlists
  FOR SELECT TO authenticated USING (org_id = get_team_org_id());
CREATE POLICY "Enable insert access for org" ON public.research_shortlists
  FOR INSERT TO authenticated WITH CHECK (org_id = get_team_org_id());
CREATE POLICY "Enable update access for org" ON public.research_shortlists
  FOR UPDATE TO authenticated USING (org_id = get_team_org_id()) WITH CHECK (org_id = get_team_org_id());
CREATE POLICY "Enable delete access for org" ON public.research_shortlists
  FOR DELETE TO authenticated USING (org_id = get_team_org_id());

CREATE TRIGGER update_research_shortlists_updated_at
  BEFORE UPDATE ON public.research_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.research_angles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shortlist_id UUID NOT NULL REFERENCES public.research_shortlists(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  headline TEXT NOT NULL,
  rationale TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_research_angles_shortlist ON public.research_angles(shortlist_id);

ALTER TABLE public.research_angles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org" ON public.research_angles
  FOR SELECT TO authenticated USING (org_id = get_team_org_id());
CREATE POLICY "Enable insert access for org" ON public.research_angles
  FOR INSERT TO authenticated WITH CHECK (org_id = get_team_org_id());
CREATE POLICY "Enable update access for org" ON public.research_angles
  FOR UPDATE TO authenticated USING (org_id = get_team_org_id()) WITH CHECK (org_id = get_team_org_id());
CREATE POLICY "Enable delete access for org" ON public.research_angles
  FOR DELETE TO authenticated USING (org_id = get_team_org_id());
