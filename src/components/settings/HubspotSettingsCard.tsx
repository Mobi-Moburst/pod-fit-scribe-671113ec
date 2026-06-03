import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plug, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fetchHubspotPipelines, type HubspotPipeline } from '@/lib/hubspot';

const KC_PROPERTIES: Array<{ object: string; name: string; label: string }> = [
  { object: 'Ticket',  name: 'kc_shortlist_id',           label: 'KC Command Center Shortlist ID' },
  { object: 'Ticket',  name: 'kc_source',                 label: 'KC Command Center Source' },
  { object: 'Contact', name: 'kc_created_for_speaker_id', label: 'KC Command Center Speaker ID' },
  { object: 'Contact', name: 'kc_created_by_app',         label: 'KC Command Center Created By' },
  { object: 'Company', name: 'kc_created_by_app',         label: 'KC Command Center Created By' },
  { object: 'Company', name: 'kc_show_url',               label: 'KC Command Center Show URL' },
];

export function HubspotSettingsCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState<HubspotPipeline[] | null>(null);
  const [portalId, setPortalId] = useState<string | null>(null);
  const [chosenPipelineId, setChosenPipelineId] = useState<string>('');
  const [kcProp, setKcProp] = useState('kc_client');
  const [showUrlProp, setShowUrlProp] = useState('');
  const [autoCreate, setAutoCreate] = useState(true);
  const [genericDomains, setGenericDomains] = useState('apple.com\npodcasts.apple.com\nspotify.com\nyoutube.com\nsubstack.com');
  const [savedPipelineLabel, setSavedPipelineLabel] = useState<string | null>(null);

  async function loadCurrent() {
    setLoading(true);
    const { data } = await supabase.from('hubspot_settings').select('*').maybeSingle();
    if (data) {
      setPortalId(data.portal_id);
      setChosenPipelineId(data.pipeline_id || '');
      setKcProp(data.kc_client_property || 'kc_client');
      setShowUrlProp(data.show_url_property || '');
      setSavedPipelineLabel(data.pipeline_label);
      setAutoCreate((data as any).auto_create_associations !== false);
      const domains = (data as any).generic_domains as string[] | null;
      if (domains?.length) setGenericDomains(domains.join('\n'));
    }
    setLoading(false);
  }

  useEffect(() => { loadCurrent(); }, []);

  async function discover() {
    setDiscovering(true);
    try {
      const res = await fetchHubspotPipelines();
      setPipelines(res.pipelines);
      setPortalId(res.portal_id);
      if (!chosenPipelineId && res.pipelines.length) {
        const agent = res.pipelines.find((p) => /agent\s*master/i.test(p.label));
        if (agent) setChosenPipelineId(agent.id);
      }
    } catch (err: any) {
      toast({ title: 'HubSpot discovery failed', description: err.message, variant: 'destructive' });
    } finally {
      setDiscovering(false);
    }
  }

  async function save() {
    if (!chosenPipelineId || !pipelines) {
      toast({ title: 'Pick a pipeline first', variant: 'destructive' });
      return;
    }
    const pipeline = pipelines.find((p) => p.id === chosenPipelineId);
    if (!pipeline) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Not signed in', variant: 'destructive' });
      setSaving(false);
      return;
    }
    const TEAM_ORG_ID = '11111111-1111-1111-1111-111111111111';
    const domains = genericDomains.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter(Boolean);
    const row = {
      org_id: TEAM_ORG_ID,
      portal_id: portalId,
      pipeline_id: pipeline.id,
      pipeline_label: pipeline.label,
      stages: pipeline.stages,
      kc_client_property: kcProp.trim() || 'kc_client',
      show_url_property: showUrlProp.trim() || null,
      auto_create_associations: autoCreate,
      generic_domains: domains,
    };
    const { error } = await supabase.from('hubspot_settings').upsert(row as any, { onConflict: 'org_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    setSavedPipelineLabel(pipeline.label);
    toast({ title: 'HubSpot config saved', description: `${pipeline.label} (${pipeline.stages.length} stages)` });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          HubSpot
          {savedPipelineLabel && (
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <CheckCircle2 className="h-3 w-3" /> {savedPipelineLabel}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Pick the ticket pipeline campaign managers work out of (e.g. <em>Agent Master Pipeline</em>).
          Tickets are matched to a speaker using the <code className="text-xs">kc_client</code> property.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading current config…</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={discover} disabled={discovering}>
                {discovering ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                {pipelines ? 'Refresh pipelines' : 'Load pipelines from HubSpot'}
              </Button>
              {portalId && <span className="text-xs text-muted-foreground">Portal ID: <code>{portalId}</code></span>}
            </div>

            {pipelines && (
              <div className="space-y-2 max-w-md">
                <Label>Pipeline</Label>
                <Select value={chosenPipelineId} onValueChange={setChosenPipelineId}>
                  <SelectTrigger><SelectValue placeholder="Choose pipeline" /></SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label} ({p.stages.length} stages)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              <div className="space-y-1">
                <Label className="text-xs">Client-match property</Label>
                <Input value={kcProp} onChange={(e) => setKcProp(e.target.value)} placeholder="kc_client" />
                <p className="text-xs text-muted-foreground">Internal HubSpot property name that holds the speaker name.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Show URL property (optional)</Label>
                <Input value={showUrlProp} onChange={(e) => setShowUrlProp(e.target.value)} placeholder="podcast_url" />
                <p className="text-xs text-muted-foreground">If set, we write the show URL here when creating tickets.</p>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3 max-w-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Auto-create missing Contacts &amp; Companies</Label>
                  <p className="text-xs text-muted-foreground">
                    When sending a shortlist row, create the host Contact and show Company in HubSpot if they don't already exist.
                  </p>
                </div>
                <Switch checked={autoCreate} onCheckedChange={setAutoCreate} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Generic domains to ignore for company dedupe</Label>
                <Textarea
                  rows={4}
                  value={genericDomains}
                  onChange={(e) => setGenericDomains(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">One per line. Hosting platforms shouldn't be used to dedupe shows.</p>
              </div>
            </div>

            <div className="rounded-md border p-3 max-w-2xl space-y-2">
              <Label className="text-sm">Required HubSpot properties</Label>
              <p className="text-xs text-muted-foreground">
                Create these custom properties in HubSpot (group: Kitcaster Command Center). Internal names must match exactly.
              </p>
              <div className="space-y-1 mt-2">
                {KC_PROPERTIES.map((p) => (
                  <div key={`${p.object}-${p.name}`} className="flex items-center justify-between text-xs">
                    <div>
                      <Badge variant="outline" className="font-normal mr-2 text-[10px]">{p.object}</Badge>
                      <span className="text-muted-foreground">{p.label}</span>
                    </div>
                    <code className="text-[11px]">{p.name}</code>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Button size="sm" onClick={save} disabled={saving || !chosenPipelineId}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Save HubSpot config
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
