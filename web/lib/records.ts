import { sql } from "./db";
import type { IdentityStage } from "../cursor/identity";

export type IdeaRow = {
  id: string;
  title: string;
  axle: string;
  baseline: string;
  body: string;
  created_at: Date | string;
};

export type DeckRow = {
  id: string;
  title: string;
  prompt: string;
  created_at: Date | string;
};

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isId(value: string): boolean {
  return idPattern.test(value);
}

export function stamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export async function listIdeas(stage: IdentityStage, owner: string): Promise<IdeaRow[]> {
  return sql<IdeaRow>(
    stage,
    "select id, title, axle, baseline, body, created_at from innovations where owner_sub = $1 order by created_at desc limit 30",
    [owner],
  );
}

export async function listDecks(stage: IdentityStage, owner: string): Promise<DeckRow[]> {
  return sql<DeckRow>(
    stage,
    "select id, title, prompt, created_at from decks where owner_sub = $1 order by created_at desc limit 20",
    [owner],
  );
}
