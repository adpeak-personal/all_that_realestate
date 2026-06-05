'use client';

import { useState, useEffect } from 'react';
import KoreaMap from '../../components/KoreaMap';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TxType = '아파트' | '오피스텔' | '빌라';
type TxFilter = '전체' | TxType;
type PresaleStatus = 'ongoing' | 'upcoming' | 'scheduled';

interface Transaction {
  id: number;
  region: string;
  district: string;
  name: string;
  type: TxType;
  area: number;
  floor: number;
  price: number; // 만원
  date: string;
}

interface Presale {
  id: number;
  name: string;
  region: string;
  district: string;
  type: TxType;
  units: number;
  minPrice: number; // 만원
  maxPrice: number;
  moveIn: string;
  status: PresaleStatus;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 1, region: '서울', district: '강남구', name: '래미안 퍼스티지', type: '아파트', area: 84.9, floor: 15, price: 270000, date: '2026-05' },
  { id: 2, region: '서울', district: '서초구', name: '아크로리버파크', type: '아파트', area: 59.9, floor: 8, price: 195000, date: '2026-05' },
  { id: 3, region: '서울', district: '마포구', name: '마포래미안푸르지오', type: '아파트', area: 84.6, floor: 12, price: 135000, date: '2026-05' },
  { id: 4, region: '서울', district: '송파구', name: '헬리오시티', type: '아파트', area: 84.9, floor: 20, price: 180000, date: '2026-05' },
  { id: 5, region: '경기', district: '성남시 분당구', name: '파크뷰자이', type: '아파트', area: 114.9, floor: 10, price: 120000, date: '2026-05' },
  { id: 6, region: '경기', district: '수원시 영통구', name: '광교중흥S클래스', type: '아파트', area: 84.9, floor: 7, price: 80000, date: '2026-04' },
  { id: 7, region: '인천', district: '서구', name: '더샵 아르테', type: '아파트', area: 84.9, floor: 3, price: 55000, date: '2026-04' },
  { id: 8, region: '부산', district: '해운대구', name: '두산위브 더제니스', type: '아파트', area: 120.1, floor: 35, price: 95000, date: '2026-04' },
];

const MOCK_PRESALES: Presale[] = [
  { id: 1, name: '올림픽파크 포레온', region: '서울', district: '강동구', type: '아파트', units: 4786, minPrice: 120000, maxPrice: 185000, moveIn: '2026-12', status: 'upcoming' },
  { id: 2, name: '힐스테이트 청라 센트럴', region: '인천', district: '서구 청라동', type: '아파트', units: 1200, minPrice: 40000, maxPrice: 65000, moveIn: '2027-03', status: 'ongoing' },
  { id: 3, name: '래미안 원펜타스', region: '서울', district: '서초구', type: '아파트', units: 641, minPrice: 200000, maxPrice: 350000, moveIn: '2027-06', status: 'upcoming' },
  { id: 4, name: '디에이치 방배', region: '서울', district: '서초구 방배동', type: '아파트', units: 3080, minPrice: 150000, maxPrice: 250000, moveIn: '2027-09', status: 'upcoming' },
  { id: 5, name: '광교 자연앤힐스테이트', region: '경기', district: '수원시 영통구', type: '아파트', units: 850, minPrice: 55000, maxPrice: 85000, moveIn: '2027-12', status: 'ongoing' },
  { id: 6, name: '검단 신도시 AA13블록', region: '인천', district: '서구 검단신도시', type: '아파트', units: 1050, minPrice: 35000, maxPrice: 52000, moveIn: '2028-03', status: 'scheduled' },
];

const REGION_STATS: Record<string, { avgPrice: number; trades: number; trend: number }> = {
  '서울': { avgPrice: 105000, trades: 234, trend: 2.3 },
  '경기': { avgPrice: 48000, trades: 412, trend: 1.5 },
  '인천': { avgPrice: 35000, trades: 186, trend: 0.8 },
  '부산': { avgPrice: 52000, trades: 203, trend: 3.1 },
  '대구': { avgPrice: 38000, trades: 145, trend: -0.5 },
  '광주': { avgPrice: 28000, trades: 98, trend: 1.2 },
  '대전': { avgPrice: 31000, trades: 112, trend: 0.9 },
  '울산': { avgPrice: 29000, trades: 87, trend: -1.1 },
  '세종': { avgPrice: 42000, trades: 65, trend: 2.8 },
  '충북': { avgPrice: 22000, trades: 134, trend: 0.4 },
  '충남': { avgPrice: 20000, trades: 156, trend: 0.6 },
  '전북': { avgPrice: 18000, trades: 112, trend: -0.3 },
  '전남': { avgPrice: 16000, trades: 89, trend: 0.2 },
  '경북': { avgPrice: 21000, trades: 167, trend: 0.1 },
  '경남': { avgPrice: 25000, trades: 198, trend: 0.7 },
  '강원': { avgPrice: 24000, trades: 143, trend: 1.4 },
  '제주': { avgPrice: 45000, trades: 78, trend: 2.0 },
};

