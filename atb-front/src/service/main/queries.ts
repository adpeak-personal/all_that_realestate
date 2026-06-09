import { useQuery } from '@tanstack/react-query';
import { getAptTrades, getNaverImages } from './api';
import type { AptTradesParams } from './type';

export const mainKeys = {
  aptTrades: (params: AptTradesParams | null) => ['apt', 'trades', params] as const,
  naverImages: (q: string | null) => ['naver', 'images', q] as const,
};

/**
 * 아파트 실거래가 조회.
 * params 가 null 이면 비활성 — 조회 버튼을 눌러 params 를 세팅하면 실행된다.
 */
export function useAptTrades(params: AptTradesParams | null) {
  return useQuery({
    queryKey: mainKeys.aptTrades(params),
    queryFn: () => getAptTrades(params!),
    enabled: params !== null,
  });
}

/**
 * 네이버 이미지 검색.
 * q 가 null 이면 비활성 — 모달을 열어 검색어를 세팅하면 실행된다.
 */
export function useNaverImages(q: string | null) {
  return useQuery({
    queryKey: mainKeys.naverImages(q),
    queryFn: () => getNaverImages(q!),
    enabled: q !== null,
  });
}
