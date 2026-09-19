'use client';

/**
 * 월별 ㎡당 평균 단가 추이 (단일 시리즈 선형 차트).
 *
 * 설계 메모
 *  - 값은 '㎡당 단가'다. 평균 거래금액은 그 달에 큰 평형이 많이 거래되면 같이
 *    오르기 때문에 시세 추이로 읽으면 오해를 부른다.
 *  - 거래건수는 두 번째 y축으로 그리지 않는다(이중 축 금지). 툴팁과 표로 준다.
 *  - 거래가 없던 달은 선을 끊는다. 직선으로 이으면 없는 시세를 지어내는 셈이다.
 *  - 값은 툴팁에만 있지 않다 — 끝점 직접 라벨 + 표 보기로도 닿는다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TrendPoint } from '../service/main/type';

const SERIES = '#4F46E5'; // indigo-600 — 대비/명도 검증 통과
const GRID = '#e2e8f0';   // slate-200, 표면에서 한 단계
const SURFACE = '#ffffff';

const PAD = { top: 16, right: 56, bottom: 28, left: 52 };
const HEIGHT = 240;

interface Props {
  items: TrendPoint[];
  /** 차트가 무엇을 그리는지 — 단일 시리즈라 범례 대신 제목이 계열을 설명한다 */
  title: string;
  subtitle?: string;
  loading?: boolean;
}

/** 축에 쓸 깔끔한 눈금 (1/2/5 × 10^n 간격). */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min];
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;

  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) out.push(Math.round(v));
  return out;
}

function ymLabel(ym: string): string {
  const m = Number(ym.slice(4, 6));
  return m === 1 ? `${ym.slice(2, 4)}.${m}` : `${m}월`;
}

