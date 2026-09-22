import Link from 'next/link';
import { formatPrice, presalePriceLabel } from '../../../lib/format';
import type { PresaleRow, PresaleStatus } from '../../../service/main/type';

/** 분양 영역 공용 조각. 목록·상세·메인 섹션이 같은 표기를 쓰게 모아 둔다. */

export const STATUS_META: Record<
  PresaleStatus,
  { label: string; className: string }
> = {
  open: { label: '접수중', className: 'bg-sale-600 text-white' },
  upcoming: { label: '접수예정', className: 'bg-sale-100 text-sale-700' },
  closed: { label: '접수마감', className: 'bg-slate-100 text-slate-500' },
  unknown: { label: '일정미정', className: 'bg-slate-100 text-slate-400' },
};

export function StatusBadge({ status }: { status: PresaleStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${m.className}`}>
      {m.label}
    </span>
  );
}

/** 'YYYYMM' → '2028년 6월' */
export function formatMoveIn(ym: string | null): string | null {
  if (!ym || ym.length !== 6) return null;
  return `${ym.slice(0, 4)}년 ${Number(ym.slice(4, 6))}월`;
}

/** 'YYYY-MM-DD' → '9.24' (연도는 접수 일정에선 대개 군더더기다) */
export function shortDate(d: string | null): string | null {
  if (!d) return null;
  return `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;
}

/** 접수 종료까지 남은 일수. 접수중이 아닐 땐 null. */
export function daysLeft(status: PresaleStatus, endde: string | null): number | null {
  if (status !== 'open' || !endde) return null;
  const end = new Date(`${endde}T23:59:59`);
  const diff = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  return diff >= 0 ? diff : null;
}

export function priceRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min !== max) {
    return `${formatPrice(min)} ~ ${formatPrice(max)}`;
  }
  return formatPrice((min ?? max) as number);
}

export function PresaleCard({ item }: { item: PresaleRow }) {
  const left = daysLeft(item.status, item.rceptEndde);
  const price = priceRange(item.minAmount, item.maxAmount);
  const moveIn = formatMoveIn(item.moveinYm);

  return (
    <Link
      href={`/presale/${item.id}`}
      className="flex flex-col bg-white rounded-2xl border border-slate-200 p-5 hover:border-sale-500 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-2 mb-3">
        <StatusBadge status={item.status} />
        {left !== null && (
          <span className="text-xs font-bold text-sale-600">
            {left === 0 ? '오늘 마감' : `D-${left}`}
          </span>
        )}
        {item.houseType && (
          <span className="text-xs text-slate-400 ml-auto">{item.houseType}</span>
        )}
      </div>

      <h3 className="font-bold text-lg text-slate-900 leading-snug group-hover:text-sale-700 transition-colors">
        {item.houseNm}
      </h3>
      <p className="text-sm text-slate-500 mt-1 truncate">
        {[item.sido, item.sgg].filter(Boolean).join(' ')}
        {item.totalHouseholds ? ` · ${item.totalHouseholds.toLocaleString()}세대` : ''}
      </p>

      <dl className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-sm">
        {price && (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 shrink-0">{presalePriceLabel(item.houseType)}</dt>
            <dd className="font-bold text-slate-900 text-right tabular-nums">{price}</dd>
          </div>
        )}
        {(item.rceptBgnde || item.rceptEndde) && (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 shrink-0">청약접수</dt>
            <dd className="text-slate-700 text-right tabular-nums">
              {shortDate(item.rceptBgnde) ?? '?'} ~ {shortDate(item.rceptEndde) ?? '?'}
            </dd>
          </div>
        )}
        {moveIn && (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 shrink-0">입주예정</dt>
            <dd className="text-slate-700 text-right">{moveIn}</dd>
          </div>
        )}
      </dl>
    </Link>
  );
}

/** 수집 전에도 화면이 비어 보이지 않게 — 무엇이 준비 중인지 말해 준다. */
export function PresaleEmpty({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`text-center bg-white rounded-2xl border border-dashed border-slate-200 ${
        compact ? 'py-10' : 'py-20'
      }`}
    >
      <p className="text-slate-600 font-medium">등록된 분양 공고가 없습니다</p>
      <p className="text-sm text-slate-400 mt-1.5">
        청약홈 분양정보 연동 후 이곳에 표시됩니다
      </p>
    </div>
  );
}
