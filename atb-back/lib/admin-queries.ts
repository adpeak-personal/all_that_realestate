/**
 * 어드민에서만 쓰는 조회·쓰기.
 *
 * 사이트 전체는 읽기 전용이고, 쓰기는 여기 모인 것뿐이다:
 *   - site_settings (운영 스위치)
 *   - presale_notices 의 노출 3개 컬럼 (광고 상품 자리)
 * 수집 데이터 자체는 어드민에서도 고치지 않는다. 고쳐 봐야 다음 수집에서 덮인다.
 */
import { NOT_CANCELED, toDateString } from './queries';
import { toFullSido, toShortSido } from './sido';
import { query } from './db';
import { parseLanding } from './landing';

// ─── 설정 ────────────────────────────────────────────────────────────────────

export interface SiteSettings {
    /** 지도·거리뷰 표시. 네이버 무료 한도가 위험할 때 끈다 */
    mapEnabled: boolean;
}

const DEFAULTS: SiteSettings = { mapEnabled: true };

export async function getSettings(): Promise<SiteSettings> {
    const rows = (await query('SELECT `key`, `value` FROM site_settings')) as Array<{
        key: string;
        value: string;
    }>;
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
        mapEnabled: map.has('map_enabled') ? map.get('map_enabled') === '1' : DEFAULTS.mapEnabled,
    };
}

export async function setSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
    if (patch.mapEnabled !== undefined) {
        await query(
            'INSERT INTO site_settings (`key`, `value`) VALUES (?, ?) ' +
                'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
            ['map_enabled', patch.mapEnabled ? '1' : '0'],
        );
    }
    return getSettings();
}

// ─── 분양 노출 제어 ──────────────────────────────────────────────────────────

export interface PresaleFlagPatch {
    isFeatured?: boolean;
    sortWeight?: number;
    isHidden?: boolean;
}

export async function setPresaleFlags(
    id: number,
    patch: PresaleFlagPatch,
): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.isFeatured !== undefined) {
        sets.push('is_featured = ?');
        params.push(patch.isFeatured ? 1 : 0);
    }
    if (patch.sortWeight !== undefined) {
        sets.push('sort_weight = ?');
        params.push(Math.trunc(patch.sortWeight));
    }
    if (patch.isHidden !== undefined) {
        sets.push('is_hidden = ?');
        params.push(patch.isHidden ? 1 : 0);
    }
    if (sets.length === 0) return false;

    params.push(id);
    const res = (await query(
        `UPDATE presale_notices SET ${sets.join(', ')} WHERE id = ?`,
        params,
    )) as unknown as { affectedRows?: number };
    return (res?.affectedRows ?? 0) > 0;
}

// ─── 어드민 목록·수정 ────────────────────────────────────────────────────────
//
// 공개 목록과 다른 점: 숨긴 것도 보이고, 노출 플래그와 관리자가 쓴 제목·설명을 같이 준다.
// 관리자가 고칠 수 있는 건 '수집이 안 건드리는 칸' 뿐이다 — 단지명·분양가처럼 수집으로
// 채워지는 값을 여기서 고쳐 봐야 다음 수집에서 덮인다.

export interface AdminPresaleRow {
    id: number;
    houseNm: string;
    sido: string | null;
    sgg: string | null;
    houseType: string | null;
    rceptBgnde: string | null;
    isFeatured: boolean;
    sortWeight: number;
    isHidden: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
}

export interface AdminListResult<T> {
    items: T[];
    total: number;
    page: number;
    size: number;
}

const ADMIN_PAGE = 15;

