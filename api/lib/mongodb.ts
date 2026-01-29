import { MongoClient, Db, ObjectId } from 'mongodb';
import crypto from 'crypto';

const uri = process.env.MONGODB_URI || process.env.s2v_MONGODB_URI;

if (!uri) {
    console.warn('MONGODB_URI or s2v_MONGODB_URI is not defined. Using fallback settings.');
}

let client: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * MongoDB 데이터베이스 연결
 * Vercel Serverless 환경에서 연결 풀링을 위해 캐싱 사용
 */
export async function getDatabase(): Promise<Db | null> {
    if (!uri) {
        return null;
    }

    if (cachedDb) {
        return cachedDb;
    }

    try {
        if (!client) {
            client = new MongoClient(uri);
            await client.connect();
        }

        cachedDb = client.db('s2v-db');
        return cachedDb;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        return null;
    }
}

// ============================================
// USER SCHEMA (다중 사용자 지원)
// ============================================

export interface User {
    _id: ObjectId;
    email: string;
    passwordHash: string;
    salt: string;
    isAdmin?: boolean; // 어드민 계정 (환경변수 API 키 사용 가능)
    createdAt: Date;
    updatedAt: Date;
    // 사용 통계
    lastLoginAt?: Date; // 마지막 로그인 시간
    lastActiveAt?: Date; // 마지막 활동 시간
    totalUsageMinutes?: number; // 총 사용 시간 (분)
    sessionStartedAt?: Date; // 현재 세션 시작 시간
    // 사용자별 설정
    settings: UserSettings;
}

export interface UserSettings {
    geminiApiKey?: string;
    textModel: string;
    imageModel: string;
    videoModel: string;
    ttsModel: string;
    ttsVoice: string;
}

/**
 * 기본 설정값
 */
export const DEFAULT_SETTINGS: UserSettings = {
    geminiApiKey: undefined,
    textModel: 'gemini-2.5-flash',
    imageModel: 'gemini-2.5-flash-image',
    videoModel: 'veo-3.1-fast-generate-preview',
    ttsModel: 'gemini-2.5-flash-preview-tts',
    ttsVoice: 'Kore',
};

// ============================================
// PASSWORD HASHING
// ============================================

function hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function generateSalt(): string {
    return crypto.randomBytes(32).toString('hex');
}

export function verifyUserPassword(password: string, hash: string, salt: string): boolean {
    const inputHash = hashPassword(password, salt);
    return inputHash === hash;
}

// ============================================
// USER CRUD
// ============================================

/**
 * 이메일로 사용자 조회
 */
export async function findUserByEmail(email: string): Promise<User | null> {
    const db = await getDatabase();
    if (!db) return null;

    try {
        return await db.collection<User>('users').findOne({ email: email.toLowerCase() });
    } catch (error) {
        console.error('Failed to find user:', error);
        return null;
    }
}

/**
 * ID로 사용자 조회
 */
export async function findUserById(userId: string): Promise<User | null> {
    const db = await getDatabase();
    if (!db) return null;

    try {
        return await db.collection<User>('users').findOne({ _id: new ObjectId(userId) });
    } catch (error) {
        console.error('Failed to find user:', error);
        return null;
    }
}

/**
 * 사용자 생성 (회원가입)
 */
export async function createUser(email: string, password: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    const db = await getDatabase();
    if (!db) {
        return { success: false, error: '데이터베이스에 연결할 수 없습니다.' };
    }

    try {
        // 이메일 중복 체크
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return { success: false, error: '이미 사용 중인 이메일입니다.' };
        }

        const salt = generateSalt();
        const passwordHash = hashPassword(password, salt);

        const result = await db.collection<User>('users').insertOne({
            _id: new ObjectId(),
            email: email.toLowerCase(),
            passwordHash,
            salt,
            createdAt: new Date(),
            updatedAt: new Date(),
            settings: { ...DEFAULT_SETTINGS },
        });

        return { success: true, userId: result.insertedId.toString() };
    } catch (error) {
        console.error('Failed to create user:', error);
        return { success: false, error: '회원가입 처리 중 오류가 발생했습니다.' };
    }
}

