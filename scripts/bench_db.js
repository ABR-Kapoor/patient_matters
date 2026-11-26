const postgres = require('postgres');
const sql = postgres('postgresql://postgres:2nFsKuNVTIRYMwKN@db.ydilthpjeaprjbfnmxvy.supabase.co:5432/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });

async function bench() {
  console.log('Testing DB connection latency...');
  const t0 = Date.now();
  const [res] = await sql`SELECT NOW()`;
  console.log('DB ping:', Date.now() - t0, 'ms. Result:', res.now);

  console.log('Testing appointments query for patient...');
  const [patient] = await sql`SELECT pid, uid FROM patients LIMIT 1`;
  const t1 = Date.now();
  const appointments = await sql`
      SELECT a.*, ft.amount as paid_amount, ft.platform_fee_applied,
             rr.refund_id, rr.amount as refund_amount, rr.status as refund_status,
             rr.reason as refund_reason, rr.refund_type,
             (rr.refund_id IS NOT NULL) as refund_requested,
             r.review_id as my_review_id,
             r.rating as my_review_rating,
             r.comment as my_review_comment,
             r.created_at as my_review_created_at,
             r.updated_at as my_review_updated_at
      FROM appointments a
      LEFT JOIN finance_transactions ft ON a.aid = ft.aid AND ft.transaction_type = 'consultation'
      LEFT JOIN refund_requests rr ON rr.aid = a.aid
      LEFT JOIN reviews r ON r.aid = a.aid
      WHERE a.pid = ${patient.pid}
      ORDER BY
        CASE WHEN a.status NOT IN ('completed', 'cancelled') THEN 0 ELSE 1 END ASC,
        CASE WHEN a.status NOT IN ('completed', 'cancelled') THEN a.scheduled_date END ASC,
        CASE WHEN a.status NOT IN ('completed', 'cancelled') THEN a.scheduled_time::time END ASC,
        CASE WHEN a.status IN ('completed', 'cancelled') THEN a.scheduled_date END DESC,
        CASE WHEN a.status IN ('completed', 'cancelled') THEN a.scheduled_time::time END DESC
  `;
  console.log('Appointments query took:', Date.now() - t1, 'ms. Count:', appointments.length);

  const appointmentIds = appointments.map(apt => apt.aid);
  const t2 = Date.now();
  if (appointmentIds.length > 0) {
    const unreadCounts = await sql`
        SELECT aid, COUNT(*)::int as count
        FROM appointment_messages
        WHERE aid = ANY(${appointmentIds}::uuid[])
          AND sender_role = 'doctor'
          AND read_at IS NULL
        GROUP BY aid
    `;
    console.log('Unread query took:', Date.now() - t2, 'ms. Rows:', unreadCounts.length);
  }

  process.exit(0);
}

bench().catch(e => { console.error('Benchmark failed:', e); process.exit(1); });
