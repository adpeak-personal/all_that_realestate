import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "../service/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
