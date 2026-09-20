-- ============================================================
-- 000_atb_db.sql  —  atb_db 전체 스키마 (유일한 마이그레이션)
--
-- 이 파일 하나만 적용하면 DB가 완성된다:
--     mysql -u root -p < 000_atb_db.sql
--
-- 생성 순서(외래키 의존): sgg_codes / kapt_complexes / apartments / apartment_deals
-- 전부 IF NOT EXISTS + seed 는 멱등(INSERT IGNORE) 이라 재실행해도 안전.
--
-- ※ 구버전 파일(001_init.sql, 001_create_apt_trades.sql, 002_apartments_kapt.sql)은
--   이 파일로 통합되어 삭제됨.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `atb_db`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `atb_db`;

-- 클라이언트 접속 charset 강제 (한글 깨짐 방지).
-- 이게 없으면 `mysql < 000_atb_db.sql` 적용 시 클라이언트 기본 charset 에 따라
-- 한글이 빈 문자열/깨진 값으로 들어갈 수 있다.
SET NAMES utf8mb4;


-- ── 0. 시군구 코드 마스터 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sgg_codes` (
  `sgg_cd`     INT         NOT NULL COMMENT '시군구코드 (PK, 예: 11650)',
  `sido_nm`    VARCHAR(40) NOT NULL COMMENT '시/도 (예: 서울특별시)',
  `sgg_nm`     VARCHAR(40) NOT NULL COMMENT '시/군/구 (예: 서초구)',
  `is_active`  TINYINT(1)  DEFAULT 1 COMMENT '수집/서비스 활성화 (1:활성 0:비활성)',
  `created_at` TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`sgg_cd`),
  KEY `idx_sido_sgg` (`sido_nm`, `sgg_nm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='전국 시군구 코드 마스터';

