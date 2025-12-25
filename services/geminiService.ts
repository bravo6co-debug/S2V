
import { GoogleGenAI, Modality, Part, Type } from "@google/genai";
import { Character, ImageData, AspectRatio, ScenarioConfig, Scenario, Scene, ScenarioTone, StoryBeat, CameraAngle } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ============================================
// MODEL CONFIGURATION
// ============================================
const MODELS = {
    // 텍스트/프롬프트 생성용 모델
    TEXT: 'gemini-3-flash-preview',

    // 이미지 생성용 모델
    IMAGE_PORTRAIT: 'imagen-4.0-generate-001',  // 캐릭터/소품/배경 초상화 (참조 없이 생성)
    IMAGE_SCENE: 'gemini-3-pro-image-preview',  // 씬 이미지 (참조 이미지 기반)

    // 비디오 생성용 모델
    VIDEO: 'veo-3.1-generate-preview',
} as const;

// Highly specific, photography-based style prompts to ensure realism.
// Removed ambiguous terms like "digital painting" that could lead to non-photorealistic results.
const PHOTOREALISTIC_STYLES = [
    "Ultra-realistic DSLR photograph taken with an 85mm f/1.8 lens. The focus is tack-sharp on the subject's eyes, creating a creamy bokeh background. Lit with soft, natural light. A subtle, realistic film grain is visible.",
    "Cinematic film still from a modern Korean thriller. Shot with an anamorphic lens, creating subtle lens flare. The lighting is high-contrast and dramatic, with a slightly desaturated color palette, giving it an 8K hyper-detailed look.",
    "Authentic, candid street photography shot on Kodak Portra 400 film. Captures a genuine, unposed moment. The image has a distinct grainy texture and true-to-life colors characteristic of professional film stock.",
    "High-fashion editorial photograph. Lit with professional studio lighting, likely a large softbox, creating soft shadows and a clean look. Skin texture is perfect and natural. The color grading is sophisticated and deliberate.",
    "A raw, unposed documentary-style photo, captured with a 35mm lens using only available light. The focus is on capturing genuine emotion and telling a story through the environment. Appears unstaged and real.",
    "Hyper-detailed medium format photograph, as if taken with a Hasselblad camera. This results in incredible detail, texture, and tonal depth. The lighting is precisely controlled to sculpt the subject.",
    "Golden hour portrait. The lighting is warm, soft, and directional, creating long, gentle shadows and a beautiful glow on the subject. The depth of field is very shallow, isolating the character from the background.",
    "Atmospheric and moody photograph taken in a dimly lit interior setting. High ISO is used, resulting in noticeable but aesthetically pleasing film grain. Shallow depth of field isolates the subject from the surrounding darkness."
];


/**
 * Analyzes a Korean character description to extract structured data and an English translation for image generation.
 */
