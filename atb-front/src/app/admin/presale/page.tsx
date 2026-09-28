'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminGate from '../AdminGate';
import { adminApi, type AdminPresaleRow } from '../AdminApi';

/**
 * 분양 공고 노출 제어.
 *
 * 수집 데이터는 손대지 않는다. 광고 상품이 붙는 세 가지만 바꾼다:
 *   추천(메인 노출) · 가중치(정렬 순서) · 숨김
 * 목록 API 는 숨김 공고를 빼고 주기 때문에, 여기서는 관리자용으로 숨김도 함께
 * 볼 수 있어야 한다 — 숨긴 공고를 다시 찾을 방법이 없으면 되돌릴 수 없다.
 */
function Control() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminPresaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async (keyword: string) => {
    setLoading(true);
    setError(null);
    try {
      const { items: rows } = await adminApi.presales(keyword);
      setItems(rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() 가 곧바로 setLoading(true) 를 하므로 한 틱 미룬다
    // (effect 본문에서 동기적으로 state 를 바꾸지 않기 위해)
    const t = setTimeout(() => load(''), 0);
    return () => clearTimeout(t);
  }, [load]);

  const patch = async (
    item: AdminPresaleRow,
    change: { isFeatured?: boolean; sortWeight?: number; isHidden?: boolean },
  ) => {
    setSavingId(item.id);
    try {
      await adminApi.presaleFlags(item.id, change);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, ...change } : it)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bold text-slate-900">분양 노출 제어</h1>
        <p className="mt-1 text-sm text-slate-500">
          추천을 켜면 메인과 목록 맨 위에 올라갑니다. 가중치가 클수록 앞에 옵니다.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="단지명으로 찾기"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          검색
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">공고가 없습니다.</p>
      ) : (
        <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-800 truncate">
                  {it.houseNm}
                </span>
                <span className="block text-xs text-slate-400 truncate">
                  {[it.sido, it.sgg].filter(Boolean).join(' ')}
                  {it.houseType ? ` · ${it.houseType}` : ''}
                  {it.rceptBgnde ? ` · 접수 ${it.rceptBgnde}` : ''}
                </span>
              </span>

              <button
                type="button"
                onClick={() => patch(it, { isFeatured: !it.isFeatured })}
                disabled={savingId === it.id}
                className={`rounded-md px-2.5 py-1 text-xs font-bold disabled:opacity-50 ${
                  it.isFeatured
                    ? 'bg-sale-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                추천
              </button>

              <label className="flex items-center gap-1 text-xs text-slate-500">
                가중치
                <input
                  type="number"
                  defaultValue={it.sortWeight}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== it.sortWeight) {
                      patch(it, { sortWeight: v });
                    }
                  }}
                  className="w-16 rounded border border-slate-300 px-1.5 py-1 text-right tabular-nums"
                />
              </label>

              <button
                type="button"
                onClick={() => patch(it, { isHidden: !it.isHidden })}
                disabled={savingId === it.id}
                className={`rounded-md px-2.5 py-1 text-xs font-bold disabled:opacity-50 ${
                  it.isHidden
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {it.isHidden ? '숨김' : '노출'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminPresalePage() {
  return (
    <AdminGate>
      <Control />
    </AdminGate>
  );
}
