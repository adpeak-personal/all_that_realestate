'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 단지 위치 지도 (네이버 지도 JS v3).
 *
 * 지도 업체를 바꾸더라도 이 파일 하나만 고치면 되도록, 바깥에는 위경도와 이름만
 * 받는 형태로 둔다. 좌표는 행정안전부 주소정보누리집에서 받아 우리 DB 에 저장한
 * 값이다 — 지도 업체의 지오코딩 결과가 아니므로 저장·표시에 제약이 없다.
 *
 * 스크립트는 한 번만 불러온다. 단지 사이를 이동할 때마다 <script> 를 새로 붙이면
 * naver 전역이 다시 초기화되며 지도가 깜빡인다.
 */
declare global {
  interface Window {
    naver?: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
        Marker: new (opts: Record<string, unknown>) => unknown;
        LatLng: new (lat: number, lng: number) => unknown;
        Point: new (x: number, y: number) => unknown;
        Size: new (w: number, h: number) => unknown;
        Position: Record<string, unknown>;
        ZoomControlStyle: Record<string, unknown>;
      };
    };
  }
}

const KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const SRC = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${KEY_ID ?? ''}`;

let loader: Promise<void> | null = null;

function loadNaverMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.naver?.maps) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="https://oapi.map.naver.com"]`);
    const el = existing ?? document.createElement('script');
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => {
      loader = null;   // 다음 시도에서 다시 붙일 수 있게
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
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 키가 없는 건 렌더 시점에 이미 아는 사실이라 state 로 만들지 않는다(아래 분기).
    if (!KEY_ID) return;
    let cancelled = false;

    loadNaverMaps()
      .then(() => {
        if (cancelled || !boxRef.current || !window.naver?.maps) return;
        const { maps } = window.naver;
        const center = new maps.LatLng(lat, lng);
        const map = new maps.Map(boxRef.current, {
          center,
          zoom,
          // 모바일에서 페이지를 스크롤하다 지도 위에서 멈추는 일이 없게
          scrollWheel: false,
        });
        new maps.Marker({
          position: center,
          map,           // 빠뜨리면 마커가 지도에 붙지 않는다
          title: name,
        });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, name, zoom]);

  const message = !KEY_ID ? '지도 키가 설정되지 않았습니다' : error;
  if (message) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 text-sm text-slate-400">
        {message}
      </div>
    );
  }
  return <div ref={boxRef} className="h-full w-full" />;
}