const STATUS_LABEL: Record<PresaleStatus, string> = {
  ongoing: '분양중',
  upcoming: '분양예정',
  scheduled: '일정확정',
};

const STATUS_COLOR: Record<PresaleStatus, string> = {
  ongoing: 'bg-red-100 text-red-700',
  upcoming: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-slate-100 text-slate-600',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toShortName(rawName: string): string {
  let n = rawName
    .replace('특별자치도', '')
    .replace('특별자치시', '')
    .replace('광역시', '')
    .replace('특별시', '')
    .replace(/도$/, '');
  const overrides: Record<string, string> = {
    '충청북': '충북', '충청남': '충남',
    '전라북': '전북', '전라남': '전남',
    '경상북': '경북', '경상남': '경남',
    '강원특별자치': '강원', '전북특별자치': '전북',
  };
  return overrides[n] ?? n;
}

function formatPrice(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const rem = manwon % 10000;
    return rem === 0 ? `${eok}억` : `${eok}억 ${rem.toLocaleString()}만`;
  }
  return `${manwon.toLocaleString()}만`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function StatBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{unit}</p>
    </div>
  );
}

function FeatureItem({ label, desc, disabled }: { label: string; desc: string; disabled?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 ${disabled ? 'opacity-40' : ''}`}>
      <CheckIcon className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-slate-800">
          {label}
          {disabled && <span className="text-xs font-normal text-slate-400 ml-1">(준비중)</span>}
        </p>
        <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function TransactionCard({ tx }: { tx: Transaction }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
          {tx.type}
        </span>
        <span className="text-xs text-slate-400">{tx.district}</span>
      </div>
      <p className="font-semibold text-slate-800 text-base leading-snug mb-1 truncate group-hover:text-indigo-600 transition-colors">{tx.name}</p>
      <p className="text-sm text-slate-500 mb-3">
        {tx.area}㎡ · {tx.floor}층
      </p>
      <p className="text-2xl font-bold text-indigo-600">{formatPrice(tx.price)}</p>
      <p className="text-xs text-slate-400 mt-1">
        {tx.date.replace('-', '.')} 거래
      </p>
    </div>
  );
}

function PresaleCard({ ps }: { ps: Presale }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer group">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[ps.status]}`}>
          {STATUS_LABEL[ps.status]}
        </span>
        <span className="text-xs text-slate-400">{ps.type}</span>
      </div>
      <h3 className="font-bold text-slate-900 text-lg mb-1 group-hover:text-indigo-600 transition-colors">{ps.name}</h3>
      <p className="text-sm text-slate-500 mb-4">
        {ps.region} {ps.district}
      </p>
      <dl className="space-y-2 text-sm border-t border-slate-100 pt-4">
        <div className="flex justify-between">
          <dt className="text-slate-500">세대수</dt>
          <dd className="font-medium text-slate-800">{ps.units.toLocaleString()}세대</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">분양가</dt>
          <dd className="font-medium text-slate-800 text-right">
            {formatPrice(ps.minPrice)} ~<br />{formatPrice(ps.maxPrice)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">입주예정</dt>
          <dd className="font-medium text-slate-800">
            {ps.moveIn.replace('-', '. ')}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<TxFilter>('전체');
  const [mapPaddingX, setMapPaddingX] = useState(120); // 기본값 (SSR)

  useEffect(() => {
    const update = () => setMapPaddingX(window.innerWidth < 1024 ? 30 : 120);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const shortSelected = selectedRegion ? toShortName(selectedRegion) : null;
  const regionStats = shortSelected ? (REGION_STATS[shortSelected] ?? null) : null;

  const filteredTx = MOCK_TRANSACTIONS.filter(
    (tx) =>
      (txFilter === '전체' || tx.type === txFilter) &&
      (!shortSelected || tx.region === shortSelected),
  );

  const regionTx = shortSelected
    ? MOCK_TRANSACTIONS.filter((tx) => tx.region === shortSelected)
    : [];

  return (
    <div className="bg-slate-50">
      {/* ── Hero / Map ── */}
      <section className="py-10 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">지역별 부동산 현황</h1>
            <p className="text-slate-500 text-base mt-2">
              지도에서 지역을 선택해 실거래가·분양 정보를 확인하세요
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Map */}
            <div className="w-full lg:w-[56%] bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <KoreaMap
                onSelect={setSelectedRegion}
                selected={selectedRegion}
                selectedColor="#4F46E5"
                height={480}
                paddingX={mapPaddingX}
                paddingY={0}
              />
            </div>

            {/* Info Panel */}
            <div className="w-full lg:w-[44%] space-y-4">
              {shortSelected && regionStats ? (
                <>
                  {/* Region stats */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
                      선택된 지역
                    </p>
                    <h2 className="text-3xl font-bold text-slate-900 mb-5">{shortSelected}</h2>
                    <div className="grid grid-cols-3 gap-3">
                      <StatBox
                        label="최근 거래"
                        value={regionStats.trades.toLocaleString()}
                        unit="건"
                      />
                      <StatBox
                        label="평균 실거래가"
                        value={formatPrice(regionStats.avgPrice)}
                        unit=""
                      />
                      <div className="bg-slate-50 rounded-xl p-3 text-center flex flex-col justify-center">
                        <p className="text-xs text-slate-500 mb-1">전월 대비</p>
                        <p
                          className={`text-xl font-bold leading-tight ${regionStats.trend >= 0 ? 'text-red-500' : 'text-blue-500'
                            }`}
                        >
                          {regionStats.trend >= 0 ? '▲' : '▼'}
                          {Math.abs(regionStats.trend)}%
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">변동</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent transactions for this region */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <p className="text-sm font-semibold text-slate-700 mb-3">
                      {shortSelected} 최근 거래
                    </p>
                    {regionTx.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {regionTx.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between py-2.5"
                          >
                            <div className="min-w-0 mr-3">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                {tx.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {tx.district} · {tx.area}㎡ · {tx.floor}층
                              </p>
                            </div>
                            <p className="text-sm font-bold text-indigo-600 shrink-0">
                              {formatPrice(tx.price)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-5">
                        등록된 거래 데이터가 없습니다
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Default panel */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">
                      지역을 선택해보세요
                    </h2>
                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      지도에서 원하는 지역을 클릭하면
                      <br className="hidden sm:inline" />
                      해당 지역의 부동산 정보를 볼 수 있어요
                    </p>
                    <div className="space-y-4">
                      <FeatureItem
                        label="실거래가 조회"
                        desc="최신 아파트·오피스텔 실거래가 확인"
                      />
                      <FeatureItem
                        label="분양정보 확인"
                        desc="전국 분양 예정 및 진행 중인 단지 정보"
                      />
                      <FeatureItem
                        label="시세 분석"
                        desc="지역별 가격 동향 분석"
                        disabled
                      />
                    </div>
                  </div>

                  {/* National stats */}
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white">
                    <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-4">
                      전국 현황 (이달 기준)
                    </p>
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                      <div>
                        <p className="text-2xl font-bold">1,432</p>
                        <p className="text-xs opacity-60 mt-0.5">전국 거래건수</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">4.8억</p>
                        <p className="text-xs opacity-60 mt-0.5">전국 평균가</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">17개</p>
                        <p className="text-xs opacity-60 mt-0.5">서비스 지역</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">▲ 1.2%</p>
                        <p className="text-xs opacity-60 mt-0.5">전월 대비</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 실거래가 ── */}
      <section id="transactions" className="py-14 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">최근 실거래가</h2>
              <p className="text-base text-slate-500 mt-1">
                {shortSelected ? `${shortSelected} 지역의 최근 거래 내역입니다` : '전국 최근 거래 내역입니다'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['전체', '아파트', '오피스텔', '빌라'] as TxFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${txFilter === f
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredTx.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredTx.map((tx) => (
                <TransactionCard key={tx.id} tx={tx} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50 rounded-lg">
              <p className="text-base text-slate-500">해당 지역·유형의 거래 데이터가 없습니다</p>
              <button
                onClick={() => {
                  setSelectedRegion(null);
                  setTxFilter('전체');
                }}
                className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                모든 지역·유형 보기
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── 분양정보 ── */}
      <section id="presales" className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">주요 분양정보</h2>
            <p className="text-base text-slate-500 mt-1">전국 분양 예정 및 진행 중인 단지 정보입니다</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_PRESALES.map((ps) => (
              <PresaleCard key={ps.id} ps={ps} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
