/**
 * 서버 렌더링 전용 API 호출.
 *
 * 브라우저는 next.config.ts 의 rewrites 로 '/api/*' 를 백엔드에 프록시하지만,
 * 서버 컴포넌트에서는 그 상대 경로를 해석할 기준이 없다. 절대 URL 로 직접 부른다.
 *
 * 이 파일의 결과를 클라이언트 컴포넌트에 initialData 로 넘기면 첫 HTML 에
 * 내용이 담긴다 — 크롤러(특히 JS 를 거의 실행하지 않는 네이버 검색봇)가
 * 읽을 수 있는 건 이 HTML 뿐이다.
 */
import type {
  AptDetail,
  AptListResult,
  AptSort,
  SggBreakdownResult,
  DealListResult,
  RecentDealsResult,
  RegionStatsResult,
  SggResult,
  SiteSummary,
  TrendResult,
} from '../main/type';

const BASE = process.env.API_BASE_URL ?? 'http://localhost:6050';

/** 조회 결과 캐시 (초). 실거래는 하루 단위로 갱신되므로 짧게 잡을 이유가 없다. */
const REVALIDATE = 600;

async function get<T>(path: string, revalidate = REVALIDATE): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // 백엔드가 내려가도 페이지 자체는 떠야 한다. 호출측에서 null 을 처리한다.
    return null;
  }
}

export function fetchAptDetail(aptId: number) {
  return get<AptDetail>(`/api/apt/${aptId}`);
}

export function fetchPriceTrend(params: {
  sido?: string;
  aptId?: number;
  months?: number;
}) {
  const qs = new URLSearchParams();
  if (params.sido) qs.set('sido', params.sido);
  if (params.aptId) qs.set('aptId', String(params.aptId));
  if (params.months) qs.set('months', String(params.months));
  return get<TrendResult>(`/api/stats/trend?${qs.toString()}`);
}

export function fetchDeals(params: { aptId?: number; page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (params.aptId) qs.set('aptId', String(params.aptId));
  if (params.page) qs.set('page', String(params.page));
  if (params.size) qs.set('size', String(params.size));
  return get<DealListResult>(`/api/deals?${qs.toString()}`);
}

export function fetchRegionStats() {
  return get<RegionStatsResult>('/api/stats/regions');
}

export function fetchRecentDeals(limit = 8) {
  return get<RecentDealsResult>(`/api/deals/recent?limit=${limit}`);
}

export function fetchSggCodes() {
  return get<SggResult>('/api/sgg', 60 * 60 * 24);
}

export function fetchAptSitemap(limit = 50000) {
  return get<{ items: Array<{ id: number; lastModified: string | null }> }>(
    `/api/sitemap/apts?limit=${limit}`,
    60 * 60,
  );
}

/** 시도 안의 시군구 요약 */
export function fetchSggBreakdown(sido: string) {
  return get<SggBreakdownResult>(`/api/sgg/breakdown?sido=${encodeURIComponent(sido)}`);
}

/** 지역별 단지 목록 */
export function fetchApts(params: {
  sggCd?: string;
  sido?: string;
  q?: string;
  sort?: AptSort;
  page?: number;
  size?: number;
}) {
  const qs = new URLSearchParams();
  if (params.sggCd) qs.set('sggCd', params.sggCd);
  if (params.sido) qs.set('sido', params.sido);
  if (params.q) qs.set('q', params.q);
  if (params.sort) qs.set('sort', params.sort);
  if (params.page) qs.set('page', String(params.page));
  if (params.size) qs.set('size', String(params.size));
  return get<AptListResult>(`/api/apts?${qs.toString()}`);
}

/** 사이트 전체 수집 현황 */
export function fetchSiteSummary() {
  return get<SiteSummary>('/api/stats/summary', 60 * 60);
}
