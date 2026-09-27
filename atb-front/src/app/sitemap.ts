import type { MetadataRoute } from 'next';
import { SIDO_LIST } from '../lib/apt-sort';

/**
 * 뼈대 사이트맵 — 고정 페이지와 지역 페이지.
 *
 * 단지(3만여 개)와 분양 공고(6천여 개)는 수가 많아 각각 /apt/sitemap/N.xml,
 * /presale/sitemap/N.xml 로 나눠 낸다(파일당 5만 URL 상한). robots.txt 가 셋을
 * 모두 알려준다.
 *
 * 지역 페이지를 넣는 이유: '서울 강남구 아파트 실거래가' 같은 검색이 이 사이트의
 * 주된 유입 경로다. 링크로만 닿을 수 있게 두면 색인이 늦다.
 */
export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL ?? 'http://localhost:4000').replace(/\/$/, '');

  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/presale`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/apt`, changeFrequency: 'daily', priority: 0.8 },
  ];

  const regions: MetadataRoute.Sitemap = SIDO_LIST.map((sido) => ({
    url: `${base}/apt?sido=${encodeURIComponent(sido)}`,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [...fixed, ...regions];
}
