import { searchCatalog } from '@/lib/catalog';
export async function GET(request: Request) {
  const url = new URL(request.url), q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const page = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get('page')) || 1)));
  const data = await searchCatalog(q, page);
  return Response.json(data, { status: data.sources.some(s => s.ok) ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
