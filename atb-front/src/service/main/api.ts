// 백엔드 fetch 호출 (raw). React Query 훅은 queries.ts 참고.
// next.config.ts 의 rewrites 로 /api/* → 백엔드(4030) 로 프록시된다.
import type {
  AptDetail,
  DealListParams,
  DealListResult,
  RecentDealsResult,
  RegionStatsResult,
  SggResult,
  TrendParams,
  TrendResult,
} from './type';

async function parse<T>(res: Response, fallbackMsg: string): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? fallbackMsg);
  return json as T;
}

/** 시군구 코드 목록 */
export async function getSggCodes(): Promise<SggResult> {
  const res = await fetch('/api/sgg');
  return parse<SggResult>(res, '시군구 목록 조회 실패');
}

/** 시도별 월간 통계. ym 생략 시 서버가 최신 수집월을 쓴다. */
export async function getRegionStats(ym?: string): Promise<RegionStatsResult> {
  const qs = ym ? `?ym=${ym}` : '';
  const res = await fetch(`/api/stats/regions${qs}`);
  return parse<RegionStatsResult>(res, '지역 통계 조회 실패');
}

/** 최근 거래. sido 는 단축명('서울'). */
export async function getRecentDeals(
  params: { sido?: string; limit?: number } = {},
): Promise<RecentDealsResult> {
  const qs = new URLSearchParams();
  if (params.sido) qs.set('sido', params.sido);
  if (params.limit) qs.set('limit', String(params.limit));

  const res = await fetch(`/api/deals/recent?${qs.toString()}`);
  return parse<RecentDealsResult>(res, '최근 거래 조회 실패');
}

/** 실거래 목록 (필터 + 페이징) */
export async function getDeals(params: DealListParams): Promise<DealListResult> {
  const qs = new URLSearchParams();
  if (params.sggCd) qs.set('sggCd', params.sggCd);
  if (params.dealYmd) qs.set('dealYmd', params.dealYmd);
  if (params.aptNm) qs.set('aptNm', params.aptNm);
  if (params.aptId) qs.set('aptId', String(params.aptId));
  if (params.page) qs.set('page', String(params.page));
  if (params.size) qs.set('size', String(params.size));

  const res = await fetch(`/api/deals?${qs.toString()}`);
  return parse<DealListResult>(res, '실거래 조회 실패');
}

/** 단지 상세 */
export async function getAptDetail(aptId: number): Promise<AptDetail> {
  const res = await fetch(`/api/apt/${aptId}`);
  return parse<AptDetail>(res, '단지 정보를 불러오지 못했습니다');
}

/** 월별 시세 추이 (㎡당 평균 단가) */
export async function getPriceTrend(params: TrendParams = {}): Promise<TrendResult> {
  const qs = new URLSearchParams();
  if (params.sido) qs.set('sido', params.sido);
  if (params.sggCd) qs.set('sggCd', params.sggCd);
  if (params.aptId) qs.set('aptId', String(params.aptId));
  if (params.months) qs.set('months', String(params.months));

  const res = await fetch(`/api/stats/trend?${qs.toString()}`);
  return parse<TrendResult>(res, '시세 추이 조회 실패');
}
