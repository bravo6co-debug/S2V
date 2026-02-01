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
 */
export async function getOpenAIKeyForUser(userId: string): Promise<string> {
    const user = await findUserById(userId);
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');

    // 어드민은 환경변수 키 우선 사용
    if (user.isAdmin) {
        const key = process.env.OPENAI_API_KEY || user.settings?.openaiApiKey;
        if (!key) throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        return key;
    }

    const key = user.settings?.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OpenAI API 키가 설정되지 않았습니다. 설정에서 OpenAI API 키를 입력해 주세요.');
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

    const messages: { role: string; content: string }[] = [];

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    } else if (jsonMode) {
        messages.push({ role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON.' });
    }

    messages.push({ role: 'user', content: prompt });

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
