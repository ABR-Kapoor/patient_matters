import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { requireSessionUser } from '@/lib/authz';

const insforge = createClient({
    baseUrl: process.env.INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!
});

/** Buckets a caller may write to. Arbitrary bucket names let a caller write into unrelated storage. */
const ALLOWED_BUCKETS = new Set(['avatar', 'profile', 'patient-uploads']);

export async function POST(request: NextRequest) {
    // Previously unauthenticated: anyone could push arbitrary files into the
    // storage buckets using the service key.
    const auth = await requireSessionUser();
    if (!auth.ok) return auth.response;

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const bucket = (formData.get('bucket') as string) || 'avatar';

        if (!ALLOWED_BUCKETS.has(bucket)) {
            return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
        }

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Invalid file upload' }, { status: 400 });
        }

        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
        }

        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

        // Upload to InsForge Storage bucket
        const { data, error } = await insforge.storage
            .from(bucket)
            .upload(fileName, file);

        if (error) {
            console.error('InsForge Storage error:', error);
            return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
        }

        const publicUrl = insforge.storage.from(bucket).getPublicUrl(fileName);

        return NextResponse.json({ success: true, url: publicUrl });
    } catch (error: any) {
        console.error('Upload API error:', error);
        return NextResponse.json({ error: error.message || 'Unknown upload error' }, { status: 500 });
    }
}
