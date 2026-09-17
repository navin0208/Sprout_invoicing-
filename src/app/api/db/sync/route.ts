import { NextRequest, NextResponse } from 'next/server';
import { jsonDb } from '@/lib/json-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = jsonDb.raw.read();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && Array.isArray(body.clients)) {
      jsonDb.raw.write(body);
      return NextResponse.json({ success: true, restored: true });
    }
    return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
