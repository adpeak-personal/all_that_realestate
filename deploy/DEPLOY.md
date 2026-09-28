# 배포 절차

서버 두 대를 쓴다.

| 역할 | 주소 | 비고 |
|---|---|---|
| DB | 158.247.244.167 | MySQL 이 이미 돌고 있고 **다른 사이트와 공용**이다 |
| 웹 | 141.164.60.58 | nginx 가 이미 있다. 여기에 컨테이너를 올린다 |

공용 DB 서버이므로 **기존 스키마·계정·설정은 건드리지 않는다.** 우리 것만 새로 만든다.

---

## 1. DB 서버 — 스키마와 전용 계정 만들기

```bash
ssh root@158.247.244.167
```

먼저 비밀번호를 만들어 어딘가 적어 둔다(아래 명령에서 두 번 쓴다).

```bash
openssl rand -base64 24
```

MySQL 에 들어가서 — `'atb'@'%'` 처럼 모든 곳에서 접속 가능한 계정을 만들지 않는다.
웹 서버 IP 와, 로컬(수집기가 SSH 터널로 들어오는 경로)만 허용한다.

```sql
CREATE DATABASE atb_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 웹 서버(백엔드)에서 쓰는 계정
CREATE USER 'atb'@'141.164.60.58' IDENTIFIED BY '위에서만든비밀번호';
GRANT SELECT, INSERT, UPDATE, DELETE ON atb_db.* TO 'atb'@'141.164.60.58';

-- 수집기(집 PC)가 SSH 터널로 들어올 때 쓰는 계정. 터널을 타면 접속원이 로컬로 보인다.
CREATE USER 'atb'@'127.0.0.1' IDENTIFIED BY '위에서만든비밀번호';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON atb_db.* TO 'atb'@'127.0.0.1';

FLUSH PRIVILEGES;
```

왜 권한을 나눴나: 웹은 테이블을 만들 일이 없다. 수집기만 스키마 변경(마이그레이션)을 한다.
웹 계정에 `DROP` 을 주지 않아 실수나 침해로 테이블이 날아가는 경우를 막는다.

### 방화벽 — 3306 을 웹 서버에만 연다

```bash
# ufw 를 쓰는 경우
ufw allow from 141.164.60.58 to any port 3306 proto tcp
ufw status numbered        # 3306 이 Anywhere 로 열려 있지 않은지 확인
```

MySQL 이 로컬에만 묶여 있으면(`bind-address = 127.0.0.1`) 웹 서버에서 접속되지 않는다.
`/etc/mysql/mysql.conf.d/mysqld.cnf` 에서 확인하고, 바꿨다면 `systemctl restart mysql`.
**이미 다른 사이트가 쓰는 서버이므로 이 파일을 고치기 전에 현재 값을 적어 두자.**

---

## 2. 데이터 올리기

PC(로컬)에서 덤프를 만들어 둔 상태다: `deploy/dump/atb_db.sql.gz` (35MB).

```bash
# PC 에서 실행
scp deploy/dump/atb_db.sql.gz root@158.247.244.167:/tmp/

# DB 서버에서 실행
gunzip -c /tmp/atb_db.sql.gz | mysql -u root -p atb_db
rm /tmp/atb_db.sql.gz
```

### 들어갔는지 확인

```sql
USE atb_db;
SELECT COUNT(*) FROM apartment_deals;   -- 548,376 근처
SELECT COUNT(*) FROM apartments;        -- 32,994
SELECT COUNT(*) FROM presale_notices;   -- 6,056
SELECT COUNT(*) FROM kapt_complexes;    -- 16,000 이상
SELECT * FROM site_settings;            -- map_enabled = 1
```

---

## 3. 웹 서버 — 컨테이너 올리기

```bash
ssh root@141.164.60.58
mkdir -p /opt/atb && cd /opt/atb
```

`docker-compose.yml` 을 저장소에서 받거나 복사해 둔다. 그리고 환경파일 두 개를 만든다.

`/opt/atb/.env.back`
```
PORT=4030
NODE_ENV=production

MYSQL_HOST=158.247.244.167
MYSQL_PORT=3306
MYSQL_USER=atb
MYSQL_PASSWORD=위에서만든비밀번호
MYSQL_DATABASE=atb_db

ADMIN_PASSWORD_HASH=로컬 atb-back/.env 의 값을 그대로 복사
ADMIN_SESSION_SECRET=openssl rand -hex 32 로 새로 만든 값
```

