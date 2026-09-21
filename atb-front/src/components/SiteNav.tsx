'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 헤더 메뉴 + 로그인 버튼.
 *
 * 현재 위치는 글자색만 바꾸면 잘 안 보여서 헤더 바닥선에 붙는 막대로 표시한다.
 * 분양정보는 사이트의 수익 영역이라 평소에도 따뜻한 색(sale)으로 구분하고,
 * 선택 막대도 같은 색을 쓴다.
 *
 * usePathname 이 필요해 이 부분만 클라이언트 컴포넌트다. 레이아웃 전체를
 * 'use client' 로 바꾸지 않으려고 따로 뺐다.
 */
const MENU = [
  { href: '/presale', label: '분양정보', sale: true },
  { href: '/', label: '지역별 시세', sale: false },
  { href: '/apt', label: '단지 찾기', sale: false },
] as const;

function isActive(pathname: string, href: string): boolean {
  // '/' 는 정확히 일치할 때만. 그렇지 않으면 모든 페이지에서 켜진다.
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNav() {
  const pathname = usePathname() ?? '/';
  const onLogin = pathname === '/login';

  return (
    <div className="flex items-center gap-3 sm:gap-6 self-stretch">
      <nav aria-label="주 메뉴" className="flex items-stretch gap-3 sm:gap-6 self-stretch">
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
              className={`relative flex items-center text-[13px] sm:text-sm whitespace-nowrap transition-colors ${color} ${
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
          className="shrink-0 rounded-full border border-slate-300 px-3 sm:px-4 py-1.5 text-[13px] sm:text-sm font-semibold text-slate-700 hover:border-brand-600 hover:text-brand-700 transition-colors"
        >
          로그인
        </Link>
      )}
    </div>
  );
}
