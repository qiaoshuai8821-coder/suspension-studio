export type Idea = {
  id: string;
  title: string;
  axle: string;
  baseline: string;
  body: string;
  createdAt: string;
};

const axles = new Set(["前悬架", "后悬架", "前后悬架"]);

export function checkIdea(idea: { title: string; axle: string; baseline: string; body: string }): string | null {
  const title = idea.title.replace(/\s+/g, " ").trim();
  const baseline = idea.baseline.replace(/\s+/g, " ").trim();
  const body = idea.body.replace(/\s+/g, " ").trim();
  if (!title || !baseline || !body || !axles.has(idea.axle)) {
    return "标题、部位、现状和结构都要填。";
  }
  if (baseline.includes("电池") || body.includes("电池")) {
    return "电池不归我们改。请只写悬架零件。";
  }
  return null;
}
