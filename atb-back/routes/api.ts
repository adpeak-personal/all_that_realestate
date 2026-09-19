import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
    latestDealMonth,
    regionStats,
    recentDeals,
    listDeals,
    sggCodes,
    aptDetail,
} from '../lib/queries';

// 이 서버는 조회 전용이다.
// 공공API 수집 / K-apt 동기화 / 매칭 / 이미지 검수는 atb-program(Python) 담당.
export default async function routes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
    fastify.get('/health', async () => ({ status: 'ok' }));

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

    /** 실거래 목록 — GET /api/deals?sggCd=11680&dealYmd=202605&aptNm=래미안&page=1 */
    fastify.get('/deals', async (request, reply) => {
        const { sggCd, dealYmd, aptNm, page, size } = request.query as {
            sggCd?: string;
            dealYmd?: string;
            aptNm?: string;
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
                page: page ? Number(page) : undefined,
                size: size ? Number(size) : undefined,
            });
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '실거래 조회 실패' };
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
