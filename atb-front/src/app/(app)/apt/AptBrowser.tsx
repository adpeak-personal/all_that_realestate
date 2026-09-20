'use client';

/**
 * 지역 선택 / 정렬 / 페이징 컨트롤.
 *
 * 상태를 URL 쿼리로 둔다. 서버에서 그대로 렌더되니 크롤러가 지역별 목록을
 * 읽을 수 있고, 링크를 그대로 공유·북마크할 수 있다.
 */

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { AptSort, SggBreakdownItem } from '../../../service/main/type';
import { SIDO_LIST, SORT_LABELS } from '../../../lib/apt-sort';

function useNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  /** 일부 값만 바꾼 URL 로 이동. page 는 필터가 바뀌면 1로 되돌린다. */
  return (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (resetPage && !('page' in patch)) next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };
}

/** 1단계 — 시도 */
export function SidoTabs({ selected }: { selected: string }) {
  const go = useNavigate();

  return (
    <div className="flex flex-wrap gap-1.5">
      {SIDO_LIST.map((s) => {
        const on = s === selected;
        return (
          <button
            key={s}
            onClick={() => go({ sido: s, sggCd: null })}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              on
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

/** 2단계 — 시군구 */
export function SggChips({
  items,
  selected,
}: {
  items: SggBreakdownItem[];
  selected: string | null;
}) {
  const go = useNavigate();
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => go({ sggCd: null })}
        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
          selected === null
            ? 'bg-slate-800 text-white'
            : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'
        }`}
      >
        전체
      </button>
      {items.map((it) => {
        const on = it.code === selected;
        return (
          <button
            key={it.code}
            onClick={() => go({ sggCd: it.code })}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              on
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'
            }`}
          >
            {it.sgg}
            <span className={`ml-1.5 text-xs ${on ? 'text-slate-300' : 'text-slate-400'}`}>
              {it.deals.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 정렬 */
export function SortSelect({ value }: { value: AptSort }) {
  const go = useNavigate();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500 shrink-0">정렬</span>
      <select
        value={value}
        onChange={(e) => go({ sort: e.target.value })}
        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
      >
        {SORT_LABELS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * 페이징 — 현재 페이지 주변만 보여준다 (79페이지를 다 그릴 수는 없다).
 *
 * href 생성기를 서버에서 prop 으로 받지 않는다. 함수는 클라이언트 컴포넌트에
 * 직렬화해 넘길 수 없다. 현재 쿼리에서 page 만 바꿔 직접 만든다.
 */
export function Pager({ page, totalPages }: { page: number; totalPages: number }) {
  const pathname = usePathname();
  const params = useSearchParams();

  const makeHref = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p > 1) next.set('page', String(p));
    else next.delete('page');
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  if (totalPages <= 1) return null;

  const from = Math.max(1, Math.min(page - 2, totalPages - 4));
  const to = Math.min(totalPages, from + 4);
  const nums = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  const box =
    'min-w-[34px] h-[34px] px-2 flex items-center justify-center rounded-md text-sm border transition-colors';

  return (
    <nav className="flex items-center justify-center gap-1.5 flex-wrap" aria-label="페이지">
      {page > 1 && (
        <Link href={makeHref(page - 1)} className={`${box} border-slate-200 hover:bg-slate-50`}>
          이전
        </Link>
      )}
      {from > 1 && (
        <>
          <Link href={makeHref(1)} className={`${box} border-slate-200 hover:bg-slate-50`}>
            1
          </Link>
          <span className="text-slate-300 px-1">…</span>
        </>
      )}
      {nums.map((n) => (
        <Link
          key={n}
          href={makeHref(n)}
          aria-current={n === page ? 'page' : undefined}
          className={`${box} ${
            n === page
              ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
              : 'border-slate-200 hover:bg-slate-50'
          }`}
        >
          {n}
        </Link>
      ))}
      {to < totalPages && (
        <>
          <span className="text-slate-300 px-1">…</span>
          <Link href={makeHref(totalPages)} className={`${box} border-slate-200 hover:bg-slate-50`}>
            {totalPages}
          </Link>
        </>
      )}
      {page < totalPages && (
        <Link href={makeHref(page + 1)} className={`${box} border-slate-200 hover:bg-slate-50`}>
          다음
        </Link>
      )}
    </nav>
  );
}
