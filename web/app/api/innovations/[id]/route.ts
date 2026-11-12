import { requireIdentity } from "../../../../cursor/identity";
import { sql } from "../../../../lib/db";
import { isId } from "../../../../lib/records";

const headers = { "cache-control": "private, no-store" };

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const { id } = await context.params;
  if (!isId(id)) return Response.json({ error: "找不到这条收集。" }, { status: 404, headers });
  const rows = await sql(
    identity.stage,
    "delete from innovations where id = $1 and owner_sub = $2 returning id",
    [id, identity.sub],
  );
  if (rows.length === 0) return Response.json({ error: "找不到这条收集。" }, { status: 404, headers });
  return new Response(null, { status: 204, headers });
}
