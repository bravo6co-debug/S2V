import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, TTS_VOICES, setCorsHeaders } from './lib/gemini.js';
import type { TTSVoice } from './lib/gemini.js';
import type { ApiErrorResponse } from './lib/types.js';

interface GenerateNarrationRequest {
    text: string;           // 나레이션 텍스트
    voice?: TTSVoice;       // 음성 선택 (기본: Kore)
    sceneId?: string;       // 씬 ID (선택)
}

interface GenerateNarrationResponse {
    audioData: string;      // Base64 인코딩된 오디오 데이터
    mimeType: string;       // audio/wav
    durationMs?: number;    // 오디오 길이 (밀리초)
    sceneId?: string;       // 씬 ID
}

/**
 * POST /api/generate-narration
 * Generates TTS audio from narration text using Gemini TTS
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    try {
        const { text, voice = TTS_VOICES.KORE, sceneId } = req.body as GenerateNarrationRequest;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                error: 'text is required and must be a string',
                code: 'INVALID_INPUT'
            } as ApiErrorResponse);
        }

        // 텍스트 길이 제한 (TTS 모델 제한)
        if (text.length > 500) {
            return res.status(400).json({
                error: 'Text too long (max 500 characters for TTS)',
                code: 'TEXT_TOO_LONG'
            } as ApiErrorResponse);
        }

        console.log(`[TTS] Generating narration for: "${text.substring(0, 50)}..." with voice: ${voice}`);

        // Gemini TTS API 호출
        const response = await ai.models.generateContent({
            model: MODELS.TTS,
            contents: text,
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voice
                        }
                    }
                }
            }
        });

        // 응답에서 오디오 데이터 추출
        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts?.[0]) {
            throw new Error('No audio data in response');
        }

        const audioPart = candidate.content.parts[0];

        // inlineData 확인
        if (!audioPart.inlineData?.data) {
            throw new Error('No inline audio data found');
        }

        const audioData = audioPart.inlineData.data;
        const mimeType = audioPart.inlineData.mimeType || 'audio/wav';

        console.log(`[TTS] Generated audio: ${mimeType}, ${Math.round(audioData.length / 1024)}KB`);

        return res.status(200).json({
            audioData,
            mimeType,
            sceneId
        } as GenerateNarrationResponse);

    } catch (e) {
        console.error("Error during TTS generation:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';

        // 특정 에러 처리
        if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
            return res.status(429).json({
                error: 'TTS API rate limit exceeded. Please try again later.',
                code: 'RATE_LIMITED'
            } as ApiErrorResponse);
        }

        return res.status(500).json({
            error: `TTS generation failed: ${errorMessage}`,
            code: 'TTS_FAILED'
        } as ApiErrorResponse);
    }
}
