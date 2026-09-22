import type { Metadata } from 'next';
import Link from 'next/link';
import { PresaleCard, PresaleEmpty } from './PresaleUI';
import { fetchPresales, fetchPresaleSummary } from '../../../service/server/api';
import type { PresaleStatus } from '../../../service/main/type';

const SIZE = 12;
const STATUS_TABS: Array<{ value: PresaleStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'open', label: '접수중' },
  { value: 'upcoming', label: '접수예정' },
  { value: 'closed', label: '마감' },
];
const VALID_STATUS = new Set(['open', 'upcoming', 'closed']);

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * 보여줄 페이지 번호. 공고가 수천 건이라 전부 늘어놓으면 번호가 수백 개가 된다.
 * 처음·끝과 현재 주변 2칸만 두고 사이는 null(…)로 비운다.
 * 예: page 7 / 505 → [1, null, 5, 6, 7, 8, 9, null, 505]
 */
function pageWindow(page: number, total: number): Array<number | null> {
  const set = new Set<number>([1, total]);
  for (let n = page - 2; n <= page + 2; n++) if (n >= 1 && n <= total) set.add(n);
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(n - sorted[i - 1] === 2 ? n - 1 : null);
    out.push(n);
  });
  return out;
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function readParams(searchParams: Props['searchParams']) {
  const sp = await searchParams;
  const st = one(sp.status);
  return {
    status: (VALID_STATUS.has(st ?? '') ? st : undefined) as PresaleStatus | undefined,
    sido: one(sp.sido) || undefined,
    page: Math.max(Number(one(sp.page)) || 1, 1),
  };
}

export const metadata: Metadata = {
  title: '분양정보',
  description:
    '전국 아파트·오피스텔 분양 공고를 접수 일정과 분양가로 한눈에. 청약 접수중·예정 단지 정보.',
  alternates: { canonical: '/presale' },
};

export default async function PresaleListPage({ searchParams }: Props) {
  const { status, sido, page } = await readParams(searchParams);

  const [summary, result] = await Promise.all([
    fetchPresaleSummary(),
    fetchPresales({ status, sido, page, size: SIZE }),
  ]);

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / SIZE), 1);

  const href = (patch: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged = { status, sido, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, String(v));
    const s = qs.toString();
    return s ? `/presale?${s}` : '/presale';
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* 분양은 실거래와 성격이 달라 자체 헤더를 둔다 — 미니 사이트처럼 */}
      <section className="bg-sale-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <p className="text-sale-100 font-semibold text-sm">ALL THAT 분양</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">분양정보</h1>
          <p className="text-sale-100/80 mt-3">
            전국 아파트·오피스텔 분양 공고를 접수 일정과 분양가로 한눈에
          </p>

          {summary && summary.total > 0 && (
            <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div className="flex items-baseline gap-2">
                <dt className="text-sale-100/70">접수중</dt>
                <dd className="font-bold text-xl tabular-nums">{summary.open}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-sale-100/70">접수예정</dt>
                <dd className="font-bold text-xl tabular-nums">{summary.upcoming}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-sale-100/70">전체 공고</dt>
                <dd className="font-bold text-xl tabular-nums">{summary.total}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* 상태 탭 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((t) => {
              const on = (t.value === 'all' && !status) || t.value === status;
              return (
                <Link
                  key={t.value}
                  href={href({ status: t.value === 'all' ? undefined : t.value, page: undefined })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    on
                      ? 'bg-sale-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-sale-500 hover:text-sale-700'
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
          {total > 0 && (
            <p className="text-sm text-slate-500">
              총 <span className="font-bold text-slate-900">{total.toLocaleString()}</span>건
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <PresaleEmpty />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((it) => (
              <PresaleCard key={it.id} item={it} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="flex justify-center gap-1.5 mt-8" aria-label="페이지">
            {pageWindow(page, totalPages).map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} aria-hidden="true" className="px-1 self-center text-slate-400">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={href({ page: n > 1 ? String(n) : undefined })}
                  aria-current={n === page ? 'page' : undefined}
                  className={`min-w-[34px] h-[34px] px-2 flex items-center justify-center rounded-md text-sm border tabular-nums ${
                    n === page
                      ? 'bg-sale-600 text-white border-sale-600 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {n}
                </Link>
              ),
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
