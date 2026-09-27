import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/site-url';

/**
 * robots.txt
 *
 * 사이트맵이 셋으로 나뉘어 있다(고정·지역 / 단지 / 분양). 색인 도구는 robots.txt
 * 에 적힌 것만 따라가므로 셋을 모두 적는다.
 *
 * 막는 곳:
 *  - /admin  : 관리 화면. 검색에 뜰 이유가 없다
 *  - /login, /my : 로그인해야 의미가 있는 화면. 색인돼도 빈 화면만 보인다
 *  - /api    : 데이터 API. 페이지가 아니다
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/admin/', '/login', '/my', '/api/'],
    },
    // 인덱스 하나만 알려주면 그 안에서 단지·분양 조각 파일로 따라간다.
    // (/apt/sitemap.xml 같은 주소는 존재하지 않는다 — 번호가 붙은 파일만 생긴다)
    sitemap: `${base}/sitemap-index.xml`,
  };
}
