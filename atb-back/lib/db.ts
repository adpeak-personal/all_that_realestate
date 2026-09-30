// dotenv 는 여기서 직접 로드한다.
// main.ts 의 dotenv.config() 는 import 평가가 끝난 뒤에 실행되므로,
// 그때 풀을 만들면 MYSQL_* 가 비어 있는 채로 커넥션이 생성된다.
import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'atb_db',
    charset: 'utf8mb4',
    waitForConnections: true,
    // DB 가 다른 서버에 있어 한 번의 왕복이 로컬보다 비싸다. 크롤러가 목록을 훑으면
    // 동시 요청이 몰리는데, 10 개로는 뒤에 줄이 계속 길어져 결국 504 로 끊겼다.
    connectionLimit: 25,
    // 무한정 줄 세우지 않는다. 밀리면 빨리 실패하는 편이 60초 기다리다 끊기는 것보다 낫다.
    queueLimit: 60,
    connectTimeout: 10_000,
    // 놀고 있는 연결은 정리한다 — 공용 DB 서버라 남의 연결 수까지 잡아먹으면 안 된다.
    maxIdle: 5,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    // DECIMAL 을 문자열로 받아 부동소수점 오차를 피한다 (전용면적/금액 계산용).
    decimalNumbers: false,
});

export async function query(sql: string, params?: any[]) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

export default pool;
