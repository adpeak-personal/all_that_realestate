/**
 * 사이트 기준 주소.
 *
 * `process.env.SITE_URL ?? 기본값` 으로 쓰면 안 된다. ?? 는 undefined·null 만
 * 걸러내서, 환경변수가 **빈 문자열**이면 그대로 통과한다. 도커 빌드에서 값을 안 넣은
 * build-arg 가 빈 문자열로 들어와 new URL('') 가 터졌고, 빌드 전체가 실패했다.
 * (Invalid URL / Failed to collect page data for /_not-found)
 *
 * 그래서 비었는지 직접 보고, 끝의 슬래시도 여기서 한 번만 떼어 준다.
 */
const FALLBACK = 'http://localhost:4000';

export function siteUrl(): string {
  const raw = (process.env.SITE_URL ?? '').trim();
  const base = raw.length > 0 ? raw : FALLBACK;
  return base.replace(/\/+$/, '');
}
