// 백엔드 fetch 호출 (raw). React Query 훅은 queries.ts / mutation.ts 참고
import type {
  AptTradesParams,
  AptTradesResult,
  NaverImagesResult,
  SyncParams,
  SyncResult,
} from './type';

async function parse<T>(res: Response, fallbackMsg: string): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? fallbackMsg);
  return json as T;
}

/** 아파트 실거래가 조회 */
export async function getAptTrades(params: AptTradesParams): Promise<AptTradesResult> {
  const { lawdCd, dealYmd, numOfRows = 100 } = params;
  const res = await fetch(
    `/api/apt/trades?lawdCd=${lawdCd}&dealYmd=${dealYmd}&numOfRows=${numOfRows}`,
  );
  return parse<AptTradesResult>(res, '조회 실패');
}

/** 실거래가 DB 저장 */
export async function syncAptTrades(params: SyncParams): Promise<SyncResult> {
  const { lawdCd, dealYmd } = params;
  const res = await fetch(
    `/api/apt/sync?lawdCd=${lawdCd}&dealYmd=${dealYmd}`,
    { method: 'POST' },
  );
  return parse<SyncResult>(res, '저장 실패');
}

/** 네이버 웹검색 기반 이미지 조회 */
export async function getNaverImages(q: string): Promise<NaverImagesResult> {
  const res = await fetch(`/api/naver/images?q=${encodeURIComponent(q)}`);
  return parse<NaverImagesResult>(res, '이미지 검색 실패');
}
