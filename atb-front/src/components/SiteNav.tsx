'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 사이트 메뉴. PC 는 헤더 우측(SiteNav), 모바일은 화면 하단 고정 탭(MobileTabBar).
 *
 * 로그인 버튼은 어느 크기에서나 헤더 우측에 있다.
 *
 * 모바일에서 메뉴를 하단에 두는 건 엄지가 닿는 위치이기 때문이다. 국내 부동산
 * 앱들도 같은 배치라 사용자가 익숙하고, 나중에 앱 웹뷰로 감쌀 때도 네이티브
 * 탭바처럼 보인다.
 *
 * 현재 위치는 PC 에선 헤더 바닥선에 붙는 막대, 모바일에선 아이콘·글자 색으로
 * 표시한다. 분양정보는 수익 영역이라 평소에도 따뜻한 색(sale)으로 구분한다.
 *
 * usePathname 이 필요해 이 부분만 클라이언트 컴포넌트다.
 */

type IconProps = { className?: string };

const svgBase = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** 분양 — 새로 올라가는 건물 */
function IconPresale({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className}>
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
      <path d="M15 9h4a1 1 0 0 1 1 1v11" />
      <path d="M3 21h18" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </svg>
  );
}

/** 시세 — 상승 추세선 */
function IconTrend({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className}>
      <path d="M4 20h16" />
      <path d="M5 15l4-4 3 3 6-6" />
      <path d="M15 8h3v3" />
    </svg>
  );
}

/** 단지 찾기 — 돋보기 */
function IconSearch({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  );
}

/** 마이페이지 — 사람 */
function IconUser({ className }: IconProps) {
  return (
    <svg {...svgBase} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c1.4-3.3 4.2-5 7.5-5s6.1 1.7 7.5 5" />
    </svg>
  );
}

const MENU = [
  { href: '/presale', label: '분양정보', sale: true, Icon: IconPresale },
  { href: '/', label: '지역별 시세', sale: false, Icon: IconTrend },
  { href: '/apt', label: '단지 찾기', sale: false, Icon: IconSearch },
] as const;

function isActive(pathname: string, href: string): boolean {
  // '/' 는 정확히 일치할 때만. 그렇지 않으면 모든 페이지에서 켜진다.
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 헤더 우측. 메뉴는 md 이상에서만 보이고, 로그인 버튼은 모든 크기에서 보인다. */
export default function SiteNav() {
  const pathname = usePathname() ?? '/';
  const onLogin = pathname === '/login';

  return (
    <div className="flex items-center gap-6 self-stretch">
      {/* 메뉴는 PC 에서만. 모바일은 하단 탭이 대신하고, 로그인 버튼만 남는다. */}
      <nav aria-label="주 메뉴" className="hidden md:flex items-stretch gap-6 self-stretch">
        {MENU.map((m) => {
          const active = isActive(pathname, m.href);
          const color = m.sale
            ? 'text-sale-700 hover:text-sale-600'
            : active
              ? 'text-brand-800'
              : 'text-slate-600 hover:text-brand-700';
          return (
            <Link
              key={m.href}
              href={m.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center text-sm whitespace-nowrap transition-colors ${color} ${
                active || m.sale ? 'font-bold' : 'font-medium'
              }`}
            >
              {m.label}
              {active && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-0 h-[3px] rounded-t-full ${
                    m.sale ? 'bg-sale-600' : 'bg-brand-600'
                  }`}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {!onLogin && (
        <Link
          href="/login"
          className="shrink-0 rounded-full border border-slate-300 px-3.5 md:px-4 py-1.5 text-[13px] md:text-sm font-semibold text-slate-700 hover:border-brand-600 hover:text-brand-700 transition-colors"
        >
          로그인
        </Link>
      )}
    </div>
  );
}

/**
 * 모바일 하단 고정 탭. md 이상에서는 숨는다.
 * 아이폰 홈 인디케이터에 가리지 않도록 safe-area 만큼 아래 여백을 더한다
 * (루트 viewport 에 viewportFit: 'cover' 가 있어야 env() 값이 들어온다).
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? '/';
  const tabs = [
    ...MENU,
    { href: '/my', label: '마이페이지', sale: false, Icon: IconUser },
  ];

  return (
    <nav
      aria-label="주 메뉴"
      className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4 h-16">
        {tabs.map(({ href, label, sale, Icon }) => {
          const active = isActive(pathname, href);
          const color = active
            ? sale
              ? 'text-sale-700'
              : 'text-brand-700'
            : 'text-slate-500';
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-colors ${color} ${
                  active ? 'font-bold' : 'font-medium'
                }`}
              >
                <Icon className={active ? 'stroke-[2.2]' : ''} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
