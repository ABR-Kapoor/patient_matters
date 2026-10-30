import postgres from 'postgres';

const globalForPostgres = globalThis as unknown as {
  sql: postgres.Sql | undefined;
};

const dbUrl = new URL(process.env.DATABASE_URL!);
const isLocalDb = ['localhost', '127.0.0.1', '::1'].includes(dbUrl.hostname);

let host = dbUrl.hostname;
let port = Number(dbUrl.port) || 5432;
let username = dbUrl.username;

// Supabase direct connection host (`db.<ref>.supabase.co:5432`) only has IPv6 AAAA DNS records.
// Serverless platforms like Vercel (AWS Lambda) do not have outbound IPv6 routing, causing TCP
// connection attempts to hang until timeout (15000ms+). Automatically use the IPv4 connection pooler.
if (host.startsWith('db.') && host.endsWith('.supabase.co')) {
    const projectRef = host.replace(/^db\./, '').replace(/\.supabase\.co$/, '');
    host = 'aws-0-ap-south-1.pooler.supabase.com';
    port = 6543;
    if (username === 'postgres') {
        username = `postgres.${projectRef}`;
    }
}

const sql = globalForPostgres.sql ?? postgres({
    host,
    port,
    database: dbUrl.pathname.replace(/^\//, ''),
    username,
    password: decodeURIComponent(dbUrl.password),
    // Local Docker Supabase container does NOT support TLS, cloud requires SSL
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
    // Supabase transaction pooler (port 6543 / PgBouncer) does not support prepared statements
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') {
    // Force recreate the connection during hot-reloads so it picks up the latest config and SSL settings.
    globalForPostgres.sql = undefined;
    globalForPostgres.sql = sql;
}

export default sql;