-- seed: 전국 시군구 256개 (공식 법정동코드 + K-apt 현행 반영).
--   경기/경남 등 코드↔이름 오류 교정, 인천 2026개편·화성 특례시·군위(대구) 등 현행.
--   광주/전북/전남은 공공API 공백이라 공식 법정동코드로 보강.
INSERT IGNORE INTO `sgg_codes` (`sgg_cd`, `sido_nm`, `sgg_nm`) VALUES
  -- 서울특별시 (25)
  (11110, '서울특별시', '종로구'),
  (11140, '서울특별시', '중구'),
  (11170, '서울특별시', '용산구'),
  (11200, '서울특별시', '성동구'),
  (11215, '서울특별시', '광진구'),
  (11230, '서울특별시', '동대문구'),
  (11260, '서울특별시', '중랑구'),
  (11290, '서울특별시', '성북구'),
  (11305, '서울특별시', '강북구'),
  (11320, '서울특별시', '도봉구'),
  (11350, '서울특별시', '노원구'),
  (11380, '서울특별시', '은평구'),
  (11410, '서울특별시', '서대문구'),
  (11440, '서울특별시', '마포구'),
  (11470, '서울특별시', '양천구'),
  (11500, '서울특별시', '강서구'),
  (11530, '서울특별시', '구로구'),
  (11545, '서울특별시', '금천구'),
  (11560, '서울특별시', '영등포구'),
  (11590, '서울특별시', '동작구'),
  (11620, '서울특별시', '관악구'),
  (11650, '서울특별시', '서초구'),
  (11680, '서울특별시', '강남구'),
  (11710, '서울특별시', '송파구'),
  (11740, '서울특별시', '강동구'),
  -- 부산광역시 (16)
  (26110, '부산광역시', '중구'),
  (26140, '부산광역시', '서구'),
  (26170, '부산광역시', '동구'),
  (26200, '부산광역시', '영도구'),
  (26230, '부산광역시', '부산진구'),
  (26260, '부산광역시', '동래구'),
  (26290, '부산광역시', '남구'),
  (26320, '부산광역시', '북구'),
  (26350, '부산광역시', '해운대구'),
  (26380, '부산광역시', '사하구'),
  (26410, '부산광역시', '금정구'),
  (26440, '부산광역시', '강서구'),
  (26470, '부산광역시', '연제구'),
  (26500, '부산광역시', '수영구'),
  (26530, '부산광역시', '사상구'),
  (26710, '부산광역시', '기장군'),
  -- 대구광역시 (9)
  (27110, '대구광역시', '중구'),
  (27140, '대구광역시', '동구'),
  (27170, '대구광역시', '서구'),
  (27200, '대구광역시', '남구'),
  (27230, '대구광역시', '북구'),
  (27260, '대구광역시', '수성구'),
  (27290, '대구광역시', '달서구'),
  (27710, '대구광역시', '달성군'),
  (27720, '대구광역시', '군위군'),
  -- 인천광역시 (11)
  (28125, '인천광역시', '제물포구'),
  (28155, '인천광역시', '영종구'),
  (28177, '인천광역시', '미추홀구'),
  (28185, '인천광역시', '연수구'),
  (28200, '인천광역시', '남동구'),
  (28237, '인천광역시', '부평구'),
  (28245, '인천광역시', '계양구'),
  (28275, '인천광역시', '서해구'),
  (28290, '인천광역시', '검단구'),
  (28710, '인천광역시', '강화군'),
  (28720, '인천광역시', '옹진군'),
  -- 광주광역시 (5)
  (12210, '광주광역시', '동구'),
  (12240, '광주광역시', '서구'),
  (12270, '광주광역시', '남구'),
  (12300, '광주광역시', '북구'),
  (12330, '광주광역시', '광산구'),
  -- 대전광역시 (5)
  (30110, '대전광역시', '동구'),
  (30140, '대전광역시', '중구'),
  (30170, '대전광역시', '서구'),
  (30200, '대전광역시', '유성구'),
  (30230, '대전광역시', '대덕구'),
  -- 울산광역시 (5)
  (31110, '울산광역시', '중구'),
  (31140, '울산광역시', '남구'),
  (31170, '울산광역시', '동구'),
  (31200, '울산광역시', '북구'),
  (31710, '울산광역시', '울주군'),
  -- 세종특별자치시 (1)
  (36110, '세종특별자치시', '세종특별자치시'),
  -- 경기도 (47)
  (41111, '경기도', '수원시 장안구'),
  (41113, '경기도', '수원시 권선구'),
  (41115, '경기도', '수원시 팔달구'),
  (41117, '경기도', '수원시 영통구'),
  (41131, '경기도', '성남시 수정구'),
  (41133, '경기도', '성남시 중원구'),
  (41135, '경기도', '성남시 분당구'),
  (41150, '경기도', '의정부시'),
  (41171, '경기도', '안양시 만안구'),
  (41173, '경기도', '안양시 동안구'),
  (41192, '경기도', '부천시 원미구'),
  (41194, '경기도', '부천시 소사구'),
  (41196, '경기도', '부천시 오정구'),
  (41210, '경기도', '광명시'),
  (41220, '경기도', '평택시'),
  (41250, '경기도', '동두천시'),
  (41271, '경기도', '안산시 상록구'),
  (41273, '경기도', '안산시 단원구'),
  (41281, '경기도', '고양시 덕양구'),
  (41285, '경기도', '고양시 일산동구'),
  (41287, '경기도', '고양시 일산서구'),
  (41290, '경기도', '과천시'),
  (41310, '경기도', '구리시'),
  (41360, '경기도', '남양주시'),
  (41370, '경기도', '오산시'),
  (41390, '경기도', '시흥시'),
  (41410, '경기도', '군포시'),
  (41430, '경기도', '의왕시'),
  (41450, '경기도', '하남시'),
  (41461, '경기도', '용인시 처인구'),
  (41463, '경기도', '용인시 기흥구'),
  (41465, '경기도', '용인시 수지구'),
  (41480, '경기도', '파주시'),
  (41500, '경기도', '이천시'),
  (41550, '경기도', '안성시'),
  (41570, '경기도', '김포시'),
  (41591, '경기도', '화성만세구'),
  (41593, '경기도', '화성효행구'),
  (41595, '경기도', '화성병점구'),
  (41597, '경기도', '화성동탄구'),
  (41610, '경기도', '광주시'),
  (41630, '경기도', '양주시'),
  (41650, '경기도', '포천시'),
  (41670, '경기도', '여주시'),
  (41800, '경기도', '연천군'),
  (41820, '경기도', '가평군'),
  (41830, '경기도', '양평군'),
  -- 충청북도 (14)
  (43111, '충청북도', '청주시 상당구'),
  (43112, '충청북도', '청주시 서원구'),
  (43113, '충청북도', '청주시 흥덕구'),
  (43114, '충청북도', '청주시 청원구'),
  (43130, '충청북도', '충주시'),
  (43150, '충청북도', '제천시'),
  (43720, '충청북도', '보은군'),
  (43730, '충청북도', '옥천군'),
  (43740, '충청북도', '영동군'),
  (43745, '충청북도', '증평군'),
  (43750, '충청북도', '진천군'),
  (43760, '충청북도', '괴산군'),
  (43770, '충청북도', '음성군'),
  (43800, '충청북도', '단양군'),
  -- 충청남도 (16)
  (44131, '충청남도', '천안시 동남구'),
  (44133, '충청남도', '천안시 서북구'),
  (44150, '충청남도', '공주시'),
  (44180, '충청남도', '보령시'),
  (44200, '충청남도', '아산시'),
  (44210, '충청남도', '서산시'),
  (44230, '충청남도', '논산시'),
  (44250, '충청남도', '계룡시'),
  (44270, '충청남도', '당진시'),
  (44710, '충청남도', '금산군'),
  (44760, '충청남도', '부여군'),
  (44770, '충청남도', '서천군'),
  (44790, '충청남도', '청양군'),
  (44800, '충청남도', '홍성군'),
  (44810, '충청남도', '예산군'),
  (44825, '충청남도', '태안군'),
  -- 전북특별자치도 (15)
  (52111, '전북특별자치도', '전주시 완산구'),
  (52113, '전북특별자치도', '전주시 덕진구'),
  (52130, '전북특별자치도', '군산시'),
  (52140, '전북특별자치도', '익산시'),
  (52180, '전북특별자치도', '정읍시'),
  (52190, '전북특별자치도', '남원시'),
  (52210, '전북특별자치도', '김제시'),
  (52710, '전북특별자치도', '완주군'),
  (52720, '전북특별자치도', '진안군'),
  (52730, '전북특별자치도', '무주군'),
  (52740, '전북특별자치도', '장수군'),
  (52750, '전북특별자치도', '임실군'),
  (52770, '전북특별자치도', '순창군'),
  (52790, '전북특별자치도', '고창군'),
  (52800, '전북특별자치도', '부안군'),
  -- 전라남도 (21)
  (12110, '전라남도', '목포시'),
  (12130, '전라남도', '여수시'),
  (12150, '전라남도', '순천시'),
  (12170, '전라남도', '나주시'),
  (12190, '전라남도', '광양시'),
  (12710, '전라남도', '담양군'),
  (12720, '전라남도', '곡성군'),
  (12730, '전라남도', '구례군'),
  (12740, '전라남도', '고흥군'),
  (12750, '전라남도', '보성군'),
  (12760, '전라남도', '화순군'),
  (12770, '전라남도', '장흥군'),
  (12780, '전라남도', '강진군'),
  (12790, '전라남도', '해남군'),
  (12800, '전라남도', '영암군'),
  (12810, '전라남도', '무안군'),
  (12820, '전라남도', '함평군'),
  (12830, '전라남도', '영광군'),
  (12840, '전라남도', '장성군'),
  (12850, '전라남도', '완도군'),
  (12860, '전라남도', '진도군'),
  -- 경상북도 (23)
  (47111, '경상북도', '포항시 남구'),
  (47113, '경상북도', '포항시 북구'),
  (47130, '경상북도', '경주시'),
  (47150, '경상북도', '김천시'),
  (47170, '경상북도', '안동시'),
  (47190, '경상북도', '구미시'),
  (47210, '경상북도', '영주시'),
  (47230, '경상북도', '영천시'),
  (47250, '경상북도', '상주시'),
  (47280, '경상북도', '문경시'),
  (47290, '경상북도', '경산시'),
  (47730, '경상북도', '의성군'),
  (47750, '경상북도', '청송군'),
  (47760, '경상북도', '영양군'),
  (47770, '경상북도', '영덕군'),
  (47820, '경상북도', '청도군'),
  (47830, '경상북도', '고령군'),
  (47840, '경상북도', '성주군'),
  (47850, '경상북도', '칠곡군'),
  (47900, '경상북도', '예천군'),
  (47920, '경상북도', '봉화군'),
  (47930, '경상북도', '울진군'),
  (47940, '경상북도', '울릉군'),
  -- 경상남도 (22)
  (48121, '경상남도', '창원시 의창구'),
  (48123, '경상남도', '창원시 성산구'),
  (48125, '경상남도', '창원시 마산합포구'),
  (48127, '경상남도', '창원시 마산회원구'),
  (48129, '경상남도', '창원시 진해구'),
  (48170, '경상남도', '진주시'),
  (48220, '경상남도', '통영시'),
  (48240, '경상남도', '사천시'),
  (48250, '경상남도', '김해시'),
  (48270, '경상남도', '밀양시'),
  (48310, '경상남도', '거제시'),
  (48330, '경상남도', '양산시'),
  (48720, '경상남도', '의령군'),
  (48730, '경상남도', '함안군'),
  (48740, '경상남도', '창녕군'),
  (48820, '경상남도', '고성군'),
  (48840, '경상남도', '남해군'),
  (48850, '경상남도', '하동군'),
  (48860, '경상남도', '산청군'),
  (48870, '경상남도', '함양군'),
  (48880, '경상남도', '거창군'),
  (48890, '경상남도', '합천군'),
  -- 제주특별자치도 (2)
  (50110, '제주특별자치도', '제주시'),
  (50130, '제주특별자치도', '서귀포시'),
  -- 강원특별자치도 (18)
  (51110, '강원특별자치도', '춘천시'),
  (51130, '강원특별자치도', '원주시'),
  (51150, '강원특별자치도', '강릉시'),
  (51170, '강원특별자치도', '동해시'),
  (51190, '강원특별자치도', '태백시'),
  (51210, '강원특별자치도', '속초시'),
  (51230, '강원특별자치도', '삼척시'),
  (51720, '강원특별자치도', '홍천군'),
  (51730, '강원특별자치도', '횡성군'),
  (51750, '강원특별자치도', '영월군'),
  (51760, '강원특별자치도', '평창군'),
  (51770, '강원특별자치도', '정선군'),
  (51780, '강원특별자치도', '철원군'),
  (51790, '강원특별자치도', '화천군'),
  (51800, '강원특별자치도', '양구군'),
  (51810, '강원특별자치도', '인제군'),
  (51820, '강원특별자치도', '고성군'),
  (51830, '강원특별자치도', '양양군');


