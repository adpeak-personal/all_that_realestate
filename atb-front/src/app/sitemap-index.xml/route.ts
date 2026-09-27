import { fetchAptSitemap, fetchPresaleSitemap } from '../../service/server/api';

/**
 * 사이트맵 인덱스.
 *
 * generateSitemaps 는 /apt/sitemap/0.xml 처럼 번호가 붙은 파일만 만들고,
 * 그것들을 묶는 인덱스는 만들어 주지 않는다(/apt/sitemap.xml 은 404 다).
 * 검색엔진에는 이 인덱스 하나만 알려주면 나머지를 따라간다.
 */
const CHUNK = 10_000;
export const revalidate = 3600;

function chunkCount(total: number): number {
  return Math.max(Math.ceil(total / CHUNK), 1);
}

export async function GET() {
  const base = (process.env.SITE_URL ?? 'http://localhost:4000').replace(/\/$/, '');

  const [apt, presale] = await Promise.all([
    fetchAptSitemap(1, 0),
    fetchPresaleSitemap(1, 0),
  ]);

  const urls = [
    `${base}/sitemap.xml`,
    ...Array.from(
      { length: chunkCount(apt?.total ?? 0) },
      (_, i) => `${base}/apt/sitemap/${i}.xml`,
    ),
    ...Array.from(
      { length: chunkCount(presale?.total ?? 0) },
      (_, i) => `${base}/presale/sitemap/${i}.xml`,
    ),
  ];

  const now = new Date().toISOString();
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `  <sitemap>\n    <loc>${u}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`)
      .join('\n') +
    `\n</sitemapindex>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
