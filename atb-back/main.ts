import 'dotenv/config';
import Fastify from 'fastify';
import routes from './routes/api';
import adminRoutes from './routes/admin';

const server = Fastify({ logger: true });

server.register(routes, { prefix: '/api' });
server.register(adminRoutes, { prefix: '/api' });

const PORT = Number(process.env.PORT || 4030);

// 배포 직후에는 캐시가 비어 있어, 첫 방문자가 전국 집계(9초)를 혼자 맞는다.
// 기동하자마자 한 번 불러 채워 둔다. 실패해도 서버는 그대로 뜬다.
const WARM = ['/api/apts?page=1', '/api/stats/summary', '/api/stats/regions', '/api/stats/trend'];

const start = async () => {
    try {
        await server.listen({ port: PORT, host: '0.0.0.0' });
        server.log.info(`Server listening on port ${PORT}`);
        for (const url of WARM) {
            server
                .inject({ method: 'GET', url })
                .then(() => server.log.info(`캐시 준비: ${url}`))
                .catch((e) => server.log.warn(`캐시 준비 실패 ${url}: ${e}`));
        }
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
