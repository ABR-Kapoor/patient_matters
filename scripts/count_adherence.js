const postgres = require('postgres');
require('dotenv').config({ path: 'd:/patient_matters/.env' });

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  prepare: false,
});

async function run() {
  const pid = 'c560ca51-25b5-447a-8405-33a9c0101617';
  const count = await sql`SELECT count(*) FROM medication_adherence WHERE pid = ${pid}`;
  console.log('Medication adherence count for patient:', count[0].count);

  const total = await sql`SELECT count(*) FROM medication_adherence`;
  console.log('Total medication adherence rows:', total[0].count);
  await sql.end();
}

run().catch(console.error);
