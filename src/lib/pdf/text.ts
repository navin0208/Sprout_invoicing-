// A line item's description can be multi-line (e.g. "Content Creation" with
// a few bullet points underneath explaining what's included) — this splits
// it into a title line plus bullet lines, used by both the PDF renderer and
// the public HTML pages so a multi-line description looks the same
// everywhere instead of running together as one paragraph.
export function splitDescription(description: string): { title: string; bullets: string[] } {
  const lines = description
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const [title, ...bullets] = lines.length ? lines : [''];
  return { title, bullets };
}
