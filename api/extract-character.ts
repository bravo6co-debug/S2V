import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, MODELS, Type, sanitizePrompt, setCorsHeaders } from './lib/gemini.js';
import type { ExtractCharacterRequest, ExtractCharacterResponse, ApiErrorResponse } from './lib/types.js';

/**
 * POST /api/extract-character
 * Extracts character data from Korean description
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCorsHeaders(res, req.headers.origin as string);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' } as ApiErrorResponse);
    }

    try {
        const { description } = req.body as ExtractCharacterRequest;

        if (!description) {
            return res.status(400).json({ error: 'description is required' } as ApiErrorResponse);
        }

        const sanitizedDescription = sanitizePrompt(description);

        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `다음 한국어 캐릭터 설명을 분석해주세요. 캐릭터의 이름, 나이, 성격, 대표 의상을 추출하고, 이미지 생성 AI를 위해 외형 묘사를 영어로 번역해주세요. 모든 정보를 JSON 형식으로 반환해야 합니다. 만약 특정 정보가 없다면 빈 문자열("")을 사용하세요. 영어 번역은 캐릭터의 시각적 특징에 초점을 맞춰 상세하게 작성해야 합니다.\n\n---\n캐릭터 설명:\n"${sanitizedDescription}"\n---`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: {
                            type: Type.STRING,
                            description: "The character's name.",
                        },
                        age: {
                            type: Type.STRING,
                            description: "The character's age range (e.g., '20s', 'teenager').",
                        },
                        personality: {
                            type: Type.STRING,
                            description: "A brief description of the character's personality.",
                        },
                        outfit: {
                            type: Type.STRING,
                            description: "A description of the character's typical outfit.",
                        },
                        englishDescription: {
                            type: Type.STRING,
                            description: "A detailed English translation of the character's physical appearance, suitable for an image generation model.",
                        },
                    },
                    required: ["name", "age", "personality", "outfit", "englishDescription"],
                },
            },
        });

        const parsedJson = JSON.parse(response.text) as ExtractCharacterResponse;

        if (!parsedJson.englishDescription) {
            throw new Error("English description was not generated.");
        }

        return res.status(200).json(parsedJson);

    } catch (e) {
        console.error("Error during character data extraction:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({
            error: `Character data extraction failed: ${errorMessage}`,
            code: 'EXTRACTION_FAILED'
        } as ApiErrorResponse);
    }
}
