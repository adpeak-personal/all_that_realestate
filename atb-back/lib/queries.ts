// 실거래 DB 조회 (읽기 전용).
// 수집/가공은 atb-program(Python)이 담당하므로 여기서는 SELECT 만 한다.
import { query } from './db';
import { toShortSido, toFullSido } from './sido';
import { parseLanding, type LandingBlock } from './landing';

/** 해제(취소)된 거래 제외 조건. API 가 '' 로 주는 경우가 있어 둘 다 본다. */
export const NOT_CANCELED = `(d.cdeal_day IS NULL OR d.cdeal_day = '')`;

export interface YearMonth {
    year: number;
    month: number;
}

/** DB 에 쌓인 가장 최근 거래월. 데이터가 없으면 null. */
export async function latestDealMonth(): Promise<YearMonth | null> {
    const rows = (await query(
        `SELECT deal_year AS y, deal_month AS m
           FROM apartment_deals
          ORDER BY deal_year DESC, deal_month DESC
          LIMIT 1`,
    )) as Array<{ y: number; m: number }>;

    if (rows.length === 0) return null;
    return { year: rows[0].y, month: rows[0].m };
}

function prevMonth({ year, month }: YearMonth): YearMonth {
    return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export interface RegionStat {
    sido: string;          // 단축명 (서울, 경기, ...)
    trades: number;        // 해당 월 거래 건수
    avgPrice: number;      // 평균 거래금액 (만원)
    unitPrice: number | null; // ㎡당 평균 단가 (만원) — 지역 간 비교는 이 값으로
    trend: number | null;  // ㎡당 단가 전월 대비 증감률 (%). 전월 데이터 없으면 null
}

/**
 * 시도별 월간 통계 + 전월 대비.
 *
 * trend 는 평균 거래금액이 아니라 '㎡당 평균 단가' 기준이다.
 * 평균 거래금액은 그 달에 큰 평형이 많이 거래되면 함께 오르기 때문에
 * 시세 변동으로 읽으면 오해를 부른다.
 */
export async function regionStats(ym: YearMonth): Promise<RegionStat[]> {
    const prev = prevMonth(ym);

    const rows = (await query(
        `SELECT s.sido_nm AS sido,
                SUM(CASE WHEN d.deal_year = ? AND d.deal_month = ? THEN 1 ELSE 0 END) AS trades,
                AVG(CASE WHEN d.deal_year = ? AND d.deal_month = ? THEN d.deal_amount END) AS avg_price,
                AVG(CASE WHEN d.deal_year = ? AND d.deal_month = ? THEN d.deal_amount / d.exclu_use_ar END) AS unit_cur,
                AVG(CASE WHEN d.deal_year = ? AND d.deal_month = ? THEN d.deal_amount / d.exclu_use_ar END) AS unit_prev
           FROM apartment_deals d
           JOIN sgg_codes s ON s.sgg_cd = d.sgg_cd
          WHERE ((d.deal_year = ? AND d.deal_month = ?) OR (d.deal_year = ? AND d.deal_month = ?))
            AND ${NOT_CANCELED}
          GROUP BY s.sido_nm`,
        [
            ym.year, ym.month,
            ym.year, ym.month,
            ym.year, ym.month,
            prev.year, prev.month,
            ym.year, ym.month,
            prev.year, prev.month,
        ],
    )) as Array<{
        sido: string;
        trades: number;
        avg_price: string | null;
        unit_cur: string | null;
        unit_prev: string | null;
    }>;

    return rows
        .filter((r) => Number(r.trades) > 0)
        .map((r) => {
            const cur = r.unit_cur === null ? null : Number(r.unit_cur);
            const pv = r.unit_prev === null ? null : Number(r.unit_prev);
            const trend =
                cur !== null && pv !== null && pv > 0
                    ? Number((((cur - pv) / pv) * 100).toFixed(1))
                    : null;

            return {
                sido: toShortSido(r.sido),
                trades: Number(r.trades),
                avgPrice: Math.round(Number(r.avg_price ?? 0)),
                unitPrice: cur === null ? null : Math.round(cur),
                trend,
            };
        })
        .sort((a, b) => b.trades - a.trades);
}

export interface DealRow {
    id: number;
    aptId: number | null;
    sido: string;
    sgg: string;
    umdNm: string;
    aptNm: string;
    excluUseAr: number;
    floor: number | null;
    dealAmount: number;
    dealDate: string;
    buildYear: number | null;
    dealingGbn: string | null;
    thumbnailUrl: string | null;
}

const DEAL_SELECT = `
    SELECT d.id, d.apt_id, s.sido_nm, s.sgg_nm, d.umd_nm, d.apt_nm,
           d.exclu_use_ar, d.floor, d.deal_amount, d.deal_date,
           d.build_year, d.dealing_gbn, a.thumbnail_url
      FROM apartment_deals d
      JOIN sgg_codes s ON s.sgg_cd = d.sgg_cd
      LEFT JOIN apartments a ON a.id = d.apt_id`;

interface RawDeal {
    id: number;
    apt_id: number | null;
    sido_nm: string;
    sgg_nm: string;
    umd_nm: string;
    apt_nm: string;
    exclu_use_ar: string;
    floor: number | null;
    deal_amount: number;
    deal_date: Date | string;
    build_year: number | null;
    dealing_gbn: string | null;
    thumbnail_url: string | null;
}

/**
 * mysql2 는 DATE 를 로컬 시간대 Date 로 준다.
 * 그대로 JSON 직렬화하면 toISOString() 이 UTC 로 바꿔 KST 기준 하루가 밀린다
 * (2004-05-07 → '2004-05-06T15:00:00.000Z'). 로컬 기준으로 직접 포맷한다.
 */
export function toDateString(v: Date | string | null): string | null {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) {
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, '0');
        const d = String(v.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return String(v).slice(0, 10);
}

function mapDeal(r: RawDeal): DealRow {
    const date = toDateString(r.deal_date) ?? '';

    return {
        id: r.id,
        aptId: r.apt_id,
        sido: toShortSido(r.sido_nm),
        sgg: r.sgg_nm,
        umdNm: r.umd_nm,
        aptNm: r.apt_nm,
        excluUseAr: Number(r.exclu_use_ar),
        floor: r.floor,
        dealAmount: r.deal_amount,
        dealDate: date,
        buildYear: r.build_year,
        dealingGbn: r.dealing_gbn,
        thumbnailUrl: r.thumbnail_url,
    };
}

/**
 * 메인 화면용 — 최신 거래 N건. sido(단축명) 로 지역 한정 가능.
 *
 * 지역을 지정하지 않으면 시도별로 1건씩 골라 섞는다.
 * 그냥 deal_date DESC, id DESC 로 뽑으면 마지막에 수집된 지역이 id 가 가장 커서
 * 전국 화면인데 한 지역이 8칸을 독차지한다(실제로 전부 전북이었다).
 */
export async function recentDeals(opts: { sido?: string; limit?: number }): Promise<DealRow[]> {
    const limit = Math.min(Math.max(opts.limit ?? 8, 1), 100);

    if (opts.sido) {
        const fulls = toFullSido(opts.sido);
        if (fulls.length === 0) return [];

        const rows = (await query(
            `${DEAL_SELECT}
              WHERE ${NOT_CANCELED}
                AND s.sido_nm IN (${fulls.map(() => '?').join(',')})
              ORDER BY d.deal_date DESC, d.id DESC
              LIMIT ${limit}`,
            fulls,
        )) as RawDeal[];
        return rows.map(mapDeal);
    }

    // 전국: 시도별 최신 1건씩 → 거래일 내림차순
    const rows = (await query(
        `SELECT t.* FROM (
           SELECT d.id, d.apt_id, s.sido_nm, s.sgg_nm, d.umd_nm, d.apt_nm,
                  d.exclu_use_ar, d.floor, d.deal_amount, d.deal_date,
                  d.build_year, d.dealing_gbn, a.thumbnail_url,
                  ROW_NUMBER() OVER (
                    PARTITION BY s.sido_nm ORDER BY d.deal_date DESC, d.id DESC
                  ) AS rn
             FROM apartment_deals d
             JOIN sgg_codes s ON s.sgg_cd = d.sgg_cd
             LEFT JOIN apartments a ON a.id = d.apt_id
            WHERE ${NOT_CANCELED}
              AND d.deal_date >= (SELECT MAX(deal_date) FROM apartment_deals) - INTERVAL 14 DAY
         ) t
          WHERE t.rn = 1
          ORDER BY t.deal_date DESC, t.id DESC
          LIMIT ${limit}`,
    )) as RawDeal[];

    return rows.map(mapDeal);
}

export interface DealListResult {
    items: DealRow[];
    total: number;
    page: number;
    size: number;
}

/** 실거래 목록 조회 (시군구 / 거래년월 / 단지명 필터 + 페이징). */
export async function listDeals(opts: {
    sggCd?: string;
    dealYmd?: string; // YYYYMM
    aptNm?: string;
    aptId?: number;
    /** 전용면적 ㎡. 단지 상세에서 '84.70㎡' 같은 면적 하나만 보려고 쓴다 */
    area?: number;
    page?: number;
    size?: number;
}): Promise<DealListResult> {
    const page = Math.max(opts.page ?? 1, 1);
    const size = Math.min(Math.max(opts.size ?? 50, 1), 500);
    const offset = (page - 1) * size;

    const params: unknown[] = [];
    let where = `WHERE ${NOT_CANCELED}`;

    if (opts.sggCd) {
        where += ' AND d.sgg_cd = ?';
        params.push(Number(opts.sggCd));
    }
    if (opts.dealYmd) {
        where += ' AND d.deal_year = ? AND d.deal_month = ?';
        params.push(Number(opts.dealYmd.slice(0, 4)), Number(opts.dealYmd.slice(4, 6)));
    }
    if (opts.aptNm) {
        where += ' AND d.apt_nm LIKE ?';
        params.push(`%${opts.aptNm}%`);
    }
    if (opts.aptId) {
        where += ' AND d.apt_id = ?';
        params.push(opts.aptId);
    }
    if (opts.area != null) {
        // exclu_use_ar 은 DECIMAL(7,4) 라 84.7 과 84.7000 이 섞인다. 소수 둘째 자리로
        // 맞춰 비교한다 — 화면에 보여주는 값(84.70㎡)과 같은 기준이어야 한다.
        where += ' AND ROUND(d.exclu_use_ar, 2) = ?';
        params.push(Number(opts.area.toFixed(2)));
    }

    const countRows = (await query(
        `SELECT COUNT(*) AS cnt
           FROM apartment_deals d
           JOIN sgg_codes s ON s.sgg_cd = d.sgg_cd
          ${where}`,
        params,
    )) as Array<{ cnt: number }>;

    const rows = (await query(
        `${DEAL_SELECT} ${where}
          ORDER BY d.deal_date DESC, d.id DESC
          LIMIT ${size} OFFSET ${offset}`,
        params,
    )) as RawDeal[];

    return {
        items: rows.map(mapDeal),
        total: Number(countRows[0]?.cnt ?? 0),
        page,
        size,
    };
}

/** 시군구 코드 목록 (활성만). 프론트 셀렉트박스용. */
export async function sggCodes(): Promise<Array<{ code: string; sido: string; sgg: string }>> {
    const rows = (await query(
        `SELECT sgg_cd, sido_nm, sgg_nm
           FROM sgg_codes
          WHERE is_active = 1
          ORDER BY sgg_cd`,
    )) as Array<{ sgg_cd: number; sido_nm: string; sgg_nm: string }>;

    return rows.map((r) => ({
        code: String(r.sgg_cd),
        sido: toShortSido(r.sido_nm),
        sgg: r.sgg_nm,
    }));
}

/**
 * 면적별 전월세 요약. 전세가율은 같은 면적·같은 기간(최근 1년)끼리만 비교한다.
 * 단지 전체를 평균하면 작은 평수 전세와 큰 평수 매매가 섞여 터무니없는 값이 나온다
 * (실제로 10% 같은 숫자가 찍혔다).
 */
export interface RentAreaStat {
    area: number;
    jeonseCount: number;
    jeonseMin: number | null;
    jeonseMax: number | null;
    /** 최근 1년 평균 보증금 (만원). 1년 내 전세가 없으면 null */
    jeonseAvg1y: number | null;
    wolseCount: number;
    /** 월세 계약의 평균 보증금·월세 (만원) */
    wolseDepositAvg: number | null;
    wolseRentAvg: number | null;
    /** 전세가율 % — 최근 1년 전세 평균 ÷ 최근 1년 매매 평균. 한쪽이라도 없으면 null */
    jeonseRatio: number | null;
}

export interface AptDetail {
    id: number;
    aptNm: string;
    propertyType: PropertyType;
    sido: string;
    sgg: string;
    umdNm: string;
    jibun: string | null;
    buildYear: number | null;
    thumbnailUrl: string | null;
    excluAreas: number[];
    /** 면적별 요약 (거래건수·최저·최고). 해제 거래는 뺀 수치 */
    areaStats: AreaStat[];
    /** 면적별 전월세 요약. 전월세가 아직 없는 단지는 빈 배열 */
    rentStats: RentAreaStat[];
    /** 어드민이 직접 쓴 검색 제목·설명. 비어 있으면 화면에서 자동 생성한다 */
    seoTitle: string | null;
    seoDescription: string | null;
    matchStatus: number;
    /** WGS84. 지오코딩 전이면 null */
    lat: number | null;
    lng: number | null;
    /** 아래는 K-apt 매칭이 된 단지만 채워진다 (미매칭이면 전부 null) */
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
        /* 교통·학군·편의 — K-apt 상세. 단지마다 채움률이 달라 없을 수 있다. */
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

/** 단지 상세 — apartments + K-apt 매칭 정보 JOIN. 없으면 null. */
export interface AreaStat {
    /** 전용면적 ㎡, 소수 2자리. 거래 이력 필터(area)와 같은 기준 */
    area: number;
    dealCount: number;
    minAmount: number;   // 만원
    maxAmount: number;   // 만원
}

export async function aptDetail(aptId: number): Promise<AptDetail | null> {
    const rows = (await query(
        `SELECT a.id, a.apt_nm, a.property_type, a.umd_nm, a.jibun, a.build_year,
                a.thumbnail_url, a.exclu_areas, a.match_status, a.lat, a.lng,
                a.seo_title, a.seo_description,
                s.sido_nm, s.sgg_nm,
                k.kapt_name, k.total_households, k.dong_cnt, k.top_floor,
                k.use_apr_date, k.heat_type, k.hall_type, k.builder,
                k.parking_total, k.addr_road, k.addr_jibun,
                k.subway_line, k.subway_station, k.subway_walk, k.bus_walk,
                k.education_facility, k.convenient_facility, k.welfare_facility,
                k.elevator_cnt, k.ev_charger_cnt
           FROM apartments a
           JOIN sgg_codes s ON s.sgg_cd = a.sgg_cd
           LEFT JOIN kapt_complexes k ON k.kapt_code = a.kapt_code
          WHERE a.id = ?`,
        [aptId],
    )) as Array<Record<string, any>>;

    const r = rows[0];
    if (!r) return null;

    // exclu_areas 는 JSON 컬럼. 드라이버 설정에 따라 문자열로 올 수 있어 방어한다.
    let areas: number[] = [];
    const raw = r.exclu_areas;
    if (Array.isArray(raw)) {
        areas = raw.map(Number).filter((n: number) => Number.isFinite(n));
    } else if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) areas = parsed.map(Number).filter(Number.isFinite);
        } catch {
            areas = [];
        }
    }
    areas.sort((a, b) => a - b);

    // 면적별 최저·최고. 화면의 면적 칩과 같은 기준(소수 2자리)으로 묶는다.
    const statRows = (await query(
        `SELECT ROUND(d.exclu_use_ar, 2) AS area,
                COUNT(*)            AS deal_count,
                MIN(d.deal_amount)  AS min_amount,
                MAX(d.deal_amount)  AS max_amount,
                AVG(IF(d.deal_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR),
                       d.deal_amount, NULL)) AS avg_1y
           FROM apartment_deals d
          WHERE d.apt_id = ? AND ${NOT_CANCELED}
          GROUP BY area
          ORDER BY area`,
        [aptId],
    )) as Array<Record<string, any>>;

    const areaStats: AreaStat[] = statRows.map((x) => ({
        area: Number(x.area),
        dealCount: Number(x.deal_count),
        minAmount: Number(x.min_amount),
        maxAmount: Number(x.max_amount),
    }));

    // 전세가율을 같은 면적끼리 맞추려고 매매 쪽 최근 1년 평균을 면적별로 들고 간다
    const saleAvg1y = new Map<number, number>();
    for (const x of statRows) {
        if (x.avg_1y !== null && x.avg_1y !== undefined) {
            saleAvg1y.set(Number(x.area), Number(x.avg_1y));
        }
    }

    const rentRows = (await query(
        `SELECT ROUND(r.exclu_use_ar, 2) AS area,
                SUM(r.rent_type = 'J')                                      AS j_cnt,
                MIN(IF(r.rent_type = 'J', r.deposit, NULL))                 AS j_min,
                MAX(IF(r.rent_type = 'J', r.deposit, NULL))                 AS j_max,
                AVG(IF(r.rent_type = 'J'
                       AND r.deal_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR),
                       r.deposit, NULL))                                    AS j_avg_1y,
                SUM(r.rent_type = 'M')                                      AS m_cnt,
                AVG(IF(r.rent_type = 'M', r.deposit, NULL))                 AS m_dep,
                AVG(IF(r.rent_type = 'M', r.monthly_rent, NULL))            AS m_rent
           FROM property_rents r
          WHERE r.apt_id = ?
          GROUP BY area
          ORDER BY area`,
        [aptId],
    )) as Array<Record<string, any>>;

    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const rentStats: RentAreaStat[] = rentRows.map((x) => {
        const area = Number(x.area);
        const jAvg = num(x.j_avg_1y);
        const sale = saleAvg1y.get(area);
        return {
            area,
            jeonseCount: Number(x.j_cnt ?? 0),
            jeonseMin: num(x.j_min),
            jeonseMax: num(x.j_max),
            jeonseAvg1y: jAvg === null ? null : Math.round(jAvg),
            wolseCount: Number(x.m_cnt ?? 0),
            wolseDepositAvg: x.m_dep === null ? null : Math.round(Number(x.m_dep)),
            wolseRentAvg: x.m_rent === null ? null : Math.round(Number(x.m_rent)),
            jeonseRatio:
                jAvg !== null && sale !== undefined && sale > 0
                    ? Math.round((jAvg / sale) * 1000) / 10
                    : null,
        };
    });

    return {
        id: r.id,
        aptNm: r.apt_nm,
        propertyType: (r.property_type ?? 'APT') as PropertyType,
        sido: toShortSido(r.sido_nm),
        sgg: r.sgg_nm,
        umdNm: r.umd_nm,
        jibun: r.jibun ?? null,
        buildYear: r.build_year ?? null,
        thumbnailUrl: r.thumbnail_url ?? null,
        excluAreas: areas,
        areaStats,
        rentStats,
        seoTitle: r.seo_title ?? null,
        seoDescription: r.seo_description ?? null,
        matchStatus: r.match_status,
        // DECIMAL 은 드라이버가 문자열로 준다
        lat: r.lat === null || r.lat === undefined ? null : Number(r.lat),
        lng: r.lng === null || r.lng === undefined ? null : Number(r.lng),
        kapt: r.kapt_name
            ? {
                  name: r.kapt_name,
                  totalHouseholds: r.total_households ?? null,
                  dongCnt: r.dong_cnt ?? null,
                  topFloor: r.top_floor ?? null,
                  useAprDate: toDateString(r.use_apr_date ?? null),
                  heatType: r.heat_type ?? null,
                  hallType: r.hall_type ?? null,
                  builder: r.builder ?? null,
                  parkingTotal: r.parking_total ?? null,
                  addrRoad: r.addr_road ?? null,
                  addrJibun: r.addr_jibun ?? null,
                  subwayLine: r.subway_line ?? null,
                  subwayStation: r.subway_station ?? null,
                  subwayWalk: r.subway_walk ?? null,
                  busWalk: r.bus_walk ?? null,
                  educationFacility: r.education_facility ?? null,
                  convenientFacility: r.convenient_facility ?? null,
                  welfareFacility: r.welfare_facility ?? null,
                  elevatorCnt: r.elevator_cnt ?? null,
                  evChargerCnt: r.ev_charger_cnt ?? null,
              }
            : null,
    };
}

