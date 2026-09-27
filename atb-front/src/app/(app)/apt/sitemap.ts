import type { MetadataRoute } from 'next';
import { fetchAptSitemap } from '../../../service/server/api';
import { siteUrl } from '../../../lib/site-url';

/**
 * 단지 상세 사이트맵. /apt/sitemap/0.xml, /apt/sitemap/1.xml … 로 나뉜다.
 *
 * 구글의 파일당 상한은 5만 URL 이지만 1만씩 끊는다 — 파일 하나가 작을수록
 * 생성이 빠르고, 일부만 갱신돼도 다시 읽는 양이 적다.
 *
 * 나누는 기준은 id 정렬 + offset 이다. 정렬이 호출마다 흔들리면 어떤 단지가
 * 어느 파일에도 안 들어갈 수 있어 백엔드에서 id 로 고정 정렬한다.
 */
const CHUNK = 10_000;

export const revalidate = 86_400;   // 하루

export async function generateSitemaps() {
  const first = await fetchAptSitemap(1, 0);
  const total = first?.total ?? 0;
  const count = Math.max(Math.ceil(total / CHUNK), 1);
  return Array.from({ length: count }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;   // Next 16 부터 id 가 Promise 로 온다
}): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const n = Number(await id) || 0;

  const data = await fetchAptSitemap(CHUNK, n * CHUNK);
  if (!data) return [];

  // lastModified 는 그 단지의 마지막 거래일 — 거래가 붙으면 페이지 내용이 바뀐다
  return data.items.map((it) => ({
    url: `${base}/apt/${it.id}`,
    lastModified: it.lastModified ? new Date(it.lastModified) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));
}
