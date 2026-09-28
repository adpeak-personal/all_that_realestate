import type { Metadata } from 'next';
import HomeView from './HomeView';
import JsonLd, { siteUrl } from '../../components/JsonLd';
import {
  fetchApts,
  fetchPriceTrend,
  fetchRecentDeals,
  fetchPresales,
  fetchPresaleSummary,
  fetchRegionStats,
  fetchSiteSummary,
} from '../../service/server/api';
import { formatYearMonth } from '../../lib/format';

// 서버에서 전국 기준 데이터를 받아 뷰에 넘긴다.
// 클라이언트 컴포넌트도 첫 HTML 은 서버에서 렌더되므로, 이 값이 있어야
// 크롤러가 읽을 내용이 생긴다.

/**
 * 메인은 요청할 때 그린다.
 *
 * 기본값(정적 생성)으로 두면 '빌드 시점'에 한 번 렌더된 HTML 이 이미지에 구워진다.
 * 그런데 도커 빌드 중에는 백엔드가 없어서 데이터가 전부 null 이고, 결과적으로
 * 숫자와 분양 목록이 빈 화면이 배포된다. 배포 직후 5분(재검증 주기) 동안 그 빈
 * 화면이 그대로 나갔다 — 검색엔진이 그때 들르면 빈 페이지를 가져간다.
 *
 * 개별 조회는 service/server/api.ts 에서 따로 캐시하므로 DB 부담은 크지 않다.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const stats = await fetchRegionStats();
  const month = formatYearMonth(stats?.baseMonth ?? null);
  const trades = (stats?.items ?? []).reduce((sum, s) => sum + s.trades, 0);

  const desc = month
    ? `${month} 기준 전국 아파트 매매 실거래 ${trades.toLocaleString()}건. ` +
      '국토교통부 실거래가 데이터로 지역별 시세와 ㎡당 단가 추이를 확인하세요.'
    : '전국 아파트 매매 실거래가와 지역별 시세 추이를 확인하세요.';

  return {
    // 홈은 브랜드 페이지라 '| 올댓부동산' 접미사를 붙이지 않는다
    title: { absolute: '올댓부동산 - 전국 아파트 실거래가·시세' },
    description: desc,
    alternates: { canonical: '/' },
  };
}

export default async function HomePage() {
  const [summary, stats, deals, trend, popular, presales, presaleSummary] =
    await Promise.all([
      fetchSiteSummary(),
      fetchRegionStats(),
      fetchRecentDeals(10),
      fetchPriceTrend({ months: 12 }),
      fetchApts({ sort: 'deals', size: 8 }),
      fetchPresales({ size: 3 }),
      fetchPresaleSummary(),
    ]);

  const base = siteUrl();

  return (
    <>
      {/*
        WebSite + SearchAction: 검색 결과에서 사이트 이름과 '사이트 내 검색' 상자를
        쓸 수 있게 한다. target 은 실제 동작하는 검색 주소여야 한다(/apt?q=).
      */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: '올댓부동산',
          url: base,
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${base}/apt?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: '올댓부동산',
          url: base,
          logo: `${base}/icon-512.png`,
        }}
      />
      <HomeView
      summary={summary ?? undefined}
      stats={stats ?? undefined}
      trend={trend ?? undefined}
      recent={deals?.items ?? []}
      popular={popular?.items ?? []}
      presales={presales?.items ?? []}
      presaleSummary={presaleSummary ?? undefined}
      />
    </>
  );
}
