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
    sido: string;         // 단축명 (서울, 경기, ...)
    trades: number;       // 해당 월 거래 건수
    avgPrice: number;     // 평균 거래금액 (만원)
    trend: number | null; // ㎡당 단가 전월 대비 증감률 (%). 전월 데이터 없으면 null
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

function mapDeal(r: RawDeal): DealRow {
    // mysql2 는 DATE 를 로컬 시간대 Date 로 준다. toISOString() 을 쓰면
    // UTC 변환 때문에 하루 밀릴 수 있어 로컬 기준으로 직접 포맷한다.
    let date: string;
    if (r.deal_date instanceof Date) {
        const y = r.deal_date.getFullYear();
        const m = String(r.deal_date.getMonth() + 1).padStart(2, '0');
        const d = String(r.deal_date.getDate()).padStart(2, '0');
        date = `${y}-${m}-${d}`;
    } else {
        date = String(r.deal_date).slice(0, 10);
    }

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

/** 메인 화면용 — 최신 거래 N건. sido(단축명) 로 지역 한정 가능. */
export async function recentDeals(opts: { sido?: string; limit?: number }): Promise<DealRow[]> {
    const limit = Math.min(Math.max(opts.limit ?? 8, 1), 100);
    const params: unknown[] = [];
    let where = `WHERE ${NOT_CANCELED}`;

    if (opts.sido) {
        const fulls = toFullSido(opts.sido);
        if (fulls.length === 0) return [];
        where += ` AND s.sido_nm IN (${fulls.map(() => '?').join(',')})`;
        params.push(...fulls);
    }

    const rows = (await query(
        `${DEAL_SELECT} ${where} ORDER BY d.deal_date DESC, d.id DESC LIMIT ${limit}`,
        params,
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

/** 단지 상세 — apartments + K-apt 매칭 정보 JOIN. */
export async function aptDetail(aptId: number) {
    const rows = (await query(
        `SELECT a.id, a.apt_nm, a.umd_nm, a.jibun, a.build_year,
                a.thumbnail_url, a.exclu_areas, a.match_status,
                s.sido_nm, s.sgg_nm,
                k.kapt_name, k.total_households, k.dong_cnt, k.top_floor,
                k.use_apr_date, k.heat_type, k.hall_type, k.builder,
                k.parking_total, k.addr_road, k.addr_jibun
           FROM apartments a
           JOIN sgg_codes s ON s.sgg_cd = a.sgg_cd
           LEFT JOIN kapt_complexes k ON k.kapt_code = a.kapt_code
          WHERE a.id = ?`,
        [aptId],
    )) as Array<Record<string, unknown>>;

    return rows[0] ?? null;
}