`/opt/atb/.env.front`
```
SITE_URL=https://atb.co.kr
GOOGLE_SITE_VERIFICATION=
NAVER_SITE_VERIFICATION=
```

> `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 는 여기 넣어도 소용없다. 프론트 빌드 때 코드에
> 박히는 값이라 **GitHub Actions 시크릿**으로 들어간다(4번 항목).

이미지를 받아 띄운다.

```bash
echo <GitHub PAT> | docker login ghcr.io -u <GitHub 아이디> --password-stdin
docker compose pull
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:4030/api/health      # {"status":"ok"}
curl -sI http://127.0.0.1:4000/ | head -1     # 200
```

컨테이너 포트는 `127.0.0.1` 에만 열려 있다. 바깥에서 4000·4030 으로 직접 들어올 수 없고,
반드시 nginx 를 지나게 된다.

---

## 4. GitHub Actions

저장소 **Settings → Secrets and variables → Actions** 에 다음을 넣는다.

| 이름 | 값 |
|---|---|
| `DEPLOY_HOST` | `141.164.60.58` |
| `DEPLOY_USER` | `root` (또는 배포용 계정) |
| `DEPLOY_SSH_KEY` | 그 계정으로 접속되는 **개인키 전문** |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | 네이버 Maps Client ID (`NAVER_MAP_CLIENT_ID` 로 넣어도 된다) |
| `SITE_URL` | `https://atb.co.kr` |

`main` 에 푸시되면: 타입검사·린트 → 이미지 빌드 → GHCR 푸시 → 서버에서 교체 → 헬스체크.

GHCR 패키지는 처음 만들어지면 **private** 이다. 서버에서 `docker login` 을 해두면 그대로 받을 수 있다.

---

## 5. nginx + 인증서

`/etc/nginx/sites-enabled/default` 에 server 블록을 추가한다(`deploy/nginx-atb.conf` 내용).
**기존 사이트 블록은 그대로 두고 아래에 덧붙인다.**

```bash
nginx -t          # 문법 검사. 실패하면 reload 하지 말 것
systemctl reload nginx
```

DNS 를 먼저 옮긴다: `atb.co.kr`, `www.atb.co.kr` → `141.164.60.58` (A 레코드).
전파를 확인한 뒤에 인증서를 받는다. 전파 전에 받으면 실패한다.

```bash
dig +short atb.co.kr           # 141.164.60.58 이 나와야 한다
certbot --nginx -d atb.co.kr -d www.atb.co.kr
systemctl reload nginx
```

---

## 6. 수집기(집 PC) 를 서버 DB 로 돌리기

수집기는 당분간 PC 에서 돈다. 집 IP 는 바뀔 수 있어 방화벽에 고정하기 어려우므로
**SSH 터널**로 붙인다. 3306 을 인터넷에 열지 않아도 된다.

```bash
# PC 에서 (터널 유지)
ssh -N -L 3307:127.0.0.1:3306 root@158.247.244.167
```

`atb-program/.env` 를 바꾼다.

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3307
MYSQL_USER=atb
MYSQL_PASSWORD=위에서만든비밀번호
MYSQL_DATABASE=atb_db
```

터널이 끊기면 수집이 실패한다. 예약 작업과 함께 쓰려면 터널을 서비스로 띄우거나
(autossh), 나중에 수집기를 서버로 옮기는 편이 낫다.

---

## 배포 후 점검

```bash
curl -sI https://atb.co.kr/ | head -1              # 200
curl -s  https://atb.co.kr/api/health              # {"status":"ok"}
curl -s  https://atb.co.kr/robots.txt              # Sitemap 주소가 https://atb.co.kr 인지
curl -s  https://atb.co.kr/sitemap-index.xml | head -5
```

- 지도가 보이는지 (네이버 Maps 콘솔에 `https://atb.co.kr` 를 **Web 서비스 URL 로 추가**해야 한다)
- `/admin` 로그인
- 검색엔진 등록: 서치콘솔·서치어드바이저에 `https://atb.co.kr/sitemap-index.xml`, RSS 는 `https://atb.co.kr/rss.xml`