export interface TrendPoint {
    ym: string;                    // 'YYYYMM'
    trades: number;                // 그 달 거래 건수 (0 이면 거래 없음)
    unitPrice: number | null;      // ㎡당 평균 단가 (만원). 거래 없으면 null
    avgPrice: number | null;       // 평균 거래금액 (만원). 거래 없으면 null
}

/** ym 에서 n개월 전까지의 'YYYYMM' 목록 (오름차순). */
function monthRange(end: YearMonth, count: number): string[] {
    const out: string[] = [];
    let { year, month } = end;
    for (let i = 0; i < count; i++) {
        out.push(`${year}${String(month).padStart(2, '0')}`);
        month -= 1;
        if (month === 0) {
            year -= 1;
            month = 12;
        }
    }
    return out.reverse();
}

/**
 * 월별 시세 추이.
 *
 * 값은 '㎡당 평균 단가' 다. 평균 거래금액은 그 달에 큰 평형이 많이 거래되면
 * 같이 오르기 때문에 시세 추이로 읽으면 오해를 부른다.
 *
 * 거래가 없던 달도 trades:0 / unitPrice:null 로 채워서 돌려준다.
 * 프론트가 선을 끊어 그릴 수 있어야 없는 구간을 직선으로 이어 속이지 않는다.
 */
