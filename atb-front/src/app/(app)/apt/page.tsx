import type { Metadata } from 'next';
import AptSearchView from './AptSearchView';
import { fetchRegionStats, fetchSggCodes } from '../../../service/server/api';
import { formatYearMonth } from '../../../lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const stats = await fetchRegionStats();
  const month = formatYearMonth(stats?.baseMonth ?? null);

  return {
    title: '아파트 실거래가 조회',
    description:
      '전국 시군구별 아파트 매매 실거래가를 조회합니다. ' +
      (month ? `${month}까지 수집된 국토교통부 데이터 기준.` : ''),
    alternates: { canonical: '/apt' },
  };
}

export default async function AptSearchPage() {
  const [sgg, stats] = await Promise.all([fetchSggCodes(), fetchRegionStats()]);

  return <AptSearchView initialSgg={sgg ?? undefined} initialStats={stats ?? undefined} />;
}
