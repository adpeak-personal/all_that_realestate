/**
 * 분양 랜딩 블록.
 *
 * 광고 페이지라 건마다 구성이 다르다(이미지만 쭉, 또는 글·이미지 교차 등).
 * 그래서 컬럼으로 고정하지 않고 블록 배열로 두고, 배열 순서가 곧 화면 순서다.
 *
 * 들어오는 값은 전부 관리자 입력이지만 그대로 믿지 않는다 — 길이·개수를 자르고
 * 이미지 주소는 http(s) 만 받는다. javascript: 같은 주소가 화면에 들어가면
 * 보는 사람 브라우저에서 실행될 수 있다.
 */
export type LandingBlock =
    | { id: string; type: 'image'; url: string; alt: string; link: string | null }
    | { id: string; type: 'text'; heading: string; body: string };

const MAX_BLOCKS = 40;
const MAX_TEXT = 4000;

function str(v: unknown, max: number): string {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** http/https 만 통과시킨다. 그 외(javascript:, data: 등)는 빈 값으로 만든다. */
function safeUrl(v: unknown): string {
    const s = str(v, 1000);
    if (!s) return '';
    try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
    } catch {
        return '';
    }
}

export function parseLanding(raw: unknown): LandingBlock[] {
    let value = raw;
    // JSON 컬럼이 드라이버 설정에 따라 문자열로 올 수 있다
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(value)) return [];

    const out: LandingBlock[] = [];
    for (const item of value.slice(0, MAX_BLOCKS)) {
        if (!item || typeof item !== 'object') continue;
        const b = item as Record<string, unknown>;
        const id = str(b.id, 40) || `b${out.length + 1}`;

        if (b.type === 'image') {
            const url = safeUrl(b.url);
            if (!url) continue;           // 주소가 없으면 보여줄 게 없다
            out.push({ id, type: 'image', url, alt: str(b.alt, 200), link: safeUrl(b.link) || null });
        } else if (b.type === 'text') {
            const heading = str(b.heading, 200);
            const body = str(b.body, MAX_TEXT);
            if (!heading && !body) continue;
            out.push({ id, type: 'text', heading, body });
        }
    }
    return out;
}
