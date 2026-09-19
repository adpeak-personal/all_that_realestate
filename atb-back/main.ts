import 'dotenv/config';
import Fastify from 'fastify';
import routes from './routes/api';

const server = Fastify({ logger: true });

server.register(routes, { prefix: '/api' });

const PORT = Number(process.env.PORT || 4000);

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
