import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from '../lib/gemini.js';
import { requireAuth } from '../lib/auth.js';
import { findUserById, getAllUsers } from '../lib/mongodb.js';

/**
 * GET /api/admin/users
 * 모든 사용자 목록 조회 (관리자 전용)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 인증 확인
        const auth = requireAuth(req);
        if (!auth.authenticated || !auth.userId) {
            return res.status(401).json({
                success: false,
                error: auth.error || '인증이 필요합니다.',
            });
        }

        // 관리자 권한 확인
        const currentUser = await findUserById(auth.userId);
        if (!currentUser?.isAdmin) {
            return res.status(403).json({
                success: false,
                error: '관리자 권한이 필요합니다.',
            });
        }

        // 모든 사용자 목록 조회
        const users = await getAllUsers();

        return res.status(200).json({
            success: true,
            users,
            totalCount: users.length,
        });
    } catch (error) {
        console.error('Admin users error:', error);
        return res.status(500).json({
            success: false,
            error: '사용자 목록 조회 중 오류가 발생했습니다.',
        });
    }
}
