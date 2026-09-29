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
  avgPrice: number;         // 만원
  unitPrice: number | null; // ㎡당 평균 단가 (만원) — 지역 간 비교는 이 값으로
  trend: number | null;     // ㎡당 단가 전월 대비 %, 비교 대상 없으면 null
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
  area?: number;    // 전용면적 ㎡ (단지 상세에서 면적 하나만 볼 때)
  page?: number;
  size?: number;
}

export interface AreaStat {
  /** 전용면적 ㎡, 소수 2자리 */
  area: number;
  dealCount: number;
  minAmount: number;  // 만원
  maxAmount: number;  // 만원
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
  /** 면적별 요약 (거래건수·최저·최고). 해제 거래는 뺀 수치 */
  areaStats: AreaStat[];
  /** 어드민이 직접 쓴 검색 제목·설명. 없으면 자동 생성한다 */
  seoTitle: string | null;
  seoDescription: string | null;
  matchStatus: number;
  /** WGS84. 지오코딩 전이면 null */
  lat: number | null;
  lng: number | null;
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
    /** 교통·학군·편의 — 단지마다 채움률이 달라 없을 수 있다 */
    subwayLine: string | null;
    subwayStation: string | null;
    subwayWalk: string | null;
    busWalk: string | null;
    educationFacility: string | null;
    convenientFacility: string | null;
    welfareFacility: string | null;
    elevatorCnt: number | null;
    evChargerCnt: number | null;
  } | null;
}

/** 월별 시세 추이 1점. 거래가 없던 달은 trades 0 / 단가 null. */
export interface TrendPoint {
  ym: string;               // 'YYYYMM'
  trades: number;
  unitPrice: number | null; // ㎡당 평균 단가 (만원)
  avgPrice: number | null;  // 평균 거래금액 (만원)
}

export interface TrendResult {
  baseMonth: string | null;
  items: TrendPoint[];
}

export interface TrendParams {
  sido?: string;
  sggCd?: string;
  aptId?: number;
  months?: number;
}

/** 시도 안의 시군구 요약 (드릴다운용) */
export interface SggBreakdownItem {
  code: string;
  sgg: string;
  apts: number;
  deals: number;
  unitPrice: number | null;
}

export interface SggBreakdownResult {
  items: SggBreakdownItem[];
  total: number;
}

export type AptSort = 'deals' | 'price_desc' | 'price_asc' | 'name' | 'households' | 'recent';

/** 지역별 단지 목록의 한 행 */
export interface AptListRow {
  id: number;
  aptNm: string;
  /** WGS84. 지오코딩 전이면 null */
  lat: number | null;
  lng: number | null;
  sido: string;
  sgg: string;
  umdNm: string;
  buildYear: number | null;
  households: number | null;
  dealCount: number;
  unitPrice: number | null;
  lastDealDate: string | null;
  lastDealAmount: number | null;
  lastDealArea: number | null;
}

export interface AptListResult {
  items: AptListRow[];
  total: number;
  page: number;
  size: number;
}

/** 사이트 전체 수집 현황 */
export interface SiteSummary {
  totalDeals: number;
  totalApts: number;
  totalSgg: number;
  firstMonth: string | null;
  lastMonth: string | null;
}

/* ── 분양 ──────────────────────────────────────────────────────────────── */

export type PresaleStatus = 'upcoming' | 'open' | 'closed' | 'unknown';

export interface PresaleRow {
  houseManageNo: string;
  pblancNo: string;
  /** 주소에 쓰는 번호 (/presale/125) */
  id: number;
  houseNm: string;
  houseType: string | null;
  rentType: string | null;
  sido: string | null;
  sgg: string | null;
  sggCd: number | null;
  addr: string | null;
  totalHouseholds: number | null;
  noticeDate: string | null;
  rceptBgnde: string | null;
  rceptEndde: string | null;
  winnerDate: string | null;
  moveinYm: string | null;
  developer: string | null;
  builder: string | null;
  status: PresaleStatus;
  isFeatured: boolean;
  minAmount: number | null;
  maxAmount: number | null;
}

export interface PresaleListResult {
  items: PresaleRow[];
  total: number;
  page: number;
  size: number;
}

export type LandingBlock =
  | { id: string; type: 'image'; url: string; alt: string; link: string | null }
  | { id: string; type: 'text'; heading: string; body: string };

export interface PresaleTypeRow {
  modelNo: string;
  houseTy: string | null;
  excluAr: number | null;
  supplyAr: number | null;
  generalHshldco: number | null;
  specialHshldco: number | null;
  topAmount: number | null;
}

export interface PresaleDetail extends PresaleRow {
  subscrptAreaNm: string | null;
  spsplyBgnde: string | null;
  spsplyEndde: string | null;
  contractBgnde: string | null;
  contractEndde: string | null;
  tel: string | null;
  homepage: string | null;
  pblancUrl: string | null;
  specltRdnEarthAt: string | null;
  mdatTrgetAreaAt: string | null;
  parcprcUlsAt: string | null;
  lat: number | null;
  lng: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  /** 관리자가 구성한 랜딩 블록 (분양 상세 위쪽에 나온다) */
  landing: LandingBlock[];
  types: PresaleTypeRow[];
}

export interface PresaleSummary {
  open: number;
  upcoming: number;
  total: number;
}