export const extractCharacterData = async (description: string): Promise<Omit<Character, 'id' | 'image'> & { englishDescription: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `다음 한국어 캐릭터 설명을 분석해주세요. 캐릭터의 이름, 나이, 성격, 대표 의상을 추출하고, 이미지 생성 AI를 위해 외형 묘사를 영어로 번역해주세요. 모든 정보를 JSON 형식으로 반환해야 합니다. 만약 특정 정보가 없다면 빈 문자열("")을 사용하세요. 영어 번역은 캐릭터의 시각적 특징에 초점을 맞춰 상세하게 작성해야 합니다.\n\n---\n캐릭터 설명:\n"${description}"\n---`,
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
        
        const parsedJson = JSON.parse(response.text);

        if (!parsedJson.englishDescription) {
             throw new Error("English description was not generated.");
        }

        return parsedJson;

    } catch (e) {
        console.error("Error during character data extraction:", e);
        if (e instanceof Error) {
            throw new Error(`Character data extraction failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred during character data extraction.");
    }
};

/**
 * Generates a single character portrait.
 */
const generateOneCharacterPortrait = async (prompt: string, aspectRatio: AspectRatio): Promise<ImageData> => {
    const finalPrompt = `
**TASK: Generate a photorealistic character portrait for a reference library.**

**CHARACTER DESCRIPTION:** "${prompt}"

**CRITICAL RULE: The character MUST be portrayed as ethnically Korean.** This is a non-negotiable, top-priority instruction.

---
**COMPOSITION & POSE (VERY STRICT):**
-   **Shot Type:** Bust shot (from the chest up), similar to a passport or ID photo.
-   **Pose:** The character MUST be facing directly forward, looking at the camera. The pose must be completely neutral and static. 
-   **Forbidden Poses:** No tilting of the head, no dynamic angles, and absolutely NO hands visible in the frame.
-   **Background:** Simple, non-distracting studio backdrop (solid light gray or off-white).
-   **Expression:** A completely neutral facial expression. No smiling or other emotions.
-   **Focus:** The focus must be entirely on the character.

---
**MANDATORY PHOTOGRAPHIC STYLE (NON-NEGOTIABLE):**
-   **Style:** Ultra-realistic, clean studio portrait.
-   **Lighting:** Bright, soft, and even lighting that illuminates the face clearly without creating harsh shadows. Think professional headshot lighting.
-   **Crucial Rule:** The final image MUST look like a real photograph. It must be indistinguishable from a photo taken with a high-end camera.
-   **Forbidden Effects:** Absolutely NO cinematic effects, no dramatic lighting, no lens flares, no heavy film grain, no vignettes, no color filters. The image should be plain and unstylized.

---
**FORBIDDEN ELEMENTS:**
-   The image MUST NOT contain any text, letters, words, numbers, watermarks, or typography.
`;

    try {
        const response = await ai.models.generateImages({
            model: MODELS.IMAGE_PORTRAIT,
            prompt: finalPrompt,
            config: {
                numberOfImages: 1, // Generate one at a time
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error("AI did not return any images. This could be due to a safety policy violation or a temporary service issue.");
        }
        
        const img = response.generatedImages[0];
        return {
            mimeType: 'image/jpeg',
            data: img.image.imageBytes,
        };

    } catch (e) {
        console.error("Error during single character portrait generation:", e);
        if (e instanceof Error) {
            throw new Error(`Single character generation failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred during single character generation.");
    }
};


/**
 * Generates one or more character portraits by calling generateOneCharacterPortrait in parallel.
 */
export const generateCharacterPortraits = async (
    prompt: string,
    numberOfImages: number,
    aspectRatio: AspectRatio
): Promise<ImageData[]> => {
     try {
        const generationPromises: Promise<ImageData>[] = [];
        for (let i = 0; i < numberOfImages; i++) {
            generationPromises.push(generateOneCharacterPortrait(prompt, aspectRatio));
        }
        const results = await Promise.all(generationPromises);
        return results.filter(Boolean); // Filter out any failed results
    } catch (e) {
        console.error("Error during parallel character portrait generation:", e);
        if (e instanceof Error) {
            throw new Error(`Character generation failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred during character generation.");
    }
};


/**
 * Generates a single prop image (object/item without people).
 */
const generateOnePropImage = async (prompt: string, aspectRatio: AspectRatio): Promise<ImageData> => {
    const finalPrompt = `
**TASK: Generate a photorealistic product/prop photograph for a reference library.**

**PROP DESCRIPTION:** "${prompt}"

**CRITICAL RULES:**
1. Generate ONLY the described object/prop - NO PEOPLE, NO HANDS, NO HUMAN BODY PARTS
2. The prop must be the sole subject of the image
3. Clean, professional product photography style

---
**COMPOSITION & SETUP (VERY STRICT):**
-   **Shot Type:** Clean product shot, centered in frame
-   **Background:** Simple, non-distracting backdrop (solid white, light gray, or subtle gradient)
-   **Angle:** 3/4 view or front view to show the object clearly
-   **Scale:** The object should fill approximately 60-80% of the frame
-   **Focus:** Sharp focus on the entire object

---
**MANDATORY PHOTOGRAPHIC STYLE (NON-NEGOTIABLE):**
-   **Style:** Professional product photography, e-commerce quality
-   **Lighting:** Clean, soft studio lighting. Even illumination with subtle shadows for depth
-   **Quality:** Ultra high resolution, sharp details, accurate colors

---
**ABSOLUTELY FORBIDDEN:**
-   NO humans, hands, fingers, or any body parts
-   NO text, watermarks, labels, or typography
-   NO busy or distracting backgrounds
-   NO artistic filters or heavy post-processing
`;

    try {
        const response = await ai.models.generateImages({
            model: MODELS.IMAGE_PORTRAIT,
            prompt: finalPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error("AI did not return any images.");
        }

        const img = response.generatedImages[0];
        return {
            mimeType: 'image/jpeg',
            data: img.image.imageBytes,
        };

    } catch (e) {
        console.error("Error during prop image generation:", e);
        if (e instanceof Error) {
            throw new Error(`Prop generation failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred during prop generation.");
    }
};

/**
 * Generates multiple prop images.
 */
export const generatePropImages = async (
    prompt: string,
    numberOfImages: number,
    aspectRatio: AspectRatio
): Promise<ImageData[]> => {
    try {
        const generationPromises: Promise<ImageData>[] = [];
        for (let i = 0; i < numberOfImages; i++) {
            generationPromises.push(generateOnePropImage(prompt, aspectRatio));
        }
        const results = await Promise.all(generationPromises);
        return results.filter(Boolean);
    } catch (e) {
        console.error("Error during parallel prop generation:", e);
        if (e instanceof Error) {
            throw new Error(`Prop generation failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred during prop generation.");
    }
};

/**
 * Generates a single background/environment image (no people).
 */
const generateOneBackgroundImage = async (
    prompt: string,
    locationType: string,
    timeOfDay: string,
    weather: string,
    aspectRatio: AspectRatio
): Promise<ImageData> => {
    const finalPrompt = `
**TASK: Generate a photorealistic background/environment photograph for a reference library.**

**SCENE DESCRIPTION:** "${prompt}"
**Location Type:** ${locationType}
**Time of Day:** ${timeOfDay}
**Weather:** ${weather}

**CRITICAL RULES:**
1. Generate ONLY the environment/background - ABSOLUTELY NO PEOPLE, NO CHARACTERS, NO HUMAN FIGURES
2. This is a pure landscape/interior shot - empty of any human presence
3. The scene should look like a location scout photograph or empty film set

---
**COMPOSITION (VERY STRICT):**
-   **Shot Type:** Wide establishing shot or medium wide shot
-   **Perspective:** Eye-level or slightly elevated angle
-   **Depth:** Show depth and layers in the environment
-   **Focus:** Deep focus - everything should be relatively sharp

---
**MANDATORY PHOTOGRAPHIC STYLE (NON-NEGOTIABLE):**
-   **Style:** Cinematic location photography, film production quality
-   **Lighting:** Natural lighting appropriate for the time of day specified
-   **Atmosphere:** Capture the mood and atmosphere of the location
-   **Quality:** High resolution, professional grade

---
**ABSOLUTELY FORBIDDEN:**
-   NO humans, silhouettes, or any human figures (even distant ones)
-   NO animals unless specifically mentioned
-   NO text, watermarks, or typography
-   NO obvious CGI or artificial elements
`;

    try {
        const response = await ai.models.generateImages({
            model: MODELS.IMAGE_PORTRAIT,
            prompt: finalPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error("AI did not return any images.");
        }

        const img = response.generatedImages[0];
        return {
            mimeType: 'image/jpeg',
            data: img.image.imageBytes,
        };

    } catch (e) {
        console.error("Error during background image generation:", e);
        if (e instanceof Error) {
            throw new Error(`Background generation failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred during background generation.");
    }
};

/**
 * Generates multiple background images.
 */
export const generateBackgroundImages = async (
    prompt: string,
    locationType: string,
    timeOfDay: string,
    weather: string,
    numberOfImages: number,
    aspectRatio: AspectRatio
): Promise<ImageData[]> => {
    try {
        const generationPromises: Promise<ImageData>[] = [];
        for (let i = 0; i < numberOfImages; i++) {
            generationPromises.push(generateOneBackgroundImage(prompt, locationType, timeOfDay, weather, aspectRatio));
        }
        const results = await Promise.all(generationPromises);
        return results.filter(Boolean);
    } catch (e) {
        console.error("Error during parallel background generation:", e);
        if (e instanceof Error) {
            throw new Error(`Background generation failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred during background generation.");
    }
};


/**
 * Edits an existing image based on a text prompt describing the modifications.
 */
export const editImage = async (
    baseImage: ImageData,
    modificationPrompt: string
): Promise<ImageData> => {
    const parts: Part[] = [];

    // Add the base image to be edited
    parts.push({
        inlineData: {
            mimeType: baseImage.mimeType,
            data: baseImage.data
        }
    });

    const finalPrompt = `
**AI Model Instructions: Intelligent Image Modification**

Your primary task is to intelligently modify the provided base image according to the user's request. You MUST produce a new, visibly changed image. Returning the original image is not an acceptable outcome.

---
**1. ANALYSIS OF BASE IMAGE**
-   **Analyze:** Scrutinize the provided input image to understand its subject, style, and composition.

---
**2. USER'S MODIFICATION REQUEST**
-   **Request:** "${modificationPrompt}"
-   **Action:** Execute this request on the base image. The change should be noticeable and directly address the user's prompt.

---
**3. GUIDELINES FOR MODIFICATION (Apply with care)**
-   **Character Identity:** Unless the prompt *specifically* requests a change to the character's face or core identity, you must preserve it with high fidelity. The character should still be recognizable as the same person.
-   **Style Consistency:** Maintain the original image's photorealistic style, lighting, and overall aesthetic. The edited image should blend seamlessly with the original.
-   **Avoid Unnecessary Alterations:** Focus only on the requested changes. Do not alter other parts of the image unless it's necessary to make the requested change look natural.

---
**4. CRITICAL OUTPUT REQUIREMENTS**
-   **Output:** A single, edited image that is clearly different from the original.
-   **Restriction:** The image must not contain any text, watermarks, or typography.
`;

    parts.push({ text: finalPrompt });

    // Use Gemini 3 Pro Image for better editing capabilities
    const response = await ai.models.generateContent({
        model: MODELS.IMAGE_SCENE,
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart && imagePart.inlineData) {
        return {
            mimeType: imagePart.inlineData.mimeType,
            data: imagePart.inlineData.data,
        };
    }

    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    const errorMessage = textPart?.text || "AI failed to return an edited image.";
    throw new Error(`Image editing failed: ${errorMessage}`);
};


/**
 * Generates a single image based on a comprehensive set of instructions.
 * This version relies directly on reference images, removing the text-based analysis step
 * to improve character consistency.
 */
const generateOneImage = async (
    prompt: string,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    addVariation: boolean,
    aspectRatio: AspectRatio
): Promise<ImageData> => {
    const parts: Part[] = [];

    // Add character images for the model to reference visually
    characterImages.forEach(img => {
        parts.push({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data
            }
        });
    });

    // Add prop images for the model to reference
    propImages.forEach(img => {
        parts.push({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data
            }
        });
    });

    // Add background image for the model to reference
    if (backgroundImage) {
        parts.push({
            inlineData: {
                mimeType: backgroundImage.mimeType,
                data: backgroundImage.data
            }
        });
    }

    // Pick a random photorealistic style and create the style prompt part
    const randomStyle = PHOTOREALISTIC_STYLES[Math.floor(Math.random() * PHOTOREALISTIC_STYLES.length)];
    const styleReferencePromptPart = `
---
**2. ART STYLE (MANDATORY & STRICT)**
**ACTION:** You MUST generate the image in the following photographic style. This is a critical instruction. The result MUST look like a real photograph, not an illustration, painting, or 3D render.
**STYLE:** ${randomStyle}
**ABSOLUTE RESTRICTIONS:** Avoid any and all artistic stylization. No illustrated features, no airbrushed skin, no cartoonish proportions, no painterly textures. The image must appear as if it was captured by a high-end camera.
`;

    const variationPrompt = addVariation ? "\n**VARIATION:** Create a different composition, pose, or camera angle from previous generations for this prompt." : "";

    // Build prop reference section if props exist - ENHANCED for Gemini 3 Pro Image
    const propReferenceSection = propImages.length > 0 ? `
---
**2. PRODUCT/PROP REFERENCE - HIGH FIDELITY REQUIRED**
**Reference Images ${characterImages.length + 1} to ${characterImages.length + propImages.length} are PRODUCT PHOTOS**

**ABSOLUTE REQUIREMENT - THIS IS THE MOST CRITICAL INSTRUCTION FOR PROPS:**
You MUST include these EXACT products in the generated image with HIGH FIDELITY:

1. **EXACT CONTAINER/BOTTLE SHAPE** - The bottle, tube, or container must be IDENTICAL
2. **EXACT LABEL & BRANDING** - If the reference shows "ATOMU" or any brand name, it MUST appear exactly the same
3. **EXACT COLOR SCHEME** - Match the precise colors of the product packaging
4. **EXACT CAP/DISPENSER** - The top/cap must match the reference exactly
5. **EXACT PROPORTIONS** - The product size and proportions must be accurate

**PLACEMENT:** The character should be holding, using, or interacting with THIS EXACT product.
**WARNING:** Do NOT substitute with a generic, similar-looking, or different product. The product must be IMMEDIATELY RECOGNIZABLE as the same item from the reference photo.
**FIDELITY LEVEL:** Treat these as product placement shots - the brand must be clearly identifiable.
` : '';

    // Build background reference section if background exists
    const backgroundReferenceSection = backgroundImage ? `
---
**BACKGROUND REFERENCE (Last image)**
Use this background image as reference for the scene setting. Match the location, lighting atmosphere, and environmental details.
` : '';

    const finalPrompt = `
**AI Model Instructions: Character, Prop & Scene Consistency**

Your primary, non-negotiable goals are:
1.  **Character Consistency:** Perfectly replicate the person from the character reference images.
2.  **Prop Consistency:** Props/objects in the scene MUST match the provided prop reference images EXACTLY.
3.  **Photorealism:** Generate an image that is indistinguishable from a real photograph.
4.  **Aspect Ratio:** The final image MUST have a ${aspectRatio === '16:9' ? 'wide, horizontal 16:9' : 'tall, vertical 9:16'} aspect ratio.

---
**1. CHARACTER REFERENCE (First ${characterImages.length} image${characterImages.length > 1 ? 's' : ''})**
**ACTION:** This is your highest priority. Analyze the provided reference image(s) to understand the character's exact appearance. You MUST replicate their facial features, age, hair style and color, and overall look with extreme precision.
**CRITICAL ETHNICITY MANDATE:** The character in the reference images is ethnically Korean. Your generated image MUST maintain this Korean ethnicity. This is a strict, non-negotiable rule. The generated person must be undeniably the SAME PERSON as in the reference photos.
${propReferenceSection}${backgroundReferenceSection}${styleReferencePromptPart}
---
**3. SCENE DESCRIPTION (Source: User's Text Prompt)**
**ACTION:** Place the character from section 1, with props from section 2 if applicable, rendered in the photographic style, into the scene described by the user's prompt below.
**USER PROMPT:**
"${prompt}"
${variationPrompt}
---
**4. TECHNICAL SPECIFICATIONS (NON-NEGOTIABLE)**
**ACTION:** Adhere strictly to the following technical requirements. This is the most important section.
-   **CRITICAL ASPECT RATIO:** The final image's aspect ratio MUST BE a ${aspectRatio === '16:9' ? 'wide, horizontal 16:9' : 'tall, vertical 9:16'}.
    -   **Valid examples for 16:9:** 1920x1080 pixels, 1280x720 pixels.
    -   **Valid examples for 9:16:** 1080x1920 pixels, 720x1280 pixels.
    -   **STRICTLY FORBIDDEN:** Do NOT generate a square (1:1, 1024x1024), ${aspectRatio === '16:9' ? 'vertical' : 'horizontal'}, or any other aspect ratio. The output MUST be ${aspectRatio === '16:9' ? 'horizontal' : 'vertical'}. Failure to follow this rule will result in an incorrect output.
-   **OUTPUT:** Generate ONE SINGLE, full-bleed image.
-   **CRITICAL RESTRICTION:** The generated image MUST NOT contain any text, letters, words, numbers, watermarks, or any form of typography. This is a strict rule.
- DO NOT use white borders or create multi-panel layouts.
`;

    parts.push({ text: finalPrompt });

    // Use Gemini 3 Pro Image (Nano Banana Pro) for better reference image consistency
    // Supports up to 14 reference images (6 objects + 5 humans) with high fidelity
    const response = await ai.models.generateContent({
        model: MODELS.IMAGE_SCENE,
        contents: { parts },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart && imagePart.inlineData) {
        return {
            mimeType: imagePart.inlineData.mimeType,
            data: imagePart.inlineData.data,
        };
    }

    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    const errorMessage = textPart?.text || "AI failed to return an image for this scene.";
    throw new Error(`Image generation failed: ${errorMessage}`);
};


/**
 * Generates one or more images by calling generateOneImage in parallel.
 */
export const generateImages = async (
    prompt: string,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    numberOfImages: number,
    aspectRatio: AspectRatio
): Promise<ImageData[]> => {
    const generationPromises: Promise<ImageData>[] = [];

    for (let i = 0; i < numberOfImages; i++) {
        generationPromises.push(
            generateOneImage(prompt, characterImages, propImages, backgroundImage, i > 0, aspectRatio)
        );
    }

    const results = await Promise.all(generationPromises);
    return results.filter(Boolean); // Filter out any null/undefined results
};


// ============================================
// SCENARIO GENERATION FUNCTIONS
// ============================================

const TONE_DESCRIPTIONS: Record<ScenarioTone, string> = {
    emotional: '따뜻하고 감성적이며, 공감을 이끌어내는 여운 있는 스토리',
    dramatic: '긴장감 넘치고, 예상치 못한 반전이 있는 극적인 스토리',
    inspirational: '도전과 성장, 희망적인 메시지를 담은 동기부여 스토리',
    romantic: '설렘과 사랑, 달콤하고 감미로운 로맨틱 스토리',
    comedic: '유쾌하고 웃긴, 밝은 에너지의 코믹 스토리',
    mysterious: '호기심을 자극하고, 궁금증을 유발하는 미스터리 스토리',
    nostalgic: '그리움과 추억, 과거를 회상하는 향수 어린 스토리',
};

/**
 * Generates a complete video scenario based on user input.
 */
export const generateScenario = async (config: ScenarioConfig): Promise<Scenario> => {
    const { topic, duration, tone } = config;
    const minScenes = Math.floor(duration / 12);
    const maxScenes = Math.ceil(duration / 8);
    const toneDescription = TONE_DESCRIPTIONS[tone];

    const prompt = `당신은 한국 숏폼 영상 시나리오 전문 작가입니다.
주어진 주제로 ${duration}초 분량의 영상 시나리오를 작성하세요.

## 입력 정보
- **주제**: "${topic}"
- **영상 길이**: ${duration}초
- **톤/분위기**: ${tone} - ${toneDescription}

## 시나리오 작성 규칙

### 1. 구조
- 총 ${minScenes}~${maxScenes}개의 씬으로 구성
- 각 씬은 7-12초 분량
- 반드시 다음 구조를 따를 것:
  - Scene 1: **Hook** - 강렬한 첫 장면으로 시선 끌기 (3초 내 관심 유도)
  - Scene 2-3: **Setup** - 상황과 인물 소개
  - 중간 씬들: **Development** - 이야기 전개
  - 마지막에서 두번째: **Climax** - 가장 강렬한 순간 또는 반전
  - 마지막 씬: **Resolution** - 여운 있는 마무리

### 2. 각 씬 작성 시 포함할 내용
- **sceneNumber**: 씬 번호 (1부터 시작)
- **duration**: 예상 길이(초, 7-12 사이)
- **storyBeat**: "Hook", "Setup", "Development", "Climax", "Resolution" 중 하나
- **visualDescription**: 화면에 보이는 것 (한국어, 구체적인 시각 묘사)
- **narration**: 내레이션 텍스트 (한국어, 자연스러운 구어체, 해당 씬 길이에 맞게)
- **cameraAngle**: "Close-up", "Extreme Close-up", "Medium shot", "Wide shot", "POV", "Over-the-shoulder", "Low angle", "High angle", "Bird's eye" 중 하나
- **mood**: 장면의 감정/분위기 (한국어, 2-3단어)
- **imagePrompt**: 이미지 생성용 영어 프롬프트 (매우 상세하고 시각적으로, 인물 표정/자세/시선/배경/조명/시간대 포함)

### 3. 숏폼 영상 특성 반영
- 첫 3초 안에 시청자의 관심을 끌 것 (Hook이 매우 중요)
- 빠른 전개, 불필요한 설명 최소화
- 감정적 공감을 이끌어내는 스토리텔링
- 마지막은 여운이 남거나 반전이 있게
- 내레이션은 자연스러운 한국어 구어체로

### 4. 이미지 프롬프트 작성 규칙 (imagePrompt)
- 반드시 영어로 작성
- 한국인 인물 묘사 시 "Korean" 명시
- 인물의 표정, 자세, 시선 방향 구체적으로
- 배경, 조명, 시간대 명시
- 감정과 분위기를 시각적으로 표현
- 영화적/시네마틱한 품질 강조

### 5. 등장인물 제안
- 시나리오에 필요한 주요 등장인물들을 제안
- 각 인물의 이름, 역할, 외형/성격 설명 포함`;

    try {
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: {
                            type: Type.STRING,
                            description: "시나리오의 제목",
                        },
                        synopsis: {
                            type: Type.STRING,
                            description: "시나리오의 한 줄 요약",
                        },
                        suggestedCharacters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: "캐릭터 이름" },
                                    role: { type: Type.STRING, description: "역할 (주인공, 조연 등)" },
                                    description: { type: Type.STRING, description: "외형과 성격 설명" },
                                },
                                required: ["name", "role", "description"],
                            },
                        },
                        scenes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sceneNumber: { type: Type.NUMBER, description: "씬 번호" },
                                    duration: { type: Type.NUMBER, description: "씬 길이(초)" },
                                    storyBeat: { type: Type.STRING, description: "스토리 비트" },
                                    visualDescription: { type: Type.STRING, description: "시각적 묘사 (한국어)" },
                                    narration: { type: Type.STRING, description: "내레이션 (한국어)" },
                                    cameraAngle: { type: Type.STRING, description: "카메라 앵글" },
                                    mood: { type: Type.STRING, description: "분위기" },
                                    imagePrompt: { type: Type.STRING, description: "이미지 생성 프롬프트 (영어)" },
                                },
                                required: ["sceneNumber", "duration", "storyBeat", "visualDescription", "narration", "cameraAngle", "mood", "imagePrompt"],
                            },
                        },
                    },
                    required: ["title", "synopsis", "suggestedCharacters", "scenes"],
                },
            },
        });

        const parsed = JSON.parse(response.text);

        // Transform to full Scenario object with IDs
        const scenario: Scenario = {
            id: crypto.randomUUID(),
            title: parsed.title,
            synopsis: parsed.synopsis,
            topic: topic,
            totalDuration: duration,
            tone: tone,
            suggestedCharacters: parsed.suggestedCharacters,
            scenes: parsed.scenes.map((scene: any, index: number) => ({
                id: crypto.randomUUID(),
                sceneNumber: scene.sceneNumber || index + 1,
                duration: scene.duration,
                storyBeat: scene.storyBeat as StoryBeat,
                visualDescription: scene.visualDescription,
                narration: scene.narration,
                cameraAngle: scene.cameraAngle as CameraAngle,
                mood: scene.mood,
                imagePrompt: scene.imagePrompt,
            })),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        return scenario;

    } catch (e) {
        console.error("Error during scenario generation:", e);
        if (e instanceof Error) {
            throw new Error(`Scenario generation failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred during scenario generation.");
    }
};

/**
 * Regenerates a single scene within a scenario.
 */
export const regenerateScene = async (
    scenario: Scenario,
    sceneId: string,
    customInstruction?: string
): Promise<Scene> => {
    const sceneIndex = scenario.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) {
        throw new Error("Scene not found in scenario.");
    }

    const currentScene = scenario.scenes[sceneIndex];
    const prevScene = sceneIndex > 0 ? scenario.scenes[sceneIndex - 1] : null;
    const nextScene = sceneIndex < scenario.scenes.length - 1 ? scenario.scenes[sceneIndex + 1] : null;

    const contextPrompt = `당신은 한국 숏폼 영상 시나리오 전문 작가입니다.
기존 시나리오의 특정 씬을 다시 작성해야 합니다.

## 시나리오 정보
- **제목**: "${scenario.title}"
- **주제**: "${scenario.topic}"
- **톤**: ${scenario.tone}
- **총 길이**: ${scenario.totalDuration}초

## 문맥 (앞뒤 씬)
${prevScene ? `**이전 씬 (Scene ${prevScene.sceneNumber}):**
- 내용: ${prevScene.visualDescription}
- 내레이션: ${prevScene.narration}
` : '(첫 번째 씬입니다)'}

${nextScene ? `**다음 씬 (Scene ${nextScene.sceneNumber}):**
- 내용: ${nextScene.visualDescription}
- 내레이션: ${nextScene.narration}
` : '(마지막 씬입니다)'}

## 재생성할 씬 정보
- **씬 번호**: ${currentScene.sceneNumber}
- **스토리 비트**: ${currentScene.storyBeat}
- **현재 내용**: ${currentScene.visualDescription}

## 요청사항
${customInstruction ? `**사용자 지시**: ${customInstruction}` : '새로운 창의적인 버전으로 다시 작성해주세요.'}

앞뒤 씬과 자연스럽게 연결되면서도 새롭고 더 나은 버전을 만들어주세요.`;

    try {
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: contextPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        duration: { type: Type.NUMBER, description: "씬 길이(초)" },
                        visualDescription: { type: Type.STRING, description: "시각적 묘사 (한국어)" },
                        narration: { type: Type.STRING, description: "내레이션 (한국어)" },
                        cameraAngle: { type: Type.STRING, description: "카메라 앵글" },
                        mood: { type: Type.STRING, description: "분위기" },
                        imagePrompt: { type: Type.STRING, description: "이미지 생성 프롬프트 (영어)" },
                    },
                    required: ["duration", "visualDescription", "narration", "cameraAngle", "mood", "imagePrompt"],
                },
            },
        });

        const parsed = JSON.parse(response.text);

        const regeneratedScene: Scene = {
            id: crypto.randomUUID(), // New ID for the regenerated scene
            sceneNumber: currentScene.sceneNumber,
            storyBeat: currentScene.storyBeat, // Keep the same story beat
            duration: parsed.duration,
            visualDescription: parsed.visualDescription,
            narration: parsed.narration,
            cameraAngle: parsed.cameraAngle as CameraAngle,
            mood: parsed.mood,
            imagePrompt: parsed.imagePrompt,
        };

        return regeneratedScene;

    } catch (e) {
        console.error("Error during scene regeneration:", e);
        if (e instanceof Error) {
            throw new Error(`Scene regeneration failed: ${e.message}`);
        }
        throw new Error("An unknown error occurred during scene regeneration.");
    }
};

/**
 * Generates an image for a specific scene.
 */
export const generateSceneImage = async (
    scene: Scene,
    characterImages: ImageData[],
    propImages: ImageData[],
    backgroundImage: ImageData | null,
    aspectRatio: AspectRatio
): Promise<ImageData> => {
    const enhancedPrompt = `
**Scene from a Korean short-form video:**
${scene.imagePrompt}

**Camera Angle:** ${scene.cameraAngle}
**Mood:** ${scene.mood}

**Style Requirements:**
- Cinematic, photorealistic quality
- Korean characters if people are depicted
- Emotional storytelling through visuals
`;

    return generateOneImage(enhancedPrompt, characterImages, propImages, backgroundImage, false, aspectRatio);
};


// ============================================
// VIDEO GENERATION FUNCTIONS (Veo API)
// ============================================

export interface VideoGenerationResult {
    videoUrl: string;
    thumbnailUrl: string;
    duration: number;
}

/**
 * Check if Veo API is available with the current API key
 */
export const checkVeoApiAvailability = async (): Promise<{ available: boolean; error?: string }> => {
    try {
        // Try to list available models to check API access
        console.log('Checking Veo API availability...');

        // Simple test - try to initiate a minimal request
        // This will fail fast if API key doesn't have Veo access
        const testOperation = await ai.models.generateVideos({
            model: MODELS.VIDEO,
            prompt: 'test',
        });

        // If we get here, the API is accessible
        // Cancel the operation since this was just a test
        console.log('Veo API is available');
        return { available: true };

    } catch (e) {
        console.error('Veo API check failed:', e);
        const errorMessage = e instanceof Error ? e.message : String(e);

        if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('403')) {
            return {
                available: false,
                error: 'API 키에 Veo 권한이 없습니다. Google AI Studio에서 Veo API를 활성화하세요.'
            };
        }
        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
            return {
                available: false,
                error: 'Veo 모델을 찾을 수 없습니다. API 키가 Veo를 지원하는지 확인하세요.'
            };
        }
        if (errorMessage.includes('INVALID_ARGUMENT')) {
            // This might actually mean the API is available but our test request was invalid
            return { available: true };
        }

        return {
            available: false,
            error: `Veo API 확인 실패: ${errorMessage}`
        };
    }
};