export async function priceTrend(opts: {
    sido?: string;
    sggCd?: string;
    aptId?: number;
    months?: number;
}): Promise<{ baseMonth: string | null; items: TrendPoint[] }> {
    const latest = await latestDealMonth();
    if (!latest) return { baseMonth: null, items: [] };

    const months = Math.min(Math.max(opts.months ?? 12, 2), 60);
    const wanted = monthRange(latest, months);
    const oldest = wanted[0];

    const params: unknown[] = [];
    let where = `WHERE ${NOT_CANCELED}
          AND (d.deal_year * 100 + d.deal_month) >= ?`;
    params.push(Number(oldest));

    if (opts.aptId) {
        where += ' AND d.apt_id = ?';
        params.push(opts.aptId);
    }
    if (opts.sggCd) {
        where += ' AND d.sgg_cd = ?';
        params.push(Number(opts.sggCd));
    }
    if (opts.sido) {
        const fulls = toFullSido(opts.sido);
        if (fulls.length === 0) return { baseMonth: null, items: [] };
        where += ` AND s.sido_nm IN (${fulls.map(() => '?').join(',')})`;
        params.push(...fulls);
    }

    const rows = (await query(
        `SELECT d.deal_year AS y, d.deal_month AS m,
                COUNT(*) AS trades,
                AVG(d.deal_amount / d.exclu_use_ar) AS unit_price,
                AVG(d.deal_amount) AS avg_price
           FROM apartment_deals d
           JOIN sgg_codes s ON s.sgg_cd = d.sgg_cd
           ${where}
          GROUP BY d.deal_year, d.deal_month`,
        params,
    )) as Array<{
        y: number;
        m: number;
        trades: number;
        unit_price: string | null;
        avg_price: string | null;
    }>;

    const byYm = new Map(
        rows.map((r) => [`${r.y}${String(r.m).padStart(2, '0')}`, r]),
    );

    const items: TrendPoint[] = wanted.map((ym) => {
        const r = byYm.get(ym);
        if (!r || Number(r.trades) === 0) {
            return { ym, trades: 0, unitPrice: null, avgPrice: null };
        }
        return {
            ym,
            trades: Number(r.trades),
            unitPrice: Math.round(Number(r.unit_price ?? 0)),
            avgPrice: Math.round(Number(r.avg_price ?? 0)),
        };
    });

    const baseMonth = `${latest.year}${String(latest.month).padStart(2, '0')}`;
    return { baseMonth, items };
}

