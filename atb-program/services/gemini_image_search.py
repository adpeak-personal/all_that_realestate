"""'2번 방향' — Gemini(google-genai) 로 아파트 단지 사진 링크 검색.

gemini-2.5-flash 는 텍스트 모델이라 그냥 물으면 존재하지 않는 URL 을 지어낼 수 있어
반드시 Google Search grounding(검색 도구)을 켜서 '실제 검색 결과 기반'으로 답하게 한다.

반환:
  - text     : 모델의 답변 전문
  - urls     : 답변 본문에서 추출한 링크들
  - sources  : grounding(검색) 출처 URL/제목들 (실제 웹 근거)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import config

DEFAULT_MODEL = "gemini-2.5-flash"
_URL_RE = re.compile(r"https?://[^\s\)\]\}<>\"']+")


class GeminiSearchError(RuntimeError):
    pass


@dataclass
class GeminiImageResult:
    query: str
    text: str
    urls: list[str] = field(default_factory=list)
    sources: list[dict] = field(default_factory=list)  # {title, uri}


def _build_prompt(umd: str, apt_nm: str) -> str:
    """사용자 템플릿: '[동 아파트명 아파트] 단지 사진 ...'."""
    subject = f"{umd} {apt_nm} 아파트".strip()
    return (
        f"[{subject}] 단지 사진 찾아줄 수 있을까? "
        f"워터마크 없고 깔끔한 걸로 링크만 찾아주면 될 거 같아. "
        f"가능하면 이미지 파일(.jpg/.png) 직접 링크를 우선으로 골라줘."
    )


def find_apt_image(
    umd: str,
    apt_nm: str,
    model: str = DEFAULT_MODEL,
) -> GeminiImageResult:
    """동/아파트명으로 Gemini 검색을 실행해 단지 사진 링크를 찾는다."""
    if not config.GEMINI_API_KEY:
        raise GeminiSearchError("GEMINI_API_KEY 가 설정되지 않았습니다 (.env 확인).")

    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        raise GeminiSearchError(
            "google-genai 미설치. 설치: pip install google-genai"
        ) from e

    prompt = _build_prompt(umd, apt_nm)

    try:
        client = genai.Client(api_key=config.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
    except Exception as e:  # noqa: BLE001 — SDK/네트워크/인증 오류 통합
        raise GeminiSearchError(f"Gemini 호출 실패: {e}") from e

    text = response.text or ""

    # 1) 답변 본문에서 URL 추출
    urls: list[str] = []
    for u in _URL_RE.findall(text):
        u = u.rstrip(".,)")
        if u not in urls:
            urls.append(u)

    # 2) grounding(검색) 출처 추출 — 실제 웹 근거
    sources: list[dict] = []
    try:
        cand = response.candidates[0]
        gm = getattr(cand, "grounding_metadata", None)
        for chunk in (getattr(gm, "grounding_chunks", None) or []):
            web = getattr(chunk, "web", None)
            if web and getattr(web, "uri", None):
                sources.append({"title": getattr(web, "title", "") or "", "uri": web.uri})
    except (AttributeError, IndexError, TypeError):
        pass

    return GeminiImageResult(query=prompt, text=text, urls=urls, sources=sources)
