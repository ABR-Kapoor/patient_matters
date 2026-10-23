import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const TRANSLATE_PROMPT = [
  'You are a translation layer for a doctor-search voice input.',
  'Translate the following spoken symptoms into natural English.',
  'If the text is already in English (including Hinglish written in Latin script), return it unchanged apart from fixing punctuation and casing.',
  'Reply with ONLY the final English text: no quotes, no explanations, no notes.',
  '---',
].join('\n');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | Blob | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '';
    if (!elevenLabsApiKey) {
      return NextResponse.json({ error: 'Missing ElevenLabs API key' }, { status: 500 });
    }

    // 1. Transcribe with ElevenLabs (model_id: scribe_v2)
    const elFormData = new FormData();
    elFormData.append('model_id', 'scribe_v2');
    elFormData.append('file', audioFile, 'recording.m4a');

    const elResponse = await fetch(ELEVENLABS_STT_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
      },
      body: elFormData,
    });

    if (!elResponse.ok) {
      const errorData = await elResponse.text();
      console.error('ElevenLabs API Error:', errorData);
      return NextResponse.json(
        { error: 'Failed to transcribe audio with ElevenLabs' },
        { status: elResponse.status }
      );
    }

    const elData = await elResponse.json();
    const rawTranscript: string = elData?.text?.trim() || '';

    if (!rawTranscript) {
      return NextResponse.json({ transcript: '' });
    }

    // 2. Hindi -> English (English passes through unchanged). If Gemini
    //    fails, fall back to the raw transcript rather than failing the request.
    let transcript = rawTranscript;
    try {
      const geminiResponse = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GOOGLE_API_KEY || '',
        },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${TRANSLATE_PROMPT}${rawTranscript}` }] },
          ],
        }),
      });

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const translated: string =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (translated) transcript = translated;
      } else {
        console.error('Gemini API Error:', await geminiResponse.text());
      }
    } catch (translateError) {
      console.error('Translation failed, returning raw transcript:', translateError);
    }

    return NextResponse.json({ transcript });
  } catch (error: any) {
    console.error('Speech to text error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
