
import { mockClients } from "@/data/mockClients";
import type { MinimalClient } from "@/types/clients";

const KEY = "pfr_clients";

function seedFromMock(): MinimalClient[] {
  // Derive a simple campaign strategy from legacy mock data to avoid empty fields
  // Also map legacy fields into new minimal profile arrays when present
  return mockClients.map((c: any) => {
    const parts = [
      c.content_goals ? `Goals: ${c.content_goals}` : "",
      c.ICP ? `ICP: ${c.ICP}` : "",
      c.CTA ? `CTA: ${c.CTA}` : "",
    ].filter(Boolean);

    const splitList = (v?: string) =>
      (v || "")
        .split(/[;,•|]/)
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
      notes: c.notes || undefined,
      campaign_strategy: parts.join(" | ") || "",
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
          .split(/[;,•|]/)
          .map((x) => x.trim())
          .filter(Boolean)
      )
    );
  }
  return [];
}

function normalizeClient(c: any): MinimalClient {
  return {
    id: c.id ?? crypto.randomUUID(),
    name: String(c.name ?? "").trim(),
    company: c.company ? String(c.company).trim() : undefined,
    media_kit_url: String(c.media_kit_url || ""),
    target_audiences: toList(c.target_audiences),
    talking_points: toList(c.talking_points),
    avoid: toList(c.avoid),
    notes: c.notes ? String(c.notes) : undefined,
    campaign_strategy: c.campaign_strategy ? String(c.campaign_strategy) : undefined,
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
