/**
 * 올댓부동산 마크 — 넓은 지붕의 집 + 상승선.
 *
 * 인라인 SVG 로 둔다. 로고는 모든 페이지에 뜨는데 <img> 로 두면 매번 요청이
 * 하나 더 생기고, 색을 상황(밝은 헤더 / 어두운 푸터)에 맞춰 바꾸기도 어렵다.
 * 집은 currentColor 를 따르고 상승선만 브랜드 액센트로 고정한다.
 */
export default function LogoMark({
  size = 28,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
    >
      <path d="M32 13 L54 28 V53 H10 V28 Z" fill="currentColor" />
      <path
        d="M19 45 L28 35 L36 42 L47 29"
        fill="none"
        stroke="#00A892"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
