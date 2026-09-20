/**
 * OG 이미지(Satori)용 한글 폰트 로더.
 *
 * ImageResponse 는 Satori 로 그리는데, 폰트를 직접 넣지 않으면 한글이 전부
 * 네모로 깨진다. 전체 한글 폰트는 수 MB 라 번들하기 부담스러워서, 구글 폰트의
 * 서브셋 기능(text= 파라미터)으로 '그 이미지에 실제로 쓰이는 글자'만 받는다.
 * 단지명 하나 기준 1만 바이트 안쪽이다.
 *
 * 주의: Satori 는 woff2 를 못 읽는다. User-Agent 를 보내지 않으면 구글이
 * truetype 로 응답하므로 그대로 쓴다.
 */

const CSS_ENDPOINT = 'https://fonts.googleapis.com/css2';

/** 하루 캐시. 같은 글자 조합이면 재요청하지 않는다. */
const REVALIDATE = 60 * 60 * 24;

/** 중복 글자를 제거해 URL 길이를 줄인다. */
function uniqueChars(text: string): string {
  return [...new Set(text.replace(/\s+/g, ' '))].join('');
}

export async function loadKoreanFont(
  text: string,
  weight: 400 | 600 | 700,
): Promise<ArrayBuffer | null> {
  const chars = uniqueChars(text);
  if (!chars) return null;

  try {
    const cssUrl =
      `${CSS_ENDPOINT}?family=Noto+Sans+KR:wght@${weight}` +
      `&text=${encodeURIComponent(chars)}`;

    const css = await fetch(cssUrl, { next: { revalidate: REVALIDATE } }).then((r) =>
      r.ok ? r.text() : '',
    );

    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/);
    if (!match) return null;

    const res = await fetch(match[1], { next: { revalidate: REVALIDATE } });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    // 폰트를 못 받으면 호출측이 이미지 생성을 건너뛴다 (깨진 글자를 내보내지 않는다).
    return null;
  }
}
