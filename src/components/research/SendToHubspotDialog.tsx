import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, User, Ticket, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  resolveHubspotAssociations, createTicketFromShortlist, hubspotTicketUrl,
  type ResolvePreview, type Overrides,
} from '@/lib/hubspot';
import type { ShortlistRow } from './ShortlistTab';

interface Props {
  row: ShortlistRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}

function splitName(n: string | null): { first: string; last: string } {
  if (!n) return { first: '', last: '' };
  const cleaned = n.trim().replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '');
  const p = cleaned.split(/\s+/);
  return p.length === 1 ? { first: p[0], last: '' } : { first: p[0], last: p.slice(1).join(' ') };
}

const GENERIC_DOMAINS = new Set([
  'apple.com', 'podcasts.apple.com', 'spotify.com', 'open.spotify.com',
  'youtube.com', 'youtu.be', 'substack.com',
]);

function parseDomainSafe(url: string | null): string {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    return GENERIC_DOMAINS.has(host) ? '' : host;
  } catch { return ''; }
}

export function SendToHubspotDialog({ row, open, onOpenChange, onCompleted }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<ResolvePreview | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});

  useEffect(() => {
    if (!open || !row) return;
    const guess = splitName(row.host_name);
    setOverrides({
      host_first: guess.first,
      host_last: guess.last,
      host_email: '',
      company_domain: parseDomainSafe(row.show_url),
      company_name: row.show_name,
    });
    setPreview(null);
    (async () => {
      setLoading(true);
      const p = await resolveHubspotAssociations(row.id, {});
      setLoading(false);
      setPreview(p);
      if (!p.ok) {
        toast({ title: 'Preview failed', description: p.error, variant: 'destructive' });
        return;
      }
      // Backfill domain + email from Rephonic-driven suggestions when our initial
      // guesses are empty (e.g. the show_url was an Apple aggregator link).
      setOverrides((o) => ({
        ...o,
        company_domain: o.company_domain || p.suggested?.domain || '',
        host_email: o.host_email || p.suggested?.email || '',
      }));
    })();
  }, [open, row?.id]);

  async function refresh() {
    if (!row) return;
    setLoading(true);
    const p = await resolveHubspotAssociations(row.id, overrides);
    setLoading(false);
    setPreview(p);
  }

  async function confirm() {
    if (!row) return;
    setSubmitting(true);
    const res = await createTicketFromShortlist(row.id, overrides);
    setSubmitting(false);
    if (!res.ok) {
      toast({ title: 'Could not send to HubSpot', description: res.error, variant: 'destructive' });
      return;
    }
    const url = res.portal_id && res.ticket_id ? hubspotTicketUrl(res.portal_id, res.ticket_id) : null;
    toast({
      title: res.deduped ? 'Already in HubSpot' : 'Ticket created in HubSpot',
      description: res.deduped
        ? 'Reusing existing ticket; shortlist row updated.'
        : `Company ${res.created?.company ? 'created' : 'reused'}, Contact ${res.created?.contact ? 'created' : 'reused'}.`,
    });
    if (url) window.open(url, '_blank', 'noopener');
    onCompleted();
    onOpenChange(false);
  }

  const dup = preview?.duplicate_ticket_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send to HubSpot</DialogTitle>
          <DialogDescription>
            We'll create or reuse the show (Company) and host (Contact), then create a ticket in
            stage 1 of your configured pipeline. Lead status is left blank.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Resolving in HubSpot…
          </div>
        )}

        {!loading && preview && !preview.ok && (
          <div className="text-sm text-destructive flex items-start gap-2 py-4">
            <AlertCircle className="h-4 w-4 mt-0.5" /> {preview.error}
          </div>
        )}

        {!loading && preview?.ok && (
          <div className="space-y-4">
            {dup && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" /> Already in HubSpot
                </div>
                <p className="text-muted-foreground mt-1">
                  A ticket for this shortlist row already exists. Confirming will reuse it.
                </p>
                {preview.portal_id && (
                  <a
                    href={hubspotTicketUrl(preview.portal_id, dup)}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center text-xs underline mt-1.5"
                  >
                    Open ticket <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                )}
              </div>
            )}

            {/* Company */}
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4" /> Company (Show)
                </div>
                {preview.company?.existing ? (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Matched existing
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Will create</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-8"
                    value={overrides.company_name || ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, company_name: e.target.value }))}
                    disabled={preview.company?.existing}
                  />
                </div>
                <div>
                  <Label className="text-xs">Domain</Label>
                  <Input
                    className="h-8"
                    value={overrides.company_domain || ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, company_domain: e.target.value }))}
                    placeholder="example.com"
                    disabled={preview.company?.existing}
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" /> Contact (Host)
                </div>
                {preview.contact?.existing ? (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Matched existing
                  </Badge>
                ) : preview.contact?.id || (overrides.host_first || overrides.host_last || overrides.host_email) ? (
                  <Badge variant="secondary" className="text-xs">Will create</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">No contact</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">First name</Label>
                  <Input
                    className="h-8"
                    value={overrides.host_first || ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, host_first: e.target.value }))}
                    disabled={preview.contact?.existing}
                  />
                </div>
                <div>
                  <Label className="text-xs">Last name</Label>
                  <Input
                    className="h-8"
                    value={overrides.host_last || ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, host_last: e.target.value }))}
                    disabled={preview.contact?.existing}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Email (optional)</Label>
                  <Input
                    className="h-8"
                    type="email"
                    value={overrides.host_email || ''}
                    onChange={(e) => setOverrides((o) => ({ ...o, host_email: e.target.value }))}
                    placeholder="host@show.com"
                    disabled={preview.contact?.existing}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Lead status is intentionally left blank (HubSpot shows it as <code>--</code>).
              </p>
            </div>

            {/* Ticket */}
            <div className="rounded-md border p-3 flex items-center gap-2 text-sm">
              <Ticket className="h-4 w-4" />
              {dup ? <span>Will reuse existing ticket.</span> : <span>Will create ticket in stage 1.</span>}
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
                Re-check matches
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={submitting || loading || !preview?.ok}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {dup ? 'Reuse existing ticket' : 'Create in HubSpot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
