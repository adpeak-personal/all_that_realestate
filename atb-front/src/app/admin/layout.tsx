import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * 어드민 레이아웃. 사이트 본체 레이아웃((app) 그룹)과 떼어 둔다 —
 * 헤더·하단탭·푸터가 관리 화면에 따라올 이유가 없고, 섞이면 실수로 관리 기능이
 * 일반 화면에 노출되기도 쉽다.
 */
export const metadata: Metadata = {
  title: '관리자',
  robots: { index: false, follow: false },   // 검색에 절대 노출되면 안 된다
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-bold tracking-tight">
            올댓부동산 <span className="text-slate-400 font-medium">관리자</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="hover:text-brand-300">대시보드</Link>
            <Link href="/admin/presale" className="hover:text-brand-300">분양 노출</Link>
            <Link href="/" className="text-slate-400 hover:text-white">사이트 →</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
