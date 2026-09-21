import type { Metadata } from 'next';
import Link from 'next/link';
import LogoMark from '../../../components/LogoMark';

export const metadata: Metadata = {
  title: '로그인',
  // 검색 결과에 로그인 페이지가 뜰 이유가 없다
  robots: { index: false, follow: true },
  alternates: { canonical: '/login' },
};

/**
 * 카카오 로그인이 실제로 동작하는지.
 * 카카오 개발자센터 앱(REST 키)과 백엔드 인증 라우트가 붙으면 true 로 바꾼다.
 * 그 전까지 버튼을 눌러도 아무 일이 없으면 고장처럼 보이므로, 비활성으로 두고
 * 준비 중이라고 밝힌다.
 */
const KAKAO_READY = false;

/** 카카오 말풍선 심볼. 카카오 로그인 디자인 가이드의 형태를 따른다. */
function KakaoSymbol() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#000000"
        d="M9 1.5C4.58 1.5 1 4.28 1 7.71c0 2.22 1.5 4.17 3.75 5.27l-.95 3.5c-.08.3.26.54.52.37l4.13-2.73c.18.02.36.02.55.02 4.42 0 8-2.78 8-6.21S13.42 1.5 9 1.5z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="bg-slate-50 py-12 sm:py-20 px-4">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid md:grid-cols-2">
        {/* 브랜드 면 — 좁은 화면에서는 로그인 버튼이 먼저 보이도록 숨긴다 */}
        <div className="hidden md:flex flex-col justify-between bg-brand-900 p-10 text-white">
          <div className="flex items-center gap-2">
            <LogoMark size={32} className="text-white" />
            <span className="text-xl font-extrabold tracking-tight">올댓부동산</span>
          </div>

          <div>
            <p className="text-2xl font-bold leading-snug">
              분양 소식부터 실거래가까지,
              <br />
              내 집 마련에 필요한 정보를
              <br />
              한곳에서.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-brand-100">
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-brand-300">·</span>
                청약 접수중·예정 분양 공고
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-brand-300">·</span>
                전국 아파트 실거래가와 시세 추이
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-brand-300">·</span>
                단지별 교통·학군·편의시설
              </li>
            </ul>
          </div>

          <p className="text-xs text-brand-200">국토교통부 · 한국부동산원 · K-apt 공공데이터 기반</p>
        </div>

        {/* 로그인 면 */}
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <div className="md:hidden mb-6 flex justify-center">
            <LogoMark size={44} className="text-brand-900" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 text-center md:text-left">로그인</h1>
          <p className="mt-2 text-sm text-slate-500 text-center md:text-left">
            카카오 계정으로 간편하게 시작하세요.
            <br />
            별도 회원가입 절차가 없습니다.
          </p>

          <button
            type="button"
            disabled={!KAKAO_READY}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] text-[15px] font-semibold text-black/85 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
          >
            <KakaoSymbol />
            카카오 로그인
          </button>

          {!KAKAO_READY && (
            <p role="status" className="mt-3 text-center text-xs text-slate-500">
              카카오 로그인은 곧 열립니다.
            </p>
          )}

          <div className="mt-10 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-500">로그인하지 않아도 모든 정보를 볼 수 있어요.</p>
            <div className="mt-3 flex justify-center gap-4 text-sm font-semibold">
              <Link href="/presale" className="text-sale-700 hover:text-sale-600">
                분양정보 보기
              </Link>
              <span aria-hidden="true" className="text-slate-300">|</span>
              <Link href="/apt" className="text-brand-700 hover:text-brand-600">
                단지 찾기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
