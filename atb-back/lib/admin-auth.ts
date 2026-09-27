/**
 * 관리자 인증. 외부 라이브러리 없이 Node 내장 crypto 만 쓴다.
 *
 * 관리자는 한 명뿐이라 계정 테이블을 두지 않고 .env 에 비밀번호 해시를 둔다.
 *   ADMIN_PASSWORD_HASH = scrypt$<salt-hex>$<hash-hex>   (npm run hash-password 로 생성)
 *   ADMIN_SESSION_SECRET = 임의의 긴 문자열
 *
 * 세션은 서명된 쿠키 하나다. 서버에 세션 저장소를 두지 않으므로 재시작해도
 * 로그인이 유지되고, 반대로 즉시 강제 로그아웃이 필요하면 SECRET 을 바꾸면 된다.
 *
 * 이 파일은 사이트에서 유일하게 '쓰기 권한' 을 여는 곳이다. 로그인 경로 외에는
 * 전부 requireAdmin 을 지나야 한다.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const COOKIE = 'atb_admin';
const MAX_AGE_SEC = 60 * 60 * 12; // 12시간

/** 비밀번호 → 저장용 해시 문자열. scripts/hash-password.ts 에서 쓴다. */
export function hashPassword(password: string): string {
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [scheme, saltHex, hashHex] = (stored || '').split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    // 길이가 다르면 timingSafeEqual 이 던진다
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function secret(): string {
    const s = process.env.ADMIN_SESSION_SECRET;
    if (!s || s.length < 16) {
        throw new Error('ADMIN_SESSION_SECRET 가 없거나 너무 짧습니다 (16자 이상).');
    }
    return s;
}

function sign(payload: string): string {
    return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** exp(만료 epoch 초) 만 담는다. 담을 정보가 더 없다 — 관리자는 한 명이다. */
function createToken(): string {
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
    const payload = String(exp);
    return `${payload}.${sign(payload)}`;
}

function validToken(token: string | undefined): boolean {
    if (!token) return false;
    const [payload, mac] = token.split('.');
    if (!payload || !mac) return false;
    const expected = sign(payload);
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    return Number(payload) > Math.floor(Date.now() / 1000);
}

function readCookie(req: FastifyRequest, name: string): string | undefined {
    const raw = req.headers.cookie;
    if (!raw) return undefined;
    for (const part of raw.split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return undefined;
}

function setCookie(reply: FastifyReply, value: string, maxAge: number) {
    const bits = [
        `${COOKIE}=${encodeURIComponent(value)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${maxAge}`,
    ];
    // 배포(https)에서는 Secure 를 붙인다. 로컬 http 에서 붙이면 쿠키가 저장되지 않는다.
    if (process.env.NODE_ENV === 'production') bits.push('Secure');
    reply.header('Set-Cookie', bits.join('; '));
}

export function login(reply: FastifyReply) {
    setCookie(reply, createToken(), MAX_AGE_SEC);
}

export function logout(reply: FastifyReply) {
    setCookie(reply, '', 0);
}

export function isAdmin(req: FastifyRequest): boolean {
    return validToken(readCookie(req, COOKIE));
}

/** 라우트 앞에 preHandler 로 건다. 통과 못 하면 401 로 끊는다. */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
    if (!isAdmin(req)) {
        reply.status(401).send({ error: '로그인이 필요합니다.' });
    }
}
