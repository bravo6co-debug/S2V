import jwt from 'jsonwebtoken';
import type { VercelRequest } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface TokenPayload {
    userId: string;
    timestamp: number;
}

/**
 * JWT 토큰 생성 (7일 유효)
 */
export function generateToken(userId: string): string {
    return jwt.sign(
        { userId, timestamp: Date.now() } as TokenPayload,
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

/**
 * JWT 토큰 검증 및 디코드
 */
export function verifyToken(token: string): TokenPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        return decoded;
    } catch {
        return null;
    }
}

/**
 * 요청에서 인증 토큰 추출 및 사용자 ID 반환
 */
export function getUserIdFromRequest(req: VercelRequest): string | null {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyToken(token);

    return payload?.userId || null;
}

/**
 * 인증 미들웨어 - 인증 실패 시 에러 응답 반환
 */
export function requireAuth(req: VercelRequest): { authenticated: boolean; userId?: string; error?: string } {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
        return {
            authenticated: false,
            error: '인증이 필요합니다. 로그인해 주세요.',
        };
    }

    return { authenticated: true, userId };
}
