import type { Metadata, Viewport } from "next";
// Pretendard 동적 서브셋 — 한글 폰트 전체(2MB+)를 받지 않고 페이지에 쓰인
// 글자가 속한 구간 파일만 받는다. npm 패키지에서 가져와 번들되므로 외부 CDN
// 없이 우리 서버에서 서빙된다. (SIL OFL 1.1 — 상업 이용 가능)
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import QueryProvider from "../service/QueryProvider";

// viewportFit: cover — 아이폰 노치·홈 인디케이터 영역까지 그리고,
// 모바일 하단 탭이 env(safe-area-inset-bottom) 로 그만큼 비켜 앉는다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  // alternates.canonical 과 og:url 이 절대 URL 로 나가려면 기준이 필요하다.
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:6060"),
  title: {
    default: "올댓부동산 - 전국 아파트 실거래가·시세",
    // 하위 페이지가 title 을 주면 뒤에 사이트명이 붙는다 (3만 개 중복 title 방지)
    template: "%s | 올댓부동산",
  },
  description: "전국 아파트 매매 실거래가와 지역별 시세 추이를 확인하세요",
  openGraph: {
    siteName: "올댓부동산",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
