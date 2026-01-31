import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from './lib/gemini.js';
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
        console.log(`Food: ${foodName}, Person: ${personImage ? 'uploaded' : `generate(${personType})`}`);

        const apiKey = await getEachLabsApiKey(auth.userId);

        // Step 1: 인물 이미지 준비 (업로드 또는 생성)
        let finalPersonImage: ImageData;

        if (personImage?.data) {
            console.log('Using uploaded person image');
            finalPersonImage = personImage;
        } else {
            console.log(`Generating person portrait: ${personType}`);
            const personPrompt = PERSON_PROMPTS[personType] || PERSON_PROMPTS['young-woman'];

            // FLUX Kontext Pro로 인물 초상화 생성 (단일 이미지, 참조 없음)
            // flux-2-turbo-edit를 사용하면 참조 없이도 프롬프트로 생성 가능
            finalPersonImage = await generateFlux2Edit({
                apiKey,
                prompt: personPrompt,
                referenceImages: [],  // 참조 없이 프롬프트만으로 생성
                aspectRatio: '9:16',
                guidanceScale: 3.5,
            });
            console.log('Person portrait generated successfully');
        }

        // Step 2: FLUX 2 Turbo Edit로 먹방 합성 이미지 생성
        // 참조 이미지: [인물, 음식]
        console.log('Generating mukbang composite image...');
        const mukbangPrompt = buildMukbangPrompt(foodName.trim());
        console.log('Mukbang prompt:', mukbangPrompt);

        const compositeImage = await generateFlux2Edit({
            apiKey,
            prompt: mukbangPrompt,
            referenceImages: [finalPersonImage, foodImage],
            aspectRatio: '9:16',
            guidanceScale: 2.5,
        });

        console.log('=== MUKBANG IMAGE GENERATION SUCCESS ===');

        const videoPrompt = buildMukbangVideoPrompt(foodName.trim());

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
