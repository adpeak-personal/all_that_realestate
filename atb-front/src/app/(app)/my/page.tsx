import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '마이페이지',
  robots: { index: false, follow: true },
};

/**
 * 마이페이지.
 *
 * 아직 로그인이 붙지 않아 항상 '로그인 전' 상태를 보여준다. 로그인 후에 쓸
 * 항목들은 자리를 보여주되, 누르면 로그인 페이지로 보낸다 — 눌러도 반응이
 * 없는 버튼을 두지 않기 위해서다.
 */
const ITEMS = [
  { label: '관심 분양', desc: '찜한 분양 공고와 청약 일정', sale: true },
  { label: '관심 단지', desc: '저장한 단지의 새 실거래 소식', sale: false },
  { label: '알림 설정', desc: '청약 D-1 · 신규 분양 공고 알림', sale: false },
];

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function MyPage() {
  return (
    <div className="bg-slate-50 min-h-full">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <h1 className="text-xl font-bold text-slate-900">마이페이지</h1>

        {/* 로그인 유도 카드 */}
        <section className="mt-5 rounded-2xl bg-brand-900 p-6 text-white">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4.5 20c1.4-3.3 4.2-5 7.5-5s6.1 1.7 7.5 5" />
              </svg>
            </span>
            <div>
              <p className="text-lg font-bold">로그인이 필요해요</p>
              <p className="mt-0.5 text-sm text-brand-100">
                관심 분양을 모아보고 청약 일정을 놓치지 마세요.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="mt-5 flex h-11 items-center justify-center rounded-xl bg-white text-sm font-bold text-brand-800 hover:bg-brand-50 transition-colors"
          >
            로그인하기
          </Link>
        </section>

        {/* 로그인 후 이용할 항목 */}
        <ul className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {ITEMS.map((it) => (
            <li key={it.label}>
              <Link
                href="/login"
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <span>
                  <span className={`block font-semibold ${it.sale ? 'text-sale-700' : 'text-slate-800'}`}>
                    {it.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-500">{it.desc}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                  로그인 후 이용
                  <Chevron />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
