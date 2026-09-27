'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 요소가 화면 가까이 왔는지. 한 번 true 가 되면 계속 true 다.
 *
 * 지도를 여기에 물려서, 사용자가 실제로 지도까지 내려왔을 때만 불러온다.
 * 단지 상세는 지도가 화면 아래쪽에 있어 안 보고 나가는 경우가 많은데, 그때마다
 * 네이버 Dynamic Map 호출을 쓰면 무료 한도를 그냥 버리게 된다.
 *
 * IntersectionObserver 하나만 믿지 않는다. 관찰자가 없거나(구형 브라우저),
 * 어떤 이유로 콜백이 오지 않는 환경에서는 지도가 영영 안 뜨게 되기 때문에,
 * 직접 위치를 재는 경로를 함께 둔다(스크롤·리사이즈, 그리고 최초 1회).
 */
export function useInView<T extends HTMLElement>(rootMargin = 300) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      setInView(true);
      cleanup();
    };

    const near = () => {
      const h = window.innerHeight || document.documentElement.clientHeight;
      // 화면 높이를 알 수 없으면(0) 보이는지 판단할 수 없다.
      // 이럴 때는 '안 띄움' 보다 '띄움' 이 낫다 — 아껴봐야 지도가 안 나오면 소용없다.
      if (!h) return true;
      const r = el.getBoundingClientRect();
      return r.top < h + rootMargin && r.bottom > -rootMargin;
    };
    const check = () => {
      if (near()) show();
    };

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting)) show();
            },
            { rootMargin: `${rootMargin}px` },
          )
        : null;
    io?.observe(el);

    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    // 처음부터 화면에 들어와 있는 경우(목록 지도처럼 위쪽에 있는 것)를 위한 1회 측정.
    // effect 본문에서 바로 setState 하지 않으려고 타이머로 한 틱 미룬다.
    const t = setTimeout(check, 0);

    function cleanup() {
      clearTimeout(t);
      io?.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    }
    return cleanup;
  }, [inView, rootMargin]);

  return { ref, inView };
}
