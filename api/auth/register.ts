import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from '../lib/gemini.js';
import { createUser } from '../lib/mongodb.js';
import { generateToken } from '../lib/auth.js';

/**
 * POST /api/auth/register
 * 회원가입
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

        // 유효성 검사
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

        // 이메일 형식 검사
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: '올바른 이메일 형식이 아닙니다.',
            });
        }

        // 비밀번호 길이 검사
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: '비밀번호는 6자 이상이어야 합니다.',
            });
        }

        // 사용자 생성
        const result = await createUser(email, password);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
            });
        }

        // 자동 로그인을 위한 토큰 생성
        const token = generateToken(result.userId!);

        return res.status(201).json({
            success: true,
            message: '회원가입이 완료되었습니다.',
            token,
            user: {
                id: result.userId,
                email: email.toLowerCase(),
                isAdmin: false,
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({
            success: false,
            error: '회원가입 처리 중 오류가 발생했습니다.',
        });
    }
}
