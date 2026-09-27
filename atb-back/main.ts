import 'dotenv/config';
import Fastify from 'fastify';
import routes from './routes/api';
import adminRoutes from './routes/admin';

const server = Fastify({ logger: true });

server.register(routes, { prefix: '/api' });
server.register(adminRoutes, { prefix: '/api' });

const PORT = Number(process.env.PORT || 4030);

const start = async () => {
    try {
        await server.listen({ port: PORT, host: '0.0.0.0' });
        server.log.info(`Server listening on port ${PORT}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
