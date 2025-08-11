
import { mockClients } from "@/data/mockClients";
import type { MinimalClient } from "@/types/clients";

const KEY = "pfr_clients";

function seedFromMock(): MinimalClient[] {
  // Derive a simple campaign strategy from legacy mock data to avoid empty fields
  // This is just a convenience for initial seeds; new clients will set real fields.
  return mockClients.map((c) => {
    const parts = [
      c.content_goals ? `Goals: ${c.content_goals}` : "",
      c.ICP ? `ICP: ${c.ICP}` : "",
      c.CTA ? `CTA: ${c.CTA}` : "",
    ].filter(Boolean);
    return {
      id: c.id,
      name: c.name,
      campaign_strategy: parts.join(" | ") || "",
      media_kit_url: "", // not present in mocks; user can edit later
    };
  });
}

export function getClients(): MinimalClient[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MinimalClient[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Failed to parse pfr_clients; falling back to seeds.", e);
  }
  return seedFromMock();
}

export function saveClients(list: MinimalClient[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}
