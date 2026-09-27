import type { MetadataRoute } from 'next';
import { fetchPresaleSitemap } from '../../../service/server/api';

/**
 * 분양 공고 사이트맵. /presale/sitemap/0.xml … 로 나뉜다.
 * 숨긴 공고는 백엔드에서 빠진다 — 화면에 없는 URL 을 검색엔진에 내밀면 안 된다.
 */
const CHUNK = 10_000;

export const revalidate = 3600;   // 공고는 매일 올라오므로 단지보다 자주 본다

export async function generateSitemaps() {
  const first = await fetchPresaleSitemap(1, 0);
  const total = first?.total ?? 0;
  const count = Math.max(Math.ceil(total / CHUNK), 1);
  return Array.from({ length: count }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const n = Number(await id) || 0;

  const data = await fetchPresaleSitemap(CHUNK, n * CHUNK);
  if (!data) return [];

  return data.items.map((it) => ({
    url: `${base}/presale/${it.id}`,
    lastModified: it.lastModified ? new Date(it.lastModified) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));
}
