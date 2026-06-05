import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { query } from '../lib/db';
import { fetchAptTrades, saveAptTrades } from '../lib/aptApi';
import { syncAptImages, syncAllMissingImages, searchAptImagesByWeb } from '../lib/imageService';

export default async function routes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
    fastify.get('/health', async () => ({ status: 'ok' }));

    // 아파트 매매 실거래가 조회
    // GET /api/apt/trades?lawdCd=11650&dealYmd=202505
    fastify.get('/apt/trades', async (request, reply) => {
        const { lawdCd, dealYmd, pageNo, numOfRows } = request.query as {
            lawdCd?: string;
            dealYmd?: string;
            pageNo?: string;
            numOfRows?: string;
        };

        if (!lawdCd || !dealYmd) {
            reply.status(400);
            return { error: 'lawdCd(지역코드 5자리)와 dealYmd(거래년월 YYYYMM)는 필수입니다.' };
        }

        try {
            const data = await fetchAptTrades({
                lawdCd,
                dealYmd,
                pageNo: pageNo ? Number(pageNo) : 1,
                numOfRows: numOfRows ? Number(numOfRows) : 100,
            });
            return data;
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '실거래가 데이터 조회 실패', details: String(err) };
        }
    });

    // API에서 가져와서 DB에 저장
    // POST /api/apt/sync?lawdCd=11650&dealYmd=202505
    fastify.post('/apt/sync', async (request, reply) => {
        const { lawdCd, dealYmd } = request.query as {
            lawdCd?: string;
            dealYmd?: string;
        };

        if (!lawdCd || !dealYmd) {
            reply.status(400);
            return { error: 'lawdCd와 dealYmd는 필수입니다.' };
        }

        try {
            // 전체 페이지 순회하여 모두 저장
            let pageNo = 1;
            let totalSaved = 0;

            while (true) {
                const data = await fetchAptTrades({ lawdCd, dealYmd, pageNo, numOfRows: 1000 });
                if (data.items.length === 0) break;

                const saved = await saveAptTrades(data.items);
                totalSaved += saved;

                if (pageNo * 1000 >= data.totalCount) break;
                pageNo++;
            }

            return { message: '저장 완료', saved: totalSaved, lawdCd, dealYmd };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '저장 실패', details: String(err) };
        }
    });

    // 특정 아파트 이미지 구글에서 가져와 저장
    // POST /api/apt/:aptId/images/sync
    fastify.post('/apt/:aptId/images/sync', async (request, reply) => {
        const { aptId } = request.params as { aptId: string };
        const id = Number(aptId);
        if (!Number.isInteger(id) || id <= 0) {
            reply.status(400);
            return { error: 'aptId는 양의 정수여야 합니다.' };
        }

        try {
            const result = await syncAptImages(id);
            return { message: '이미지 동기화 완료', ...result };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '이미지 동기화 실패', details: String(err) };
        }
    });

    // 이미지 없는 아파트 일괄 처리
    // POST /api/apt/images/sync-missing?limit=20
    fastify.post('/apt/images/sync-missing', async (request, reply) => {
        const { limit } = request.query as { limit?: string };
        const n = limit ? Number(limit) : 20;

        try {
            const result = await syncAllMissingImages(n);
            return { message: '일괄 이미지 동기화 완료', ...result };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '일괄 동기화 실패', details: String(err) };
        }
    });

    // 특정 아파트 이미지 목록 조회
    // GET /api/apt/:aptId/images
    fastify.get('/apt/:aptId/images', async (request, reply) => {
        const { aptId } = request.params as { aptId: string };
        const id = Number(aptId);
        if (!Number.isInteger(id) || id <= 0) {
            reply.status(400);
            return { error: 'aptId는 양의 정수여야 합니다.' };
        }

        try {
            const images = await query(
                `SELECT id, image_url, source, is_primary, sort_order
                 FROM apartment_images
                 WHERE apt_id = ?
                 ORDER BY sort_order`,
                [id],
            );
            return { aptId: id, images };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '이미지 조회 실패', details: String(err) };
        }
    });

    // 네이버 웹검색 → og:image 스크래핑
    // GET /api/naver/images?q=도곡동+타워팰리스
    fastify.get('/naver/images', async (request, reply) => {
        const { q } = request.query as { q?: string };
        if (!q) {
            reply.status(400);
            return { error: 'q(검색어)는 필수입니다.' };
        }

        try {
            const items = await searchAptImagesByWeb(q);
            return { items, total: items.length };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: '이미지 검색 실패', details: String(err) };
        }
    });

    fastify.get('/users', async (request, reply) => {
        try {
            const rows = await query('SELECT id, name FROM users LIMIT 10');
            return { users: rows };
        } catch (err) {
            fastify.log.error(err);
            reply.status(500);
            return { error: 'DB query failed', details: String(err) };
        }
    });
}
