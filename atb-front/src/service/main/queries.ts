import { useQuery } from '@tanstack/react-query';
import { getDeals, getRecentDeals, getRegionStats, getSggCodes } from './api';
import type { DealListParams } from './type';

export const mainKeys = {
  sgg: () => ['sgg'] as const,
  regionStats: (ym?: string) => ['stats', 'regions', ym ?? 'latest'] as const,
  recentDeals: (sido: string | null, limit: number) =>
    ['deals', 'recent', sido, limit] as const,
  deals: (params: DealListParams) => ['deals', 'list', params] as const,
};

/** 시군구 코드 목록. 거의 변하지 않으므로 오래 캐시한다. */
export function useSggCodes() {
  return useQuery({
    queryKey: mainKeys.sgg(),
    queryFn: getSggCodes,
    staleTime: 1000 * 60 * 60, // 1시간
  });
}

/** 시도별 월간 통계 (지도 패널용) */
export function useRegionStats(ym?: string) {
  return useQuery({
    queryKey: mainKeys.regionStats(ym),
    queryFn: () => getRegionStats(ym),
    staleTime: 1000 * 60 * 5,
  });
}

/** 최근 거래. sido 가 null 이면 전국. */
export function useRecentDeals(sido: string | null, limit = 8) {
  return useQuery({
    queryKey: mainKeys.recentDeals(sido, limit),
    queryFn: () => getRecentDeals({ sido: sido ?? undefined, limit }),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * 실거래 목록 조회.
 * params 가 null 이면 비활성 — 조회 버튼으로 params 를 세팅하면 실행된다.
 */
export function useDeals(params: DealListParams | null) {
  return useQuery({
    queryKey: mainKeys.deals(params ?? {}),
    queryFn: () => getDeals(params!),
    enabled: params !== null,
  });
}
