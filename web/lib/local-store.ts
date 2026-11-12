import type { Idea } from "./ideas";

export type StoredDeck = {
  id: string;
  title: string;
  prompt: string;
  createdAt: string;
  pptxBase64: string;
};

const storageKey = "suspension-studio-v1";

export function readStore(): { ideas: Idea[]; decks: StoredDeck[] } {
  if (typeof localStorage === "undefined") return { ideas: [], decks: [] };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ideas: [], decks: [] };
    const parsed = JSON.parse(raw) as { ideas?: Idea[]; decks?: StoredDeck[] };
    return {
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      decks: Array.isArray(parsed.decks) ? parsed.decks : [],
    };
  } catch {
    return { ideas: [], decks: [] };
  }
}

export function writeStore(ideas: Idea[], decks: StoredDeck[]) {
  localStorage.setItem(storageKey, JSON.stringify({ ideas, decks: decks.slice(0, 12) }));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function downloadPptx(pptxBase64: string, title: string) {
  const binary = atob(pptxBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.pptx`;
  link.click();
  URL.revokeObjectURL(url);
}
