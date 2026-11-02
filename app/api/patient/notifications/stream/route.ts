import { NextRequest } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';
import {
    syncDueDoseNotifications,
    syncLifecycleNotifications,
} from '@/lib/shared/notifications/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 15000;
const SYNC_INTERVAL_MS = 15000;
const MAX_STREAM_MS = 60000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function validCursor(value: string | null): string {
    if (value) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return new Date(Date.now() - 2 * 60_000).toISOString();
}

export async function GET(request: NextRequest) {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    const uid = auth.data.uid;
    const pid = auth.data.pid;
    const encoder = new TextEncoder();
    let cursor = validCursor(request.nextUrl.searchParams.get('since'));
    let isClosed = false;
    let lastHeartbeat = Date.now();
    let lastSync = Date.now();
    const seen = new Set<string>();

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const close = () => {
                if (isClosed) return;
                isClosed = true;
                try {
                    controller.close();
                } catch {
                    // The client already disconnected.
                }
            };

            request.signal.addEventListener('abort', close);
            const startedAt = Date.now();

            controller.enqueue(encoder.encode(': connected\n\n'));

            try {
                while (!isClosed && Date.now() - startedAt < MAX_STREAM_MS) {
                    if (Date.now() - lastSync >= SYNC_INTERVAL_MS) {
                        lastSync = Date.now();
                        try {
                            await syncLifecycleNotifications(uid, pid, { notify: true });
                            await syncDueDoseNotifications(uid, pid);
                        } catch (syncError) {
                            console.error('[notifications/stream] sync failed:', syncError);
                        }
                    }

                    const rows = await sql<any[]>`
                        SELECT
                            n.*,
                            COALESCE(
                                n.metadata->>'image_url',
                                n.metadata->>'avatar_url'
                            ) AS image_url,
                            n.metadata->>'doctor_name' AS doctor_name
                        FROM notifications n
                        WHERE n.uid = ${uid}
                          AND n.created_at >= ${cursor}::timestamptz
                        ORDER BY n.created_at ASC, n.notification_id ASC
                        LIMIT 100
                    `;

                    for (const row of rows) {
                        if (seen.has(String(row.notification_id))) continue;
                        seen.add(String(row.notification_id));
                        const createdAt = new Date(row.created_at).toISOString();
                        if (createdAt > cursor) cursor = createdAt;
                        controller.enqueue(
                            encoder.encode(
                                `event: notification\ndata: ${JSON.stringify({
                                    ...row,
                                    image_url: row.image_url || row.avatar_url || null,
                                    avatar_url: row.image_url || row.avatar_url || null,
                                })}\n\n`,
                            ),
                        );
                    }

                    if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
                        lastHeartbeat = Date.now();
                        controller.enqueue(encoder.encode(': keep-alive\n\n'));
                    }

                    await sleep(POLL_INTERVAL_MS);
                }
            } catch (error) {
                if (!isClosed) {
                    console.error('[notifications/stream] failed:', error);
                }
            } finally {
                close();
            }
        },
        cancel() {
            isClosed = true;
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
