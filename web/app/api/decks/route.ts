import { requireIdentity } from "../../../cursor/identity";
import { draftFromPrompt } from "../../../lib/draft";
import { sql } from "../../../lib/db";
import { isId, listDecks, stamp } from "../../../lib/records";
import { renderDraft } from "../../../lib/slides";

const headers = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const rows = await listDecks(identity.stage, identity.sub);
  return Response.json(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      prompt: row.prompt,
      createdAt: stamp(row.created_at),
    })),
    { headers },
  );
}

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  let payload: { prompt?: unknown; innovationId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "这次提交的格式不对。" }, { status: 400, headers });
  }
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const drafted = draftFromPrompt(prompt);
  if (!drafted.ok) return Response.json({ error: drafted.error }, { status: 400, headers });

  let innovationId: string | null = null;
  if (typeof payload.innovationId === "string" && payload.innovationId !== "") {
    if (!isId(payload.innovationId)) {
      return Response.json({ error: "找不到对应的记录。" }, { status: 404, headers });
    }
    const owned = await sql(
      identity.stage,
      "select id from innovations where id = $1 and owner_sub = $2",
      [payload.innovationId, identity.sub],
    );
    if (owned.length === 0) return Response.json({ error: "找不到对应的记录。" }, { status: 404, headers });
    innovationId = payload.innovationId;
  }

  const pptx = await renderDraft(drafted.draft);
  const id = crypto.randomUUID();
  await sql(
    identity.stage,
    "insert into decks (id, owner_sub, innovation_id, title, prompt, pptx_base64) values ($1, $2, $3, $4, $5, $6)",
    [id, identity.sub, innovationId, drafted.draft.title, prompt.slice(0, 1500), pptx.toString("base64")],
  );
  return Response.json(
    {
      id,
      title: drafted.draft.title,
      axle: drafted.draft.axle,
      features: drafted.draft.features,
    },
    { status: 201, headers },
  );
}