export async function listPresalesForAdmin(opts: {
    q?: string;
    sido?: string;
    sggCd?: string;
    page?: number;
}): Promise<AdminListResult<AdminPresaleRow>> {
    const page = Math.max(opts.page ?? 1, 1);
    const offset = (page - 1) * ADMIN_PAGE;

    const params: unknown[] = [];
    const conds: string[] = [];
    if (opts.q?.trim()) {
        conds.push('house_nm LIKE ?');
        params.push(`%${opts.q.trim()}%`);
    }
    if (opts.sggCd) {
        conds.push('sgg_cd = ?');
        params.push(Number(opts.sggCd));
    } else if (opts.sido) {
        // 화면에서는 '서울' 처럼 짧게 고르지만 저장은 '서울특별시' 라 맞춰 준다
        const fulls = toFullSido(opts.sido);
        if (fulls.length === 0) return { items: [], total: 0, page, size: ADMIN_PAGE };
        conds.push(`sido_nm IN (${fulls.map(() => '?').join(',')})`);
        params.push(...fulls);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const countRows = (await query(
        `SELECT COUNT(*) AS cnt FROM presale_notices ${where}`,
        params,
    )) as Array<{ cnt: number }>;

    const rows = (await query(
        `SELECT id, house_nm, sido_nm, sgg_nm, house_secd_nm, rcept_bgnde,
                is_featured, sort_weight, is_hidden, seo_title, seo_description
           FROM presale_notices
           ${where}
          ORDER BY is_featured DESC, sort_weight DESC, notice_date DESC, id DESC
          LIMIT ${ADMIN_PAGE} OFFSET ${offset}`,
        params,
    )) as Array<Record<string, any>>;

    return {
        items: rows.map((r) => ({
            id: Number(r.id),
            houseNm: r.house_nm,
            sido: r.sido_nm ?? null,
            sgg: r.sgg_nm ?? null,
            houseType: r.house_secd_nm ?? null,
            rceptBgnde: toDateString(r.rcept_bgnde),
            isFeatured: !!r.is_featured,
            sortWeight: Number(r.sort_weight ?? 0),
            isHidden: !!r.is_hidden,
            seoTitle: r.seo_title ?? null,
            seoDescription: r.seo_description ?? null,
        })),
        total: Number(countRows[0]?.cnt ?? 0),
        page,
        size: ADMIN_PAGE,
    };
}

export interface AdminAptRow {
    id: number;
    aptNm: string;
    sido: string;
    sgg: string;
    umdNm: string;
    dealCount: number;
    seoTitle: string | null;
    seoDescription: string | null;
}

export async function listAptsForAdmin(opts: {
    q?: string;
    sido?: string;
    sggCd?: string;
    page?: number;
}): Promise<AdminListResult<AdminAptRow>> {
    const page = Math.max(opts.page ?? 1, 1);
    const offset = (page - 1) * ADMIN_PAGE;

    const params: unknown[] = [];
    const conds: string[] = [];
    if (opts.q?.trim()) {
        conds.push('a.apt_nm LIKE ?');
        params.push(`%${opts.q.trim()}%`);
    }
    if (opts.sggCd) {
        conds.push('a.sgg_cd = ?');
        params.push(Number(opts.sggCd));
    } else if (opts.sido) {
        const fulls = toFullSido(opts.sido);
        if (fulls.length === 0) return { items: [], total: 0, page, size: ADMIN_PAGE };
        conds.push(`s.sido_nm IN (${fulls.map(() => '?').join(',')})`);
        params.push(...fulls);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const countRows = (await query(
        `SELECT COUNT(*) AS cnt FROM apartments a
           JOIN sgg_codes s ON s.sgg_cd = a.sgg_cd ${where}`,
        params,
    )) as Array<{ cnt: number }>;

    const rows = (await query(
        `SELECT a.id, a.apt_nm, a.umd_nm, a.seo_title, a.seo_description,
                s.sido_nm, s.sgg_nm,
                (SELECT COUNT(*) FROM apartment_deals d
                  WHERE d.apt_id = a.id AND ${NOT_CANCELED}) AS deal_count
           FROM apartments a
           JOIN sgg_codes s ON s.sgg_cd = a.sgg_cd
           ${where}
          ORDER BY deal_count DESC, a.apt_nm
          LIMIT ${ADMIN_PAGE} OFFSET ${offset}`,
        params,
    )) as Array<Record<string, any>>;

    return {
        items: rows.map((r) => ({
            id: Number(r.id),
            aptNm: r.apt_nm,
            sido: toShortSido(r.sido_nm),
            sgg: r.sgg_nm,
            umdNm: r.umd_nm,
            dealCount: Number(r.deal_count ?? 0),
            seoTitle: r.seo_title ?? null,
            seoDescription: r.seo_description ?? null,
        })),
        total: Number(countRows[0]?.cnt ?? 0),
        page,
        size: ADMIN_PAGE,
    };
}

export interface SeoPatch {
    seoTitle?: string | null;
    seoDescription?: string | null;
}

/** 빈 문자열은 '지운다'는 뜻으로 받아 NULL 로 되돌린다(= 자동 생성으로 복귀). */
function seoValue(v: string | null | undefined): string | null | undefined {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
}

async function setSeo(table: 'presale_notices' | 'apartments', id: number, patch: SeoPatch) {
    const sets: string[] = [];
    const params: unknown[] = [];
    const title = seoValue(patch.seoTitle);
    const desc = seoValue(patch.seoDescription);
    if (title !== undefined) {
        sets.push('seo_title = ?');
        params.push(title);
    }
    if (desc !== undefined) {
        sets.push('seo_description = ?');
        params.push(desc);
    }
    if (sets.length === 0) return false;

    params.push(id);
    const res = (await query(
        `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`,
        params,
    )) as unknown as { affectedRows?: number };
    return (res?.affectedRows ?? 0) > 0;
}

/** 편집 화면용 단건. 숨긴 공고도 열 수 있어야 한다. */
export async function presaleForAdmin(id: number) {
    const rows = (await query(
        `SELECT id, house_nm, sido_nm, sgg_nm, seo_title, seo_description, landing
           FROM presale_notices WHERE id = ?`,
        [id],
    )) as Array<Record<string, any>>;
    const r = rows[0];
    if (!r) return null;
    return {
        id: Number(r.id),
        houseNm: r.house_nm,
        sido: r.sido_nm ?? null,
        sgg: r.sgg_nm ?? null,
        seoTitle: r.seo_title ?? null,
        seoDescription: r.seo_description ?? null,
        landing: parseLanding(r.landing),
    };
}

/** 랜딩 블록 저장. 들어온 값은 parseLanding 으로 한 번 걸러서 넣는다. */
export async function setPresaleLanding(id: number, raw: unknown): Promise<boolean> {
    const blocks = parseLanding(raw);
    const res = (await query('UPDATE presale_notices SET landing = ? WHERE id = ?', [
        blocks.length > 0 ? JSON.stringify(blocks) : null,
        id,
    ])) as unknown as { affectedRows?: number };
    return (res?.affectedRows ?? 0) > 0;
}

export const setPresaleSeo = (id: number, patch: SeoPatch) => setSeo('presale_notices', id, patch);
export const setAptSeo = (id: number, patch: SeoPatch) => setSeo('apartments', id, patch);

// ─── 수집 상태 ───────────────────────────────────────────────────────────────

export interface CollectStatus {
    deals: { total: number; lastMonth: string | null };
    apartments: { total: number; geocoded: number; kaptMatched: number };
    kapt: { total: number; sggDone: number; sggTotal: number; lastSynced: string | null };
    presale: { total: number; open: number; upcoming: number; lastSynced: string | null };
}

/** 어젯밤 수집이 제대로 돌았는지 한 화면에서 보려고 만든 것. */
export async function collectStatus(): Promise<CollectStatus> {
    const one = async (sql: string) => ((await query(sql)) as Array<Record<string, any>>)[0] ?? {};

    const deals = await one(
        `SELECT COUNT(*) AS total,
                MAX(CONCAT(deal_year, LPAD(deal_month, 2, '0'))) AS last_month
           FROM apartment_deals`,
    );
    const apts = await one(
        `SELECT COUNT(*) AS total,
                SUM(lat IS NOT NULL)       AS geocoded,
                SUM(kapt_code IS NOT NULL) AS matched
           FROM apartments`,
    );
    const kapt = await one(
        `SELECT COUNT(*) AS total,
                COUNT(DISTINCT LEFT(bjd_code, 5)) AS sgg_done,
                MAX(synced_at) AS last_synced
           FROM kapt_complexes`,
    );
    const sgg = await one('SELECT COUNT(*) AS total FROM sgg_codes WHERE is_active = 1');
    const presale = await one(
        `SELECT COUNT(*) AS total,
                SUM(rcept_bgnde <= CURDATE() AND rcept_endde >= CURDATE()) AS open_cnt,
                SUM(rcept_bgnde > CURDATE())                               AS upcoming_cnt,
                MAX(synced_at) AS last_synced
           FROM presale_notices`,
    );

    const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
    return {
        deals: { total: Number(deals.total ?? 0), lastMonth: deals.last_month ?? null },
        apartments: {
            total: Number(apts.total ?? 0),
            geocoded: Number(apts.geocoded ?? 0),
            kaptMatched: Number(apts.matched ?? 0),
        },
        kapt: {
            total: Number(kapt.total ?? 0),
            sggDone: Number(kapt.sgg_done ?? 0),
            sggTotal: Number(sgg.total ?? 0),
            lastSynced: iso(kapt.last_synced),
        },
        presale: {
            total: Number(presale.total ?? 0),
            open: Number(presale.open_cnt ?? 0),
            upcoming: Number(presale.upcoming_cnt ?? 0),
            lastSynced: iso(presale.last_synced),
        },
    };
}