/**
 * 사용자 설정 조회
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
    const user = await findUserById(userId);
    if (user?.settings) {
        return user.settings;
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * 사용자 설정 저장
 */
export async function saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<boolean> {
    const db = await getDatabase();
    if (!db) return false;

    try {
        const updateFields: Record<string, unknown> = {};

        if (settings.geminiApiKey !== undefined) {
            updateFields['settings.geminiApiKey'] = settings.geminiApiKey || undefined;
        }
        if (settings.textModel) {
            updateFields['settings.textModel'] = settings.textModel;
        }
        if (settings.imageModel) {
            updateFields['settings.imageModel'] = settings.imageModel;
        }
        if (settings.videoModel) {
            updateFields['settings.videoModel'] = settings.videoModel;
        }
        if (settings.ttsModel) {
            updateFields['settings.ttsModel'] = settings.ttsModel;
        }
        if (settings.ttsVoice) {
            updateFields['settings.ttsVoice'] = settings.ttsVoice;
        }

        updateFields['updatedAt'] = new Date();

        await db.collection<User>('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateFields }
        );

        return true;
    } catch (error) {
        console.error('Failed to save user settings:', error);
        return false;
    }
}

// ============================================
// ADMIN FUNCTIONS (관리자 전용)
// ============================================

/**
 * 모든 사용자 목록 조회 (관리자 전용)
 */
export interface UserListItem {
    id: string;
    email: string;
    isAdmin: boolean;
    createdAt: Date;
    lastLoginAt?: Date;
    lastActiveAt?: Date;
    totalUsageMinutes: number;
    hasApiKey: boolean;
}

export async function getAllUsers(): Promise<UserListItem[]> {
    const db = await getDatabase();
    if (!db) return [];

    try {
        const users = await db.collection<User>('users')
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        return users.map(user => ({
            id: user._id.toString(),
            email: user.email,
            isAdmin: user.isAdmin || false,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
            lastActiveAt: user.lastActiveAt,
            totalUsageMinutes: user.totalUsageMinutes || 0,
            hasApiKey: !!user.settings?.geminiApiKey,
        }));
    } catch (error) {
        console.error('Failed to get all users:', error);
        return [];
    }
}

/**
 * 로그인 시간 업데이트
 */
export async function updateUserLogin(userId: string): Promise<boolean> {
    const db = await getDatabase();
    if (!db) return false;

    try {
        await db.collection<User>('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    lastLoginAt: new Date(),
                    lastActiveAt: new Date(),
                    sessionStartedAt: new Date(),
                }
            }
        );
        return true;
    } catch (error) {
        console.error('Failed to update user login:', error);
        return false;
    }
}

/**
 * 사용자 활동 시간 업데이트 (API 호출 시)
 */
export async function updateUserActivity(userId: string): Promise<boolean> {
    const db = await getDatabase();
    if (!db) return false;

    try {
        const user = await findUserById(userId);
        if (!user) return false;

        const now = new Date();
        let additionalMinutes = 0;

        // 세션 시작 시간이 있고, 30분 이내의 활동이면 사용 시간 누적
        if (user.sessionStartedAt) {
            const sessionStart = new Date(user.sessionStartedAt);
            const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : sessionStart;
            const timeSinceLastActive = (now.getTime() - lastActive.getTime()) / (1000 * 60);

            // 마지막 활동으로부터 30분 이내면 그 시간을 누적
            if (timeSinceLastActive <= 30) {
                additionalMinutes = timeSinceLastActive;
            }
        }

        await db.collection<User>('users').updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    lastActiveAt: now,
                },
                $inc: {
                    totalUsageMinutes: additionalMinutes,
                }
            }
        );

        return true;
    } catch (error) {
        console.error('Failed to update user activity:', error);
        return false;
    }
}

// ============================================
// LEGACY FUNCTIONS (하위 호환성)
// ============================================

/**
 * @deprecated Use getUserSettings instead
 */
export async function getSettings(): Promise<UserSettings & { _id: string; updatedAt: Date }> {
    return {
        _id: 'default',
        ...DEFAULT_SETTINGS,
        updatedAt: new Date(),
    };
}
