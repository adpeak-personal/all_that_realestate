-- apartments.match_status: 'K-apt 에 없음' 에 별도 코드(5) 를 준다.
--
-- 왜:
--   예전에는 0 하나가 '아직 매칭을 안 해봤다' 와 '해봤지만 K-apt 에 없다' 를 겸했다.
--   매칭 워커는 match_status=0 을 집으므로, K-apt 에 등록되지 않는 단지
--   (오피스텔·도시형생활주택 등) 14,830 건을 매일 다시 매칭했다. 하루 두 시간을
--   쓰고 결과는 늘 같았고, 공용 DB 로 매일 그만큼의 UPDATE 가 터널을 타고 나갔다.
--
-- 이 뒤로:
--   0 = 아직 안 해봄        → 매칭 대상
--   5 = 해봤는데 K-apt 없음  → 7일(REMATCH_AFTER_DAYS) 마다 한 번만 다시
--
-- 기준: matched_at 이 채워져 있으면 한 번은 해본 것이다 (update_apartment_match 가
--       결과와 무관하게 NOW() 를 쓴다). reset_matches 는 둘 다 비우므로 0 으로 남는다.

START TRANSACTION;

UPDATE apartments
   SET match_status = 5
 WHERE match_status = 0
   AND matched_at IS NOT NULL;

COMMIT;

-- 주석만 갱신 (동작과 무관, 33k 행이라 즉시 끝난다)
ALTER TABLE apartments
  MODIFY COLUMN `match_status` TINYINT NOT NULL DEFAULT 0
  COMMENT '0:안해봄 1:confirmed(이름+지번) 2:matched(단일) 3:ambiguous 4:conflict 5:unmatched(K-apt 없음) — 3·4는 수동확인';

-- 확인
SELECT match_status, COUNT(*) AS n
  FROM apartments
 GROUP BY match_status
 ORDER BY match_status;
