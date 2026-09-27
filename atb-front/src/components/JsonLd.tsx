import { siteUrl } from '../lib/site-url';

/**
 * 구조화 데이터(JSON-LD) 삽입기.
 *
 * 검색엔진이 '이 페이지가 무엇인지' 읽는 경로다. 화면에는 보이지 않으므로
 * 화면에 없는 사실을 여기에 적으면 안 된다 — 값은 전부 실제 데이터에서 온다.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * 사이트 주소. 절대 URL 이 필요한 구조화 데이터에서 쓴다.
 * 여기서 다시 내보내는 이유: 이 파일을 쓰는 쪽이 JsonLd 와 siteUrl 을 같이 가져다 쓴다.
 */
export { siteUrl };

/**
 * 빵부스러기. 검색 결과에서 '올댓부동산 › 단지 찾기 › 서울 강남구' 처럼
 * 경로가 보이게 한다. 화면의 '← 목록으로' 링크와 같은 경로를 적는다.
 */
export function breadcrumb(items: Array<{ name: string; path: string }>) {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${base}${it.path}`,
    })),
  };
}
