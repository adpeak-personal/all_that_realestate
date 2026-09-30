import { getSettings } from '../lib/admin-queries';
import { cached } from '../lib/cache';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
    latestDealMonth,
    regionStats,
    recentDeals,
    listDeals,
    sggCodes,
    aptDetail,
    priceTrend,
    aptSitemapEntries,
    presaleSitemapEntries,
    sggBreakdown,
    listApts,
    siteSummary,
    listPresales,
    presaleDetail,
    presaleSummary,
} from '../lib/queries';
import type { PresaleStatus } from '../lib/queries';
import type { AptSort } from '../lib/queries';

// 이 서버는 조회 전용이다.
// 공공API 수집 / K-apt 동기화 / 매칭 / 이미지 검수는 atb-program(Python) 담당.
export default async function routes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
    fastify.get('/health', async () => ({ status: 'ok' }));

    /**
     * 사이트 운영 설정. 화면이 지도를 그릴지 말지 정하는 데 쓰므로 공개다.
     * 어드민에서 끄면 곧 반영되어야 해서 프런트에서 짧게(30초) 캐시한다.
     */
    fastify.get('/settings', async (_request, reply) => {
        try {
            // 어드민에서 끄면 30초 안에 반영되면 충분하다
            return await cached('settings', 30, getSettings);
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '설정을 불러오지 못했습니다.' };
        }
    });

    /** 시군구 코드 목록 — GET /api/sgg */
    fastify.get('/sgg', async (request, reply) => {
        try {
            const items = await sggCodes();
            return { items, total: items.length };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '시군구 목록 조회 실패' };
        }
    });

    /**
     * 시도별 월간 통계 — GET /api/stats/regions?ym=202605
     * ym 생략 시 DB 에 쌓인 최신 거래월을 자동으로 쓴다.
     */
    fastify.get('/stats/regions', async (request, reply) => {
        const { ym } = request.query as { ym?: string };

        try {
            const target = ym
                ? { year: Number(ym.slice(0, 4)), month: Number(ym.slice(4, 6)) }
                : await latestDealMonth();

            // 아직 수집된 거래가 한 건도 없는 상태
            if (!target) return { baseMonth: null, items: [] };

            const items = await regionStats(target);
            const baseMonth = `${target.year}${String(target.month).padStart(2, '0')}`;
            return { baseMonth, items };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '지역 통계 조회 실패' };
        }
    });

    /** 최근 거래 — GET /api/deals/recent?sido=서울&limit=8 */
    fastify.get('/deals/recent', async (request, reply) => {
        const { sido, limit } = request.query as { sido?: string; limit?: string };

        try {
            const items = await recentDeals({
                sido,
                limit: limit ? Number(limit) : undefined,
            });
            return { items, total: items.length };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '최근 거래 조회 실패' };
        }
    });

    /**
     * 실거래 목록 — GET /api/deals?sggCd=11680&dealYmd=202605&aptNm=래미안&page=1
     * aptId 를 주면 그 단지의 거래이력만 (단지 상세 페이지용).
     */
    fastify.get('/deals', async (request, reply) => {
        const { sggCd, dealYmd, aptNm, aptId, area, page, size } = request.query as {
            sggCd?: string;
            dealYmd?: string;
            aptNm?: string;
            aptId?: string;
            area?: string;
            page?: string;
            size?: string;
        };

        if (dealYmd && !/^\d{6}$/.test(dealYmd)) {
            reply.status(400);
            return { error: 'dealYmd 는 YYYYMM 형식이어야 합니다.' };
        }

        try {
            return await listDeals({
                sggCd,
                dealYmd,
                aptNm,
                aptId: aptId ? Number(aptId) : undefined,
                area: area && Number.isFinite(Number(area)) ? Number(area) : undefined,
                page: page ? Number(page) : undefined,
                size: size ? Number(size) : undefined,
            });
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '실거래 조회 실패' };
        }
    });

    /**
     * 월별 시세 추이 — GET /api/stats/trend?sido=서울&months=12
     * sido / sggCd / aptId 중 하나로 범위를 좁힌다. 없으면 전국.
     * 값은 ㎡당 평균 단가(만원). 거래 없던 달도 trades:0 으로 포함된다.
     */
    fastify.get('/stats/trend', async (request, reply) => {
        const { sido, sggCd, aptId, months } = request.query as {
            sido?: string;
            sggCd?: string;
            aptId?: string;
            months?: string;
        };

        try {
            return await priceTrend({
                sido,
                sggCd,
                aptId: aptId ? Number(aptId) : undefined,
                months: months ? Number(months) : undefined,
            });
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '시세 추이 조회 실패' };
        }
    });

    /** 사이트 전체 수집 현황 — GET /api/stats/summary */
    fastify.get('/stats/summary', async (request, reply) => {
        try {
            return await siteSummary();
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '수집 현황 조회 실패' };
        }
    });

    /** 시도 안의 시군구 요약 — GET /api/sgg/breakdown?sido=서울 */
    fastify.get('/sgg/breakdown', async (request, reply) => {
        const { sido } = request.query as { sido?: string };
        if (!sido) {
            reply.status(400);
            return { error: 'sido(시도 단축명)는 필수입니다.' };
        }
        try {
            // 목록 300페이지를 훑는 동안 이 값은 300번 똑같이 나간다. 5분 들고 있는다.
            const items = await cached(`breakdown:${sido}`, 300, () => sggBreakdown(sido));
            return { items, total: items.length };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '시군구 요약 조회 실패' };
        }
    });

    /**
     * 지역별 단지 목록 — GET /api/apts?sggCd=11680&sort=deals&page=1&size=30
     * sggCd 또는 sido 로 범위를 잡는다. 둘 다 없으면 전국.
     */
    fastify.get('/apts', async (request, reply) => {
        const { sggCd, sido, q, sort, page, size } = request.query as {
            sggCd?: string;
            sido?: string;
            q?: string;
            sort?: string;
            page?: string;
            size?: string;
        };

        try {
            // 검색어가 있는 요청은 사람이 친 것이라 매번 새로 조회한다.
            // 지역·페이지 조합은 크롤러가 수백 개를 훑으므로 잠깐 들고 있는다.
            const key = `apts:${sggCd ?? ''}:${sido ?? ''}:${sort ?? ''}:${page ?? 1}:${size ?? ''}`;
            const run = () =>
                listApts({
                    sggCd,
                    sido,
                    q,
                    sort: sort as AptSort | undefined,
                    page: page ? Number(page) : undefined,
                    size: size ? Number(size) : undefined,
                });
            return q ? await run() : await cached(key, 120, run);
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '단지 목록 조회 실패' };
        }
    });

    // ── 분양 ──────────────────────────────────────────────────────────────
    // 수집기는 아직 없다. 화면·API 를 먼저 세워 두고 매핑만 붙일 수 있게 한다.

    /** 분양 요약 — GET /api/presales/summary */
    fastify.get('/presales/summary', async (request, reply) => {
        try {
            return await presaleSummary();
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '분양 요약 조회 실패' };
        }
    });

    /**
     * 분양 공고 목록 — GET /api/presales?sido=서울&status=open&page=1
     * status: open(접수중) / upcoming(예정) / closed(마감)
     */
    fastify.get('/presales', async (request, reply) => {
        const { sido, sggCd, status, houseType, q, sort, page, size } = request.query as {
            sido?: string;
            sggCd?: string;
            status?: string;
            houseType?: string;
            q?: string;
            sort?: string;
            page?: string;
            size?: string;
        };

        const allowed = new Set(['open', 'upcoming', 'closed']);

        try {
            return await listPresales({
                sido,
                sggCd,
                status: allowed.has(status ?? '') ? (status as PresaleStatus) : undefined,
                houseType,
                q,
                sort: sort === 'notice' ? 'notice' : undefined,
                page: page ? Number(page) : undefined,
                size: size ? Number(size) : undefined,
            });
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '분양 목록 조회 실패' };
        }
    });

    /** 분양 공고 상세 — GET /api/presales/:id  (id = 주택관리번호-공고번호) */
    fastify.get('/presales/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            const item = await presaleDetail(id);
            if (!item) {
                reply.status(404);
                return { error: '분양 공고를 찾을 수 없습니다.' };
            }
            return item;
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '분양 공고 조회 실패' };
        }
    });

    /** 사이트맵용 단지 목록 — GET /api/sitemap/apts?limit=10000&offset=0 */
    fastify.get('/sitemap/apts', async (request, reply) => {
        const { limit, offset } = request.query as { limit?: string; offset?: string };
        try {
            return await aptSitemapEntries(
                limit ? Number(limit) : undefined,
                offset ? Number(offset) : undefined,
            );
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '사이트맵 목록 조회 실패' };
        }
    });

    /** 사이트맵용 분양 공고 목록 — GET /api/sitemap/presales?limit=10000&offset=0 */
    fastify.get('/sitemap/presales', async (request, reply) => {
        const { limit, offset } = request.query as { limit?: string; offset?: string };
        try {
            return await presaleSitemapEntries(
                limit ? Number(limit) : undefined,
                offset ? Number(offset) : undefined,
            );
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '사이트맵 목록 조회 실패' };
        }
    });

    /** 단지 상세 — GET /api/apt/:aptId */
    fastify.get('/apt/:aptId', async (request, reply) => {
        const { aptId } = request.params as { aptId: string };
        const id = Number(aptId);

        if (!Number.isInteger(id) || id <= 0) {
            reply.status(400);
            return { error: 'aptId 는 양의 정수여야 합니다.' };
        }

        try {
            const apt = await aptDetail(id);
            if (!apt) {
                reply.status(404);
                return { error: '단지를 찾을 수 없습니다.' };
            }
            return apt;
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '단지 조회 실패' };
        }
    });
}