/**
 * Generates a video clip from a source image using Google Veo API.
 * Uses image-to-video generation with motion prompt.
 */
export const generateVideoFromImage = async (
    sourceImage: ImageData,
    motionPrompt: string,
    durationSeconds: number = 5
): Promise<VideoGenerationResult> => {
    try {
        console.log('=== VIDEO GENERATION START ===');
        console.log(`Model: ${MODELS.VIDEO}`);
        console.log('Motion prompt:', motionPrompt);
        console.log('Duration:', durationSeconds, 'seconds');
        console.log('Image MIME type:', sourceImage.mimeType);
        console.log('Image data length:', sourceImage.data.length, 'chars');

        // Prepare the enhanced prompt for video generation
        const enhancedPrompt = `
Cinematic video generation from reference image:
${motionPrompt}

Motion & Camera Requirements:
- Smooth, natural camera movements
- Realistic motion physics
- Cinematic quality, film-like aesthetics

Technical Requirements:
- High quality video output
- Consistent lighting throughout
- No sudden jumps or artifacts
`.trim();

        console.log('Calling ai.models.generateVideos...');

        // Generate video using Veo model
        let operation;
        try {
            operation = await ai.models.generateVideos({
                model: MODELS.VIDEO,
                prompt: enhancedPrompt,
                image: {
                    imageBytes: sourceImage.data,
                    mimeType: sourceImage.mimeType as 'image/jpeg' | 'image/png',
                },
                config: {
                    numberOfVideos: 1,
                    durationSeconds: Math.min(durationSeconds, 8),
                    aspectRatio: '16:9',
                    // Veo 3.1 새 옵션 (fps는 Gemini API에서 지원 안함 - 기본 24fps)
                    includeAudio: true,  // 오디오 자동 생성
                },
            });
            console.log('Operation created successfully');
            console.log('Operation name:', operation.name);
        } catch (initError) {
            console.error('Failed to create video generation operation:', initError);
            throw new Error(`Veo API 호출 실패: ${initError instanceof Error ? initError.message : String(initError)}`);
        }

        console.log('Video generation started, polling for completion...');

        // Poll until video generation is complete (max 5 minutes timeout)
        const maxPollingTime = 300000; // 5 minutes
        const pollInterval = 10000; // 10 seconds
        const startTime = Date.now();
        let pollCount = 0;

        while (!operation.done) {
            pollCount++;
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            if (Date.now() - startTime > maxPollingTime) {
                throw new Error(`비디오 생성 시간 초과 (${elapsed}초 경과). 나중에 다시 시도하세요.`);
            }

            console.log(`Polling #${pollCount} - ${elapsed}s elapsed...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            try {
                operation = await ai.operations.getVideosOperation({
                    operation: operation,
                });
                console.log(`Poll #${pollCount} - done: ${operation.done}`);
            } catch (pollError) {
                console.error(`Poll #${pollCount} failed:`, pollError);
                throw new Error(`비디오 생성 상태 확인 실패: ${pollError instanceof Error ? pollError.message : String(pollError)}`);
            }
        }

        const totalTime = Math.round((Date.now() - startTime) / 1000);
        console.log(`Video generation completed in ${totalTime} seconds!`);
        console.log('Operation response:', JSON.stringify(operation.response, null, 2));

        // Extract video URL from response - handle multiple possible response structures
        // Structure 1: generateVideoResponse.generatedSamples[0].video.uri (actual API response)
        // Structure 2: generatedVideos[0].video (SDK wrapper)
        const response = operation.response as any;
        let videoUrl: string | undefined;

        // Try actual API response structure first
        if (response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
            videoUrl = response.generateVideoResponse.generatedSamples[0].video.uri;
            console.log('Found video URL in generateVideoResponse.generatedSamples');
        }
        // Try SDK wrapper structure
        else if (response?.generatedVideos?.[0]?.video?.uri) {
            videoUrl = response.generatedVideos[0].video.uri;
            console.log('Found video URL in generatedVideos');
        }
        // Try direct generatedSamples
        else if (response?.generatedSamples?.[0]?.video?.uri) {
            videoUrl = response.generatedSamples[0].video.uri;
            console.log('Found video URL in generatedSamples');
        }

        if (!videoUrl) {
            console.error('Could not find video URL in response:', response);
            throw new Error('비디오 생성이 완료되었지만 URL을 찾을 수 없습니다.');
        }

        console.log('=== VIDEO GENERATION SUCCESS ===');
        console.log('Video URL:', videoUrl);

        return {
            videoUrl: videoUrl,
            thumbnailUrl: `data:${sourceImage.mimeType};base64,${sourceImage.data}`,
            duration: durationSeconds,
        };

    } catch (e) {
        console.error('=== VIDEO GENERATION ERROR ===');
        console.error('Error object:', e);

        if (e instanceof Error) {
            const msg = e.message;
            console.error('Error message:', msg);
            console.error('Error stack:', e.stack);

            // More specific Korean error messages
            if (msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('Forbidden')) {
                throw new Error('Veo API 접근 권한이 없습니다. API 키가 Veo를 지원하는지 확인하세요. (Google AI Studio > API Keys에서 확인)');
            }
            if (msg.includes('QUOTA_EXCEEDED') || msg.includes('429') || msg.includes('Resource exhausted')) {
                throw new Error('Veo API 할당량을 초과했습니다. 잠시 후 다시 시도하세요.');
            }
            if (msg.includes('not found') || msg.includes('404') || msg.includes('does not exist')) {
                throw new Error(`Veo 모델(${MODELS.VIDEO})을 찾을 수 없습니다. API 키가 Veo API를 지원하는지 확인하세요.`);
            }
            if (msg.includes('INVALID_ARGUMENT') || msg.includes('400')) {
                throw new Error(`잘못된 요청: ${msg}`);
            }
            if (msg.includes('UNAUTHENTICATED') || msg.includes('401')) {
                throw new Error('API 키가 유효하지 않습니다. 환경 변수를 확인하세요.');
            }

            // Pass through already-formatted Korean errors
            if (msg.includes('비디오') || msg.includes('Veo')) {
                throw e;
            }

            throw new Error(`비디오 생성 실패: ${msg}`);
        }
        throw new Error('비디오 생성 중 알 수 없는 오류가 발생했습니다.');
    }
};