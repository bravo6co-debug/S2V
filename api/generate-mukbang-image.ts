import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, ai, MODELS, sanitizePrompt, getAIClientForUser } from './lib/gemini.js';
import { requireAuth } from './lib/auth.js';
import { getEachLabsApiKey, generateFlux2Edit } from './lib/eachlabs.js';
import type { ImageData, ApiErrorResponse } from './lib/types.js';

// =============================================
// 인물 유형 정의
// =============================================

type PersonType = 'young-woman' | 'young-man' | 'middle-woman' | 'middle-man';

const PERSON_PROMPTS: Record<PersonType, string> = {
    'young-woman': 'A portrait photograph of a young Korean woman in her 20s, natural makeup, warm genuine smile, casual modern outfit, soft studio lighting, head and shoulders, photorealistic, no text',
    'young-man': 'A portrait photograph of a young Korean man in his 20s, clean-shaven, warm genuine smile, casual modern outfit, soft studio lighting, head and shoulders, photorealistic, no text',
    'middle-woman': 'A portrait photograph of a Korean woman in her 40s, elegant and warm, gentle smile, smart casual outfit, soft studio lighting, head and shoulders, photorealistic, no text',
    'middle-man': 'A portrait photograph of a Korean man in his 40s, warm and approachable, genuine smile, smart casual outfit, soft studio lighting, head and shoulders, photorealistic, no text',
};

// =============================================
// 먹방 합성 프롬프트 템플릿
// =============================================

function buildMukbangPrompt(foodName: string): string {
    return `Photorealistic food photography scene, the ${foodName} is the hero subject occupying the center and lower two-thirds of the frame in sharp focus with beautiful plating and garnish, a person sits behind the table slightly out of focus holding chopsticks or utensils reaching toward the ${foodName}, warm golden ambient lighting, overhead angle tilted slightly toward the food, shallow depth of field focused on the food, restaurant table setting, absolutely no visible text letters numbers or writing in any language including on screens signs labels and packaging, no watermarks`;
}

// =============================================
// 먹방 영상용 모션 프롬프트 템플릿
// =============================================

function buildMukbangVideoPrompt(foodName: string): string {
    return `Cinematic scene starting with an extreme close-up of ${foodName} with steam rising and glistening texture in sharp focus, then the camera slowly pulls back and tilts up to gradually reveal a person sitting at the table picking up the ${foodName} with chopsticks and eating with genuine enjoyment, smooth dolly-out zoom-out camera movement, warm golden lighting, shallow depth of field keeping food in focus, food advertising quality, 4K cinematic`;
}

// =============================================
// API 핸들러
// =============================================

interface GenerateMukbangImageRequest {
    foodImage: ImageData;
    foodName: string;
    personImage?: ImageData;
    generatePerson?: boolean;
    personType?: PersonType;
    customPersonPrompt?: string;  // 사용자 한국어 인물 설명 (직접 입력)
    customScenePrompt?: string;   // 사용자 한국어 씬 설명 (직접 입력)
}

// =============================================
// 한국어 인물 설명 → 영어 포트레이트 프롬프트 변환
// =============================================

