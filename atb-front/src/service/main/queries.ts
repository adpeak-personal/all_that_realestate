import { useQuery } from '@tanstack/react-query';
import {
  getAptDetail,
  getDeals,
  getPriceTrend,
  getRecentDeals,
  getRegionStats,
  getSggCodes,
} from './api';
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

// initialData 는 서버 컴포넌트가 미리 받아 넘긴 값이다.
// 이게 있으면 첫 렌더부터 내용이 채워져 HTML 에 담기고(크롤러가 읽을 수 있고),
// 하이드레이션 직후 같은 요청을 다시 보내지도 않는다.

export const mainKeys = {
  sgg: () => ['sgg'] as const,
  regionStats: (ym?: string) => ['stats', 'regions', ym ?? 'latest'] as const,
  recentDeals: (sido: string | null, limit: number) =>
    ['deals', 'recent', sido, limit] as const,
  deals: (params: DealListParams) => ['deals', 'list', params] as const,
  aptDetail: (id: number) => ['apt', id] as const,
  trend: (params: TrendParams) => ['stats', 'trend', params] as const,
};

/** 시군구 코드 목록. 거의 변하지 않으므로 오래 캐시한다. */
export function useSggCodes(initialData?: SggResult) {
  return useQuery({
    queryKey: mainKeys.sgg(),
    queryFn: getSggCodes,
    staleTime: 1000 * 60 * 60, // 1시간
    initialData,
  });
}

/** 시도별 월간 통계 (지도 패널용) */
export function useRegionStats(ym?: string, initialData?: RegionStatsResult) {
  return useQuery({
    queryKey: mainKeys.regionStats(ym),
    queryFn: () => getRegionStats(ym),
    staleTime: 1000 * 60 * 5,
    initialData,
  });
}

/** 최근 거래. sido 가 null 이면 전국. */
export function useRecentDeals(
  sido: string | null,
  limit = 8,
  initialData?: RecentDealsResult,
) {
  return useQuery({
    queryKey: mainKeys.recentDeals(sido, limit),
    queryFn: () => getRecentDeals({ sido: sido ?? undefined, limit }),
    staleTime: 1000 * 60 * 5,
    // 지역을 고르면 키가 바뀌므로, 서버가 준 전국 데이터는 전국 키에만 쓰인다.
    initialData: sido === null ? initialData : undefined,
  });
}

/**
 * 실거래 목록 조회.
 * params 가 null 이면 비활성 — 조회 버튼으로 params 를 세팅하면 실행된다.
 */
export function useDeals(params: DealListParams | null, initialData?: DealListResult) {
  return useQuery({
    queryKey: mainKeys.deals(params ?? {}),
    queryFn: () => getDeals(params!),
    enabled: params !== null,
    initialData,
  });
}

/** 단지 상세. 단지 정보는 거의 안 바뀌므로 오래 캐시한다. */
export function useAptDetail(aptId: number, initialData?: AptDetail) {
  return useQuery({
    queryKey: mainKeys.aptDetail(aptId),
    queryFn: () => getAptDetail(aptId),
    enabled: Number.isFinite(aptId) && aptId > 0,
    staleTime: 1000 * 60 * 30,
    initialData,
  });
}

/** 월별 시세 추이. 범위(sido/sggCd/aptId)가 바뀌면 자동으로 다시 받는다. */
export function usePriceTrend(params: TrendParams | null, initialData?: TrendResult) {
  return useQuery({
    queryKey: mainKeys.trend(params ?? {}),
    queryFn: () => getPriceTrend(params!),
    enabled: params !== null,
    staleTime: 1000 * 60 * 5,
    initialData,
  });
}
