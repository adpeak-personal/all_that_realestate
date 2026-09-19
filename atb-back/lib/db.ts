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
    connectionLimit: 10,
    // DECIMAL 을 문자열로 받아 부동소수점 오차를 피한다 (전용면적/금액 계산용).
    decimalNumbers: false,
});

export async function query(sql: string, params?: any[]) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

export default pool;
