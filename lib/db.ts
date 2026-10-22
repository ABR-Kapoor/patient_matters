import postgres from 'postgres';

const globalForPostgres = globalThis as unknown as {
  sql: postgres.Sql | undefined;
};

const dbUrl = new URL(process.env.DATABASE_URL!);
const isLocalDb = ['localhost', '127.0.0.1', '::1'].includes(dbUrl.hostname);

const sql = globalForPostgres.sql ?? postgres({
    host: dbUrl.hostname,
    port: Number(dbUrl.port) || 5432,
    database: dbUrl.pathname.replace(/^\//, ''),
    username: dbUrl.username,
    password: decodeURIComponent(dbUrl.password),
    // Local Docker Supabase container does NOT support TLS, cloud requires SSL
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
    max: 10,
    idle_timeout: 30,
    connect_timeout: 30,
});

if (process.env.NODE_ENV !== 'production') {
    // Force recreate the connection during hot-reloads so it picks up the latest config and SSL settings.
    globalForPostgres.sql = undefined;
    globalForPostgres.sql = sql;
}

export default sql;
