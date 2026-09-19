import Link from 'next/link';
export default function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-1.5">
                        <span className="text-xl font-extrabold text-indigo-700 tracking-tight">올댓부동산</span>
                    </Link>
                    <div className="flex items-center gap-6">
                        <nav className="flex items-center gap-6">
                            <a
                                href="#transactions"
                                className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
                            >
                                실거래가
                            </a>
                            <a
                                href="#presales"
                                className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
                            >
                                분양정보
                            </a>
                        </nav>
                        <div className="hidden sm:flex items-center gap-4">
                            <div className="w-px h-5 bg-slate-200" />
                            <a href="#" className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors">
                                로그인
                            </a>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1">{children}</main>

            <footer className="bg-slate-800 text-slate-400">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-8">
                        <div>
                            <p className="text-base font-bold text-white mb-1">올댓부동산</p>
                            <p className="text-sm">부동산 실거래가 및 분양 정보를 한눈에</p>
                        </div>
                        <div className="flex gap-12 text-sm">
                            <div className="space-y-2">
                                <p className="font-semibold text-white">소개</p>
                                <a href="#" className="block hover:text-white">회사소개</a>
                                <a href="#" className="block hover:text-white">채용</a>
                            </div>
                            <div className="space-y-2">
                                <p className="font-semibold text-white">문의</p>
                                <a href="#" className="block hover:text-white">고객센터</a>
                                <a href="#" className="block hover:text-white">광고/제휴</a>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 py-4">
                    <p className="text-center text-xs text-slate-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        © 2026 올댓부동산. All rights reserved. · 본 사이트의 데이터는 참고용이며 투자 판단의 근거로 사용할 수 없습니다.
                    </p>
                </div>
            </footer>
        </div>
    );
}
