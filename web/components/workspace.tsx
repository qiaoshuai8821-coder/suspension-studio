"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { draftFromPrompt } from "@/lib/draft";
import { checkIdea, type Idea } from "@/lib/ideas";
import { bytesToBase64, downloadPptx, readStore, writeStore, type StoredDeck } from "@/lib/local-store";
import { promptStarters, sampleIdeas, type SampleIdea } from "@/lib/samples";

type Feature = { id: string; text: string };

export function Workspace() {
  const [ready, setReady] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [decks, setDecks] = useState<StoredDeck[]>([]);
  const [title, setTitle] = useState("");
  const [axle, setAxle] = useState("后悬架");
  const [baseline, setBaseline] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState(promptStarters[0]);
  const [busy, setBusy] = useState<"save" | "generate" | null>(null);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<{ id: string; title: string; features: Feature[]; pptxBase64: string } | null>(null);

  useEffect(() => {
    const saved = readStore();
    setIdeas(saved.ideas);
    setDecks(saved.decks);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStore(ideas, decks);
  }, [ready, ideas, decks]);

  function saveIdea(idea: { title: string; axle: string; baseline: string; body: string }) {
    setError("");
    const problem = checkIdea(idea);
    if (problem) {
      setError(problem);
      return;
    }
    const next: Idea = {
      id: crypto.randomUUID(),
      title: idea.title.replace(/\s+/g, " ").trim(),
      axle: idea.axle,
      baseline: idea.baseline.replace(/\s+/g, " ").trim(),
      body: idea.body.replace(/\s+/g, " ").trim(),
      createdAt: new Date().toISOString(),
    };
    setIdeas((current) => [next, ...current].slice(0, 30));
    setTitle("");
    setBaseline("");
    setBody("");
  }

  async function generate(nextPrompt: string) {
    setBusy("generate");
    setError("");
    setLatest(null);
    const drafted = draftFromPrompt(nextPrompt);
    if (!drafted.ok) {
      setBusy(null);
      setError(drafted.error);
      return;
    }
    const { renderDraft } = await import("@/lib/slides");
    const bytes = await renderDraft(drafted.draft);
    const pptxBase64 = bytesToBase64(bytes);
    const deck: StoredDeck = {
      id: crypto.randomUUID(),
      title: drafted.draft.title,
      prompt: nextPrompt.slice(0, 1500),
      createdAt: new Date().toISOString(),
      pptxBase64,
    };
    setDecks((current) => [deck, ...current].slice(0, 12));
    setLatest({ id: deck.id, title: deck.title, features: drafted.draft.features, pptxBase64 });
    setBusy(null);
  }

  function useIdea(idea: Idea | SampleIdea) {
    setPrompt(`标题：${idea.title}\n桥：${idea.axle}\n基线：${idea.baseline}\n结构：${idea.body}`);
    setError("");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-28 sm:gap-6 lg:pb-8">
      <header className="border-b border-border pb-5">
        <p className="text-sm font-medium text-primary">乘用车悬架平台</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">悬架创新工作台</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          打开就能用。想法记在这台浏览器里，换一台电脑不会跟着走。把项目下载到自己电脑上，按说明启动，也是这一套。只写悬架零件。出来的是讨论稿，还没做过检索。
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="ideas" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>记下想法</CardTitle>
            <CardDescription>写清是前悬还是后悬、现在卡在哪、零件之间怎么连。下面的示例可以先收下再改。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                saveIdea({ title, axle, baseline, body });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="title">标题</Label>
                  <Input id="title" value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} placeholder="例如：轮跳末端的第二接触" className="h-11 text-base" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="axle">部位</Label>
                  <select
                    id="axle"
                    value={axle}
                    onChange={(event) => setAxle(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-transparent px-2 text-base"
                  >
                    <option>前悬架</option>
                    <option>后悬架</option>
                    <option>前后悬架</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="baseline">现在卡在哪</Label>
                <Textarea id="baseline" value={baseline} maxLength={300} onChange={(event) => setBaseline(event.target.value)} placeholder="现有结构里，哪一处同时干了两件互相打架的事" className="min-h-24 text-base" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="body">结构关系</Label>
                <Textarea id="body" value={body} maxLength={800} onChange={(event) => setBody(event.target.value)} placeholder="谁和谁连着；平时什么样；到了那个工况，力走到哪；哪组孔不动" className="min-h-28 text-base" />
              </div>
              <Button type="submit" disabled={busy !== null} className="h-11 w-full px-4 text-base sm:w-auto">
                记下来
              </Button>
            </form>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">已记下的想法</p>
              {ideas.length === 0 ? (
                <p className="rounded-lg bg-muted px-3 py-3 text-sm leading-6 text-muted-foreground">还没记下想法。可以先收下面的示例，再按你们的实车改。</p>
              ) : (
                ideas.map((idea) => (
                  <article key={idea.id} className="rounded-lg border border-border px-3 py-3">
                    <div className="min-w-0">
                      <h2 className="break-words font-medium">{idea.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {idea.axle} · {formatWhen(idea.createdAt)}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button type="button" variant="secondary" className="h-11 px-1 text-sm" onClick={() => useIdea(idea)}>
                        填入
                      </Button>
                      <Button type="button" variant="outline" className="h-11 px-1 text-sm" onClick={() => void generate(compose(idea))} disabled={busy !== null}>
                        生成
                      </Button>
                      <Button type="button" variant="ghost" className="h-11 px-1 text-sm" onClick={() => setIdeas((current) => current.filter((item) => item.id !== idea.id))}>
                        删除
                      </Button>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{idea.body}</p>
                  </article>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">示例，点一下就能记下来</p>
              {sampleIdeas.map((idea) => (
                <div key={idea.title} className="flex flex-col gap-2 rounded-lg bg-accent px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{idea.title}</p>
                    <p className="text-xs text-muted-foreground">{idea.axle}</p>
                  </div>
                  <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" disabled={busy !== null} onClick={() => saveIdea(idea)}>
                    记下
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card id="slides" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>写成两页</CardTitle>
            <CardDescription>至少写三句：零件怎么连，力或者位移怎么走。写完就能下载。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {promptStarters.map((starter) => (
                <Button key={starter.slice(0, 12)} type="button" variant="outline" className="h-auto min-h-11 whitespace-normal px-3 py-2 text-left text-sm" onClick={() => setPrompt(starter)}>
                  {starter.slice(0, 18)}…
                </Button>
              ))}
            </div>
            <Textarea value={prompt} maxLength={1500} onChange={(event) => setPrompt(event.target.value)} className="min-h-36 text-base sm:min-h-40" />
            <Button type="button" className="h-11 w-full px-4 text-base sm:w-auto" disabled={busy !== null} onClick={() => void generate(prompt)}>
              {busy === "generate" ? "正在写这两页…" : "生成两页幻灯片"}
            </Button>

            {latest ? (
              <div className="rounded-lg border border-primary/30 bg-accent px-3 py-3">
                <p className="break-words font-medium">{latest.title}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                  {latest.features.map((feature) => (
                    <li key={feature.id}>
                      {feature.id} {feature.text}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm leading-6">这些方案具备写成独立权利要求的结构关系。是不是新的、值不值得申请，要检索之后才知道。</p>
                <Button type="button" className="mt-3 h-11 w-full px-4 text-base sm:w-auto" onClick={() => downloadPptx(latest.pptxBase64, latest.title)}>
                  下载幻灯片
                </Button>
              </div>
            ) : (
              <p className="rounded-lg bg-muted px-3 py-3 text-sm leading-6 text-muted-foreground">还没有新的结果。写完上面的文字，再点按钮。</p>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">已经生成的</p>
              {decks.length === 0 ? (
                <p className="text-sm text-muted-foreground">生成过的两页留在这台浏览器里，刷新也还在。</p>
              ) : (
                decks.map((deck) => (
                  <button
                    key={deck.id}
                    type="button"
                    onClick={() => downloadPptx(deck.pptxBase64, deck.title)}
                    className="flex min-h-11 w-full flex-col items-start gap-1 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="break-words">{deck.title}</span>
                    <span className="text-xs text-muted-foreground">{formatWhen(deck.createdAt)}</span>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <Button type="button" variant="secondary" className="h-11" onClick={() => document.getElementById("ideas")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            记下想法
          </Button>
          <Button type="button" className="h-11" onClick={() => document.getElementById("slides")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            写成两页
          </Button>
        </div>
      </nav>
    </div>
  );
}

function compose(idea: { title: string; axle: string; baseline: string; body: string }) {
  return `标题：${idea.title}\n桥：${idea.axle}\n基线：${idea.baseline}\n结构：${idea.body}`;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}（上海）`;
}
