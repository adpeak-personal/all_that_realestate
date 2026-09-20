'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PriceTrendChart from '../../components/PriceTrendChart';
import { PresaleCard, PresaleEmpty } from './presale/PresaleUI';
import { formatDate, formatPrice, formatYearMonth, toPyeong } from '../../lib/format';
import type {
  AptListRow,
  Deal,
  PresaleRow,
  PresaleSummary,
  RegionStat,
  RegionStatsResult,
  SiteSummary,
  TrendResult,
} from '../../service/main/type';

/** ±0.5% 미만은 '보합'. 0.1% 에 화살표를 달면 없는 방향성을 만들어낸다. */
const FLAT = 0.5;

/** 지도를 걷어낸 자리를 메우는 바로가기. 거래가 많아 실제로 많이 찾는 곳들. */
const QUICK_LINKS = [
  { label: '서울 강남구', sido: '서울', sggCd: '11680' },
  { label: '서울 송파구', sido: '서울', sggCd: '11710' },
  { label: '서울 노원구', sido: '서울', sggCd: '11350' },
  { label: '경기 성남분당구', sido: '경기', sggCd: '41135' },
  { label: '경기 화성동탄구', sido: '경기', sggCd: '41590' },
  { label: '인천 연수구', sido: '인천', sggCd: '28185' },
  { label: '부산 해운대구', sido: '부산', sggCd: '26350' },
];

