import { NextRequest, NextResponse } from 'next/server';

const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true';
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

    // 1. Transcribe with Deepgram (nova-3, multilingual: Hindi + English code-switching).
    const audioBuffer = await audioFile.arrayBuffer();
    // Deepgram doesn't accept the 'audio/m4a' label; the same AAC/MP4 bytes
    // work fine as 'audio/mp4'.
    const rawType = (audioFile as File).type || '';
    const contentType = rawType === 'audio/m4a' ? 'audio/mp4' : rawType || 'audio/mp4';
    const deepgramResponse = await fetch(DEEPGRAM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY || ''}`,
        'Content-Type': contentType,
      },
      body: audioBuffer,
    });

    if (!deepgramResponse.ok) {
      const errorData = await deepgramResponse.text();
      console.error('Deepgram API Error:', errorData);
      return NextResponse.json(
        { error: 'Failed to transcribe audio with Deepgram' },
        { status: deepgramResponse.status }
      );
    }

    const deepgramData = await deepgramResponse.json();
    const rawTranscript: string =
      deepgramData?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';

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
