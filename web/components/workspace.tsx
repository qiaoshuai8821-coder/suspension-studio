"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { promptStarters, sampleIdeas, type SampleIdea } from "@/lib/samples";

export type Idea = {
  id: string;
  title: string;
  axle: string;
  baseline: string;
  body: string;
  createdAt: string;
};

export type DeckItem = {
  id: string;
  title: string;
  prompt: string;
  createdAt: string;
};

export type ViewerCard = {
  label: string;
  simulated: boolean;
  kind: "person" | "key";
};

type Feature = { id: string; text: string };

export function Workspace({
  viewer,
  initialIdeas,
  initialDecks,
}: {
  viewer: ViewerCard;
  initialIdeas: Idea[];
  initialDecks: DeckItem[];
}) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [decks, setDecks] = useState(initialDecks);
  const [title, setTitle] = useState("");
  const [axle, setAxle] = useState("后悬架");
  const [baseline, setBaseline] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState(promptStarters[0]);
  const [busy, setBusy] = useState<"save" | "generate" | null>(null);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<{ id: string; title: string; features: Feature[] } | null>(null);

  async function reload() {
    const [ideaResponse, deckResponse] = await Promise.all([fetch("/api/innovations"), fetch("/api/decks")]);
    if (ideaResponse.ok) setIdeas(await ideaResponse.json());
    if (deckResponse.ok) setDecks(await deckResponse.json());
  }

  async function saveIdea(idea: { title: string; axle: string; baseline: string; body: string }) {
    setBusy("save");
    setError("");
    const response = await fetch("/api/innovations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idea),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(payload.error || "没有收下来。");
      return;
    }
    setTitle("");
    setBaseline("");
    setBody("");
    await reload();
  }

  async function removeIdea(id: string) {
    setError("");
    const response = await fetch(`/api/innovations/${id}`, { method: "DELETE" });
    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "没有删掉。");
      return;
    }
    setIdeas((current) => current.filter((idea) => idea.id !== id));
  }

  async function generate(nextPrompt: string, innovationId?: string) {
    setBusy("generate");
    setError("");
    setLatest(null);
    const response = await fetch("/api/decks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: nextPrompt, innovationId }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(payload.error || "没有生成。");
      return;
    }
    setLatest({ id: payload.id, title: payload.title, features: payload.features });
    await reload();
  }

  function useIdea(idea: Idea | SampleIdea) {
    const next = `标题：${idea.title}\n桥：${idea.axle}\n基线：${idea.baseline}\n结构：${idea.body}`;
    setPrompt(next);
    setError("");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">乘用车悬架平台</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">悬架创新工作台</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            先把结构想法收进来，再按提示词整理成两页介绍。只写悬架零件。生成结果是草案，未做检索。
          </p>
        </div>
        <ViewerBadge viewer={viewer} />
      </header>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>收集创新</CardTitle>
            <CardDescription>记下桥、基线失败在哪、以及零件之间的关系。示例可以收进来再改。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveIdea({ title, axle, baseline, body });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="title">标题</Label>
                  <Input id="title" value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} placeholder="例如：轮跳末端的第二接触" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="axle">桥</Label>
                  <select
                    id="axle"
                    value={axle}
                    onChange={(event) => setAxle(event.target.value)}
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  >
                    <option>前悬架</option>
                    <option>后悬架</option>
                    <option>前后悬架</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="baseline">基线在哪里失败</Label>
                <Textarea id="baseline" value={baseline} maxLength={300} onChange={(event) => setBaseline(event.target.value)} placeholder="现有结构的哪一处同时承担了两件互相妨碍的事" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="body">结构关系</Label>
                <Textarea id="body" value={body} maxLength={800} onChange={(event) => setBody(event.target.value)} placeholder="谁和谁连接，正常工况怎样，工况成立后力走到哪，哪一组孔不动" className="min-h-28" />
              </div>
              <Button type="submit" disabled={busy !== null} className="h-10 self-start px-4">
                {busy === "save" ? "正在收集…" : "收进工作台"}
              </Button>
            </form>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">我的收集</p>
              {ideas.length === 0 ? (
                <p className="rounded-lg bg-muted px-3 py-3 text-sm leading-6 text-muted-foreground">还没有收集。可以先收下面的示例，再按实车基线改写。</p>
              ) : (
                ideas.map((idea) => (
                  <article key={idea.id} className="rounded-lg border border-border px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-medium">{idea.title}</h2>
                        <p className="text-xs text-muted-foreground">
                          {idea.axle} · {formatWhen(idea.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={() => useIdea(idea)}>
                          填入提示词
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            void generate(compose(idea), idea.id);
                          }}
                          disabled={busy !== null}
                        >
                          生成
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => void removeIdea(idea.id)}>
                          删除
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{idea.body}</p>
                  </article>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">示例，可以收进我的收集</p>
              {sampleIdeas.map((idea) => (
                <div key={idea.title} className="flex items-center justify-between gap-3 rounded-lg bg-accent px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{idea.title}</p>
                    <p className="text-xs text-muted-foreground">{idea.axle}</p>
                  </div>
                  <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void saveIdea(idea)}>
                    收集
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>按提示词生成</CardTitle>
            <CardDescription>写成三句以上的结构关系。工作台整理成两页，并给出可下载的幻灯片。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {promptStarters.map((starter) => (
                <Button key={starter.slice(0, 12)} type="button" variant="outline" onClick={() => setPrompt(starter)}>
                  {starter.slice(0, 16)}…
                </Button>
              ))}
            </div>
            <Textarea value={prompt} maxLength={1500} onChange={(event) => setPrompt(event.target.value)} className="min-h-40" />
            <Button type="button" className="h-10 self-start px-4" disabled={busy !== null} onClick={() => void generate(prompt)}>
              {busy === "generate" ? "正在整理两页…" : "生成两页 PPT"}
            </Button>

            {latest ? (
              <div className="rounded-lg border border-primary/30 bg-accent px-3 py-3">
                <p className="font-medium">{latest.title}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                  {latest.features.map((feature) => (
                    <li key={feature.id}>
                      {feature.id} {feature.text}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm leading-6">这些方案具备写成独立权利要求的结构关系。是不是新的、值不值得申请，要检索之后才知道。</p>
                <Button asChild className="mt-3 h-10 px-4">
                  <a href={`/api/decks/${latest.id}`}>下载这份 PPT</a>
                </Button>
              </div>
            ) : (
              <p className="rounded-lg bg-muted px-3 py-3 text-sm leading-6 text-muted-foreground">还没有新的生成结果。写完提示词后点上面的按钮。</p>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">已生成</p>
              {decks.length === 0 ? (
                <p className="text-sm text-muted-foreground">生成过的两页介绍会留在这里，刷新后还在。</p>
              ) : (
                decks.map((deck) => (
                  <a key={deck.id} href={`/api/decks/${deck.id}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                    <span>{deck.title}</span>
                    <span className="text-xs text-muted-foreground">{formatWhen(deck.createdAt)}</span>
                  </a>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ViewerBadge({ viewer }: { viewer: ViewerCard }) {
  return (
    <div className="rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
      <p className="font-medium">{viewer.label}</p>
      <p className="text-xs leading-5 text-muted-foreground">
        {viewer.simulated
          ? "本地演示身份。发布后的页面由 Cursor 账号打开，这里会换成你的名字。"
          : viewer.kind === "key"
            ? "这是一把获准调用的密钥，不是一个人。"
            : "已用 Cursor 账号打开工作台。"}
      </p>
    </div>
  );
}

function compose(idea: { title: string; axle: string; baseline: string; body: string }) {
  return `标题：${idea.title}\n桥：${idea.axle}\n基线：${idea.baseline}\n结构：${idea.body}`;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 上海`;
}
