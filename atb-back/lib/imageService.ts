import { query } from './db';

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

interface PlaceResult {
    place_id: string;
    name: string;
    photos?: { photo_reference: string; height: number; width: number }[];
    geometry?: { location: { lat: number; lng: number } };
    formatted_address?: string;
}

interface PlacesTextSearchResponse {
    status: string;
    results: PlaceResult[];
    error_message?: string;
}

interface PlaceDetailsResponse {
    status: string;
    result: PlaceResult;
    error_message?: string;
}

function getApiKey(): string {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set in .env');
    return key;
}

/** Google Place Photo URL 생성 (maxwidth 800px) */
function photoUrl(photoReference: string, apiKey: string, maxWidth = 800): string {
    return `${PLACES_BASE}/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${apiKey}`;
}

/** 아파트 이름 + 주소로 Google Places Text Search 실행 */
async function searchPlace(aptNm: string, umdNm: string): Promise<PlaceResult | null> {
    const apiKey = getApiKey();
    const query_str = `${aptNm} ${umdNm} 아파트`;
    const params = new URLSearchParams({
        query: query_str,
        language: 'ko',
        type: 'establishment',
        key: apiKey,
    });
    const url = `${PLACES_BASE}/textsearch/json?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Places Text Search 실패: ${res.status} ${res.statusText}`);

    const data: PlacesTextSearchResponse = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API 오류: ${data.status} - ${data.error_message ?? ''}`);
    }

    return data.results?.[0] ?? null;
}

/** Place Details로 추가 사진 참조 가져오기 */
async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
    const apiKey = getApiKey();
    const params = new URLSearchParams({
        place_id: placeId,
        fields: 'name,photos,geometry,formatted_address',
        language: 'ko',
        key: apiKey,
    });
    const url = `${PLACES_BASE}/details/json?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Places Details 실패: ${res.status} ${res.statusText}`);

    const data: PlaceDetailsResponse = await res.json();
    if (data.status !== 'OK') {
        throw new Error(`Places Details API 오류: ${data.status} - ${data.error_message ?? ''}`);
    }

    return data.result ?? null;
}

export interface ImageSyncResult {
    aptId: number;
    saved: number;
    thumbnailUrl: string | null;
}

/**
 * 특정 아파트의 구글 이미지를 가져와 apartment_images에 저장하고
 * apartments.thumbnail_url / lat / lng 업데이트
 */
export async function syncAptImages(aptId: number, maxImages = 5): Promise<ImageSyncResult> {
    const apiKey = getApiKey();

    // 1. DB에서 아파트 정보 조회
    const rows = await query(
        'SELECT apt_nm, umd_nm, address_road FROM apartments WHERE id = ?',
        [aptId],
    ) as { apt_nm: string; umd_nm: string; address_road: string | null }[];

    if (rows.length === 0) throw new Error(`아파트 id=${aptId} 를 찾을 수 없습니다.`);
    const apt = rows[0];

    // 2. Places Text Search
    const place = await searchPlace(apt.apt_nm, apt.umd_nm);
    if (!place) {
        return { aptId, saved: 0, thumbnailUrl: null };
    }

    // 3. Place Details로 photos 최대 확보
    let photos = place.photos ?? [];
    if (photos.length < maxImages && place.place_id) {
        const details = await getPlaceDetails(place.place_id);
        if (details?.photos) photos = details.photos;
        // lat/lng 업데이트
        if (details?.geometry?.location) {
            const { lat, lng } = details.geometry.location;
            await query(
                'UPDATE apartments SET lat = ?, lng = ? WHERE id = ?',
                [lat, lng, aptId],
            );
        }
    }

    const photoRefs = photos.slice(0, maxImages).map(p => p.photo_reference);
    if (photoRefs.length === 0) return { aptId, saved: 0, thumbnailUrl: null };

    // 4. apartment_images에 저장 (중복 무시)
    let saved = 0;
    let thumbnailUrl: string | null = null;

    for (let i = 0; i < photoRefs.length; i++) {
        const url = photoUrl(photoRefs[i], apiKey);
        const isPrimary = i === 0 ? 1 : 0;

        const result = await query(
            `INSERT IGNORE INTO apartment_images (apt_id, image_url, source, is_primary, sort_order)
             VALUES (?, ?, 'google', ?, ?)`,
            [aptId, url, isPrimary, i],
        ) as { affectedRows: number };

        if (result.affectedRows > 0) saved++;
        if (i === 0) thumbnailUrl = url;
    }

    // 5. thumbnail_url 업데이트 (아직 없을 경우에만)
    if (thumbnailUrl) {
        await query(
            'UPDATE apartments SET thumbnail_url = ? WHERE id = ? AND thumbnail_url IS NULL',
            [thumbnailUrl, aptId],
        );
    }

    return { aptId, saved, thumbnailUrl };
}

/**
 * apartments 테이블에서 이미지 없는 아파트를 일괄 처리
 * limit: 한 번에 처리할 최대 개수
 */
export async function syncAllMissingImages(limit = 20): Promise<{ processed: number; totalSaved: number }> {
    const rows = await query(
        `SELECT id FROM apartments
         WHERE thumbnail_url IS NULL
         ORDER BY id
         LIMIT ?`,
        [limit],
    ) as { id: number }[];

    let totalSaved = 0;
    for (const row of rows) {
        const res = await syncAptImages(row.id);
        totalSaved += res.saved;
    }

    return { processed: rows.length, totalSaved };
}

// ─── 웹 검색 + og:image 스크래핑 ──────────────────────────────────────────────

export interface WebImageResult {
    pageUrl: string;
    imageUrl: string;
    domain: string;
}

/** og:image 메타태그 추출 */
function extractOgImage(html: string): string | null {
    const patterns = [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) return m[1];
    }
    return null;
}

/**
 * 1단계: 네이버 웹 검색으로 각 도메인에서 아파트 페이지 URL 획득
 * 2단계: 해당 URL HTML 긁어 og:image 추출
 */
export async function searchAptImagesByWeb(
    aptQuery: string,
    maxImages = 5,
): Promise<WebImageResult[]> {
    const clientId     = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('NAVER credentials not set');

    const SEARCH_DOMAINS = ['kbland.kr', 'land.naver.com', 'place.map.kakao.com', 'namu.wiki'];

    const results: WebImageResult[] = [];

    for (const domain of SEARCH_DOMAINS) {
        if (results.length >= maxImages) break;

        // 1단계: 네이버 웹 검색 (site: 연산자)
        const params = new URLSearchParams({
            query:   `${aptQuery} site:${domain}`,
            display: '3',
            sort:    'sim',
        });

        let links: string[] = [];
        try {
            const searchRes = await fetch(
                `https://openapi.naver.com/v1/search/webkr.json?${params.toString()}`,
                {
                    headers: {
                        'X-Naver-Client-Id':     clientId,
                        'X-Naver-Client-Secret': clientSecret,
                    },
                },
            );
            if (!searchRes.ok) continue;
            const searchData = await searchRes.json() as { items?: { link: string }[] };
            links = (searchData.items ?? []).map(i => i.link).slice(0, 2);
        } catch {
            continue;
        }

        // 2단계: 각 URL에서 og:image 추출
        for (const pageUrl of links) {
            if (results.length >= maxImages) break;
            try {
                const htmlRes = await fetch(pageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ATBBot/1.0)',
                        'Accept':     'text/html',
                    },
                    signal: AbortSignal.timeout(6000),
                });
                if (!htmlRes.ok) continue;
                const html = await htmlRes.text();
                const imageUrl = extractOgImage(html);
                if (imageUrl) results.push({ pageUrl, imageUrl, domain });
            } catch {
                // 타임아웃 또는 접속 불가 — 스킵
            }
        }
    }

    return results;
}