/**
 * 사이트맵용 단지 id 목록.
 *
 * 거래가 한 건도 없는 단지는 상세 페이지에 보여줄 내용이 없으므로 제외한다.
 * (빈 페이지를 대량으로 색인시키면 사이트 전체 평가에 해롭다.)
 */
export async function aptSitemapEntries(
    limit = 10000,
    offset = 0,
): Promise<{ items: Array<{ id: number; lastModified: string | null }>; total: number }> {
    const n = Math.min(Math.max(limit, 1), 50000);
    const off = Math.max(offset, 0);

    // 사이트맵은 페이지를 나눠 내보낸다(파일당 5만 URL 상한). 순서가 호출마다
    // 흔들리면 어떤 단지는 어느 파일에도 안 들어가므로 id 로 고정 정렬한다.
    const rows = (await query(
        `SELECT a.id, MAX(d.deal_date) AS last_deal
           FROM apartments a
           JOIN apartment_deals d ON d.apt_id = a.id
          WHERE ${NOT_CANCELED}
          GROUP BY a.id
          ORDER BY a.id
          LIMIT ${n} OFFSET ${off}`,
    )) as Array<{ id: number; last_deal: Date | string | null }>;

    const cnt = (await query(
        `SELECT COUNT(*) AS cnt FROM (
            SELECT a.id FROM apartments a
              JOIN apartment_deals d ON d.apt_id = a.id
             WHERE ${NOT_CANCELED}
             GROUP BY a.id) t`,
    )) as Array<{ cnt: number }>;

    return {
        items: rows.map((r) => ({ id: r.id, lastModified: toDateString(r.last_deal) })),
        total: Number(cnt[0]?.cnt ?? 0),
    };
}