-- ── 1. K-apt 공동주택 단지 마스터 ──────────────────────────────
--   국토교통부 1613000(목록/기본/상세) 응답 저장소이자 매칭용 마스터.
--   atb-program/services/kapt_sync.py 가 시군구 단위로 채운다.
CREATE TABLE IF NOT EXISTS `kapt_complexes` (
  `kapt_code`        VARCHAR(20)   NOT NULL COMMENT 'K-apt 단지코드 (PK, 앵커키)',
  `kapt_name`        VARCHAR(100)  NOT NULL COMMENT '단지명 (kaptName)',

  -- 지역
  `sgg_cd`           INT           DEFAULT NULL COMMENT '시군구코드 5자리 (bjd_code 앞 5자리)',
  `sido_nm`          VARCHAR(40)   DEFAULT NULL COMMENT '시도 (as1)',
  `sgg_nm`           VARCHAR(40)   DEFAULT NULL COMMENT '시군구 (as2)',
  `umd_nm`           VARCHAR(50)   DEFAULT NULL COMMENT '법정동 (as3)',
  `bjd_code`         CHAR(10)      DEFAULT NULL COMMENT '법정동코드 10자리 (bjdCode)',

  -- 주소 & 매칭키
  `addr_jibun`       VARCHAR(200)  DEFAULT NULL COMMENT '지번주소 (kaptAddr)',
  `addr_road`        VARCHAR(200)  DEFAULT NULL COMMENT '도로명주소 (doroJuso)',
  `jibun`            VARCHAR(30)   DEFAULT NULL COMMENT 'addr_jibun 에서 파싱한 지번 (매칭용)',

  -- 기본정보 (getAphusBassInfoV4)
  `total_households` INT           DEFAULT NULL COMMENT '세대수 (kaptdaCnt, 0이면 hoCnt)',
  `dong_cnt`         SMALLINT      DEFAULT NULL COMMENT '동수 (kaptDongCnt)',
  `top_floor`        SMALLINT      DEFAULT NULL COMMENT '최고층 (kaptTopFloor)',
  `use_apr_date`     DATE          DEFAULT NULL COMMENT '사용승인일=준공일 (kaptUsedate)',
  `heat_type`        VARCHAR(20)   DEFAULT NULL COMMENT '난방방식 (codeHeatNm)',
  `hall_type`        VARCHAR(20)   DEFAULT NULL COMMENT '복도유형: 계단식/복도식 (codeHallNm)',
  `sale_type`        VARCHAR(20)   DEFAULT NULL COMMENT '분양형태 (codeSaleNm)',
  `builder`          VARCHAR(100)  DEFAULT NULL COMMENT '시공사 (kaptBcompany)',
  `total_area`       DECIMAL(12,2) DEFAULT NULL COMMENT '연면적 ㎡ (kaptTarea)',

  -- 상세정보 (getAphusDtlInfoV4)
  `parking_total`    INT           DEFAULT NULL COMMENT '총주차대수 = 지상(kaptdPcnt)+지하(kaptdPcntu)',
  `cctv_cnt`         INT           DEFAULT NULL COMMENT 'CCTV 대수 (kaptdCccnt)',

  `raw`              JSON          DEFAULT NULL COMMENT '기본+상세 원본 응답 병합',
  `synced_at`        TIMESTAMP     NULL DEFAULT NULL COMMENT '마지막 동기화 시각',
  `created_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`kapt_code`),
  KEY `idx_sgg`       (`sgg_cd`),
  KEY `idx_match`     (`sgg_cd`, `umd_nm`, `jibun`),
  KEY `idx_kapt_name` (`kapt_name`(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='K-apt 공동주택 단지 마스터';


-- ── 2. 아파트 단지 (실거래에서 파생) ───────────────────────────
--   실거래 수집 시 껍데기 upsert → 매칭(apt_match_run.py)이 kapt_code 연결.
--   세대수·주소 등 부가정보는 kapt_code 로 kapt_complexes 를 JOIN 해서 읽는다.
CREATE TABLE IF NOT EXISTS `apartments` (
  `id`               BIGINT        NOT NULL AUTO_INCREMENT,

  -- 위치/단지 (실거래 API 유래)
  `sgg_cd`           INT           NOT NULL COMMENT '시군구코드 (예: 11650)',
  `umd_nm`           VARCHAR(50)   NOT NULL COMMENT '법정동명 (예: 방배동)',
  `jibun`            VARCHAR(20)   DEFAULT NULL COMMENT '지번',
  `apt_nm`           VARCHAR(100)  NOT NULL COMMENT '아파트명',
  `build_year`       SMALLINT      DEFAULT NULL COMMENT '건축년도 (실거래, 연도만)',

  -- K-apt 매칭 (kapt_complexes 로 연결)
  `kapt_code`        VARCHAR(20)   DEFAULT NULL COMMENT 'kapt_complexes.kapt_code (미매칭 시 NULL)',
  `match_status`     TINYINT       NOT NULL DEFAULT 0
     COMMENT '0:미매칭 1:confirmed(이름+지번) 2:matched(단일) 3:ambiguous 4:conflict — 3·4는 수동확인',
  `match_method`     VARCHAR(20)   DEFAULT NULL COMMENT 'name / jibun / name+jibun',
  `matched_at`       TIMESTAMP     NULL DEFAULT NULL COMMENT '매칭 실행 시각',

  -- K-apt 정보 캐시(선택) — 매칭 성공 단지의 대표값 복사용. 기본은 JOIN 사용.
  `total_households` INT           DEFAULT NULL COMMENT '총 세대수',
  `total_floors`     SMALLINT      DEFAULT NULL COMMENT '최고 층수',
  `address_road`     VARCHAR(200)  DEFAULT NULL COMMENT '도로명주소',
  `address_jibun`    VARCHAR(200)  DEFAULT NULL COMMENT '지번주소',
  `lat`              DECIMAL(10,7) DEFAULT NULL COMMENT '위도 (WGS84, 별도 지오코딩)',
  `lng`              DECIMAL(10,7) DEFAULT NULL COMMENT '경도 (WGS84, 별도 지오코딩)',
  `geocode_status`   TINYINT       NOT NULL DEFAULT 0
     COMMENT '0:미처리 1:성공 2:주소로 못찾음 3:오류(재시도 대상)',
  `geocoded_at`      TIMESTAMP     NULL DEFAULT NULL COMMENT '지오코딩 시각',

  -- 파생 (apartment_deals 집계) — 전용면적 기준 시세 조회/필터용
  `exclu_areas`      JSON          DEFAULT NULL COMMENT '이 단지에서 거래된 전용면적(㎡) 종류 배열. deals 파생, 저장 시 갱신',

  -- 대표 이미지 (이미지 검수 워커)
  `thumbnail_url`    VARCHAR(500)  DEFAULT NULL COMMENT '대표 이미지 URL',
  `thumbnail_source` VARCHAR(30)   DEFAULT NULL COMMENT '이미지 출처 (naver/google/manual)',
  `apt_status`       VARCHAR(20)   DEFAULT 'COMPLETED' COMMENT '단지 상태 (COMPLETED/PRE_SALE)',
  `image_status`     TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '이미지 검수 (0:미검수 1:있음 2:없음)',
  `image_checked_at` TIMESTAMP     NULL DEFAULT NULL COMMENT '이미지 검수 시각',

  `created_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_apt`     (`sgg_cd`, `apt_nm`, `jibun`),
  KEY `idx_sgg_apt`       (`sgg_cd`, `apt_nm`(50)),
  KEY `idx_apt_nm`        (`apt_nm`(50)),
  KEY `idx_kapt_code`     (`kapt_code`),
  KEY `idx_match_status`  (`match_status`),
  KEY `idx_coords`        (`lat`, `lng`),
  KEY `idx_geocode_status` (`geocode_status`),
  KEY `idx_image_status`  (`image_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='아파트 단지 마스터 (실거래 파생 + K-apt 매칭)';


-- ── 3. 아파트 매매 실거래가 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS `apartment_deals` (
  `id`               BIGINT        NOT NULL AUTO_INCREMENT,
  `transaction_key`  VARCHAR(64)   NOT NULL COMMENT 'MD5(sgg_cd+apt_nm+apt_dong+deal_date+floor+exclu_use_ar+deal_amount)',
  `apt_id`           BIGINT        DEFAULT NULL COMMENT 'apartments.id FK',

  -- 위치
  `sgg_cd`           INT           NOT NULL COMMENT '시군구코드',
  `umd_nm`           VARCHAR(50)   NOT NULL COMMENT '법정동명',
  `jibun`            VARCHAR(20)   DEFAULT NULL,

  -- 단지
  `apt_nm`           VARCHAR(100)  NOT NULL COMMENT '아파트명',
  `apt_dong`         VARCHAR(20)   DEFAULT NULL COMMENT '동',
  `build_year`       SMALLINT      DEFAULT NULL,

  -- 계약
  `deal_date`        DATE          NOT NULL COMMENT '거래일',
  `deal_year`        SMALLINT      NOT NULL,
  `deal_month`       TINYINT       NOT NULL,
  `deal_day`         TINYINT       NOT NULL,
  `deal_amount`      INT           NOT NULL COMMENT '거래금액 (만원)',
  `floor`            SMALLINT      DEFAULT NULL,
  `exclu_use_ar`     DECIMAL(7,4)  NOT NULL COMMENT '전용면적 ㎡',

  -- 거래 특성
  `dealing_gbn`         VARCHAR(20)  DEFAULT NULL COMMENT '거래유형 (중개거래/직거래)',
  `estate_agent_sgg_nm` VARCHAR(100) DEFAULT NULL COMMENT '중개사 소재지',
  `buyer_gbn`           VARCHAR(20)  DEFAULT NULL COMMENT '매수자 구분',
  `sler_gbn`            VARCHAR(20)  DEFAULT NULL COMMENT '매도자 구분',
  `land_leasehold_gbn`  CHAR(1)      DEFAULT 'N'  COMMENT '토지임대부 여부',

  -- 취소/등기
  `rgst_date`        VARCHAR(20)   DEFAULT NULL COMMENT '등기일자',
  `cdeal_day`        VARCHAR(20)   DEFAULT NULL COMMENT '해제사유발생일',
  `cdeal_type`       VARCHAR(20)   DEFAULT NULL COMMENT '해제 사유',

  `created_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transaction`  (`transaction_key`),
  KEY `idx_sgg_date`           (`sgg_cd`, `deal_date`),
  KEY `idx_apt_nm`             (`apt_nm`(50)),
  KEY `idx_apt_id_date`        (`apt_id`, `deal_date`),
  KEY `idx_grp_sgg_ym`         (`sgg_cd`, `deal_year`, `deal_month`),
  KEY `idx_grp_apt_ym`         (`apt_nm`(50), `deal_year`, `deal_month`),
  KEY `idx_grp_sgg_area`       (`sgg_cd`, `exclu_use_ar`),
  KEY `idx_deal_date`          (`deal_date`),

  CONSTRAINT `fk_deal_apt` FOREIGN KEY (`apt_id`)
    REFERENCES `apartments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='아파트 매매 실거래가';
