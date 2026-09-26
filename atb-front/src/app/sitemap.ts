import type { MetadataRoute } from 'next';
import { fetchAptSitemap } from '../service/server/api';

// 사이트맵 한 파일의 상한은 50,000 URL. 현재 단지 수가 그 아래라 한 파일로 낸다.
// 넘어가면 generateSitemaps 로 쪼개야 한다.
const MAX_APTS = 49_000;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? 'http://localhost:4000').replace(/\/$/, '');

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/apt`, changeFrequency: 'daily', priority: 0.8 },
  ];

  const data = await fetchAptSitemap(MAX_APTS);
  if (!data) return staticPages;

  // lastModified 는 그 단지의 마지막 거래일. 거래가 붙는 단지만 목록에 들어온다.
  const aptPages: MetadataRoute.Sitemap = data.items.map((it) => ({
    url: `${base}/apt/${it.id}`,
    lastModified: it.lastModified ? new Date(it.lastModified) : undefined,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticPages, ...aptPages];
}
