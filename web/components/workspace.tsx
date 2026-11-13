"use client";

import { AlertCircle, Check, ChevronDown, ChevronRight, Download, FileText, Loader2, NotebookPen } from "lucide-react";
import { useEffect, useState, type ReactNode, type SelectHTMLAttributes } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { draftFromPrompt, type Draft } from "@/lib/draft";
import { checkIdea, type Idea } from "@/lib/ideas";
import { bytesToBase64, downloadPptx, readStore, writeStore, type StoredDeck } from "@/lib/local-store";
import { providers, type ProviderId } from "@/lib/providers";
import { promptStarters, sampleIdeas, type SampleIdea } from "@/lib/samples";
import { cn } from "cn";

type Feature = { id: string; text: string };

export function Workspace() {
  const [ready, setReady] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [decks, setDecks] = useState<StoredDeck[]>([]);
  const [title, setTitle] = useState("");
  const [axle, setAxle] = useState("后悬架");
  const [baseline, setBaseline] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState(promptStarters[2]);
  const [provider, setProvider] = useState<ProviderId>("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"save" | "generate" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [note, setNote] = useState("");
  const [latest, setLatest] = useState<{ id: string; title: string; features: Feature[]; pptxBase64: string; fromModel: boolean } | null>(null);

  useEffect(() => {
    const savedStore = readStore();
    setIdeas(savedStore.ideas);
    setDecks(savedStore.decks);
    const llm = readLlm();
    if (llm) {
      setProvider(llm.provider);
      setApiKey(llm.apiKey);
    }
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
      setSaved("");
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
    setSaved(`已记下「${next.title}」。下一步到第二步，写成两页。`);
  }

  function rememberLlm(nextProvider: ProviderId, nextKey: string) {
    setProvider(nextProvider);
    setApiKey(nextKey);
    writeLlm(nextProvider, nextKey);
  }

  async function generate(nextPrompt: string) {
    setBusy("generate");
    setError("");
    setSaved("");
    setNote("");
    setLatest(null);
    const key = apiKey.trim();
    let draft: Draft;
    let fromModel = false;
    if (!key) {
      const drafted = draftFromPrompt(nextPrompt);
      if (!drafted.ok) {
        setBusy(null);
        setError(drafted.error);
        return;
      }
      draft = drafted.draft;
      setNote("这次没有走大模型，只是把你写的句子拆开。填上密钥后再生成，才会按车型、零件和方向来写。");
    } else {
      writeLlm(provider, key);
      let response: Response;
      try {
        response = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: nextPrompt, provider, apiKey: key }),
        });
      } catch {
        setBusy(null);
        setError("没有连上生成服务。");
        return;
      }
      const payload = (await response.json().catch(() => null)) as { error?: string; draft?: Draft } | null;
      if (!response.ok || !payload?.draft) {
        setBusy(null);
        setError(payload?.error || "模型没有写完。");
        return;
      }
      draft = payload.draft;
      fromModel = true;
    }
    const { renderDraft } = await import("@/lib/slides");
    const bytes = await renderDraft(draft);
    const pptxBase64 = bytesToBase64(bytes);
    const deck: StoredDeck = {
      id: crypto.randomUUID(),
      title: draft.title,
      prompt: nextPrompt.slice(0, 2000),
      createdAt: new Date().toISOString(),
      pptxBase64,
    };
    setDecks((current) => [deck, ...current].slice(0, 12));
    setLatest({ id: deck.id, title: deck.title, features: draft.features, pptxBase64, fromModel });
    setBusy(null);
  }

  function useIdea(idea: Idea | SampleIdea) {
    setPrompt(`标题：${idea.title}\n桥：${idea.axle}\n基线：${idea.baseline}\n结构：${idea.body}`);
    setError("");
    document.getElementById("slides")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] pb-28 sm:gap-5 lg:pb-10">
      <header className="blueprint overflow-hidden rounded-lg border border-border shadow-[0_1px_2px_rgba(28,36,48,0.04)]">
        <div className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
          <Mark />
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-primary">CHASSIS · SUSPENSION</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">悬架创新工作台</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">按车型、零件和方向，写成两页结构讨论稿。密钥只留在这台浏览器里。</p>
          </div>
        </div>
        <ol className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-t border-border bg-card/80 px-3 py-3 sm:px-5">
          <li>
            <StepLink href="#ideas" index="01" title="记下想法" detail="先写零件关系" />
          </li>
          <li aria-hidden="true" className="text-accent">
            <ChevronRight className="size-4" />
          </li>
          <li>
            <StepLink href="#slides" index="02" title="写成两页" detail="再生成讨论稿" accent />
          </li>
        </ol>
      </header>

      {error ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm leading-6 text-destructive" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {saved ? (
        <p className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm leading-6 text-success" role="status">
          <Check className="mt-0.5 size-4 shrink-0" />
          <span>{saved}</span>
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-5">
        <Card id="ideas" className="scroll-mt-4">
          <CardHeader className="border-b border-border pb-4">
            <StepHeading index="01" icon={<NotebookPen className="size-4" />} title="记下想法" detail="写清前悬还是后悬、现在卡在哪、零件之间怎么连。示例可以直接收下再改。" />
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveIdea({ title, axle, baseline, body });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title">标题</Label>
                  <Input id="title" value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} placeholder="例如：轮跳末端的第二接触" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="axle">部位</Label>
                  <FieldSelect id="axle" value={axle} onChange={(event) => setAxle(event.target.value)}>
                    <option>前悬架</option>
                    <option>后悬架</option>
                    <option>前后悬架</option>
                  </FieldSelect>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="baseline">现在卡在哪</Label>
                <Textarea id="baseline" value={baseline} maxLength={300} onChange={(event) => setBaseline(event.target.value)} placeholder="现有结构里，哪一处同时干了两件互相打架的事" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="body">结构关系</Label>
                <Textarea id="body" value={body} maxLength={800} onChange={(event) => setBody(event.target.value)} placeholder="谁和谁连着；平时什么样；到了那个工况，力走到哪；哪组孔不动" className="min-h-28" />
              </div>
              <Button type="submit" variant="outline" disabled={busy !== null} className="h-11 w-full px-4 text-base sm:w-auto sm:self-start">
                记下来
              </Button>
            </form>

            <section className="flex flex-col gap-2">
              <SectionLabel>已记下的想法</SectionLabel>
              {ideas.length === 0 ? (
                <EmptyState title="还没记下想法" body="先收下面的示例，再按你们的实车改零件和传力路径。" />
              ) : (
                ideas.map((idea) => (
                  <article key={idea.id} className="rounded-lg border border-border bg-card px-3 py-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-semibold">{idea.title}</h2>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                        {idea.axle} · {formatWhen(idea.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{idea.body}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button type="button" variant="outline" className="h-11 px-1 text-sm" onClick={() => useIdea(idea)}>
                        填入
                      </Button>
                      <Button type="button" variant="emphasis" className="h-11 px-1 text-sm" onClick={() => void generate(compose(idea))} disabled={busy !== null}>
                        生成
                      </Button>
                      <Button type="button" variant="ghost" className="h-11 px-1 text-sm text-muted-foreground" onClick={() => setIdeas((current) => current.filter((item) => item.id !== idea.id))}>
                        删除
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </section>

            <section className="flex flex-col gap-2">
              <SectionLabel>示例，点卡片就能记下</SectionLabel>
              {sampleIdeas.map((idea) => (
                <button
                  key={idea.title}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => saveIdea(idea)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left shadow-sm transition hover:border-accent disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-[11px] font-medium tracking-wide text-accent">示例</span>
                    <span className="mt-0.5 block break-words text-sm font-semibold text-foreground">{idea.title}</span>
                    <span className="block text-xs text-muted-foreground">{idea.axle}</span>
                  </span>
                  <span className="inline-flex h-8 shrink-0 items-center rounded-md border border-primary px-2.5 text-xs font-semibold text-primary">记下</span>
                </button>
              ))}
            </section>
          </CardContent>
        </Card>

        <Card id="slides" className="scroll-mt-4">
          <CardHeader className="border-b border-border pb-4">
            <StepHeading index="02" icon={<FileText className="size-4" />} title="写成两页" detail="写清哪款车、哪个零件或系统、想往哪个方向改。这一步才是生成。" accent />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="provider">模型</Label>
                <FieldSelect id="provider" value={provider} onChange={(event) => rememberLlm(event.target.value as ProviderId, apiKey)}>
                  {Object.entries(providers).map(([id, item]) => (
                    <option key={id} value={id}>
                      {item.label}
                    </option>
                  ))}
                </FieldSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="apiKey">模型密钥</Label>
                <Input
                  id="apiKey"
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(event) => rememberLlm(provider, event.target.value)}
                  placeholder="填一次就留在这台浏览器里"
                />
              </div>
            </div>
            <div className="grid gap-2">
              {promptStarters.map((starter, index) => {
                const active = prompt === starter;
                return (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => setPrompt(starter)}
                    className={cn(
                      "rounded-lg border bg-card px-3 py-3 text-left shadow-sm transition hover:border-primary",
                      active ? "border-accent ring-3 ring-accent/30" : "border-border",
                    )}
                  >
                    <span className="font-mono text-[11px] font-medium tracking-wide text-accent tabular-nums">方向 0{index + 1}</span>
                    <span className="mt-1 block text-sm leading-6 text-foreground">{starter.length > 54 ? `${starter.slice(0, 54)}…` : starter}</span>
                  </button>
                );
              })}
            </div>
            <Textarea value={prompt} maxLength={2000} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：后驱轿车，后悬下控制臂内点。轮跳末端的冲击不要再进衬套，想在缓冲块压实之后另开一条进纵梁的传力路径。车身安装孔不动。" className="min-h-36 sm:min-h-40" />
            <Button type="button" variant="emphasis" className="h-11 w-full px-4 text-base font-semibold" disabled={busy !== null} onClick={() => void generate(prompt)}>
              {busy === "generate" ? (apiKey.trim() ? "正在让模型写这两页…" : "正在整理这两页…") : "生成两页幻灯片"}
            </Button>

            {busy === "generate" ? (
              <p className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-3 text-sm leading-6 text-foreground" role="status">
                <Loader2 className="size-4 shrink-0 animate-spin text-accent" />
                {apiKey.trim() ? "模型正在按车型、零件和方向写结构关系。" : "正在按你写下的句子整理，这次不调用模型。"}
              </p>
            ) : null}
            {note ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm leading-6 text-warning">{note}</p>
            ) : null}

            {latest ? (
              <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-3">
                <p className="font-mono text-[11px] font-medium tracking-wide text-success">已写成两页</p>
                <p className="mt-1 break-words text-base font-semibold">{latest.title}</p>
                <ul className="mt-2 space-y-1 text-sm leading-6">
                  {latest.features.map((feature) => (
                    <li key={feature.id} className="flex gap-2">
                      <span className="font-mono text-xs font-medium text-primary tabular-nums">{feature.id}</span>
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm leading-6 text-foreground">
                  {latest.fromModel ? "这是模型按你的提示写的讨论稿，里面的数字不是实测。" : "这是按你写下的句子整理的，不是模型写的。"}
                  这些方案具备写成独立权利要求的结构关系。是不是新的、值不值得申请，要检索之后才知道。
                </p>
                <Button type="button" className="mt-3 h-11 w-full px-4 text-base sm:w-auto" onClick={() => downloadPptx(latest.pptxBase64, latest.title)}>
                  <Download className="size-4" />
                  下载幻灯片
                </Button>
              </div>
            ) : busy === "generate" ? null : (
              <EmptyState title="还没有新的结果" body="写完上面的车型、零件和方向，再点橙色的生成按钮。" />
            )}

            <section className="flex flex-col gap-2">
              <SectionLabel>已经生成的</SectionLabel>
              {decks.length === 0 ? (
                <EmptyState title="这台浏览器里还没有幻灯片" body="生成过的两页会留在这里，刷新也还在。" />
              ) : (
                decks.map((deck) => (
                  <button
                    key={deck.id}
                    type="button"
                    onClick={() => downloadPptx(deck.pptxBase64, deck.title)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm shadow-sm transition hover:border-primary"
                  >
                    <span className="min-w-0 break-words font-medium">{deck.title}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{formatWhen(deck.createdAt)}</span>
                  </button>
                ))
              )}
            </section>
          </CardContent>
        </Card>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={() => document.getElementById("ideas")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <span className="font-mono text-xs tabular-nums">01</span>
            记下想法
          </Button>
          <Button type="button" variant="emphasis" className="h-11" onClick={() => document.getElementById("slides")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <span className="font-mono text-xs tabular-nums">02</span>
            写成两页
          </Button>
        </div>
      </nav>
    </div>
  );
}

function Mark() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0 rounded-lg shadow-sm">
      <rect width="48" height="48" rx="8" fill="#1F4E5F" />
      <path d="M8 8h32M8 16h32M8 24h32M8 32h32M8 40h32M8 8v32M16 8v32M24 8v32M32 8v32M40 8v32" stroke="#F4F7F8" strokeOpacity="0.16" />
      <path d="M11 33h26" stroke="#F4F7F8" strokeWidth="1.4" />
      <path d="M13 33 L24 16 L35 33" fill="none" stroke="#F4F7F8" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 33 L24 22 L30 33" fill="none" stroke="#E8833A" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="13" cy="33" r="2.2" fill="#E8833A" />
      <circle cx="35" cy="33" r="2.2" fill="#E8833A" />
      <circle cx="24" cy="16" r="2.3" fill="#F4F7F8" />
    </svg>
  );
}

function StepLink({ href, index, title, detail, accent = false }: { href: string; index: string; title: string; detail: string; accent?: boolean }) {
  return (
    <a href={href} className="flex min-h-11 items-center gap-2 rounded-md px-1 py-1 transition hover:bg-secondary sm:gap-3 sm:px-2">
      <span className={cn("font-mono text-xl font-semibold tabular-nums", accent ? "text-accent" : "text-primary")}>{index}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">{detail}</span>
      </span>
    </a>
  );
}

function StepHeading({ index, icon, title, detail, accent = false }: { index: string; icon: ReactNode; title: string; detail: string; accent?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("font-mono text-[1.75rem] leading-none font-semibold tabular-nums", accent ? "text-accent" : "text-primary")}>{index}</span>
      <span className={cn("mt-1 inline-flex size-7 items-center justify-center rounded-md", accent ? "bg-accent/15 text-accent" : "bg-secondary text-primary")}>{icon}</span>
      <div className="min-w-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-1 leading-6">{detail}</CardDescription>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold tracking-wide text-primary">{children}</p>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-input bg-muted/70 px-4 py-5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function FieldSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-input bg-card px-3 pr-9 text-base text-foreground shadow-[0_1px_0_rgba(28,36,48,0.03)] outline-none transition focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-accent/35",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function compose(idea: { title: string; axle: string; baseline: string; body: string }) {
  return `标题：${idea.title}\n桥：${idea.axle}\n基线：${idea.baseline}\n结构：${idea.body}`;
}

const llmStorageKey = "suspension-studio-llm-v1";

function readLlm(): { provider: ProviderId; apiKey: string } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(llmStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { provider?: string; apiKey?: string };
    if (!parsed.provider || !(parsed.provider in providers) || typeof parsed.apiKey !== "string") return null;
    return { provider: parsed.provider as ProviderId, apiKey: parsed.apiKey };
  } catch {
    return null;
  }
}

function writeLlm(provider: ProviderId, apiKey: string) {
  localStorage.setItem(llmStorageKey, JSON.stringify({ provider, apiKey }));
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}（上海）`;
}
