/**
 * 네이버 지도 JS v3 로더. 단지 상세(AptMap)와 목록 지도(AptListMap)가 함께 쓴다.
 *
 * 스크립트는 문서당 한 번만 붙인다. 화면을 옮길 때마다 <script> 를 새로 넣으면
 * naver 전역이 다시 초기화되며 지도가 깜빡인다.
 *
 * 인증 파라미터는 ncpKeyId 다. 예전 상품(AI·NAVER API)의 ncpClientId 로 적으면
 * 새로 발급한 Maps 키로는 인증되지 않는다.
 */
type NaverEventTarget = object;

export interface NaverMaps {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
  Marker: new (opts: Record<string, unknown>) => unknown;
  Panorama: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
  LatLng: new (lat: number, lng: number) => unknown;
  LatLngBounds: new () => unknown;
  Point: new (x: number, y: number) => unknown;
  Size: new (w: number, h: number) => unknown;
  Position: Record<string, number>;
  ZoomControlStyle: Record<string, number>;
  Event: {
    addListener: (
      target: NaverEventTarget,
      event: string,
      handler: (...args: unknown[]) => void,
    ) => void;
  };
  onJSContentLoaded?: () => void;
}

declare global {
  interface Window {
    naver?: { maps: NaverMaps };
  }
}

export const NAVER_MAP_KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

// submodules=panorama 를 붙여야 거리뷰(Panorama)를 쓸 수 있다.
const SRC =
  `https://oapi.map.naver.com/openapi/v3/maps.js` +
  `?ncpKeyId=${NAVER_MAP_KEY_ID ?? ''}&submodules=panorama`;

let loader: Promise<void> | null = null;

/**
 * 스크립트 로드 + 서브모듈 준비까지 기다린다.
 * script 의 load 이벤트는 본체만 보장하고, 서브모듈은 그 뒤에 따로 로드되면서
 * onJSContentLoaded 로 알려준다. 이걸 안 기다리면 naver.maps.Panorama 가 없다.
 */
export function loadNaverMaps(): Promise<void> {
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
