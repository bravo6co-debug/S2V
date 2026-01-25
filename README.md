# 시나리오생성기반_이미지/영상생성서비스

Google Gemini AI와 Veo를 활용한 시나리오 기반 이미지 및 영상 생성 서비스입니다. 캐릭터, 소품, 배경의 일관성을 유지하면서 시나리오 기반의 씬 이미지와 AI 영상을 생성합니다.

## 주요 기능

### 캐릭터 관리
- 참조 이미지 기반 캐릭터 라이브러리 구축
- 캐릭터 메타데이터 관리 (이름, 나이, 성격, 의상)
- 최대 5개 캐릭터 동시 활성화하여 씬 생성 시 참조

### 소품 & 배경 에셋
- 소품 라이브러리: 핵심 소품/일반 소품 분류, 카테고리별 관리
- 배경 라이브러리: 장소 유형, 시간대, 날씨 설정
- **활성화 시스템**: 최대 5개 소품 + 1개 배경을 활성화하여 이미지 생성 시 일관성 유지

### 시나리오 기반 이미지 생성
- 챕터/씬 구조로 시나리오 작성
- 씬별 이미지 개별 생성 또는 전체 일괄 생성
- 활성화된 캐릭터, 소품, 배경 이미지를 AI에 전달하여 일관된 스타일 유지
- 다양한 화면 비율 지원 (1:1, 16:9, 9:16, 4:3, 3:4)

### AI 영상 생성 (Veo 3.1)
- 생성된 이미지를 기반으로 AI 영상 클립 생성
- Veo 3.1 Fast 모델 사용 (빠른 속도, 비용 최적화)
- 클립별 모션 프롬프트 설정
- 영상 다운로드 기능 (Vercel API 프록시)

### 이미지 편집
- 생성된 이미지에 텍스트 프롬프트로 수정 적용
- Gemini AI 기반 이미지 편집

## 기술 스택

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (Serverless Functions)
- **AI Models**:
  - `gemini-3-flash-preview` - 텍스트/프롬프트 생성
  - `imagen-4.0-generate-001` - 캐릭터/소품/배경 초상화 생성
  - `gemini-3-pro-image-preview` - 씬 이미지 생성 (참조 이미지 기반)
  - `veo-3.1-fast-generate-001` - AI 영상 생성

## 설치 및 실행

### 필수 요구사항
- Node.js 18+
- Google Gemini API Key (Veo API 접근 권한 포함)

### 로컬 실행

```bash
# 의존성 설치
npm install

# 환경 변수 설정
# .env.local 파일 생성 후 아래 내용 추가
API_KEY=your_gemini_api_key_here

# 개발 서버 실행
npm run dev
```

### Vercel 배포

```bash
# 프로덕션 빌드
npm run build

# Vercel CLI로 배포
vercel --prod
```

**Vercel 환경변수 설정:**
1. Vercel Dashboard → 프로젝트 선택
2. Settings → Environment Variables
3. `GEMINI_API_KEY` 또는 `API_KEY` 추가

## 프로젝트 구조

```
├── api/
│   └── download-video.ts    # Vercel Serverless - 비디오 다운로드 프록시
├── components/
│   ├── character/           # 캐릭터, 소품, 배경 관리 컴포넌트
│   ├── scenario/            # 시나리오/씬 관리 컴포넌트
│   └── video/               # 영상 제작 컴포넌트
├── contexts/
│   └── ProjectContext.tsx   # 전역 상태 관리
├── hooks/
│   ├── useScenario.ts       # 시나리오 관련 커스텀 훅
│   └── useVideo.ts          # 영상 제작 관련 커스텀 훅
├── services/
│   └── geminiService.ts     # Gemini AI API 통합 (모델 설정 포함)
├── types.ts                 # TypeScript 타입 정의
├── vercel.json              # Vercel 배포 설정
└── App.tsx                  # 메인 애플리케이션
```

## 사용 방법

1. **캐릭터 등록**: 캐릭터 탭에서 참조 이미지와 정보를 등록
2. **에셋 준비**: 에셋 탭에서 소품과 배경 이미지 등록
3. **활성화**: 씬에서 사용할 캐릭터(최대 5개), 소품(최대 5개), 배경(1개)을 활성화
4. **시나리오 작성**: 시나리오 탭에서 챕터와 씬 작성
5. **이미지 생성**: 개별 씬 또는 전체 씬의 이미지 생성
6. **영상 생성**: 영상 탭에서 씬 이미지를 가져와 AI 영상 클립 생성
7. **영상 다운로드**: 생성된 영상 클립 다운로드

## API 엔드포인트

### `/api/download-video`

비디오 다운로드 프록시 API (Vercel Serverless Function)

```
GET /api/download-video?fileId=<google_file_id>
```

- Google API의 비디오 파일을 서버에서 대신 다운로드하여 CORS 문제 해결
- 응답: 비디오 파일 스트림 (video/mp4)

## 라이선스

MIT License
