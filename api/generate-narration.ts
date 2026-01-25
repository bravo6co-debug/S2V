import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, TTS_VOICES, setCorsHeaders } from './lib/gemini.js';
import type { TTSVoice } from './lib/gemini.js';
import type { ApiErrorResponse } from './lib/types.js';
import WaveFile from 'wavefile';

interface GenerateNarrationRequest {
    text: string;           // 나레이션 텍스트
    voice?: TTSVoice;       // 음성 선택 (기본: Kore)
    sceneId?: string;       // 씬 ID (선택)
}

interface GenerateNarrationResponse {
    audioData: string;      // Base64 인코딩된 오디오 데이터 (WAV 포맷)
    mimeType: string;       // audio/wav
    durationMs?: number;    // 오디오 길이 (밀리초)
    sceneId?: string;       // 씬 ID
}

/**
 * Raw PCM 데이터를 WAV 파일로 변환
 * Gemini TTS API는 헤더가 없는 Raw PCM (24kHz, 16-bit, Mono)을 반환하므로
 * 브라우저에서 재생 가능한 WAV 파일로 변환해야 함
 */
function convertPcmToWav(base64PcmData: string, sampleRate: number = 24000): { wavBase64: string; durationMs: number } {
    // Base64 PCM 데이터를 Buffer로 변환
    const pcmBuffer = Buffer.from(base64PcmData, 'base64');

    // 16-bit PCM이므로 Int16Array로 변환
    const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);

    // WaveFile 객체 생성 및 PCM 데이터로 WAV 파일 구성
    // 1채널(Mono), 24kHz, 16비트
    const wav = new WaveFile();
    wav.fromScratch(1, sampleRate, '16', samples);

    // WAV 파일을 Buffer로 변환 후 Base64 인코딩
    const wavBuffer = wav.toBuffer();
    const wavBase64 = Buffer.from(wavBuffer).toString('base64');

    // 오디오 길이 계산 (샘플 수 / 샘플레이트 * 1000ms)
    const durationMs = Math.round((samples.length / sampleRate) * 1000);

    return { wavBase64, durationMs };
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

        // 안전 필터 차단 확인
        if (response.promptFeedback?.blockReason) {
            throw new Error(`Content blocked by safety filter: ${response.promptFeedback.blockReason}`);
        }

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

        const rawAudioData = audioPart.inlineData.data;
        const rawMimeType = audioPart.inlineData.mimeType || '';

        console.log(`[TTS] Raw audio received: ${rawMimeType}, ${Math.round(rawAudioData.length / 1024)}KB`);

        // 데이터 검증: 너무 작은 데이터는 오류로 처리 (침묵 또는 생성 실패)
        // 최소 1KB 이상이어야 유효한 오디오로 간주
        if (rawAudioData.length < 1000) {
            throw new Error('Generated audio data is too small - may be silence or generation failed');
        }

        // Gemini TTS는 Raw PCM (헤더 없음)을 반환하므로 WAV로 변환 필요
        // mimeType이 audio/wav가 아니거나, 실제로 WAV 헤더가 없는 경우 변환
        let audioData: string;
        let mimeType: string;
        let durationMs: number | undefined;

        // WAV 파일인지 확인 (RIFF 헤더 체크)
        const headerCheck = Buffer.from(rawAudioData.substring(0, 8), 'base64').toString('ascii');
        const isAlreadyWav = headerCheck.startsWith('RIFF');

        if (isAlreadyWav) {
            // 이미 유효한 WAV 파일이면 그대로 사용
            console.log('[TTS] Audio is already in WAV format');
            audioData = rawAudioData;
            mimeType = 'audio/wav';
        } else {
            // Raw PCM을 WAV로 변환
            console.log('[TTS] Converting Raw PCM to WAV format...');
            const converted = convertPcmToWav(rawAudioData, 24000);
            audioData = converted.wavBase64;
            durationMs = converted.durationMs;
            mimeType = 'audio/wav';
            console.log(`[TTS] Converted to WAV: ${Math.round(audioData.length / 1024)}KB, duration: ${durationMs}ms`);
        }

        return res.status(200).json({
            audioData,
            mimeType,
            durationMs,
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
