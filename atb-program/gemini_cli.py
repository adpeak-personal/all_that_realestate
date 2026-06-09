"""Gemini(2번 방향) 아파트 단지 사진 링크 검색 — 커맨드라인 실행기.

사용법:
  python gemini_cli.py <동> <아파트명>
예:
  python gemini_cli.py 역삼동 e-편한세상

GEMINI_API_KEY 는 .env 에서 로드. 모델은 gemini-2.5-flash + Google Search grounding.
"""
import sys

from services import gemini_image_search as gis


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("사용법: python gemini_cli.py <동> <아파트명>")
        print("예:    python gemini_cli.py 역삼동 e-편한세상")
        return 2

    umd = argv[0]
    apt_nm = " ".join(argv[1:])  # 아파트명에 공백 허용

    print(f"[검색] {umd} {apt_nm} 아파트  (model=gemini-2.5-flash, grounding=on)\n")
    try:
        res = gis.find_apt_image(umd, apt_nm)
    except gis.GeminiSearchError as e:
        print(f"오류: {e}")
        return 1

    print("─ 답변 ─────────────────────────────────────────")
    print(res.text.strip() or "(빈 응답)")

    if res.urls:
        print("\n─ 본문에서 찾은 링크 ───────────────────────────")
        for u in res.urls:
            print(" •", u)

    if res.sources:
        print("\n─ 검색 출처(grounding) ─────────────────────────")
        for s in res.sources:
            print(f" • {s['title']}\n   {s['uri']}")

    if not res.urls and not res.sources:
        print("\n(추출된 링크가 없습니다)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
