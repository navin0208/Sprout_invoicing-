import { prisma } from './prisma';

// The Settings table always has exactly one row (id = 1). This makes sure
// it exists and returns it — callers never have to null-check it.
export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: 1 } });
}

export function parseDayOffsets(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.filter((n) => Number.isFinite(n));
  } catch {
    // fall through
  }
  return [];
}
