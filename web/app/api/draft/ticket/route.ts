import { PROOF_BITS } from "@/lib/draft-proof";
import { clientAddress, fromOurPage, issueChallenge } from "@/lib/draft-guard";

export async function GET(request: Request) {
  if (!fromOurPage(request)) {
    return Response.json({ error: "请从工作台页面发起。" }, { status: 403 });
  }
  const issued = issueChallenge(clientAddress(request));
  if ("error" in issued) {
    return Response.json({ error: issued.error }, { status: 429 });
  }
  return Response.json({ id: issued.id, nonce: issued.nonce, bits: PROOF_BITS });
}
