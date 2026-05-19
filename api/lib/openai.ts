/**
 * OpenAI API utility for text generation
 * Used when user selects an OpenAI model for text/scenario generation
 */

import { findUserById } from './mongodb.js';

/**
 * OpenAI 모델인지 확인
 */
export function isOpenAIModel(model: string): boolean {
    return model.startsWith('gpt-') || model.startsWith('o3-') || model.startsWith('o4-');
}

/**
 * 사용자의 OpenAI API 키 가져오기
 * - 일반 사용자: 본인 설정 키만 사용
 * - 관리자(isAdmin): 환경변수(OPENAI_API_KEY) 우선, 없으면 본인 키
 */
export async function getOpenAIKeyForUser(userId: string): Promise<string> {
    const user = await findUserById(userId);
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');

    // 어드민: 환경변수 키 우선
    if (user.isAdmin) {
        const key = process.env.OPENAI_API_KEY || user.settings?.openaiApiKey;
        if (!key) throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        return key;
    }

    // 일반 사용자: 본인 설정 키만 사용 (관리자 환경변수 키로 비용 누수 차단)
    const key = user.settings?.openaiApiKey;
    if (!key) throw new Error('OpenAI API 키가 설정되지 않았습니다. 설정에서 본인 OpenAI API 키를 입력해 주세요.');
    return key;
}

interface OpenAITextOptions {
    systemPrompt?: string;
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
}

/**
 * OpenAI Chat Completions API를 사용한 텍스트 생성
 * JSON 모드 지원
 */
export async function generateTextWithOpenAI(
    apiKey: string,
    model: string,
    prompt: string,
    options: OpenAITextOptions = {}
): Promise<string> {
    const { systemPrompt, jsonMode = true, maxTokens, temperature } = options;

    if (!systemPrompt) {
        // 기존 fallback('You are a helpful assistant')은 가드레일이 전혀 없어
        // jailbreak/PII/유해 콘텐츠/prompt injection에 무방비. 명시 강제로 차단.
        throw new Error(
            '[openai.ts] systemPrompt is required. ' +
            'Empty/default prompts produce unsafe outputs (no guardrails for jailbreak, PII, sensitive topics). ' +
            'Pass a domain-specific systemPrompt via options.systemPrompt.'
        );
    }

    const messages: { role: string; content: string }[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
    ];

    const body: Record<string, unknown> = { model, messages };

    if (jsonMode) {
        body.response_format = { type: 'json_object' };
    }
    if (maxTokens) body.max_tokens = maxTokens;
    if (temperature !== undefined) body.temperature = temperature;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}
