import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'test',
    waitForConnections: true,
    connectionLimit: 10,
});

export async function query(sql: string, params?: any[]) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

export default pool;
