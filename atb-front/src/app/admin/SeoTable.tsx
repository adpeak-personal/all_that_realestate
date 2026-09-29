'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SIDO_LIST } from '../../lib/apt-sort';

/**
 * 어드민 목록 + 검색 제목·설명 편집.
 *
 * 분양과 단지가 화면 구조가 같아서 한 컴포넌트로 쓴다. 다른 것은 '무엇을 보여줄지'
 * (row 렌더)와 어느 API 를 부를지뿐이다.
 *
 * 제목·설명을 비우면 저장할 때 지워지고 자동 생성으로 돌아간다 — 잘못 쓴 문구를
 * 되돌릴 방법이 있어야 한다. 그래서 '자동' 상태와 '직접 쓴' 상태를 눈에 띄게 구분한다.
 */
export interface SeoRow {
  id: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export default function SeoTable<T extends SeoRow>({
  title,
  hint,
  load,
  save,
  hrefOf,
  renderRow,
}: {
  title: string;
  hint: string;
  load: (params: { q: string; sido: string; page: number }) => Promise<ListResult<T>>;
  save: (id: number, patch: { seoTitle: string; seoDescription: string }) => Promise<unknown>;
  hrefOf: (row: T) => string;
  /** 왼쪽에 보여줄 내용 (이름·지역 등) */
  renderRow: (row: T) => React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [sido, setSido] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResult<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 편집 중인 행. 한 번에 하나만 연다 — 여러 개를 동시에 고치다 저장을 빠뜨리기 쉽다.
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ seoTitle: '', seoDescription: '' });
  const [saving, setSaving] = useState(false);

  const fetchList = useCallback(
    async (params: { q: string; sido: string; page: number }) => {
      setLoading(true);
      setError(null);
      try {
        setData(await load(params));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  useEffect(() => {
    const t = setTimeout(() => fetchList({ q, sido, page }), 0);
    return () => clearTimeout(t);
  }, [fetchList, q, sido, page]);

  const startEdit = (row: T) => {
    setOpenId(row.id);
    setDraft({ seoTitle: row.seoTitle ?? '', seoDescription: row.seoDescription ?? '' });
  };

  const submit = async (row: T) => {
    setSaving(true);
    try {
      await save(row.id, draft);
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) =>
                it.id === row.id
                  ? {
                      ...it,
                      seoTitle: draft.seoTitle.trim() || null,
                      seoDescription: draft.seoDescription.trim() || null,
                    }
                  : it,
              ),
            }
          : prev,
      );
      setOpenId(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = data ? Math.max(Math.ceil(data.total / data.size), 1) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      </div>

      {/* 검색 · 지역 */}
      <div className="flex flex-wrap gap-2">
        <input
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              setQ((e.target as HTMLInputElement).value);
            }
          }}
          placeholder="이름으로 찾기 (엔터)"
          className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
        />
        <select
          value={sido}
          onChange={(e) => {
            setPage(1);
            setSido(e.target.value);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">전체 지역</option>
          {SIDO_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">불러오는 중…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-slate-500">결과가 없습니다.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            총 {data.total.toLocaleString()}건 · {data.page}/{totalPages} 페이지
          </p>

          <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {data.items.map((row) => {
              const editing = openId === row.id;
              const custom = row.seoTitle || row.seoDescription;
              return (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1">{renderRow(row)}</span>

                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                        custom ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {custom ? '직접 작성' : '자동'}
                    </span>

                    <Link
                      href={hrefOf(row)}
                      target="_blank"
                      className="shrink-0 text-xs text-slate-500 hover:text-slate-900 hover:underline"
                    >
                      페이지 ↗
                    </Link>

                    <button
                      type="button"
                      onClick={() => (editing ? setOpenId(null) : startEdit(row))}
                      className="shrink-0 rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      {editing ? '닫기' : '제목 수정'}
                    </button>
                  </div>

                  {editing && (
                    <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">
                          검색 제목 <span className="font-normal">({draft.seoTitle.length}자)</span>
                        </span>
                        <input
                          value={draft.seoTitle}
                          onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })}
                          placeholder="비워두면 자동으로 만듭니다"
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">
                          검색 설명{' '}
                          <span className="font-normal">({draft.seoDescription.length}자)</span>
                        </span>
                        <textarea
                          value={draft.seoDescription}
                          onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })}
                          rows={3}
                          placeholder="비워두면 자동으로 만듭니다"
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                        />
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => submit(row)}
                          disabled={saving}
                          className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          {saving ? '저장 중…' : '저장'}
                        </button>
                        <span className="text-xs text-slate-400">
                          비워서 저장하면 자동 생성으로 돌아갑니다
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-sm text-slate-500 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
