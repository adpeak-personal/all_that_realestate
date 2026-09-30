/**
 * 아주 작은 메모리 캐시.
 *
 * 검색엔진이 목록을 훑을 때 같은 조회가 쏟아진다 — 단지 목록 300페이지를 도는 동안
 * '서울 시군구 요약' 은 300번 똑같이 나간다. 그 사이 DB 는 다른 프로젝트와 함께 쓰는
 * 서버에 있고, 네트워크를 건너간다. 한 번 받은 답을 잠깐 들고 있기만 해도 그 부담이
 * 대부분 사라진다.
 *
 * 저장소를 따로 두지 않는다(Redis 등). 서버가 한 대고, 데이터가 몇 십 초 늦어도
 * 문제가 없는 조회들이라 프로세스 메모리로 충분하다.
 */
interface Entry {
    value: unknown;
    expires: number;
}

const store = new Map<string, Entry>();
const MAX_KEYS = 500;

/**
 * 같은 키로 동시에 들어온 요청은 한 번만 실제로 조회한다.
 * 캐시가 비어 있을 때 크롤러가 30개를 동시에 보내면 그대로 30개가 DB 로 가는데,
 * 이걸 막지 않으면 캐시가 있어도 몰릴 때 똑같이 무너진다.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expires > now) return hit.value as T;

    const running = inflight.get(key);
    if (running) return running as Promise<T>;

    const p = load()
        .then((value) => {
            // 오래된 것부터 버린다. 지역·페이지 조합이 많아 무한정 쌓일 수 있다.
            if (store.size >= MAX_KEYS) {
                const oldest = store.keys().next().value;
                if (oldest !== undefined) store.delete(oldest);
            }
            store.set(key, { value, expires: Date.now() + ttlSec * 1000 });
            return value;
        })
        .finally(() => {
            inflight.delete(key);
        });

    inflight.set(key, p);
    return p as Promise<T>;
}

/** 어드민에서 값을 바꿨을 때처럼, 바로 반영돼야 하는 경우에 쓴다. */
export function clearCache(prefix?: string) {
    if (!prefix) {
        store.clear();
        return;
    }
    for (const k of store.keys()) {
        if (k.startsWith(prefix)) store.delete(k);
    }
}