/** 사이트맵용 분양 공고 목록. 숨긴 공고는 뺀다 — 화면에 없는 URL 을 제출하면 안 된다. */
export async function presaleSitemapEntries(
    limit = 10000,
    offset = 0,
): Promise<{ items: Array<{ id: string; lastModified: string | null }>; total: number }> {
    const n = Math.min(Math.max(limit, 1), 50000);
    const off = Math.max(offset, 0);

    const rows = (await query(
        `SELECT id, notice_date, updated_at
           FROM presale_notices
          WHERE is_hidden = 0
          ORDER BY id
          LIMIT ${n} OFFSET ${off}`,
    )) as Array<Record<string, any>>;

    const cnt = (await query(
        'SELECT COUNT(*) AS cnt FROM presale_notices WHERE is_hidden = 0',
    )) as Array<{ cnt: number }>;

    return {
        items: rows.map((r) => ({
            id: String(r.id),
            lastModified: toDateString(r.updated_at ?? r.notice_date),
        })),
        total: Number(cnt[0]?.cnt ?? 0),
    };
}

/** 시군구 단위 요약 — 시도를 고른 뒤 '어느 구로 갈지' 고르는 화면용. */
export async function sggBreakdown(sido: string): Promise<
    Array<{ code: string; sgg: string; apts: number; deals: number; unitPrice: number | null }>
> {
    const fulls = toFullSido(sido);
    if (fulls.length === 0) return [];

    const rows = (await query(
        `SELECT s.sgg_cd, s.sgg_nm,
                COUNT(DISTINCT d.apt_id) AS apts,
                COUNT(*)                 AS deals,
                AVG(d.deal_amount / d.exclu_use_ar) AS unit_price
           FROM apartment_deals d
           JOIN sgg_codes s ON s.sgg_cd = d.sgg_cd
          WHERE ${NOT_CANCELED}
            AND s.sido_nm IN (${fulls.map(() => '?').join(',')})
          GROUP BY s.sgg_cd, s.sgg_nm
          ORDER BY deals DESC`,
        fulls,
    )) as Array<{
        sgg_cd: number;
        sgg_nm: string;
        apts: number;
        deals: number;
        unit_price: string | null;
    }>;

    return rows.map((r) => ({
        code: String(r.sgg_cd),
        sgg: r.sgg_nm,
        apts: Number(r.apts),
        deals: Number(r.deals),
        unitPrice: r.unit_price === null ? null : Math.round(Number(r.unit_price)),
    }));
}

export type PropertyType = 'APT' | 'OFFI';

/** 화면·제목에 쓰는 이름. DB 에는 코드로 들어간다. */
export const PROPERTY_LABEL: Record<PropertyType, string> = {
    APT: '아파트',
    OFFI: '오피스텔',
};

/**
 * 사용자 입력 → 유형 코드. 모르는 값이면 null(=유형 안 가림).
 * 사용자 입력을 SQL 에 직접 붙이지 않기 위한 화이트리스트다.
 */
export function toPropertyType(v: unknown): PropertyType | null {
    const s = String(v ?? '').trim().toUpperCase();
    return s === 'APT' || s === 'OFFI' ? s : null;
}

export type AptSort = 'deals' | 'price_desc' | 'price_asc' | 'name' | 'households' | 'recent';

/** 정렬 키 → ORDER BY. 사용자 입력을 SQL 에 직접 붙이지 않기 위한 화이트리스트. */
const APT_ORDER: Record<AptSort, string> = {
    deals: 'deal_count DESC, a.apt_nm',
    // 금액 정렬은 ㎡당 단가로 한다. 거래금액 자체로 줄세우면 큰 평형이 많은
    // 단지가 무조건 위로 올라와 '비싼 동네'가 아니라 '큰 집'을 보여주게 된다.
    price_desc: 'unit_price DESC, a.apt_nm',
    price_asc: 'unit_price ASC, a.apt_nm',
    name: 'a.apt_nm ASC',
    households: 'households DESC, a.apt_nm',
    recent: 'last_deal DESC, a.apt_nm',
};

