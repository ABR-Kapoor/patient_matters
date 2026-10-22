import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, sourceLocale, targetLocale, type = 'text' } = await request.json();

    if (!text || !targetLocale) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // If target is English, return as-is
    if (targetLocale === 'en') {
      return NextResponse.json({ success: true, result: text });
    }

    // Dynamically import Lingo.dev SDK (server-side only)
    const { LingoDotDevEngine } = await import('lingo.dev/sdk');
    
    const lingoDotDev = new LingoDotDevEngine({
      apiKey: process.env.LINGODOTDEV_API_KEY || process.env.NEXT_PUBLIC_LINGODOTDEV_API_KEY || '',
      batchSize: 100,
      idealBatchItemSize: 1000,
    });

    let result;
    switch (type) {
      case 'text':
        result = await lingoDotDev.localizeText(text, {
          sourceLocale: sourceLocale || 'en',
          targetLocale,
        });
        break;
      case 'object':
        result = await lingoDotDev.localizeObject(text, {
          sourceLocale: sourceLocale || 'en',
          targetLocale,
        });
        break;
      case 'html':
        result = await lingoDotDev.localizeHtml(text, {
          sourceLocale: sourceLocale || 'en',
          targetLocale,
        });
        break;
      case 'transliterate':
        // For transliteration, we use localizeText to convert between scripts
        // Source is assumed to be 'en' (Latin script), target is the desired script
        // Or if text contains non-Latin characters, we transliterate to Latin
        result = await lingoDotDev.localizeText(text, {
          sourceLocale: 'en',
          targetLocale,
        });
        break;
      case 'transliterateToLatin':
        // Transliterate any script to Latin/Roman script
        // This is useful for names in Hindi, Bengali, etc. to Roman script
        const sourceForLatin = getSourceLocaleFromText(text);
        result = await lingoDotDev.localizeText(text, {
          sourceLocale: sourceForLatin,
          targetLocale: 'en-Latn',
        });
        break;
      default:
        throw new Error('Invalid translation type');
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { success: false, error: 'Translation failed' },
      { status: 500 }
    );
  }
}

// Detect source locale based on text content
function getSourceLocaleFromText(text: string): string {
  // Check for common script patterns
  const hasDevanagari = /[\u0900-\u097F]/.test(text); // Hindi, Sanskrit
  const hasBengali = /[\u0980-\u09FF]/.test(text); // Bengali
  const hasTamil = /[\u0B80-\u0BFF]/.test(text); // Tamil
  const hasTelugu = /[\u0C00-\u0C7F]/.test(text); // Telugu
  const hasGujarati = /[\u0A80-\u0AFF]/.test(text); // Gujarati
  const hasArabic = /[\u0600-\u06FF]/.test(text); // Arabic
  
  if (hasDevanagari) return 'hi';
  if (hasBengali) return 'bn';
  if (hasTamil) return 'ta';
  if (hasTelugu) return 'te';
  if (hasGujarati) return 'gu';
  if (hasArabic) return 'ar';
  
  return 'en';
}
