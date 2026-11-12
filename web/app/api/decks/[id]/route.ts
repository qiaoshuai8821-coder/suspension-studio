import { requireIdentity } from "../../../../cursor/identity";
import { sql } from "../../../../lib/db";
import { isId } from "../../../../lib/records";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const { id } = await context.params;
  if (!isId(id)) return new Response("找不到这份幻灯片。", { status: 404 });
  const rows = await sql<{ title: string; pptx_base64: string }>(
    identity.stage,
    "select title, pptx_base64 from decks where id = $1 and owner_sub = $2",
    [id, identity.sub],
  );
  const row = rows[0];
  if (!row) return new Response("找不到这份幻灯片。", { status: 404 });
  const filename = encodeURIComponent(`${row.title}.pptx`);
  return new Response(Buffer.from(row.pptx_base64, "base64"), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "content-disposition": `attachment; filename="proposal.pptx"; filename*=UTF-8''${filename}`,
      "cache-control": "private, no-store",
    },
  });
}