export interface AptListRow {
    id: number;
    aptNm: string;
    propertyType: PropertyType;
    /** WGS84. 지오코딩 전이면 null — 지도에서 그 단지만 빠진다 */
    lat: number | null;
    lng: number | null;
    sido: string;
    sgg: string;
    umdNm: string;
    buildYear: number | null;
    households: number | null;
    dealCount: number;
    unitPrice: number | null;   // ㎡당 평균 단가 (만원)
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

/** 지역별 단지 목록. 시군구(sggCd) 또는 시도(sido) 로 범위를 잡는다. */
export async function listApts(opts: {
    sggCd?: string;
    sido?: string;
    q?: string;
    type?: string;
    sort?: AptSort;
    page?: number;
    size?: number;
}): Promise<AptListResult> {
    const page = Math.max(opts.page ?? 1, 1);
    const size = Math.min(Math.max(opts.size ?? 30, 1), 100);
    const offset = (page - 1) * size;
    const order = APT_ORDER[opts.sort ?? 'deals'] ?? APT_ORDER.deals;

    const params: unknown[] = [];
    let where = `WHERE ${NOT_CANCELED}`;

    if (opts.sggCd) {
        where += ' AND a.sgg_cd = ?';
        params.push(Number(opts.sggCd));
    } else if (opts.sido) {
        const fulls = toFullSido(opts.sido);
        if (fulls.length === 0) return { items: [], total: 0, page, size };
        where += ` AND s.sido_nm IN (${fulls.map(() => '?').join(',')})`;
        params.push(...fulls);
    }
    if (opts.q) {
        where += ' AND a.apt_nm LIKE ?';
        params.push(`%${opts.q}%`);
    }
    const listType = toPropertyType(opts.type);
    if (listType) {
        where += ' AND a.property_type = ?';
        params.push(listType);
    }

    const base = `
        FROM apartments a
        JOIN sgg_codes s ON s.sgg_cd = a.sgg_cd
        JOIN apartment_deals d ON d.apt_id = a.id
        LEFT JOIN kapt_complexes k ON k.kapt_code = a.kapt_code
        ${where}`;

    const countRows = (await query(
        `SELECT COUNT(*) AS cnt FROM (SELECT a.id ${base} GROUP BY a.id) t`,
        params,
    )) as Array<{ cnt: number }>;

    const rows = (await query(
        `SELECT a.id, a.apt_nm, a.property_type, a.umd_nm, a.build_year, s.sido_nm, s.sgg_nm,
                a.lat, a.lng,
                k.total_households AS households,
                COUNT(*)           AS deal_count,
                AVG(d.deal_amount / d.exclu_use_ar) AS unit_price,
                MAX(d.deal_date)   AS last_deal
         ${base}
         GROUP BY a.id
         ORDER BY ${order}
         LIMIT ${size} OFFSET ${offset}`,
        params,
    )) as Array<Record<string, any>>;

    // 최근 거래 1건은 페이지에 실린 단지에 대해서만 따로 가져온다.
    // 전체를 윈도우 함수로 훑으면 558,000 행을 매번 정렬하게 된다.
    const ids = rows.map((r) => r.id as number);
    const latest = new Map<number, { amount: number; area: number; date: string }>();

    if (ids.length > 0) {
        const lastRows = (await query(
            `SELECT t.apt_id, t.deal_amount, t.exclu_use_ar, t.deal_date
               FROM (
                 SELECT d.apt_id, d.deal_amount, d.exclu_use_ar, d.deal_date,
                        ROW_NUMBER() OVER (
                          PARTITION BY d.apt_id ORDER BY d.deal_date DESC, d.id DESC
                        ) AS rn
                   FROM apartment_deals d
                  WHERE d.apt_id IN (${ids.map(() => '?').join(',')})
                    AND ${NOT_CANCELED}
               ) t
              WHERE t.rn = 1`,
            ids,
        )) as Array<{
            apt_id: number;
            deal_amount: number;
            exclu_use_ar: string;
            deal_date: Date | string;
        }>;

        for (const r of lastRows) {
            latest.set(r.apt_id, {
                amount: r.deal_amount,
                area: Number(r.exclu_use_ar),
                date: toDateString(r.deal_date) ?? '',
            });
        }
    }

    return {
        items: rows.map((r) => {
            const last = latest.get(r.id);
            return {
                id: r.id,
                aptNm: r.apt_nm,
                propertyType: (r.property_type ?? 'APT') as PropertyType,
                // DECIMAL 은 mysql2 가 문자열로 주기도 해서 숫자로 맞춘다
                lat: r.lat === null || r.lat === undefined ? null : Number(r.lat),
                lng: r.lng === null || r.lng === undefined ? null : Number(r.lng),
                sido: toShortSido(r.sido_nm),
                sgg: r.sgg_nm,
                umdNm: r.umd_nm,
                buildYear: r.build_year ?? null,
                households: r.households ?? null,
                dealCount: Number(r.deal_count),
                unitPrice: r.unit_price === null ? null : Math.round(Number(r.unit_price)),
                lastDealDate: last?.date ?? null,
                lastDealAmount: last?.amount ?? null,
                lastDealArea: last?.area ?? null,
            };
        }),
        total: Number(countRows[0]?.cnt ?? 0),
        page,
        size,
    };
}


export interface RentRow {
    id: number;
    dealDate: string | null;
    /** 'J' 전세 / 'M' 월세 */
    rentType: 'J' | 'M';
    deposit: number;
    monthlyRent: number;
    excluUseAr: number;
    floor: number | null;
    /** 2021년 6월 임대차 신고제 이후 건에만 있다 */
    contractType: string | null;
    contractTerm: string | null;
    preDeposit: number | null;
    preMonthlyRent: number | null;
}

/** 단지의 전월세 이력. 면적(area)을 주면 그 면적만. 최신순. */
export async function listRents(opts: {
    aptId: number;
    area?: number;
    rentType?: string;
    limit?: number;
}): Promise<RentRow[]> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 300);
    const params: unknown[] = [opts.aptId];
    let where = 'WHERE r.apt_id = ?';

    if (opts.area !== undefined && Number.isFinite(opts.area)) {
        // 화면의 면적 칩과 같은 기준(소수 2자리)으로 묶는다
        where += ' AND ROUND(r.exclu_use_ar, 2) = ?';
        params.push(Number(opts.area.toFixed(2)));
    }
    const rt = String(opts.rentType ?? '').trim().toUpperCase();
    if (rt === 'J' || rt === 'M') {
        where += ' AND r.rent_type = ?';
        params.push(rt);
    }

    const rows = (await query(
        `SELECT r.id, r.deal_date, r.rent_type, r.deposit, r.monthly_rent,
                r.exclu_use_ar, r.floor, r.contract_type, r.contract_term,
                r.pre_deposit, r.pre_monthly_rent
           FROM property_rents r
           ${where}
          ORDER BY r.deal_date DESC, r.id DESC
          LIMIT ${limit}`,
        params,
    )) as Array<Record<string, any>>;

    return rows.map((r) => ({
        id: r.id,
        dealDate: toDateString(r.deal_date),
        rentType: r.rent_type === 'M' ? 'M' : 'J',
        deposit: Number(r.deposit),
        monthlyRent: Number(r.monthly_rent),
        excluUseAr: Number(r.exclu_use_ar),
        floor: r.floor ?? null,
        contractType: r.contract_type ?? null,
        contractTerm: r.contract_term ?? null,
        preDeposit: r.pre_deposit === null || r.pre_deposit === undefined ? null : Number(r.pre_deposit),
        preMonthlyRent:
            r.pre_monthly_rent === null || r.pre_monthly_rent === undefined
                ? null
                : Number(r.pre_monthly_rent),
    }));
}

export interface SiteSummary {
    totalDeals: number;
    totalApts: number;
    totalSgg: number;
    firstMonth: string | null;  // 'YYYYMM'
    lastMonth: string | null;
    /** 유형별 단지 수 (APT / OFFI) */
    aptsByType: Record<string, number>;
    /** 전월세 건수 (전세 + 월세) */
    totalRents: number;
}

/** 사이트 전체 수집 현황 — 메인에서 '이 사이트가 뭘 갖고 있는지' 보여주는 값. */
export async function siteSummary(): Promise<SiteSummary> {
    const rows = (await query(
        `SELECT COUNT(*) AS deals,
                COUNT(DISTINCT d.apt_id) AS apts,
                COUNT(DISTINCT d.sgg_cd) AS sgg,
                MIN(d.deal_date) AS first_date,
                MAX(d.deal_date) AS last_date
           FROM apartment_deals d
          WHERE ${'${NOT_CANCELED}'}`.replace('${NOT_CANCELED}', NOT_CANCELED),
    )) as Array<{
        deals: number;
        apts: number;
        sgg: number;
        first_date: Date | string | null;
        last_date: Date | string | null;
    }>;

    const r = rows[0];
    const ym = (v: Date | string | null) => {
        const d = toDateString(v);
        return d ? d.slice(0, 4) + d.slice(5, 7) : null;
    };

    // 유형별 단지 수 / 전월세 건수. 둘 다 작은 조회라 위 집계와 같이 돌려도 싸다.
    const typeRows = (await query(
        `SELECT property_type, COUNT(*) AS n FROM apartments GROUP BY property_type`,
    )) as Array<{ property_type: string; n: number }>;
    const aptsByType: Record<string, number> = {};
    for (const t of typeRows) aptsByType[t.property_type] = Number(t.n);

    const rentRows = (await query(
        `SELECT COUNT(*) AS n FROM property_rents`,
    )) as Array<{ n: number }>;

    return {
        totalDeals: Number(r?.deals ?? 0),
        totalApts: Number(r?.apts ?? 0),
        totalSgg: Number(r?.sgg ?? 0),
        firstMonth: ym(r?.first_date ?? null),
        lastMonth: ym(r?.last_date ?? null),
        aptsByType,
        totalRents: Number(rentRows[0]?.n ?? 0),
    };
}

