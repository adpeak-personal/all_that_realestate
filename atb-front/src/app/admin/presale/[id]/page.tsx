'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminGate from '../../AdminGate';
import LandingEditor from './LandingEditor';
import { adminApi, type AdminPresaleDetail, type LandingBlock } from '../../AdminApi';

/**
 * 분양 한 건의 편집 화면. 검색 문구와 랜딩 구성을 함께 다룬다.
 *
 * 저장은 사용자가 누를 때만 한다(자동 저장 없음). 광고 페이지를 만지는 중에
 * 절반쯤 만든 상태가 공개되면 곤란하기 때문이다.
 */
function Editor({ id }: { id: number }) {
  const [data, setData] = useState<AdminPresaleDetail | null>(null);
  const [blocks, setBlocks] = useState<LandingBlock[]>([]);
  const [seo, setSeo] = useState({ seoTitle: '', seoDescription: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    adminApi
      .presale(id)
      .then((d) => {
        setData(d);
        setBlocks(d.landing);
        setSeo({ seoTitle: d.seoTitle ?? '', seoDescription: d.seoDescription ?? '' });
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // 문구와 랜딩을 한 번에 저장한다 — 사용자는 '저장' 을 한 번 눌렀을 뿐이다
      await Promise.all([adminApi.presaleSeo(id, seo), adminApi.presaleLanding(id, blocks)]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">불러오는 중…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/admin/presale" className="text-xs text-slate-500 hover:underline">
            ← 분양 목록
          </Link>
          <h1 className="truncate font-bold text-slate-900">{data.houseNm}</h1>
          <p className="text-xs text-slate-400">{[data.sido, data.sgg].filter(Boolean).join(' ')}</p>
        </div>
        <Link
          href={`/presale/${id}`}
          target="_blank"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          페이지 보기 ↗
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : saved ? '저장됨' : '저장'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-900">검색 문구</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          비우면 자동으로 만들어집니다. 접수중인 공고는 자동 제목에 분양가·모델하우스·할인정보가 들어갑니다.
        </p>
        <input
          value={seo.seoTitle}
          onChange={(e) => setSeo({ ...seo, seoTitle: e.target.value })}
          placeholder="검색 제목"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          value={seo.seoDescription}
          onChange={(e) => setSeo({ ...seo, seoDescription: e.target.value })}
          rows={2}
          placeholder="검색 설명"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </section>

      <section>
        <h2 className="font-bold text-slate-900">랜딩 구성</h2>
        <p className="mt-0.5 mb-2 text-xs text-slate-500">
          여기에 넣은 블록이 분양 상세 페이지 위쪽에 순서대로 나옵니다. 비워두면 기본 화면만 나옵니다.
        </p>
        <LandingEditor value={blocks} onChange={setBlocks} />
      </section>
    </div>
  );
}

export default function AdminPresaleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminGate>
      <Editor id={Number(id)} />
    </AdminGate>
  );
}
