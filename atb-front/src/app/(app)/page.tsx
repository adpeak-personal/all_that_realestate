import type { Metadata } from 'next';
import HomeView from './HomeView';
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

  return (
    <HomeView
      summary={summary ?? undefined}
      stats={stats ?? undefined}
      trend={trend ?? undefined}
      recent={deals?.items ?? []}
      popular={popular?.items ?? []}
      presales={presales?.items ?? []}
      presaleSummary={presaleSummary ?? undefined}
    />
  );
}