export default function PriceTrendChart({ items, title, subtitle, loading }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  // viewBox 로 늘리면 글자까지 같이 늘어난다. 실제 폭을 재서 px 로 그린다.
  //
  // 이 div 는 로딩/표보기 분기 밖에서는 마운트되지 않는다. useEffect([]) 로 잡으면
  // 첫 렌더(로딩 중)에 ref 가 null 이라 그냥 빠져나가고 다시 실행되지 않아서,
  // 데이터가 도착해 차트가 붙어도 폭이 초기값에 머문다. 콜백 ref 로 붙인다.
  const roRef = useRef<ResizeObserver | null>(null);
  const attachWrap = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    wrapRef.current = el;
    if (!el) return;

    // 붙는 즉시 한 번 직접 잰다. ResizeObserver 의 첫 콜백은 환경에 따라
    // 늦거나(백그라운드 탭·렌더 스로틀링) 건너뛸 수 있어서, 그것만 믿으면
    // 차트가 초기 폭에 머물러 카드 밖으로 삐져나간다.
    const w = el.getBoundingClientRect().width;
    if (w > 0) setWidth(Math.max(w, 280));

    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(entry.contentRect.width, 280));
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);

  useEffect(() => () => roRef.current?.disconnect(), []);

  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const { values, yMin, yMax, ticks } = useMemo(() => {
    const vals = items.map((d) => d.unitPrice).filter((v): v is number => v !== null);
    if (vals.length === 0) {
      return { values: [] as number[], yMin: 0, yMax: 1, ticks: [] as number[] };
    }
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    // 위아래 여유를 줘서 선이 축에 붙지 않게
    const pad = (hi - lo || hi * 0.1) * 0.25;
    const t = niceTicks(lo - pad, hi + pad);
    return {
      values: vals,
      yMin: Math.min(lo - pad, t[0]),
      yMax: Math.max(hi + pad, t[t.length - 1]),
      ticks: t,
    };
  }, [items]);

  const x = useCallback(
    (i: number) => (items.length <= 1 ? plotW / 2 : (i / (items.length - 1)) * plotW),
    [items.length, plotW],
  );
  const y = useCallback(
    (v: number) => plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH,
    [plotH, yMin, yMax],
  );

  /** 거래 없는 달에서 끊어진 구간들 */
  const segments = useMemo(() => {
    const segs: Array<Array<{ i: number; v: number }>> = [];
    let cur: Array<{ i: number; v: number }> = [];
    items.forEach((d, i) => {
      if (d.unitPrice === null) {
        if (cur.length) segs.push(cur);
        cur = [];
      } else {
        cur.push({ i, v: d.unitPrice });
      }
    });
    if (cur.length) segs.push(cur);
    return segs;
  }, [items]);

  // useMemo + 조기 return 조합은 React Compiler 가 메모이제이션을 보존하지 못한다.
  // 컴파일러가 알아서 메모이즈하므로 평범한 식으로 둔다.
  const lastIdx = items.reduce((acc, d, i) => (d.unitPrice !== null ? i : acc), -1);
  const lastPoint =
    lastIdx >= 0 ? { i: lastIdx, v: items[lastIdx].unitPrice as number } : null;

  // 라벨은 오른쪽 끝(최신월)에서부터 역방향으로 뽑는다.
  // 앞에서부터 건너뛰면서 마지막만 강제로 그리면 끝 두 개가 붙어버린다.
  const labelStep = plotW / items.length < 44 ? 2 : 1;
  const labelIdx = new Set<number>();
  for (let i = items.length - 1; i >= 0; i -= labelStep) labelIdx.add(i);

  const hasData = values.length > 0;
  const active = hover !== null ? items[hover] : null;

  function pointerToIndex(clientX: number) {
    const el = wrapRef.current;
    if (!el || items.length === 0) return null;
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left - PAD.left;
    const idx = Math.round((px / plotW) * (items.length - 1));
    return Math.min(Math.max(idx, 0), items.length - 1);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-md px-2.5 py-1 shrink-0"
          aria-pressed={showTable}
        >
          {showTable ? '차트로' : '표로'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-16">불러오는 중…</p>
      ) : !hasData ? (
        <p className="text-sm text-slate-400 text-center py-16">
          추이를 그릴 거래 데이터가 없습니다
        </p>
      ) : showTable ? (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="text-left font-medium py-2">월</th>
                <th className="text-right font-medium py-2">㎡당 단가</th>
                <th className="text-right font-medium py-2">거래건수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {items.map((d) => (
                <tr key={d.ym}>
                  <td className="py-2 text-slate-600">
                    {d.ym.slice(0, 4)}.{d.ym.slice(4, 6)}
                  </td>
                  <td className="py-2 text-right font-medium text-slate-800">
                    {d.unitPrice === null ? '–' : `${d.unitPrice.toLocaleString()}만`}
                  </td>
                  <td className="py-2 text-right text-slate-500">
                    {d.trades.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={attachWrap} className="relative mt-3">
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${title}. ${items[0]?.ym.slice(0, 4)}년부터 ${items.length}개월간 ㎡당 평균 단가 추이. 표로 보기 버튼으로 수치를 확인할 수 있습니다.`}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
            tabIndex={0}
            onPointerMove={(e) => setHover(pointerToIndex(e.clientX))}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(items.length - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                setHover((h) => {
                  const base = h ?? items.length - 1;
                  const next = e.key === 'ArrowLeft' ? base - 1 : base + 1;
                  return Math.min(Math.max(next, 0), items.length - 1);
                });
              }
            }}
          >
            <g transform={`translate(${PAD.left},${PAD.top})`}>
              {/* 눈금선 — 실선 헤어라인, 표면에서 한 단계 */}
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                  <text
                    x={-10}
                    y={y(t)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-slate-400 tabular-nums"
                    fontSize={11}
                  >
                    {t.toLocaleString()}
                  </text>
                </g>
              ))}

              {/* 면 채움 — 단일 시리즈라 10% 워시 */}
              {segments.map((seg, si) =>
                seg.length < 2 ? null : (
                  <path
                    key={`a${si}`}
                    d={
                      `M ${x(seg[0].i)} ${plotH} ` +
                      seg.map((p) => `L ${x(p.i)} ${y(p.v)}`).join(' ') +
                      ` L ${x(seg[seg.length - 1].i)} ${plotH} Z`
                    }
                    fill={SERIES}
                    opacity={0.1}
                  />
                ),
              )}

              {/* 선 — 2px, 둥근 캡/조인 */}
              {segments.map((seg, si) => (
                <path
                  key={`l${si}`}
                  d={seg.map((p, k) => `${k ? 'L' : 'M'} ${x(p.i)} ${y(p.v)}`).join(' ')}
                  fill="none"
                  stroke={SERIES}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* 끊긴 구간을 보이게: 한 점짜리 구간은 점으로 */}
              {segments
                .filter((seg) => seg.length === 1)
                .map((seg) => (
                  <circle
                    key={`p${seg[0].i}`}
                    cx={x(seg[0].i)}
                    cy={y(seg[0].v)}
                    r={4}
                    fill={SERIES}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />
                ))}

              {/* x축 라벨 — 좁으면 건너뛴다 */}
              {items.map((d, i) => {
                if (!labelIdx.has(i)) return null;
                return (
                  <text
                    key={d.ym}
                    x={x(i)}
                    y={plotH + 18}
                    textAnchor="middle"
                    className="fill-slate-400 tabular-nums"
                    fontSize={11}
                  >
                    {ymLabel(d.ym)}
                  </text>
                );
              })}

              {/* 크로스헤어 */}
              {active && (
                <line
                  x1={x(hover as number)}
                  x2={x(hover as number)}
                  y1={0}
                  y2={plotH}
                  stroke={GRID}
                  strokeWidth={1}
                />
              )}
              {active && active.unitPrice !== null && (
                <circle
                  cx={x(hover as number)}
                  cy={y(active.unitPrice)}
                  r={4.5}
                  fill={SERIES}
                  stroke={SURFACE}
                  strokeWidth={2}
                />
              )}

              {/* 끝점 마커 + 직접 라벨 (값이 툴팁에만 갇히지 않게) */}
              {lastPoint && (
                <>
                  <circle
                    cx={x(lastPoint.i)}
                    cy={y(lastPoint.v)}
                    r={4.5}
                    fill={SERIES}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />
                  <text
                    x={x(lastPoint.i) + 10}
                    y={y(lastPoint.v)}
                    dominantBaseline="middle"
                    className="fill-slate-700 tabular-nums"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {lastPoint.v.toLocaleString()}
                  </text>
                </>
              )}
            </g>
          </svg>

          {/* 툴팁 — 값이 먼저, 이름이 뒤 */}
          {active && (
            <div
              className="pointer-events-none absolute bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs"
              style={{
                left: Math.min(
                  Math.max(PAD.left + x(hover as number) - 60, 0),
                  Math.max(width - 130, 0),
                ),
                top: 0,
              }}
            >
              <p className="text-slate-500 mb-1">
                {active.ym.slice(0, 4)}년 {Number(active.ym.slice(4, 6))}월
              </p>
              {active.unitPrice === null ? (
                <p className="text-slate-400">거래 없음</p>
              ) : (
                <>
                  <p className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-3 h-0.5 rounded-full"
                      style={{ background: SERIES }}
                    />
                    <span className="font-bold text-slate-900 tabular-nums">
                      {active.unitPrice.toLocaleString()}만
                    </span>
                    <span className="text-slate-400">/㎡</span>
                  </p>
                  <p className="text-slate-500 mt-0.5 tabular-nums">
                    거래 {active.trades.toLocaleString()}건
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
