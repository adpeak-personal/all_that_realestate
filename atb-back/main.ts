import Fastify from 'fastify';
import dotenv from 'dotenv';
import routes from './routes/api';

dotenv.config();

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
