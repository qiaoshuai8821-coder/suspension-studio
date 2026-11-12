import { requireIdentity } from "../../../cursor/identity";
import { sql } from "../../../lib/db";
import { listIdeas, stamp } from "../../../lib/records";

const axles = new Set(["前悬架", "后悬架", "前后悬架"]);
const headers = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const rows = await listIdeas(identity.stage, identity.sub);
  return Response.json(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      axle: row.axle,
      baseline: row.baseline,
      body: row.body,
      createdAt: stamp(row.created_at),
    })),
    { headers },
  );
}

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const title = text(body.title, 40);
  const axle = text(body.axle, 12);
  const baseline = text(body.baseline, 300);
  const note = text(body.body, 800);
  if (!title || !baseline || !note || !axles.has(axle)) {
    return Response.json({ error: "标题、部位、现状和结构都要填。" }, { status: 400, headers });
  }
  if (note.includes("电池") || baseline.includes("电池")) {
    return Response.json({ error: "电池不归我们改。请只写悬架零件。" }, { status: 400, headers });
  }
  const id = crypto.randomUUID();
  await sql(
    identity.stage,
    "insert into innovations (id, owner_sub, title, axle, baseline, body) values ($1, $2, $3, $4, $5, $6)",
    [id, identity.sub, title, axle, baseline, note],
  );
  return Response.json({ id }, { status: 201, headers });
}

async function readJson(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object") {
      return Response.json({ error: "这次提交的格式不对。" }, { status: 400, headers });
    }
    return value as Record<string, unknown>;
  } catch {
    return Response.json({ error: "这次提交的格式不对。" }, { status: 400, headers });
  }
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
