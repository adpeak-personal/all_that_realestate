/**
 * 어드민에서만 쓰는 조회·쓰기.
 *
 * 사이트 전체는 읽기 전용이고, 쓰기는 여기 모인 것뿐이다:
 *   - site_settings (운영 스위치)
 *   - presale_notices 의 노출 3개 컬럼 (광고 상품 자리)
 * 수집 데이터 자체는 어드민에서도 고치지 않는다. 고쳐 봐야 다음 수집에서 덮인다.
 */
import { query } from './db';

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
    houseManageNo: string,
    pblancNo: string,
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

    params.push(houseManageNo, pblancNo);
    const res = (await query(
        `UPDATE presale_notices SET ${sets.join(', ')}
          WHERE house_manage_no = ? AND pblanc_no = ?`,
        params,
    )) as unknown as { affectedRows?: number };
    return (res?.affectedRows ?? 0) > 0;
}

/** 어드민 목록. 공개 목록과 달리 숨긴 공고도 포함하고 노출 플래그를 같이 준다. */
export interface AdminPresaleRow {
    id: string;
    houseNm: string;
    sido: string | null;
    sgg: string | null;
    houseType: string | null;
    rceptBgnde: string | null;
    isFeatured: boolean;
    sortWeight: number;
    isHidden: boolean;
}

export async function listPresalesForAdmin(q?: string, size = 30): Promise<AdminPresaleRow[]> {
    const params: unknown[] = [];
    let where = '';
    if (q && q.trim()) {
        where = 'WHERE house_nm LIKE ?';
        params.push(`%${q.trim()}%`);
    }
    const rows = (await query(
        `SELECT house_manage_no, pblanc_no, house_nm, sido_nm, sgg_nm, house_secd_nm,
                rcept_bgnde, is_featured, sort_weight, is_hidden
           FROM presale_notices
           ${where}
          ORDER BY is_featured DESC, sort_weight DESC, notice_date DESC
          LIMIT ${Math.min(Math.max(size, 1), 100)}`,
        params,
    )) as Array<Record<string, any>>;

    return rows.map((r) => ({
        id: `${r.house_manage_no}-${r.pblanc_no}`,
        houseNm: r.house_nm,
        sido: r.sido_nm ?? null,
        sgg: r.sgg_nm ?? null,
        houseType: r.house_secd_nm ?? null,
        rceptBgnde: r.rcept_bgnde ? new Date(r.rcept_bgnde).toISOString().slice(0, 10) : null,
        isFeatured: !!r.is_featured,
        sortWeight: Number(r.sort_weight ?? 0),
        isHidden: !!r.is_hidden,
    }));
}

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
