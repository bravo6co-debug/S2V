import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';

/**
 * GET /api/download-video?fileId=xxx
 * Video download proxy for Google Gemini API generated videos
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    // Preflight 요청 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET 요청만 허용
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 인증 체크
    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
        return res.status(401).json({
            success: false,
            error: auth.error || '로그인이 필요합니다.'
        });
    }

    const { fileId } = req.query;

    if (!fileId || typeof fileId !== 'string') {
        return res.status(400).json({ error: 'fileId parameter is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
        console.error('API key not configured');
        return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }

    try {
        // Google API에서 비디오 파일 다운로드
        const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?alt=media&key=${apiKey}`;

        console.log(`Downloading video: files/${fileId}`);

        const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                'Accept': 'video/mp4, */*',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Google API error: ${response.status} - ${errorText}`);
            return res.status(response.status).json({
                error: `Failed to download video: ${response.statusText}`,
                details: errorText
            });
        }

        // Content-Type 및 Content-Disposition 헤더 설정
        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="video_${fileId}.mp4"`);

        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        // 비디오 데이터 스트리밍
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`Video downloaded successfully: ${buffer.length} bytes`);

        return res.status(200).send(buffer);

    } catch (error) {
        console.error('Video download error:', error);
        return res.status(500).json({
            error: 'Failed to download video',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
