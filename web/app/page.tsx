import { Suspense } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";

import { Workspace, type DeckItem, type Idea, type ViewerCard } from "@/components/workspace";
import { getIdentity } from "../cursor/identity";
import { listDecks, listIdeas, stamp } from "../lib/records";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="px-6 py-8 text-sm text-muted-foreground">正在确认是谁在看…</p>}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  await connection();
  const identity = await getIdentity(await headers());
  if (!identity.verified) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <p className="text-sm font-medium text-primary">悬架创新工作台</p>
        <h1 className="text-3xl font-semibold">登录之后才能记想法、出幻灯片</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          团队成员用自己的 Cursor 账号打开即可。这里不另设用户名和密码。
        </p>
      </main>
    );
  }

  const viewer: ViewerCard = {
    label: identity.kind === "key" ? identity.name || "密钥" : identity.name || identity.email || "已登录",
    simulated: identity.simulated,
    kind: identity.kind,
  };
  let ideas: Idea[] = [];
  let decks: DeckItem[] = [];
  let loadError = "";
  try {
    const [ideaRows, deckRows] = await Promise.all([
      listIdeas(identity.stage, identity.sub),
      listDecks(identity.stage, identity.sub),
    ]);
    ideas = ideaRows.map((row) => ({
      id: row.id,
      title: row.title,
      axle: row.axle,
      baseline: row.baseline,
      body: row.body,
      createdAt: stamp(row.created_at),
    }));
    decks = deckRows.map((row) => ({
      id: row.id,
      title: row.title,
      prompt: row.prompt,
      createdAt: stamp(row.created_at),
    }));
  } catch {
    loadError = "列表暂时打不开，刷新一次再试。";
  }

  return (
    <main>
      {loadError ? <p className="px-6 pt-4 text-sm text-destructive">{loadError}</p> : null}
      <Workspace viewer={viewer} initialIdeas={ideas} initialDecks={decks} />
    </main>
  );
}
