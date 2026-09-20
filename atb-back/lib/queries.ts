// 실거래 DB 조회 (읽기 전용).
// 수집/가공은 atb-program(Python)이 담당하므로 여기서는 SELECT 만 한다.
import { query } from './db';
import { toShortSido, toFullSido } from './sido';

/** 해제(취소)된 거래 제외 조건. API 가 '' 로 주는 경우가 있어 둘 다 본다. */
const NOT_CANCELED = `(d.cdeal_day IS NULL OR d.cdeal_day = '')`;

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
function toDateString(v: Date | string | null): string | null {
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
    } | null;
}

/** 단지 상세 — apartments + K-apt 매칭 정보 JOIN. 없으면 null. */
export async function aptDetail(aptId: number): Promise<AptDetail | null> {
    const rows = (await query(
        `SELECT a.id, a.apt_nm, a.umd_nm, a.jibun, a.build_year,
                a.thumbnail_url, a.exclu_areas, a.match_status, a.lat, a.lng,
                s.sido_nm, s.sgg_nm,
                k.kapt_name, k.total_households, k.dong_cnt, k.top_floor,
                k.use_apr_date, k.heat_type, k.hall_type, k.builder,
                k.parking_total, k.addr_road, k.addr_jibun
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

    return {
        id: r.id,
        aptNm: r.apt_nm,
        sido: toShortSido(r.sido_nm),
        sgg: r.sgg_nm,
        umdNm: r.umd_nm,
        jibun: r.jibun ?? null,
        buildYear: r.build_year ?? null,
        thumbnailUrl: r.thumbnail_url ?? null,
        excluAreas: areas,
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
export async function aptSitemapEntries(limit = 50000): Promise<
    Array<{ id: number; lastModified: string | null }>
> {
    const n = Math.min(Math.max(limit, 1), 50000);
    const rows = (await query(
        `SELECT a.id, MAX(d.deal_date) AS last_deal
           FROM apartments a
           JOIN apartment_deals d ON d.apt_id = a.id
          WHERE ${NOT_CANCELED}
          GROUP BY a.id
          ORDER BY COUNT(*) DESC, a.id
          LIMIT ${n}`,
    )) as Array<{ id: number; last_deal: Date | string | null }>;

    return rows.map((r) => ({ id: r.id, lastModified: toDateString(r.last_deal) }));
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
        `SELECT a.id, a.apt_nm, a.umd_nm, a.build_year, s.sido_nm, s.sgg_nm,
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


export interface SiteSummary {
    totalDeals: number;
    totalApts: number;
    totalSgg: number;
    firstMonth: string | null;  // 'YYYYMM'
    lastMonth: string | null;
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

    return {
        totalDeals: Number(r?.deals ?? 0),
        totalApts: Number(r?.apts ?? 0),
        totalSgg: Number(r?.sgg ?? 0),
        firstMonth: ym(r?.first_date ?? null),
        lastMonth: ym(r?.last_date ?? null),
    };
}