/* ── 분양 공고 ─────────────────────────────────────────────────────────────
 * 아직 수집기가 없어 데이터는 0건이다. 화면과 API 가 먼저 서 있어야
 * 수집을 붙일 때 매핑만 하면 되고, 빈 상태도 미리 확인할 수 있다.
 */

/** 공고 진행 상태. 날짜로 파생하므로 DB 에 저장하지 않는다(매일 바뀐다). */
export type PresaleStatus = 'upcoming' | 'open' | 'closed' | 'unknown';

export interface PresaleRow {
    houseManageNo: string;
    pblancNo: string;
    /** 목록·상세 URL 에 쓰는 번호 (/presale/125). 청약홈 키와 별개다 */
    id: number;
    houseNm: string;
    houseType: string | null;      // APT / 오피스텔 ...
    rentType: string | null;       // 분양주택 / 임대주택
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
    /** 최저~최고 분양가 (만원). 주택형이 없으면 null */
    minAmount: number | null;
    maxAmount: number | null;
}

interface RawPresale {
    id: number;
    house_manage_no: string;
    pblanc_no: string;
    house_nm: string;
    house_secd_nm: string | null;
    rent_secd_nm: string | null;
    sido_nm: string | null;
    sgg_nm: string | null;
    sgg_cd: number | null;
    addr: string | null;
    total_households: number | null;
    notice_date: Date | string | null;
    rcept_bgnde: Date | string | null;
    rcept_endde: Date | string | null;
    winner_date: Date | string | null;
    movein_ym: string | null;
    developer: string | null;
    builder: string | null;
    is_featured: number;
    min_amount: number | null;
    max_amount: number | null;
}

/** 오늘 기준 접수 상태. 날짜가 없으면 판단하지 않는다(추측하지 않는다). */
function presaleStatus(bgn: string | null, end: string | null): PresaleStatus {
    if (!bgn && !end) return 'unknown';
    const today = toDateString(new Date()) as string;
    if (bgn && today < bgn) return 'upcoming';
    if (end && today > end) return 'closed';
    return 'open';
}

function mapPresale(r: RawPresale): PresaleRow {
    const rceptBgnde = toDateString(r.rcept_bgnde);
    const rceptEndde = toDateString(r.rcept_endde);

    return {
        houseManageNo: r.house_manage_no,
        pblancNo: r.pblanc_no,
        // 주소에 쓰는 번호. 청약홈 키(house_manage_no/pblanc_no)는 위 필드로 그대로 나간다.
        id: Number(r.id),
        houseNm: r.house_nm,
        houseType: r.house_secd_nm,
        rentType: r.rent_secd_nm,
        sido: r.sido_nm,
        sgg: r.sgg_nm,
        sggCd: r.sgg_cd,
        addr: r.addr,
        totalHouseholds: r.total_households,
        noticeDate: toDateString(r.notice_date),
        rceptBgnde,
        rceptEndde,
        winnerDate: toDateString(r.winner_date),
        moveinYm: r.movein_ym,
        developer: r.developer,
        builder: r.builder,
        status: presaleStatus(rceptBgnde, rceptEndde),
        isFeatured: Boolean(r.is_featured),
        minAmount: r.min_amount === null ? null : Number(r.min_amount),
        maxAmount: r.max_amount === null ? null : Number(r.max_amount),
    };
}

const PRESALE_SELECT = `
    SELECT n.id, n.house_manage_no, n.pblanc_no, n.house_nm, n.house_secd_nm,
           n.rent_secd_nm, n.sido_nm, n.sgg_nm, n.sgg_cd, n.addr,
           n.total_households, n.notice_date, n.rcept_bgnde, n.rcept_endde,
           n.winner_date, n.movein_ym, n.developer, n.builder, n.is_featured,
           MIN(t.top_amount) AS min_amount,
           MAX(t.top_amount) AS max_amount
      FROM presale_notices n
      LEFT JOIN presale_types t
        ON t.house_manage_no = n.house_manage_no AND t.pblanc_no = n.pblanc_no`;

export interface PresaleListResult {
    items: PresaleRow[];
    total: number;
    page: number;
    size: number;
}

/**
 * 분양 공고 목록.
 *
 * status 는 날짜 파생이라 SQL 에서 직접 거른다(저장 컬럼이 없다).
 * 정렬은 노출 제어(is_featured, sort_weight)를 먼저 보고 그다음 일정 순이다 —
 * 광고 상품이 붙는 자리라 수집 순서가 노출 순서를 결정하면 안 된다.
 */