function Trend({ value, className = '' }: { value: number | null; className?: string }) {
  if (value === null) return <span className={`text-slate-300 ${className}`}>–</span>;
  if (Math.abs(value) < FLAT)
    return <span className={`text-slate-400 ${className}`}>보합</span>;

  return (
    <span className={`${value > 0 ? 'text-up' : 'text-down'} ${className}`}>
      {value > 0 ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */

function Hero({ summary, baseMonth }: { summary?: SiteSummary; baseMonth: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  const period =
    summary?.firstMonth && summary?.lastMonth
      ? `${formatYearMonth(summary.firstMonth)} ~ ${formatYearMonth(summary.lastMonth)}`
      : null;

  return (
    <section className="bg-brand-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
          전국 아파트 실거래가
        </h1>
        <p className="text-brand-200 mt-3 text-base sm:text-lg">
          국토교통부 신고 자료로 보는 단지별 시세와 거래 이력
        </p>

        {/* 단지명 검색 — 지금까지 지역을 타고 들어가는 길밖에 없었다 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = q.trim();
            if (v) router.push(`/apt?q=${encodeURIComponent(v)}`);
          }}
          className="mt-7 flex gap-2 max-w-xl"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="단지명으로 찾기 — 예: 래미안, 자이, 헬리오시티"
            aria-label="단지명 검색"
            className="flex-1 min-w-0 rounded-xl px-4 py-3 text-slate-900 bg-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl px-5 sm:px-7 py-3 font-semibold bg-brand-500 hover:bg-brand-400 text-brand-900 transition-colors"
          >
            검색
          </button>
        </form>

        {/* 수집 현황 — 이 사이트가 무엇을 갖고 있는지 */}
        {summary && (
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {[
              { k: '실거래', v: `${summary.totalDeals.toLocaleString()}건` },
              { k: '단지', v: `${summary.totalApts.toLocaleString()}개` },
              { k: '지역', v: `${summary.totalSgg}개 시군구` },
              ...(period ? [{ k: '기간', v: period }] : []),
            ].map((it) => (
              <div key={it.k} className="flex items-baseline gap-2">
                <dt className="text-brand-300">{it.k}</dt>
                <dd className="font-semibold tabular-nums">{it.v}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-2">
          <span className="text-xs text-brand-300 mr-1">바로가기</span>
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.sggCd}
              href={`/apt?sido=${encodeURIComponent(l.sido)}&sggCd=${l.sggCd}`}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {baseMonth && (
          <p className="text-xs text-brand-300 mt-6">
            아래 통계는 {formatYearMonth(baseMonth)} 신고분 기준입니다.
          </p>
        )}
      </div>
    </section>
  );
}

/* ── 이번 달 요약 ─────────────────────────────────────────────────────────── */

function MonthlyKpi({ stats }: { stats?: RegionStatsResult }) {
  const items = stats?.items ?? [];
  if (items.length === 0) return null;

  const trades = items.reduce((s, r) => s + r.trades, 0);
  if (trades === 0) return null;

  const avgPrice = Math.round(items.reduce((s, r) => s + r.avgPrice * r.trades, 0) / trades);
  // `!== null` 은 undefined 를 통과시켜 NaN 을 만든다. 느슨한 비교로 둘 다 거른다.
  const withUnit = items.filter((r) => r.unitPrice != null);
  const unitWeight = withUnit.reduce((s, r) => s + r.trades, 0);
  const unitPrice = unitWeight
    ? Math.round(withUnit.reduce((s, r) => s + (r.unitPrice as number) * r.trades, 0) / unitWeight)
    : null;

  const withTrend = items.filter((r) => r.trend != null);
  const trendWeight = withTrend.reduce((s, r) => s + r.trades, 0);
  const trend = trendWeight
    ? Number(
        (
          withTrend.reduce((s, r) => s + (r.trend as number) * r.trades, 0) / trendWeight
        ).toFixed(1),
      )
    : null;

  const tiles = [
    { label: '거래 건수', value: trades.toLocaleString(), unit: '건' },
    { label: '평균 거래가', value: formatPrice(avgPrice), unit: '' },
    { label: '㎡당 평균', value: unitPrice ? unitPrice.toLocaleString() : '–', unit: '만원' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">{t.label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {t.value}
            {t.unit && <span className="text-base font-medium text-slate-400 ml-1">{t.unit}</span>}
          </p>
        </div>
      ))}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-sm text-slate-500">전월 대비</p>
        <p className="text-2xl sm:text-3xl font-bold mt-1.5 tabular-nums">
          <Trend value={trend} />
        </p>
        <p className="text-xs text-slate-400 mt-0.5">㎡당 단가 기준</p>
      </div>
    </div>
  );
}

/* ── 시도별 시세 ──────────────────────────────────────────────────────────── */

function RegionTable({ stats }: { stats?: RegionStatsResult }) {
  const items = [...(stats?.items ?? [])]
    .filter((r) => r.unitPrice != null)
    .sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0));

  if (items.length === 0) return null;
  const max = items[0].unitPrice ?? 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">시도별 ㎡당 시세</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          면적당 단가라 평형 구성에 흔들리지 않습니다. 지역을 누르면 단지 목록으로 갑니다.
        </p>
      </div>

      <ul className="divide-y divide-slate-100">
        {items.map((r: RegionStat) => (
          <li key={r.sido}>
            <Link
              href={`/apt?sido=${encodeURIComponent(r.sido)}`}
              className="flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-3 hover:bg-slate-50 transition-colors"
            >
              <span className="w-9 shrink-0 font-semibold text-slate-800">{r.sido}</span>

              {/* 막대 — 지역 간 크기 비교를 글자보다 먼저 읽히게 */}
              <span className="flex-1 min-w-[80px] hidden sm:block">
                <span
                  className="block h-2 rounded-full bg-brand-600"
                  style={{ width: `${Math.max(((r.unitPrice ?? 0) / max) * 100, 2)}%` }}
                />
              </span>

              <span className="w-[72px] text-right font-bold text-slate-900 tabular-nums">
                {r.unitPrice?.toLocaleString()}
                <span className="text-xs font-medium text-slate-400 ml-0.5">만</span>
              </span>
              <span className="w-20 text-right text-sm text-slate-500 tabular-nums hidden xl:block">
                {r.trades.toLocaleString()}건
              </span>
              <span className="w-[62px] text-right text-sm font-medium tabular-nums">
                <Trend value={r.trend} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── 거래 많은 단지 ───────────────────────────────────────────────────────── */

function PopularApts({ items }: { items: AptListRow[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">거래가 많은 단지</h2>
          <p className="text-sm text-slate-500 mt-0.5">최근 12개월 거래 건수 기준</p>
        </div>
        <Link href="/apt" className="text-sm font-semibold text-brand-700 hover:text-brand-600">
          전체 보기 →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((a, i) => (
          <Link
            key={a.id}
            href={`/apt/${a.id}`}
            className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-brand-400 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full tabular-nums">
                {i + 1}위
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                {a.dealCount.toLocaleString()}건
              </span>
            </div>
            <p className="font-semibold text-slate-800 truncate group-hover:text-brand-700 transition-colors">
              {a.aptNm}
            </p>
            <p className="text-sm text-slate-400 truncate mt-0.5">
              {a.sido} {a.sgg} {a.umdNm}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-3 tabular-nums">
              {a.lastDealAmount !== null ? formatPrice(a.lastDealAmount) : '–'}
            </p>
            <p className="text-xs text-slate-400 tabular-nums mt-0.5">
              ㎡당 {a.unitPrice?.toLocaleString()}만
              {a.households ? ` · ${a.households.toLocaleString()}세대` : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── 최근 실거래 ──────────────────────────────────────────────────────────── */

function RecentDeals({ items }: { items: Deal[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">최근 실거래</h2>
        <p className="text-sm text-slate-500 mt-0.5">지역별 가장 최근 신고분입니다</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {items.map((d) => {
            const row = (
              <>
                <span className="w-12 shrink-0 text-xs font-semibold text-brand-700 bg-brand-50 rounded-md py-1 text-center">
                  {d.sido}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-800 truncate">{d.aptNm}</span>
                  <span className="block text-xs text-slate-400 truncate mt-0.5">
                    {d.sgg} {d.umdNm} · {d.excluUseAr.toFixed(1)}㎡ {toPyeong(d.excluUseAr)}평
                    {d.floor !== null && ` · ${d.floor}층`}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block font-bold text-slate-900 tabular-nums">
                    {formatPrice(d.dealAmount)}
                  </span>
                  <span className="block text-xs text-slate-400 tabular-nums mt-0.5">
                    {formatDate(d.dealDate)}
                  </span>
                </span>
              </>
            );

            return (
              <li key={d.id}>
                {d.aptId ? (
                  <Link
                    href={`/apt/${d.aptId}`}
                    className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-slate-50 transition-colors"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 sm:px-6 py-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ── 분양정보 ─────────────────────────────────────────────────────────────── */

function PresaleSection({
  items,
  summary,
}: {
  items: PresaleRow[];
  summary?: PresaleSummary;
}) {
  return (
    <section className="bg-sale-50 border-y border-sale-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-bold text-sale-600">ALL THAT 분양</p>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              지금 청약 가능한 분양
            </h2>
            <p className="text-slate-500 mt-1.5">
              {summary && summary.total > 0
                ? `접수중 ${summary.open}건 · 접수예정 ${summary.upcoming}건`
                : '전국 아파트·오피스텔 분양 공고'}
            </p>
          </div>
          <Link
            href="/presale"
            className="rounded-xl px-5 py-2.5 font-semibold bg-sale-600 hover:bg-sale-700 text-white transition-colors"
          >
            분양정보 전체보기
          </Link>
        </div>

        {items.length === 0 ? (
          <PresaleEmpty compact />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((it) => (
              <PresaleCard key={it.id} item={it} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

interface ViewProps {
  summary?: SiteSummary;
  presales: PresaleRow[];
  presaleSummary?: PresaleSummary;
  stats?: RegionStatsResult;
  trend?: TrendResult;
  recent: Deal[];
  popular: AptListRow[];
}

export default function HomeView({
  summary,
  stats,
  trend,
  recent,
  popular,
  presales,
  presaleSummary,
}: ViewProps) {
  return (
    <div className="bg-slate-50">
      <Hero summary={summary} baseMonth={stats?.baseMonth ?? null} />

      <PresaleSection items={presales} summary={presaleSummary} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-10 sm:space-y-12">
        <MonthlyKpi stats={stats} />

        {/* 시도별 시세와 추이는 같은 '전국을 어떻게 볼 것인가' 를 다룬다 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <RegionTable stats={stats} />
          </div>
          <div className="lg:col-span-5">
              <PriceTrendChart
              items={trend?.items ?? []}
              title="전국 ㎡당 단가 추이"
              subtitle="최근 12개월. 거래가 없던 달은 선이 끊깁니다."
            />
          </div>
        </div>

        <PopularApts items={popular} />
        <RecentDeals items={recent} />
      </div>
    </div>
  );
}
