import type { LandingBlock } from '../../../service/main/type';

/**
 * 관리자가 구성한 랜딩 블록을 화면에 편다.
 *
 * 이미지는 next/image 대신 <img> 를 쓴다. 광고 이미지는 회사 사이트를 비롯해 어디서든
 * 올 수 있는데, next/image 는 허용 도메인을 미리 등록해야 해서 새 출처가 생길 때마다
 * 설정을 고치고 다시 배포해야 한다. 그러면 운영자가 이미지를 못 붙인다.
 *
 * 주소는 백엔드에서 http(s) 만 통과시켰다.
 */
export default function LandingBlocks({ blocks }: { blocks: LandingBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {blocks.map((b) =>
          b.type === 'image' ? (
            <figure key={b.id}>
              {b.link ? (
                <a href={b.link} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.url} alt={b.alt} className="w-full rounded-xl" loading="lazy" />
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.url} alt={b.alt} className="w-full rounded-xl" loading="lazy" />
              )}
              {b.alt && (
                <figcaption className="mt-2 text-center text-xs text-slate-400">{b.alt}</figcaption>
              )}
            </figure>
          ) : (
            <div key={b.id}>
              {b.heading && (
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{b.heading}</h2>
              )}
              {/* 줄바꿈을 그대로 보여준다 — 운영자가 쓴 대로 나와야 한다 */}
              {b.body && (
                <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{b.body}</p>
              )}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
