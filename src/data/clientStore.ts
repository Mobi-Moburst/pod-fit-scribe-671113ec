
import { mockClients } from "@/data/mockClients";
import type { MinimalClient } from "@/types/clients";
import { parseCampaignStrategy, buildCampaignStrategyFromArrays } from "@/lib/campaignStrategy";

const KEY = "pfr_clients";

function seedFromMock(): MinimalClient[] {
  // Derive a campaign strategy and arrays from legacy mock data
  return mockClients.map((c: any) => {
    const splitList = (v?: string) =>
      (v || "")
        .split(/[\n\r,;•|]/)
        .map((x) => x.trim())
        .filter(Boolean);

    const target_audiences = Array.from(
      new Set([...(c.target_roles || []), ...splitList(c.ICP)])
    );

    const talking_points = Array.from(
      new Set([...(c.topics_to_prioritize || []), ...(c.keywords_positive || [])])
    );

    const avoid = Array.from(
      new Set([...(c.topics_to_avoid || []), ...(c.keywords_negative || [])])
    );

    return {
      id: c.id,
      name: c.name,
      company: c.company || undefined,
      media_kit_url: "", // not present in mocks; user can edit later
      target_audiences,
      talking_points,
      avoid,
      avoid_text: avoid.join(", "),
      notes: c.notes || undefined,
      campaign_strategy: buildCampaignStrategyFromArrays(target_audiences, talking_points),
    } as MinimalClient;
  });
}

export function toList(v: any): string[] {
  if (Array.isArray(v)) {
    return Array.from(new Set(v.map((x) => String(x).trim()).filter(Boolean)));
  }
  if (typeof v === "string") {
    return Array.from(
      new Set(
        v
          .split(/[\n\r,;•|]/)
          .map((x) => x.trim())
          .filter(Boolean)
      )
    );
  }
  return [];
}

function normalizeClient(c: any): MinimalClient {
  let strategy = c.campaign_strategy ? String(c.campaign_strategy) : "";
  let audiences = toList(c.target_audiences);
  let talking = toList(c.talking_points);

  // Preserve raw free-text for "Things to Avoid"
  const avoidText =
    typeof c.avoid_text === "string"
      ? c.avoid_text
      : Array.isArray(c.avoid)
      ? c.avoid.join(", ")
      : typeof c.avoid === "string"
      ? c.avoid
      : "";

  if (strategy.trim()) {
    const { audiences: a, talking: t } = parseCampaignStrategy(strategy);
    audiences = a;
    talking = t;
  } else if ((audiences.length || talking.length) && !strategy.trim()) {
    // backfill strategy so the textarea is prefilled for older clients
    strategy = buildCampaignStrategyFromArrays(audiences, talking);
  }

  return {
    id: c.id ?? crypto.randomUUID(),
    name: String(c.name ?? "").trim(),
    company: c.company ? String(c.company).trim() : undefined,
    media_kit_url: String(c.media_kit_url || ""),
    target_audiences: audiences,
    talking_points: talking,
    avoid_text: avoidText,
    avoid: toList(avoidText),
    notes: c.notes ? String(c.notes) : undefined,
    campaign_strategy: strategy,
  };
}

export function getClients(): MinimalClient[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MinimalClient[];
      if (Array.isArray(parsed)) return parsed.map(normalizeClient);
    }
  } catch (e) {
    console.warn("Failed to parse pfr_clients; falling back to seeds.", e);
  }
  return seedFromMock().map(normalizeClient);
}

export function saveClients(list: MinimalClient[]) {
  try {
    const normalized = (list || []).map(normalizeClient);
    localStorage.setItem(KEY, JSON.stringify(normalized));
    // Notify other tabs or parts of the app if needed
    window.dispatchEvent(new CustomEvent('pfr_clients_updated'));
  } catch (e) {
    console.error('Failed to save clients', e);
  }
}
