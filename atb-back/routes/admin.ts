/**
 * 어드민 API. 사이트에서 유일하게 쓰기가 일어나는 곳이다.
 *
 * 로그인(POST /admin/login) 외의 모든 경로는 requireAdmin 을 지난다.
 * 로그인 실패는 이유를 구분해 알려주지 않는다 — 비밀번호가 틀렸는지, 설정이
 * 안 됐는지를 밖에서 구분할 수 있게 하면 공격자에게 정보를 주는 셈이다.
 */
import type { FastifyInstance } from 'fastify';
import { login, logout, isAdmin, requireAdmin, verifyPassword } from '../lib/admin-auth';
import {
    collectStatus,
    getSettings,
    listAptsForAdmin,
    listPresalesForAdmin,
    setAptSeo,
    setPresaleFlags,
    setPresaleSeo,
    setSettings,
} from '../lib/admin-queries';

export default async function adminRoutes(fastify: FastifyInstance) {
    // 로그인 시도 간격 — 한 대의 서버에 관리자 한 명이라 메모리 기록으로 충분하다
    let lastFail = 0;
    let failCount = 0;

    fastify.post('/admin/login', async (request, reply) => {
        const { password } = (request.body ?? {}) as { password?: string };
        const hash = process.env.ADMIN_PASSWORD_HASH;

        // 연속 실패 시 점점 느리게 (5회부터 1초, 10회부터 5초)
        const wait = failCount >= 10 ? 5000 : failCount >= 5 ? 1000 : 0;
        if (wait && Date.now() - lastFail < wait) {
            reply.status(429);
            return { error: '잠시 후 다시 시도해 주세요.' };
        }

        if (!hash || !password || !verifyPassword(password, hash)) {
            failCount += 1;
            lastFail = Date.now();
            if (!hash) fastify.log.error('ADMIN_PASSWORD_HASH 가 설정되지 않았습니다.');
            reply.status(401);
            return { error: '비밀번호가 올바르지 않습니다.' };
        }

        failCount = 0;
        login(reply);
        return { ok: true };
    });

    fastify.post('/admin/logout', async (_request, reply) => {
        logout(reply);
        return { ok: true };
    });

    /** 화면이 로그인 상태를 확인할 때. 인증 없이도 부를 수 있고 참/거짓만 준다. */
    fastify.get('/admin/me', async (request) => ({ admin: isAdmin(request) }));

    fastify.get('/admin/status', { preHandler: requireAdmin }, async () => collectStatus());

    fastify.get('/admin/settings', { preHandler: requireAdmin }, async () => getSettings());

    fastify.put('/admin/settings', { preHandler: requireAdmin }, async (request, reply) => {
        const body = (request.body ?? {}) as { mapEnabled?: unknown };
        if (body.mapEnabled !== undefined && typeof body.mapEnabled !== 'boolean') {
            reply.status(400);
            return { error: 'mapEnabled 는 true/false 여야 합니다.' };
        }
        return setSettings({ mapEnabled: body.mapEnabled as boolean | undefined });
    });

    /** 목록은 검색어·지역·페이지로 좁힌다. 한 페이지 15개. */
    fastify.get('/admin/presales', { preHandler: requireAdmin }, async (request) => {
        const { q, sido, sggCd, page } = request.query as Record<string, string | undefined>;
        return listPresalesForAdmin({ q, sido, sggCd, page: page ? Number(page) : undefined });
    });

    fastify.get('/admin/apts', { preHandler: requireAdmin }, async (request) => {
        const { q, sido, sggCd, page } = request.query as Record<string, string | undefined>;
        return listAptsForAdmin({ q, sido, sggCd, page: page ? Number(page) : undefined });
    });

    /**
     * 검색 결과에 뜨는 제목·설명을 직접 쓴다. 빈 문자열로 보내면 지워지고
     * 자동 생성으로 돌아간다 — 잘못 쓴 걸 되돌릴 방법이 있어야 한다.
     */
    for (const [path, save] of [
        ['/admin/presales/:id/seo', setPresaleSeo],
        ['/admin/apts/:id/seo', setAptSeo],
    ] as const) {
        fastify.put(path, { preHandler: requireAdmin }, async (request, reply) => {
            const id = Number((request.params as { id: string }).id);
            if (!Number.isInteger(id) || id <= 0) {
                reply.status(400);
                return { error: 'id 가 올바르지 않습니다.' };
            }
            const body = (request.body ?? {}) as Record<string, unknown>;
            for (const k of ['seoTitle', 'seoDescription']) {
                const v = body[k];
                if (v !== undefined && v !== null && typeof v !== 'string') {
                    reply.status(400);
                    return { error: `${k} 는 문자열이어야 합니다.` };
                }
            }
            const ok = await save(id, {
                seoTitle: body.seoTitle as string | null | undefined,
                seoDescription: body.seoDescription as string | null | undefined,
            });
            if (!ok) {
                reply.status(404);
                return { error: '대상을 찾지 못했습니다.' };
            }
            return { ok: true };
        });
    }

    fastify.put('/admin/presales/:id/flags', { preHandler: requireAdmin }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const noticeId = Number(id);
        if (!Number.isInteger(noticeId) || noticeId <= 0) {
            reply.status(400);
            return { error: 'id 는 공고 번호(숫자)여야 합니다.' };
        }

        const body = (request.body ?? {}) as Record<string, unknown>;
        for (const k of ['isFeatured', 'isHidden']) {
            if (body[k] !== undefined && typeof body[k] !== 'boolean') {
                reply.status(400);
                return { error: `${k} 는 true/false 여야 합니다.` };
            }
        }
        if (body.sortWeight !== undefined && !Number.isFinite(Number(body.sortWeight))) {
            reply.status(400);
            return { error: 'sortWeight 는 숫자여야 합니다.' };
        }

        const ok = await setPresaleFlags(noticeId, {
            isFeatured: body.isFeatured as boolean | undefined,
            sortWeight: body.sortWeight === undefined ? undefined : Number(body.sortWeight),
            isHidden: body.isHidden as boolean | undefined,
        });
        if (!ok) {
            reply.status(404);
            return { error: '해당 공고를 찾지 못했습니다.' };
        }
        return { ok: true };
    });
}
