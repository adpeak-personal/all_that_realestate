-- 단지 목록(전국)이 16~19초 걸리던 문제.
--
-- /api/apts 에 지역을 지정하지 않으면 listApts 가 이렇게 돈다:
--
--   FROM apartments a JOIN apartment_deals d ON d.apt_id = a.id
--    WHERE (d.cdeal_day IS NULL OR d.cdeal_day = '')
--    GROUP BY a.id ORDER BY deal_count DESC
--
-- 실행 계획은 apartment_deals 전체 스캔(615,212행) + 임시테이블 + 파일정렬이었고,
-- COUNT(*) 를 위해 같은 스캔을 한 번 더 했다. 기존 idx_apt_id_date(apt_id, deal_date)
-- 로는 cdeal_day·deal_amount·exclu_use_ar 를 못 얻어 행을 전부 읽어야 하므로,
-- 옵티마이저가 인덱스를 버리고 풀스캔을 고른다 (그 판단 자체는 옳다).
--
-- 그래서 집계에 필요한 칸을 전부 담은 커버링 인덱스를 둔다. 인덱스만 읽고
-- apt_id 순서로 묶이므로 GROUP BY 의 임시테이블도 사라진다.
--
-- 로컬 측정 (버퍼풀을 똑같이 따뜻하게 둔 상태):
--   목록   3.91초 → 0.67초
--   COUNT  5.58초 → 0.48초
--
-- 비용: 인덱스 약 140MB (atb_db 0.51GB → 0.65GB). 디스크는 13GB 남아 있다.
-- MySQL 8 은 이 ALTER 를 온라인으로 처리해 조회·쓰기를 막지 않는다 (로컬 2.3초).
--
-- 되돌리기:  DROP INDEX idx_apt_cover ON apartment_deals;

CREATE INDEX idx_apt_cover
    ON apartment_deals (apt_id, cdeal_day, deal_date, deal_amount, exclu_use_ar);

ANALYZE TABLE apartment_deals;
