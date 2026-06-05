'use client';

import { useState } from 'react';

interface AptTradeItem {
  aptNm: string;
  aptDong: string | number;
  umdNm: string;
  excluUseAr: number;
  floor: number;
  dealAmount: string;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  buildYear: number;
  dealingGbn: string;
  buyerGbn: string;
  slerGbn: string;
}

interface ApiResult {
  items: AptTradeItem[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
}

interface NaverImage {
  pageUrl: string;
  imageUrl: string;
  domain: string;
}

interface ImageModal {
  aptNm: string;
  query: string;
  images: NaverImage[];
  loading: boolean;
  error: string | null;
}

const SGG_OPTIONS = [
  { code: '11680', name: '서울 강남구' },
  { code: '11650', name: '서울 서초구' },
  { code: '11710', name: '서울 송파구' },
  { code: '11440', name: '서울 마포구' },
  { code: '11110', name: '서울 종로구' },
  { code: '11140', name: '서울 중구' },
];

function formatPrice(raw: string): string {
  const n = parseInt(raw.replace(/,/g, ''), 10);
  if (isNaN(n)) return raw;
  if (n >= 10000) {
    const eok = Math.floor(n / 10000);
    const rem = n % 10000;
    return rem === 0 ? `${eok}억` : `${eok}억 ${rem.toLocaleString()}만`;
  }
  return `${n.toLocaleString()}만`;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}


export default function AptTradePage() {
  const [lawdCd, setLawdCd] = useState('11680');
  const [dealYmd, setDealYmd] = useState(currentYearMonth());
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const [modal, setModal] = useState<ImageModal | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    setSyncMsg(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/apt/trades?lawdCd=${lawdCd}&dealYmd=${dealYmd}&numOfRows=100`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '조회 실패');
      setResult(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function syncToDB() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(
        `/api/apt/sync?lawdCd=${lawdCd}&dealYmd=${dealYmd}`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '저장 실패');
      setSyncMsg(`저장 완료 — ${json.saved}건 신규 저장`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function openImages(item: AptTradeItem) {
    const q = `${item.aptNm} ${item.umdNm} 아파트`;
    setModal({ aptNm: item.aptNm, query: q, images: [], loading: true, error: null });

    try {
      const res = await fetch(`/api/naver/images?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '이미지 검색 실패');
      setModal(prev => prev && ({
        ...prev,
        images: json.items ?? [],
        loading: false,
      }));
    } catch (e) {
      setModal(prev => prev && ({ ...prev, loading: false, error: String(e) }));
    }
  }

  const sggName = SGG_OPTIONS.find(o => o.code === lawdCd)?.name ?? lawdCd;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">아파트 실거래가 조회</h1>
        <p className="text-sm text-slate-500 mt-1">
          국토교통부 실거래가 API에서 데이터를 가져와 미리 확인합니다
        </p>
      </div>

      {/* Search form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <label className="text-xs font-semibold text-slate-600">지역</label>
          <select
            value={lawdCd}
            onChange={e => setLawdCd(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SGG_OPTIONS.map(o => (
              <option key={o.code} value={o.code}>{o.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600">계약년월 (YYYYMM)</label>
          <input
            type="text"
            value={dealYmd}
            onChange={e => setDealYmd(e.target.value)}
            placeholder="예: 202506"
            maxLength={6}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '조회중...' : '조회'}
        </button>

        {result && result.items.length > 0 && (
          <button
            onClick={syncToDB}
            disabled={syncing}
            className="px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {syncing ? '저장중...' : 'DB에 저장'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          오류: {error}
        </div>
      )}
      {syncMsg && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
          {syncMsg}
        </div>
      )}

      {/* Results table */}
      {result && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-base font-bold text-slate-800">
              {sggName} · {dealYmd.slice(0, 4)}년 {dealYmd.slice(4)}월
            </h2>
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium">
              총 {result.totalCount.toLocaleString()}건
            </span>
            <span className="text-xs text-slate-400">(이번 페이지 {result.items.length}건)</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">아파트명</th>
                    <th className="text-left px-4 py-3">동/읍면동</th>
                    <th className="text-right px-4 py-3">전용면적</th>
                    <th className="text-right px-4 py-3">층</th>
                    <th className="text-right px-4 py-3 text-indigo-600">거래금액</th>
                    <th className="text-center px-4 py-3">거래일</th>
                    <th className="text-center px-4 py-3">건축년도</th>
                    <th className="text-center px-4 py-3">거래유형</th>
                    <th className="text-center px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.aptNm}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {item.umdNm}
                        {item.aptDong ? <span className="ml-1 text-slate-400">{item.aptDong}동</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.excluUseAr}㎡</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.floor}층</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">
                        {formatPrice(item.dealAmount)}원
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">
                        {item.dealYear}.{String(item.dealMonth).padStart(2, '0')}.{String(item.dealDay).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400 text-xs">{item.buildYear}</td>
                      <td className="px-4 py-3 text-center">
                        {item.dealingGbn ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            item.dealingGbn === '중개거래'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            {item.dealingGbn}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openImages(item)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium whitespace-nowrap"
                        >
                          이미지
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && !error && !result && (
        <div className="text-center py-24 text-slate-400">
          <p className="text-4xl mb-4">🏢</p>
          <p className="text-base font-medium text-slate-500">
            지역과 계약년월을 선택하고 조회 버튼을 눌러주세요
          </p>
        </div>
      )}

      {/* Image modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">{modal.aptNm}</h3>
                <p className="text-xs text-slate-400 mt-0.5">검색어: {modal.query}</p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-light leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6">
              {modal.loading && (
                <div className="text-center py-12 text-slate-400">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">이미지 검색 중...</p>
                </div>
              )}

              {modal.error && (
                <div className="text-center py-10 text-red-500 text-sm">
                  {modal.error}
                </div>
              )}

              {!modal.loading && !modal.error && modal.images.length === 0 && (
                <p className="text-center py-10 text-slate-400 text-sm">검색 결과가 없습니다</p>
              )}

              {!modal.loading && modal.images.length > 0 && (
                <div className="grid grid-cols-5 gap-3">
                  {modal.images.map((img, i) => (
                    <a
                      key={i}
                      href={img.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block aspect-square overflow-hidden rounded-xl bg-slate-100 border border-slate-200 hover:border-indigo-400 transition-colors"
                      title={img.domain}
                    >
                      <img
                        src={img.imageUrl}
                        alt={`${modal.aptNm} ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).src =
                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f1f5f9" width="100" height="100"/%3E%3Ctext x="50" y="55" font-size="20" text-anchor="middle" fill="%23cbd5e1"%3E🏢%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
