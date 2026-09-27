'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 단지 위치 지도 + 거리뷰 (네이버 지도 JS v3).
 *
 * 지도 업체를 바꾸더라도 이 파일 하나만 고치면 되도록, 바깥에는 위경도와 이름만
 * 받는 형태로 둔다. 좌표는 행정안전부 주소정보누리집에서 받아 우리 DB 에 저장한
 * 값이다 — 지도 업체의 지오코딩 결과가 아니므로 저장·표시에 제약이 없다.
 *
 * 거리뷰는 화면에 띄우는 것만 허용된다. 캡처해서 썸네일·공유 이미지로 저장하면
 * 약관 위반이므로 그렇게 쓰지 않는다.
 *
 * 스크립트는 한 번만 불러온다. 단지 사이를 이동할 때마다 <script> 를 새로 붙이면
 * naver 전역이 다시 초기화되며 지도가 깜빡인다.
 */
type NaverEventTarget = object;

interface NaverMaps {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
  Marker: new (opts: Record<string, unknown>) => unknown;
  Panorama: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
  LatLng: new (lat: number, lng: number) => unknown;
  Event: {
    addListener: (target: NaverEventTarget, event: string, handler: (...args: unknown[]) => void) => void;
  };
  onJSContentLoaded?: () => void;
}

declare global {
  interface Window {
    naver?: { maps: NaverMaps };
  }
}

const KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
// submodules=panorama 를 붙여야 거리뷰(Panorama)를 쓸 수 있다.
const SRC =
  `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${KEY_ID ?? ''}&submodules=panorama`;

let loader: Promise<void> | null = null;

/**
 * 스크립트 로드 + 서브모듈 준비까지 기다린다.
 * script 의 load 이벤트는 본체만 보장하고, 서브모듈은 그 뒤에 따로 로드되면서
 * onJSContentLoaded 로 알려준다. 이걸 안 기다리면 naver.maps.Panorama 가 없다.
 */
function loadNaverMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.naver?.maps?.Panorama) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const done = () => resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://oapi.map.naver.com"]',
    );
    const el = existing ?? document.createElement('script');

    el.addEventListener('load', () => {
      if (window.naver?.maps?.Panorama) return done();
      // 서브모듈이 아직이면 콜백을 기다리되, 혹시 이미 끝났을 수도 있어 짧게 폴백을 둔다
      if (window.naver?.maps) window.naver.maps.onJSContentLoaded = done;
      setTimeout(done, 3000);
    });
    el.addEventListener('error', () => {
      loader = null; // 다음 시도에서 다시 붙일 수 있게
      reject(new Error('네이버 지도 스크립트를 불러오지 못했습니다'));
    });

    if (!existing) {
      el.src = SRC;
      el.async = true;
      document.head.appendChild(el);
    }
  });
  return loader;
}

type View = 'map' | 'pano';

export default function AptMap({
  lat,
  lng,
  name,
  zoom = 16,
}: {
  lat: number;
  lng: number;
  name: string;
  zoom?: number;
}) {
  const mapBox = useRef<HTMLDivElement | null>(null);
  const panoBox = useRef<HTMLDivElement | null>(null);
  const panoMade = useRef(false);

  const [view, setView] = useState<View>('map');
  const [error, setError] = useState<string | null>(null);
  // null = 아직 모름, true = 거리뷰 있음, false = 이 좌표 주변에 거리뷰 없음
  const [hasPano, setHasPano] = useState<boolean | null>(null);

  useEffect(() => {
    if (!KEY_ID) return;
    let cancelled = false;

    loadNaverMaps()
      .then(() => {
        if (cancelled || !mapBox.current || !window.naver?.maps) return;
        const { maps } = window.naver;
        const center = new maps.LatLng(lat, lng);
        const map = new maps.Map(mapBox.current, {
          center,
          zoom,
          // 모바일에서 페이지를 스크롤하다 지도 위에서 멈추는 일이 없게
          scrollWheel: false,
        });
        new maps.Marker({ position: center, map, title: name });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, name, zoom]);

  /** 거리뷰는 처음 누를 때 만든다. 안 보는 사람에게 파노라마를 미리 받게 할 이유가 없다. */
  const showPano = useCallback(() => {
    setView('pano');
    if (panoMade.current || !panoBox.current || !window.naver?.maps?.Panorama) return;
    panoMade.current = true;

    const { maps } = window.naver;
    const pano = new maps.Panorama(panoBox.current, {
      position: new maps.LatLng(lat, lng),
      pov: { pan: 0, tilt: 0, fov: 100 },
    });
    // 주변에 거리뷰가 없으면 ERROR 로 온다 (단지 안쪽·신축은 없는 곳이 많다)
    maps.Event.addListener(pano as NaverEventTarget, 'pano_status', (...args: unknown[]) => {
      setHasPano(args[0] === 'OK');
    });
  }, [lat, lng]);

  const message = !KEY_ID ? '지도 키가 설정되지 않았습니다' : error;
  if (message) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 text-sm text-slate-400">
        {message}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapBox} className={`h-full w-full ${view === 'map' ? '' : 'hidden'}`} />

      <div className={`h-full w-full ${view === 'pano' ? '' : 'hidden'}`}>
        <div ref={panoBox} className="h-full w-full" />
        {hasPano === false && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 px-6 text-center text-sm text-slate-500">
            이 단지 주변에는 거리뷰가 없습니다.
          </div>
        )}
      </div>

      {/* 전환 버튼. 거리뷰가 없는 것으로 확인되면 다시 누를 수 없게 감춘다. */}
      <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setView('map')}
          aria-pressed={view === 'map'}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === 'map' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          지도
        </button>
        {hasPano !== false && (
          <button
            type="button"
            onClick={showPano}
            aria-pressed={view === 'pano'}
            className={`border-l border-slate-300 px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === 'pano' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            거리뷰
          </button>
        )}
      </div>
    </div>
  );
}
