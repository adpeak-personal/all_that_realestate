import Link from 'next/link';
import LogoMark from '../../components/LogoMark';
import SiteNav from '../../components/SiteNav';

/**
 * 헤더/푸터.
 *
 * 없는 기능은 걸어두지 않는다. 회사소개·채용 같은 자리만 잡은 링크는
 * 눌러도 아무 일이 없어 신뢰를 깎는다. (로그인은 페이지가 있고, 카카오 키가
 * 들어오기 전까지는 그 페이지에서 '준비 중'임을 밝힌다.) 대신 푸터에는 데이터 출처를 적는다 —
 * 실거래가 사이트에서 출처 표기가 그 어떤 회사소개보다 신뢰에 가깝다.
 */
export default function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-2 shrink-0">
                        {/* aria-hidden 이다 — 바로 옆 워드마크를 두 번 읽지 않게 */}
                        <LogoMark size={28} className="text-brand-900" />
                        <span className="sr-only min-[400px]:not-sr-only text-lg sm:text-xl font-extrabold text-brand-700 tracking-tight">
                            올댓부동산
                        </span>
                    </Link>
                    <SiteNav />
                </div>
            </header>

            <main className="flex-1">{children}</main>

            <footer className="bg-slate-800 text-slate-400 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="flex flex-col sm:flex-row justify-between gap-8">
                        <div>
                            <p className="flex items-center gap-2 text-base font-bold text-white mb-1">
                                <LogoMark size={22} className="text-white" />
                                올댓부동산
                            </p>
                            <p className="text-sm">전국 아파트 실거래가와 지역별 시세</p>
                        </div>

                        <div className="text-sm space-y-2 sm:text-right">
                            <p className="font-semibold text-white">데이터 출처</p>
                            <p>국토교통부 아파트 매매 실거래가</p>
                            <p>공동주택관리정보시스템(K-apt) 단지 정보</p>
                            <p>한국부동산원 청약홈 분양정보</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 py-4">
                    <p className="text-center text-xs text-slate-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 leading-relaxed">
                        © 2026 올댓부동산 · 실거래가는 신고 기준이며 해제·정정으로 달라질 수 있습니다.
                        본 사이트의 정보는 참고용이며 투자 판단의 근거로 사용할 수 없습니다.
                    </p>
                </div>
            </footer>
        </div>
    );
}
