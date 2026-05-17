import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth.js';
import { getAIClientForUser, setCorsHeaders, MODELS } from '../lib/gemini.js';
import { findUserById } from '../lib/mongodb.js';
import pkg from 'wavefile';
const { WaveFile } = pkg;

function convertPcmToWav(base64PcmData: string, sampleRate: number = 24000): { wavBase64: string; durationMs: number } {
  const pcmBuffer = Buffer.from(base64PcmData, 'base64');
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
  const wav = new WaveFile();
  wav.fromScratch(1, sampleRate, '16', samples);
  const wavBuffer = wav.toBuffer();
  const wavBase64 = Buffer.from(wavBuffer).toString('base64');
  const durationMs = Math.round((samples.length / sampleRate) * 1000);
  return { wavBase64, durationMs };
}

interface NarrationInput {
  sceneNumber: number;
  narration: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, req.headers.origin as string);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireAuth(req);
  if (!auth.authenticated || !auth.userId) {
    return res.status(401).json({ error: auth.error || '로그인이 필요합니다.' });
  }

  try {
    const { scenes, ttsProvider = 'openai', ttsModel, voice, batchSize = 5 } = req.body;
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ error: 'scenes array is required' });
    }

    const results: { sceneNumber: number; success: boolean; audio?: any; durationSeconds?: number; error?: string }[] = [];

    for (let i = 0; i < scenes.length; i += batchSize) {
      const batch = scenes.slice(i, i + batchSize) as NarrationInput[];

      const batchPromises = batch.map(async (scene) => {
        try {
          if (ttsProvider === 'openai') {
            return await generateOpenAiTts(auth.userId!, scene, ttsModel || 'tts-1', voice || 'nova');
          } else {
            return await generateGeminiTts(auth.userId!, scene, voice || 'Kore');
          }
        } catch (err) {
          return {
            sceneNumber: scene.sceneNumber,
            success: false,
            error: err instanceof Error ? err.message : 'TTS failed',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i + batchSize < scenes.length) {
        await new Promise(r => setTimeout(r, ttsProvider === 'openai' ? 2000 : 5000));
      }
    }

    return res.status(200).json({ results });
  } catch (e) {
    console.error('[longform/generate-narrations] Error:', e);
    return res.status(500).json({ error: `Narrations generation failed: ${e instanceof Error ? e.message : 'Unknown'}` });
  }
}

async function generateOpenAiTts(
  userId: string,
  scene: NarrationInput,
  model: string,
  voice: string
) {
  const user = await findUserById(userId);
  // 일반 사용자는 본인 키만, 관리자만 환경변수 폴백 허용 (비용 누수 차단)
  const personalKey = user?.settings?.openaiApiKey;
  const openaiApiKey = personalKey || (user?.isAdmin ? process.env.OPENAI_API_KEY : undefined);
  if (!openaiApiKey) throw new Error('OpenAI API 키가 설정되지 않았습니다. 설정에서 본인 OpenAI API 키를 입력해 주세요.');

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: scene.narration,
      voice,
      response_format: 'mp3',
      speed: 1.0,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI TTS error: ${response.status} - ${err}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const durationSeconds = scene.narration.length / 5; // rough estimate

  return {
    sceneNumber: scene.sceneNumber,
    success: true,
    audio: { mimeType: 'audio/mp3', data: base64 },
    durationSeconds: Math.round(durationSeconds),
  };
}

async function generateGeminiTts(
  userId: string,
  scene: NarrationInput,
  voice: string
) {
  const aiClient = await getAIClientForUser(userId);
  const ttsModel = MODELS.TTS;

  const response = await aiClient.models.generateContent({
    model: ttsModel,
    contents: `한국어 다큐멘터리 나레이터 톤으로 읽어주세요.\n\n${scene.narration}`,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const { wavBase64, durationMs } = convertPcmToWav(part.inlineData.data);
      return {
        sceneNumber: scene.sceneNumber,
        success: true,
        audio: { mimeType: 'audio/wav', data: wavBase64 },
        durationSeconds: Math.round(durationMs / 1000),
      };
    }
  }
  throw new Error('No audio generated');
}
