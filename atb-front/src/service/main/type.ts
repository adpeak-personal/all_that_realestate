// atb-back 조회 API 응답/요청 타입.
// 수집(공공API 호출·DB 저장)은 atb-program(Python)이 하므로 프론트는 읽기만 한다.

/** 시군구 코드 */
export interface SggItem {
  code: string; // '11680'
  sido: string; // 단축명 '서울'
  sgg: string;  // '강남구'
}

export interface SggResult {
  items: SggItem[];
  total: number;
}

/** 실거래 1건 */
export interface Deal {
  id: number;
  aptId: number | null;
  sido: string;
  sgg: string;
  umdNm: string;
  aptNm: string;
  excluUseAr: number;
  floor: number | null;
  dealAmount: number; // 만원
  dealDate: string;   // 'YYYY-MM-DD'
  buildYear: number | null;
  dealingGbn: string | null;
  thumbnailUrl: string | null;
}

export interface DealListResult {
  items: Deal[];
  total: number;
  page: number;
  size: number;
}

export interface RecentDealsResult {
  items: Deal[];
  total: number;
}

/** 시도별 월간 통계 */
export interface RegionStat {
  sido: string;
  trades: number;
  avgPrice: number;     // 만원
  trend: number | null; // ㎡당 단가 전월 대비 %, 비교 대상 없으면 null
}

export interface RegionStatsResult {
  baseMonth: string | null; // 'YYYYMM'. 수집 데이터가 없으면 null
  items: RegionStat[];
}

export interface DealListParams {
  sggCd?: string;
  dealYmd?: string; // YYYYMM
  aptNm?: string;
  aptId?: number;   // 단지 상세의 거래이력 조회용
  page?: number;
  size?: number;
}

/** 단지 상세. kapt 는 K-apt 매칭이 된 단지만 채워진다. */
export interface AptDetail {
  id: number;
  aptNm: string;
  sido: string;
  sgg: string;
  umdNm: string;
  jibun: string | null;
  buildYear: number | null;
  thumbnailUrl: string | null;
  excluAreas: number[];
  matchStatus: number;
  kapt: {
    name: string;
    totalHouseholds: number | null;
    dongCnt: number | null;
    topFloor: number | null;
    useAprDate: string | null;
    heatType: string | null;
    hallType: string | null;
    builder: string | null;
    parkingTotal: number | null;
    addrRoad: string | null;
    addrJibun: string | null;
  } | null;
}