export async function listPresales(opts: {
    sido?: string;
    sggCd?: string;
    status?: PresaleStatus;
    houseType?: string;
    q?: string;
    /** 'notice' 는 공고일 최신순. RSS 처럼 '새로 올라온 순' 이 필요한 곳에서 쓴다 */
    sort?: 'default' | 'notice';
    page?: number;
    size?: number;
}): Promise<PresaleListResult> {
    const page = Math.max(opts.page ?? 1, 1);
    const size = Math.min(Math.max(opts.size ?? 20, 1), 100);
    const offset = (page - 1) * size;

    const params: unknown[] = [];
    let where = 'WHERE n.is_hidden = 0';

    if (opts.sido) {
        const fulls = toFullSido(opts.sido);
        if (fulls.length > 0) {
            where += ` AND n.sido_nm IN (${fulls.map(() => '?').join(',')})`;
            params.push(...fulls);
        } else {
            where += ' AND n.sido_nm = ?';
            params.push(opts.sido);
        }
    }
    if (opts.sggCd) {
        where += ' AND n.sgg_cd = ?';
        params.push(Number(opts.sggCd));
    }
    if (opts.houseType) {
        where += ' AND n.house_secd_nm = ?';
        params.push(opts.houseType);
    }
    if (opts.q) {
        where += ' AND n.house_nm LIKE ?';
        params.push(`%${opts.q}%`);
    }
    if (opts.status === 'open') {
        where += ' AND n.rcept_bgnde <= CURDATE() AND n.rcept_endde >= CURDATE()';
    } else if (opts.status === 'upcoming') {
        where += ' AND n.rcept_bgnde > CURDATE()';
    } else if (opts.status === 'closed') {
        where += ' AND n.rcept_endde < CURDATE()';
    }

    const countRows = (await query(
        `SELECT COUNT(*) AS cnt FROM presale_notices n ${where}`,
        params,
    )) as Array<{ cnt: number }>;

    const rows = (await query(
        `${PRESALE_SELECT}
         ${where}
         GROUP BY n.id
         -- 광고 자리(is_featured·sort_weight)가 먼저, 그다음은 사용자가 지금 볼 순서:
         -- 접수중(마감 임박 순) → 접수예정(곧 시작 순) → 마감(최근 순).
         -- 시작일 내림차순으로 두면 '지금 청약 가능한 분양' 에 먼 미래 공고가 먼저 뜬다.
         ORDER BY ${opts.sort === 'notice' ? 'n.notice_date DESC, n.house_manage_no DESC' : `
                  n.is_featured DESC, n.sort_weight DESC,
                  CASE WHEN n.rcept_bgnde <= CURDATE() AND n.rcept_endde >= CURDATE() THEN 0
                       WHEN n.rcept_bgnde > CURDATE() THEN 1
                       WHEN n.rcept_endde < CURDATE() THEN 2
                       ELSE 3 END,
                  CASE WHEN n.rcept_bgnde <= CURDATE() AND n.rcept_endde >= CURDATE()
                       THEN n.rcept_endde END ASC,
                  CASE WHEN n.rcept_bgnde > CURDATE() THEN n.rcept_bgnde END ASC,
                  n.rcept_endde DESC, n.notice_date DESC`}
         LIMIT ${size} OFFSET ${offset}`,
        params,
    )) as RawPresale[];

    return {
        items: rows.map(mapPresale),
        total: Number(countRows[0]?.cnt ?? 0),
        page,
        size,
    };
}

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
    /** 어드민이 직접 쓴 검색 제목·설명. 비어 있으면 화면에서 자동 생성한다 */
    seoTitle: string | null;
    seoDescription: string | null;
    /** 관리자가 구성한 랜딩 블록. 비어 있으면 기본 화면만 나온다 */
    landing: LandingBlock[];
    types: PresaleTypeRow[];
}

/** 분양 공고 상세. id 는 '주택관리번호-공고번호'. */
/**
 * 분양 공고 상세.
 *
 * id 는 우리 번호(/presale/125)다. 예전 주소가 '주택관리번호-공고번호' 형태였으므로
 * 그것도 받아 준다 — 어딘가 남아 있는 링크가 죽지 않게. 화면에서는 새 주소로 넘긴다.
 */
export async function presaleDetail(id: string): Promise<PresaleDetail | null> {
    const numeric = /^\d+$/.test(id);
    let where: string;
    let params: unknown[];

    if (numeric) {
        where = 'WHERE n.id = ? AND n.is_hidden = 0';
        params = [Number(id)];
    } else {
        const sep = id.lastIndexOf('-');
        if (sep <= 0) return null;
        where = 'WHERE n.house_manage_no = ? AND n.pblanc_no = ? AND n.is_hidden = 0';
        params = [id.slice(0, sep), id.slice(sep + 1)];
    }

    const rows = (await query(
        `${PRESALE_SELECT}
          ${where}
          GROUP BY n.id`,
        params,
    )) as RawPresale[];

    if (rows.length === 0) return null;

    const extraRows = (await query(
        `SELECT subscrpt_area_nm, spsply_bgnde, spsply_endde, contract_bgnde,
                contract_endde, tel, homepage, pblanc_url, speclt_rdn_earth_at,
                mdat_trget_area_at, parcprc_uls_at, lat, lng, seo_title, seo_description,
                landing
           FROM presale_notices
          WHERE house_manage_no = ? AND pblanc_no = ?`,
        [rows[0].house_manage_no, rows[0].pblanc_no],
    )) as Array<Record<string, any>>;
    const e = extraRows[0] ?? {};

    const typeRows = (await query(
        `SELECT model_no, house_ty, exclu_ar, supply_ar,
                general_hshldco, special_hshldco, top_amount
           FROM presale_types
          WHERE house_manage_no = ? AND pblanc_no = ?
          ORDER BY exclu_ar, model_no`,
        [rows[0].house_manage_no, rows[0].pblanc_no],
    )) as Array<Record<string, any>>;

    return {
        ...mapPresale(rows[0]),
        subscrptAreaNm: e.subscrpt_area_nm ?? null,
        spsplyBgnde: toDateString(e.spsply_bgnde ?? null),
        spsplyEndde: toDateString(e.spsply_endde ?? null),
        contractBgnde: toDateString(e.contract_bgnde ?? null),
        contractEndde: toDateString(e.contract_endde ?? null),
        tel: e.tel ?? null,
        homepage: e.homepage ?? null,
        pblancUrl: e.pblanc_url ?? null,
        specltRdnEarthAt: e.speclt_rdn_earth_at ?? null,
        mdatTrgetAreaAt: e.mdat_trget_area_at ?? null,
        parcprcUlsAt: e.parcprc_uls_at ?? null,
        lat: e.lat == null ? null : Number(e.lat),
        lng: e.lng == null ? null : Number(e.lng),
        seoTitle: e.seo_title ?? null,
        seoDescription: e.seo_description ?? null,
        landing: parseLanding(e.landing),
        types: typeRows.map((t) => ({
            modelNo: t.model_no,
            houseTy: t.house_ty ?? null,
            excluAr: t.exclu_ar == null ? null : Number(t.exclu_ar),
            supplyAr: t.supply_ar == null ? null : Number(t.supply_ar),
            generalHshldco: t.general_hshldco ?? null,
            specialHshldco: t.special_hshldco ?? null,
            topAmount: t.top_amount ?? null,
        })),
    };
}

/** 분양 화면 상단 요약 — 접수중/예정 건수. 데이터가 0건이어도 동작한다. */
export async function presaleSummary(): Promise<{
    open: number;
    upcoming: number;
    total: number;
}> {
    const rows = (await query(
        `SELECT
           SUM(rcept_bgnde <= CURDATE() AND rcept_endde >= CURDATE()) AS open_cnt,
           SUM(rcept_bgnde > CURDATE())                               AS upcoming_cnt,
           COUNT(*)                                                   AS total_cnt
         FROM presale_notices
        WHERE is_hidden = 0`,
    )) as Array<{ open_cnt: number | null; upcoming_cnt: number | null; total_cnt: number }>;

    const r = rows[0];
    return {
        open: Number(r?.open_cnt ?? 0),
        upcoming: Number(r?.upcoming_cnt ?? 0),
        total: Number(r?.total_cnt ?? 0),
    };
}
