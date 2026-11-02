import sql from '@/lib/db';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const PUSH_CHUNK_SIZE = 100;

export interface PushMessage {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: 'default' | null;
    channelId?: string;
}

interface ExpoTicket {
    status?: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: {
        error?: string;
        [key: string]: unknown;
    };
}

function isExpoPushToken(token: string): boolean {
    return /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(token);
}

function withServiceAuth(headers: Record<string, string>): Record<string, string> {
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (!accessToken) return headers;
    return { ...headers, Authorization: `Bearer ${accessToken}` };
}

async function removeInvalidTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    try {
        await sql`DELETE FROM push_tokens WHERE token = ANY(${tokens})`;
    } catch (error) {
        console.error('[push] failed to delete invalid tokens:', error);
    }
}

async function sendChunk(tokens: string[], message: PushMessage): Promise<ExpoTicket[]> {
    const payload = tokens.map((to) => ({
        to,
        title: message.title,
        body: message.body,
        sound: message.sound === null ? null : (message.sound || 'default'),
        priority: 'high',
        ...(message.channelId ? { channelId: message.channelId } : {}),
        data: message.data || {},
    }));

    const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: withServiceAuth({
            Accept: 'application/json',
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
    });

    const result: any = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(result?.errors?.[0]?.message || `Expo push HTTP ${response.status}`);
    }

    const tickets: ExpoTicket[] = Array.isArray(result?.data)
        ? result.data
        : result?.data
            ? [result.data]
            : [];

    const invalid = tickets
        .map((ticket, index) =>
            ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
                ? tokens[index]
                : null,
        )
        .filter((token): token is string => Boolean(token));

    await removeInvalidTokens(invalid);
    return tickets;
}

export async function sendPushToTokens(tokens: string[], message: PushMessage): Promise<ExpoTicket[]> {
    const validTokens = Array.from(new Set(tokens.filter(isExpoPushToken)));
    if (validTokens.length === 0) return [];

    const tickets: ExpoTicket[] = [];
    for (let index = 0; index < validTokens.length; index += PUSH_CHUNK_SIZE) {
        const chunk = validTokens.slice(index, index + PUSH_CHUNK_SIZE);
        try {
            tickets.push(...await sendChunk(chunk, message));
        } catch (error) {
            console.error('[push] Expo send failed:', error);
        }
    }
    return tickets;
}

export async function sendPushToUid(uid: string, message: PushMessage): Promise<ExpoTicket[]> {
    if (!uid) return [];
    try {
        const rows = await sql<{ token: string }[]>`
            SELECT token
            FROM push_tokens
            WHERE uid = ${uid}
        `;
        return await sendPushToTokens(rows.map((row) => row.token), message);
    } catch (error) {
        console.error('[push] failed to load push tokens:', error);
        return [];
    }
}

export async function getPushReceipts(ticketIds: string[]): Promise<any> {
    if (ticketIds.length === 0) return null;
    try {
        const response = await fetch(EXPO_RECEIPTS_URL, {
            method: 'POST',
            headers: withServiceAuth({
                Accept: 'application/json',
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ ids: ticketIds }),
            signal: AbortSignal.timeout(5000),
        });
        return await response.json();
    } catch (error) {
        console.error('[push] failed to load receipts:', error);
        return null;
    }
}
