import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';
import { query } from './db';

const BASE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const parser = new XMLParser({ ignoreAttributes: false });

export interface AptTradeItem {
    aptDong: string | number;
    aptNm: string;
    buildYear: number;
    buyerGbn: string;
    cdealDay: string;
    cdealType: string;
    dealAmount: string;       // "233,000" 형태
    dealDay: number;
    dealMonth: number;
    dealYear: number;
    dealingGbn: string;
    estateAgentSggNm: string;
    excluUseAr: number;
    floor: number;
    jibun: string | number;
    landLeaseholdGbn: string;
    rgstDate: string;
    sggCd: number;
    slerGbn: string;
    umdNm: string;
}

export interface AptTradeResult {
    items: AptTradeItem[];
    totalCount: number;
    pageNo: number;
    numOfRows: number;
}

/** API 응답 아이템 → DB INSERT용 파싱 */
function parseItem(item: AptTradeItem) {
    const amount = parseInt(String(item.dealAmount).replace(/,/g, ''), 10);
    const y = item.dealYear;
    const m = String(item.dealMonth).padStart(2, '0');
    const d = String(item.dealDay).padStart(2, '0');
    const dealDate = `${y}-${m}-${d}`;

    const transactionKey = createHash('md5')
        .update(`${item.sggCd}_${item.aptNm}_${item.aptDong}_${dealDate}_${item.floor}_${item.excluUseAr}_${amount}`)
        .digest('hex');

    return {
        transaction_key:      transactionKey,
        sgg_cd:               item.sggCd,
        umd_nm:               item.umdNm,
        jibun:                String(item.jibun || ''),
        apt_nm:               item.aptNm,
        apt_dong:             String(item.aptDong || ''),
        build_year:           item.buildYear || null,
        deal_amount:          amount,
        deal_date:            dealDate,
        deal_year:            item.dealYear,
        deal_month:           item.dealMonth,
        deal_day:             item.dealDay,
        exclu_use_ar:         item.excluUseAr,
        floor:                item.floor,
        dealing_gbn:          item.dealingGbn || null,
        buyer_gbn:            item.buyerGbn || null,
        sler_gbn:             item.slerGbn || null,
        land_leasehold_gbn:   item.landLeaseholdGbn || 'N',
        cdeal_type:           item.cdealType || null,
        cdeal_day:            item.cdealDay || null,
        estate_agent_sgg_nm:  item.estateAgentSggNm || null,
        rgst_date:            item.rgstDate || null,
    };
}

/** 파싱된 아이템 배열을 DB에 저장 (중복 무시) */
export async function saveAptTrades(items: AptTradeItem[]): Promise<number> {
    if (items.length === 0) return 0;

    const rows = items.map(parseItem);

    // 1. 배치 내 unique 단지만 apartments에 upsert
    const seen = new Set<string>();
    for (const r of rows) {
        const key = `${r.sgg_cd}_${r.apt_nm}_${r.jibun}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await query(
            `INSERT IGNORE INTO apartments (sgg_cd, umd_nm, jibun, apt_nm, build_year)
             VALUES (?, ?, ?, ?, ?)`,
            [r.sgg_cd, r.umd_nm, r.jibun, r.apt_nm, r.build_year],
        );
    }

    // 2. apartment_deals INSERT
    const columns = Object.keys(rows[0]);
    const placeholders = rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const values = rows.flatMap(r => columns.map(c => (r as Record<string, unknown>)[c]));

    const result = await query(
        `INSERT IGNORE INTO apartment_deals (${columns.join(',')}) VALUES ${placeholders}`,
        values,
    ) as { affectedRows: number };

    // 3. apt_id 일괄 연결 (NULL인 것만)
    await query(
        `UPDATE apartment_deals d
         JOIN apartments a
           ON a.sgg_cd = d.sgg_cd
          AND a.apt_nm = d.apt_nm
          AND COALESCE(a.jibun, '') = COALESCE(d.jibun, '')
         SET d.apt_id = a.id
         WHERE d.apt_id IS NULL`,
        [],
    );

    return result.affectedRows;
}

export async function fetchAptTrades(params: {
    lawdCd: string;   // 지역코드 5자리 (예: 11650 = 서울 서초구)
    dealYmd: string;  // 거래년월 YYYYMM (예: 202505)
    pageNo?: number;
    numOfRows?: number;
}): Promise<AptTradeResult> {
    const serviceKey = process.env.DATA_AUTH_KEY;
    if (!serviceKey) throw new Error('DATA_AUTH_KEY is not set in .env');

    // serviceKey는 URLSearchParams를 거치면 이중 인코딩되므로 직접 URL에 삽입
    const otherParams = new URLSearchParams({
        LAWD_CD: params.lawdCd,
        DEAL_YMD: params.dealYmd,
        pageNo: String(params.pageNo ?? 1),
        numOfRows: String(params.numOfRows ?? 100),
    });
    const fullUrl = `${BASE_URL}?serviceKey=${serviceKey}&${otherParams.toString()}`;

    const res = await fetch(fullUrl);
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`API 응답 오류: ${res.status} ${res.statusText}\n${body}`);
    }

    const xml = await res.text();
    const parsed = parser.parse(xml);

    // OpenAPI 오류 응답 처리 (OpenAPI_ServiceResponse 형태로 오는 경우)
    const errMsg = parsed?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg;
    if (errMsg) throw new Error(`API 오류: ${errMsg}`);

    const header = parsed?.response?.header;
    if (header?.resultCode !== '00' && header?.resultCode !== 0) {
        throw new Error(`API 오류: [${header?.resultCode}] ${header?.resultMsg ?? 'unknown error'}`);
    }

    const body = parsed?.response?.body;
    const rawItems = body?.items?.item;

    // 결과가 1건이면 object, 여러 건이면 array로 오므로 통일
    const items: AptTradeItem[] = rawItems == null
        ? []
        : Array.isArray(rawItems) ? rawItems : [rawItems];

    return {
        items,
        totalCount: Number(body?.totalCount ?? 0),
        pageNo: Number(body?.pageNo ?? 1),
        numOfRows: Number(body?.numOfRows ?? 0),
    };
}
