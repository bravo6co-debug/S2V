import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from '../lib/gemini.js';
import { getDatabase } from '../lib/mongodb.js';
import crypto from 'crypto';

/**
 * POST /api/admin/setup
 * 일회성 어드민 계정 생성 (사용 후 이 파일 삭제 필요)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { secretKey } = req.body;

        // 간단한 보안 체크 (환경변수나 하드코딩된 키)
        if (secretKey !== 'CREATE_ADMIN_2024') {
            return res.status(403).json({ error: 'Invalid secret key' });
        }

        const db = await getDatabase();
        if (!db) {
            return res.status(500).json({ error: 'Database connection failed' });
        }

        const email = 'gamzon@kakao.com';
        const password = '1q2w3e4r';

        // 이미 존재하는지 확인
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            // 이미 존재하면 isAdmin만 업데이트
            await db.collection('users').updateOne(
                { email },
                { $set: { isAdmin: true, updatedAt: new Date() } }
            );
            return res.status(200).json({
                success: true,
                message: '기존 사용자를 어드민으로 업데이트했습니다.',
                email,
            });
        }

        // 비밀번호 해싱
        const salt = crypto.randomBytes(32).toString('hex');
        const passwordHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

        // 새 어드민 사용자 생성
        const result = await db.collection('users').insertOne({
            email,
            passwordHash,
            salt,
            isAdmin: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            settings: {
                textModel: 'gemini-2.5-flash',
                imageModel: 'gemini-2.5-flash-image',
                videoModel: 'veo-3.1-fast-generate-preview',
                ttsModel: 'gemini-2.5-flash-preview-tts',
                ttsVoice: 'Kore',
            },
        });

        return res.status(201).json({
            success: true,
            message: '어드민 계정이 생성되었습니다.',
            email,
            userId: result.insertedId.toString(),
        });
    } catch (error) {
        console.error('Admin setup error:', error);
        return res.status(500).json({
            success: false,
            error: '어드민 계정 생성 중 오류가 발생했습니다.',
        });
    }
}