async function translatePersonDescription(koreanDesc: string, userId: string): Promise<string> {
    const aiClient = await getAIClientForUser(userId);
    const client = aiClient || ai;

    const response = await client.models.generateContent({
        model: MODELS.TEXT,
        contents: `Convert the following Korean person description into an English portrait photo prompt.
Keep it concise (1-2 sentences). Focus on: age, gender, appearance, hairstyle, clothing, expression.

Korean description: "${sanitizePrompt(koreanDesc, 500)}"

Output format (English only, no Korean):
"A portrait photograph of a Korean [person description], [appearance details], [expression], [clothing]"`,
        config: {
            temperature: 0.3,
        },
    });

    const translated = (response.text || '').replace(/^["']|["']$/g, '').trim();

    // 포트레이트 필수 접미사 보장
    const suffix = 'soft studio lighting, head and shoulders, photorealistic, no text';
    if (translated.toLowerCase().includes('photorealistic')) {
        return translated;
    }
    return `${translated}, ${suffix}`;
}

// =============================================
// 한국어 씬 설명 → 영어 먹방 프롬프트 변환
// =============================================

async function translateSceneDescription(koreanDesc: string, foodName: string, userId: string): Promise<string> {
    const aiClient = await getAIClientForUser(userId);
    const client = aiClient || ai;

    const response = await client.models.generateContent({
        model: MODELS.TEXT,
        contents: `Convert the following Korean food scene description into an English photorealistic food photography prompt.
The food is "${foodName}". Keep it concise (2-3 sentences).
Focus on: composition, lighting, camera angle, person interaction with food, atmosphere.
MUST include these constraints: no visible text/letters/numbers/writing, no watermarks, photorealistic quality.

Korean description: "${sanitizePrompt(koreanDesc, 500)}"

Output format (English only, no Korean):
"Photorealistic food photography scene, [scene description], [lighting], [camera angle], absolutely no visible text letters numbers or writing, no watermarks"`,
        config: {
            temperature: 0.3,
        },
    });

    const translated = (response.text || '').replace(/^["']|["']$/g, '').trim();

    // 필수 접미사 보장: 텍스트 금지
    const noTextSuffix = 'absolutely no visible text letters numbers or writing in any language, no watermarks';
    if (translated.toLowerCase().includes('no visible text')) {
        return translated;
    }
    return `${translated}, ${noTextSuffix}`;
}

// =============================================
// 한국어 씬 설명 → 영어 비디오 모션 프롬프트 변환
// =============================================

async function translateVideoDescription(koreanDesc: string, foodName: string, userId: string): Promise<string> {
    const aiClient = await getAIClientForUser(userId);
    const client = aiClient || ai;

    const response = await client.models.generateContent({
        model: MODELS.TEXT,
        contents: `Convert the following Korean food scene description into an English cinematic video motion prompt.
The food is "${foodName}". Keep it concise (2-3 sentences).
Focus on: camera movement (dolly, zoom, pan, tilt), food interaction, motion dynamics, cinematic quality.

Korean description: "${sanitizePrompt(koreanDesc, 500)}"

Output format (English only, no Korean):
"Cinematic scene [camera movement and action description], warm golden lighting, shallow depth of field, food advertising quality, 4K cinematic"`,
        config: {
            temperature: 0.3,
        },
    });

    const translated = (response.text || '').replace(/^["']|["']$/g, '').trim();

    // 시네마틱 접미사 보장
    if (translated.toLowerCase().includes('4k cinematic') || translated.toLowerCase().includes('cinematic')) {
        return translated;
    }
    return `${translated}, food advertising quality, 4K cinematic`;
}

interface MukbangImageResult {
    compositeImage: ImageData;
    videoPrompt: string;
}

/**
 * POST /api/generate-mukbang-image
 * FLUX 2 Turbo Edit로 인물 + 음식 합성 이미지 생성
 *
 * - foodImage: 음식 사진 (필수, 업로드)
 * - foodName: 음식 이름 (필수, e.g., "라면", "치킨")
 * - personImage: 인물 사진 (업로드한 경우)
 * - generatePerson: true이면 인물 자동 생성
 * - personType: 인물 유형 (generatePerson=true일 때)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    const auth = requireAuth(req);
    if (!auth.authenticated || !auth.userId) {
        return res.status(401).json({
            success: false,
            error: auth.error || '로그인이 필요합니다.'
        });
    }

    try {
        const {
            foodImage,
            foodName,
            personImage,
            generatePerson,
            personType = 'young-woman',
            customPersonPrompt,
            customScenePrompt,
        } = req.body as GenerateMukbangImageRequest;

        if (!foodImage?.data || !foodImage?.mimeType) {
            return res.status(400).json({ error: '음식 이미지가 필요합니다.' } as ApiErrorResponse);
        }

        if (!foodName?.trim()) {
            return res.status(400).json({ error: '음식 이름을 입력해 주세요.' } as ApiErrorResponse);
        }

        if (!personImage && !generatePerson) {
            return res.status(400).json({ error: '인물 사진을 업로드하거나 자동 생성을 선택해 주세요.' } as ApiErrorResponse);
        }

        console.log('=== MUKBANG IMAGE GENERATION START ===');
        console.log(`Food: ${foodName}, Person: ${personImage ? 'uploaded' : customPersonPrompt ? `custom("${customPersonPrompt}")` : `preset(${personType})`}`);

        const apiKey = await getEachLabsApiKey(auth.userId);

        // Step 1: 인물 이미지 준비 (업로드 또는 생성)
        let finalPersonImage: ImageData;

        if (personImage?.data) {
            console.log('Using uploaded person image');
            finalPersonImage = personImage;
        } else {
            let personPrompt: string;

            if (customPersonPrompt?.trim()) {
                // 커스텀 한국어 설명 → 영어 포트레이트 프롬프트 변환
                console.log(`Translating custom person description: ${customPersonPrompt}`);
                personPrompt = await translatePersonDescription(customPersonPrompt.trim(), auth.userId);
                console.log(`Translated prompt: ${personPrompt}`);
            } else {
                // 기존 프리셋 사용
                console.log(`Using preset person type: ${personType}`);
                personPrompt = PERSON_PROMPTS[personType] || PERSON_PROMPTS['young-woman'];
            }

            finalPersonImage = await generateFlux2Edit({
                apiKey,
                prompt: personPrompt,
                referenceImages: [],
                aspectRatio: '9:16',
                guidanceScale: 3.5,
            });
            console.log('Person portrait generated successfully');
        }

        // Step 2: FLUX 2 Turbo Edit로 먹방 합성 이미지 생성
        // 참조 이미지: [인물, 음식]
        console.log('Generating mukbang composite image...');

        let mukbangPrompt: string;
        let videoPrompt: string;

        if (customScenePrompt?.trim()) {
            // 커스텀 한국어 씬 설명 → 영어 프롬프트 변환
            console.log(`Translating custom scene description: ${customScenePrompt}`);
            mukbangPrompt = await translateSceneDescription(customScenePrompt.trim(), foodName.trim(), auth.userId);
            videoPrompt = await translateVideoDescription(customScenePrompt.trim(), foodName.trim(), auth.userId);
            console.log(`Translated scene prompt: ${mukbangPrompt}`);
            console.log(`Translated video prompt: ${videoPrompt}`);
        } else {
            // 기본 프롬프트 사용
            mukbangPrompt = buildMukbangPrompt(foodName.trim());
            videoPrompt = buildMukbangVideoPrompt(foodName.trim());
        }

        console.log('Mukbang prompt:', mukbangPrompt);

        const compositeImage = await generateFlux2Edit({
            apiKey,
            prompt: mukbangPrompt,
            referenceImages: [finalPersonImage, foodImage],
            aspectRatio: '9:16',
            guidanceScale: 2.5,
        });

        console.log('=== MUKBANG IMAGE GENERATION SUCCESS ===');

        const result: MukbangImageResult = {
            compositeImage,
            videoPrompt,
        };

        return res.status(200).json(result);

    } catch (e) {
        console.error('=== MUKBANG IMAGE GENERATION ERROR ===');
        console.error('Error:', e);

        if (e instanceof Error) {
            const msg = e.message;

            if (msg.includes('API 키가 유효하지 않') || msg.includes('401') || msg.includes('Unauthorized')) {
                return res.status(403).json({
                    error: 'EachLabs API 키가 유효하지 않습니다. 설정에서 키를 확인하세요.',
                    code: 'API_KEY_INVALID'
                } as ApiErrorResponse);
            }

            if (msg.includes('API 키가 설정되지 않') || msg.includes('MISSING')) {
                return res.status(400).json({
                    error: 'EachLabs(Hailuo) API 키가 설정되지 않았습니다. 설정에서 키를 등록하세요.',
                    code: 'API_KEY_MISSING'
                } as ApiErrorResponse);
            }

            return res.status(500).json({
                error: `먹방 이미지 생성 실패: ${msg}`,
                code: 'MUKBANG_IMAGE_FAILED'
            } as ApiErrorResponse);
        }

        return res.status(500).json({
            error: '먹방 이미지 생성 중 알 수 없는 오류가 발생했습니다.',
            code: 'UNKNOWN_ERROR'
        } as ApiErrorResponse);
    }
}
