import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from '../lib/gemini.js';
import { generateToken } from '../lib/auth.js';
import { findUserByEmail, verifyUserPassword } from '../lib/mongodb.js';

/**
 * POST /api/auth/login
 * 이메일/비밀번호로 로그인하고 JWT 토큰 반환
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
        const { email, password } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                success: false,
                error: '이메일을 입력해 주세요.',
            });
        }

        if (!password || typeof password !== 'string') {
            return res.status(400).json({
                success: false,
                error: '비밀번호를 입력해 주세요.',
            });
        }

        // 사용자 조회
        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: '이메일 또는 비밀번호가 올바르지 않습니다.',
            });
        }

        // 비밀번호 확인
        if (!verifyUserPassword(password, user.passwordHash, user.salt)) {
            return res.status(401).json({
                success: false,
                error: '이메일 또는 비밀번호가 올바르지 않습니다.',
            });
        }

        // 토큰 생성
        const token = generateToken(user._id.toString());

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id.toString(),
                email: user.email,
                hasApiKey: !!user.settings?.geminiApiKey,
                isAdmin: user.isAdmin || false,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            error: '로그인 처리 중 오류가 발생했습니다.',
        });
    }
}
