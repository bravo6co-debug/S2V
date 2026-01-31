import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { getUserSettings, saveUserSettings, DEFAULT_SETTINGS } from './lib/mongodb.js';

/**
 * GET /api/settings - 사용자 설정 조회 (인증 필요)
 * PUT /api/settings - 사용자 설정 저장 (인증 필요)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 인증 확인
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
        return res.status(401).json({ error: auth.error });
    }

    const userId = auth.userId;

    try {
        if (req.method === 'GET') {
            // 사용자 설정 조회
            const settings = await getUserSettings(userId);

            // API 키는 마스킹해서 반환 (보안)
            const maskedSettings = {
                ...settings,
                geminiApiKey: settings.geminiApiKey
                    ? maskApiKey(settings.geminiApiKey)
                    : undefined,
                hailuoApiKey: settings.hailuoApiKey
                    ? maskApiKey(settings.hailuoApiKey)
                    : undefined,
                hasApiKey: !!settings.geminiApiKey,
                hasHailuoApiKey: !!settings.hailuoApiKey,
            };

            return res.status(200).json({
                success: true,
                settings: maskedSettings,
                defaults: DEFAULT_SETTINGS,
            });
        }

        if (req.method === 'PUT') {
            // 설정 저장
            const {
                geminiApiKey,
                hailuoApiKey,
                textModel,
                imageModel,
                videoModel,
                ttsModel,
                ttsVoice,
            } = req.body;

            // 유효성 검사
            const validTextModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
            const validImageModels = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image', 'imagen-4.0-generate-001', 'imagen-4.0-fast-generate-001', 'flux-kontext-pro', 'flux-kontext-max'];
            const validVideoModels = ['minimax-hailuo-v2-3-fast-standard-image-to-video'];
            const validTtsModels = ['gemini-2.5-flash-preview-tts'];
            const validTtsVoices = ['Kore', 'Aoede', 'Charon', 'Fenrir', 'Puck'];

            const updates: Record<string, unknown> = {};

            // Gemini API 키 (빈 문자열이면 기존 값 유지, null이면 삭제)
            if (geminiApiKey !== undefined) {
                if (geminiApiKey === null || geminiApiKey === '') {
                    updates.geminiApiKey = undefined;
                } else if (typeof geminiApiKey === 'string' && geminiApiKey.trim()) {
                    updates.geminiApiKey = geminiApiKey.trim();
                }
            }

            // Hailuo API 키 (동영상 생성용)
            if (hailuoApiKey !== undefined) {
                if (hailuoApiKey === null || hailuoApiKey === '') {
                    updates.hailuoApiKey = undefined;
                } else if (typeof hailuoApiKey === 'string' && hailuoApiKey.trim()) {
                    updates.hailuoApiKey = hailuoApiKey.trim();
                }
            }

            // 모델 설정 검증 및 업데이트
            if (textModel && validTextModels.includes(textModel)) {
                updates.textModel = textModel;
            }

            if (imageModel && validImageModels.includes(imageModel)) {
                updates.imageModel = imageModel;
            }

            if (videoModel && validVideoModels.includes(videoModel)) {
                updates.videoModel = videoModel;
            }

            if (ttsModel && validTtsModels.includes(ttsModel)) {
                updates.ttsModel = ttsModel;
            }

            if (ttsVoice && validTtsVoices.includes(ttsVoice)) {
                updates.ttsVoice = ttsVoice;
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: '업데이트할 유효한 설정이 없습니다.',
                });
            }

            const success = await saveUserSettings(userId, updates);

            if (!success) {
                return res.status(500).json({
                    success: false,
                    error: '설정 저장에 실패했습니다.',
                });
            }

            // 업데이트된 설정 반환
            const newSettings = await getUserSettings(userId);
            const maskedSettings = {
                ...newSettings,
                geminiApiKey: newSettings.geminiApiKey
                    ? maskApiKey(newSettings.geminiApiKey)
                    : undefined,
                hailuoApiKey: newSettings.hailuoApiKey
                    ? maskApiKey(newSettings.hailuoApiKey)
                    : undefined,
                hasApiKey: !!newSettings.geminiApiKey,
                hasHailuoApiKey: !!newSettings.hailuoApiKey,
            };

            return res.status(200).json({
                success: true,
                message: '설정이 저장되었습니다.',
                settings: maskedSettings,
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Settings API error:', error);
        return res.status(500).json({
            success: false,
            error: '설정 처리 중 오류가 발생했습니다.',
        });
    }
}

/**
 * API 키 마스킹 (앞 8자리만 표시)
 */
function maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
        return '********';
    }
    return apiKey.substring(0, 8) + '********';
}
