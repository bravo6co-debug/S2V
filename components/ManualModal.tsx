
import React, { useEffect } from 'react';

interface ManualModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 transition-opacity duration-300"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-gray-800 text-gray-300 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-4xl h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-2xl sm:rounded-t-xl z-10 flex-shrink-0">
                    <h2 className="text-lg sm:text-2xl font-bold text-indigo-400">S2V 사용 설명서</h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center bg-gray-700 rounded-full text-white hover:bg-gray-600 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white"
                        aria-label="Close manual"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>
                <main className="overflow-y-auto flex-grow p-4 sm:p-6 space-y-6 sm:space-y-8">
                    {/* 앱 개요 */}
                    <section>
                        <h3 className="text-xl sm:text-2xl font-semibold text-yellow-400 mb-3">1. 앱 개요</h3>
                        <p className="text-gray-400 leading-relaxed text-sm sm:text-base">
                            <strong className="text-white">S2V (Scenario to Video)</strong>는 AI를 활용하여 시나리오부터 영상까지 자동으로 제작하는 통합 콘텐츠 제작 도구입니다.
                            시나리오, 광고, 클립, 롱폼, 음식 영상 등 다양한 형태의 영상을 간편하게 만들 수 있습니다.
                        </p>
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs sm:text-sm">
                            <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-300 text-center">시나리오</div>
                            <div className="p-2 bg-pink-500/10 border border-pink-500/30 rounded-lg text-pink-300 text-center">영상 제작</div>
                            <div className="p-2 bg-teal-500/10 border border-teal-500/30 rounded-lg text-teal-300 text-center">롱폼</div>
                            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-center">음식 영상</div>
                            <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-300 text-center">광고</div>
                            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-300 text-center">클립</div>
                        </div>
                    </section>

                    {/* 비용 안내 */}
                    <section>
                        <h3 className="text-xl sm:text-2xl font-semibold text-yellow-400 mb-3">2. 비용 안내</h3>
                        <div className="p-3 sm:p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-4">
                            <div className="p-3 bg-green-900/30 rounded-lg border border-green-700/50">
                                <p className="text-green-400 font-semibold mb-1">권장 스타일</p>
                                <p className="text-gray-300 text-sm">
                                    포토리얼리즘보다 <span className="text-green-300 font-medium">애니메이션, 일러스트, 수채화</span> 스타일을 권장합니다.
                                    비용 효율적이고 일관된 품질의 영상을 제작할 수 있습니다.
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-400 border-b border-gray-700">
                                            <th className="pb-2 pr-4">서비스</th>
                                            <th className="pb-2 pr-4">단위</th>
                                            <th className="pb-2 pr-4">비용</th>
                                            <th className="pb-2">비고</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-300">
                                        <tr className="border-b border-gray-700/50">
                                            <td className="py-2 pr-4 font-medium text-white">이미지 생성</td>
                                            <td className="py-2 pr-4">1장</td>
                                            <td className="py-2 pr-4">약 55원</td>
                                            <td className="py-2">Nano Banana</td>
                                        </tr>
                                        <tr className="border-b border-gray-700/50">
                                            <td className="py-2 pr-4">FLUX 이미지</td>
                                            <td className="py-2 pr-4">5장</td>
                                            <td className="py-2 pr-4">약 60~120원</td>
                                            <td className="py-2">고품질 (광고 전용)</td>
                                        </tr>
                                        <tr className="border-b border-gray-700/50">
                                            <td className="py-2 pr-4">4K 고해상도</td>
                                            <td className="py-2 pr-4">1장</td>
                                            <td className="py-2 pr-4">약 340원</td>
                                            <td className="py-2">고품질</td>
                                        </tr>
                                        <tr className="border-b border-gray-700/50 text-red-400">
                                            <td className="py-2 pr-4">Veo 3.1 Fast</td>
                                            <td className="py-2 pr-4">8초</td>
                                            <td className="py-2 pr-4">약 1,700원</td>
                                            <td className="py-2">SNS/초안용</td>
                                        </tr>
                                        <tr className="border-b border-gray-700/50 text-red-400">
                                            <td className="py-2 pr-4">Veo 3.1 Standard</td>
                                            <td className="py-2 pr-4">8초</td>
                                            <td className="py-2 pr-4">약 4,500원</td>
                                            <td className="py-2">마케팅/광고용</td>
                                        </tr>
                                        <tr className="border-b border-gray-700/50 text-red-400">
                                            <td className="py-2 pr-4">Veo 3.0 Full</td>
                                            <td className="py-2 pr-4">8초</td>
                                            <td className="py-2 pr-4">약 8,500원</td>
                                            <td className="py-2">전문가용</td>
                                        </tr>
                                        <tr className="border-b border-gray-700/50 text-orange-400">
                                            <td className="py-2 pr-4">Hailuo AI 영상</td>
                                            <td className="py-2 pr-4">6초</td>
                                            <td className="py-2 pr-4">크레딧 차감</td>
                                            <td className="py-2">음식/클립 영상</td>
                                        </tr>
                                        <tr className="text-indigo-400 font-semibold">
                                            <td className="py-2 pr-4">Remotion 내보내기</td>
                                            <td className="py-2 pr-4">무제한</td>
                                            <td className="py-2 pr-4">무료</td>
                                            <td className="py-2">권장!</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-3 bg-indigo-900/30 rounded-lg border border-indigo-700/50">
                                <p className="text-indigo-400 font-semibold mb-1">비용 예시</p>
                                <p className="text-gray-300 text-sm">
                                    3분 영상 = 약 18개 이미지 x 55원 = <span className="text-indigo-300 font-bold">약 1,000원</span>
                                    <br />
                                    <span className="text-xs text-gray-400">(Remotion 영상 내보내기 사용 시, Veo API 미사용)</span>
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 탭별 사용 방법 */}
                    <section>
                        <h3 className="text-xl sm:text-2xl font-semibold text-yellow-400 mb-3">3. 탭별 사용 방법</h3>
                        <div className="space-y-4">

                            {/* 시나리오 탭 */}
                            <details className="group bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                                <summary className="flex items-center gap-2 p-3 sm:p-4 cursor-pointer hover:bg-gray-700/30 transition-colors">
                                    <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-purple-300 font-semibold text-sm sm:text-base">시나리오 탭</span>
                                    <span className="text-gray-500 text-xs ml-auto">AI 시나리오 + 이미지 + 나레이션</span>
                                </summary>
                                <div className="p-3 sm:p-4 pt-0 space-y-3 text-sm text-gray-400">
                                    <p>주제를 입력하면 AI가 씬별 시나리오를 자동 생성합니다.</p>
                                    <ol className="list-decimal list-inside space-y-2">
                                        <li><strong className="text-white">로그인</strong> 후 상단에서 이미지 스타일/화면 비율을 설정합니다.</li>
                                        <li><strong className="text-white">시나리오 생성</strong> 버튼을 눌러 주제, 영상 길이, 시나리오 모드(캐릭터/환경/추상/나레이션), 분위기를 입력합니다.</li>
                                        <li>생성된 <strong className="text-white">씬별 시나리오</strong>를 확인하고 필요시 나레이션/비주얼 설명을 수정합니다.</li>
                                        <li><strong className="text-white">캐릭터 관리:</strong> 제안된 캐릭터의 이미지를 생성하고, 이름/외모/의상 등을 편집합니다.</li>
                                        <li><strong className="text-white">씬 이미지 생성:</strong> 개별 또는 전체 씬 이미지를 일괄 생성합니다.</li>
                                        <li><strong className="text-white">나레이션 생성:</strong> TTS 음성을 선택하여 나레이션 오디오를 만듭니다.</li>
                                    </ol>
                                    <div className="p-2 bg-purple-900/20 rounded-lg">
                                        <p className="text-purple-300 text-xs">시나리오 모드: 캐릭터 중심 / 환경&풍경 / 추상적 비주얼 / 나레이션 드리븐</p>
                                    </div>
                                </div>
                            </details>

                            {/* 영상 제작 탭 */}
                            <details className="group bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                                <summary className="flex items-center gap-2 p-3 sm:p-4 cursor-pointer hover:bg-gray-700/30 transition-colors">
                                    <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-pink-300 font-semibold text-sm sm:text-base">영상 제작 탭</span>
                                    <span className="text-gray-500 text-xs ml-auto">Remotion 내보내기 + AI 영상</span>
                                </summary>
                                <div className="p-3 sm:p-4 pt-0 space-y-3 text-sm text-gray-400">
                                    <p>시나리오/광고/클립에서 만든 에셋을 영상으로 조합합니다.</p>
                                    <ol className="list-decimal list-inside space-y-2">
                                        <li><strong className="text-white">소스 선택:</strong> 시나리오, 광고, 클립 중 사용할 소스를 선택합니다.</li>
                                        <li><strong className="text-white">타임라인 편집:</strong> 클립 순서, 길이를 조정합니다.</li>
                                        <li><strong className="text-white">나레이션 관리:</strong> TTS 음성(Kore, Aoede, Charon, Fenrir, Puck)을 선택하여 나레이션을 생성합니다.</li>
                                        <li><strong className="text-white">Remotion 미리보기:</strong> 영상을 미리 확인합니다.</li>
                                        <li><strong className="text-white">영상 내보내기:</strong> Remotion으로 무료 렌더링하여 다운로드합니다. (2분 초과 시 자동 분할)</li>
                                    </ol>
                                    <div className="p-2 bg-yellow-900/20 rounded-lg">
                                        <p className="text-yellow-400 text-xs">Remotion 내보내기(무료)를 권장합니다. AI 영상 생성(Veo)은 고비용이 발생합니다.</p>
                                    </div>
                                </div>
                            </details>

                            {/* 롱폼 탭 */}
                            <details className="group bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                                <summary className="flex items-center gap-2 p-3 sm:p-4 cursor-pointer hover:bg-gray-700/30 transition-colors">
                                    <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-teal-300 font-semibold text-sm sm:text-base">롱폼 탭</span>
                                    <span className="text-gray-500 text-xs ml-auto">10분 이상 장편 영상</span>
                                </summary>
                                <div className="p-3 sm:p-4 pt-0 space-y-3 text-sm text-gray-400">
                                    <p>10분 이상의 긴 영상을 5단계 워크플로우로 제작합니다.</p>
                                    <ol className="list-decimal list-inside space-y-2">
                                        <li><strong className="text-white">Step 1 - 기본 설정:</strong> 주제, 영상 길이, 나레이션/이미지/TTS 모델을 선택합니다.</li>
                                        <li><strong className="text-white">Step 2 - 시나리오 편집:</strong> AI가 생성한 챕터별 시나리오를 수정합니다.</li>
                                        <li><strong className="text-white">Step 3 - 캐릭터 설정:</strong> 시나리오에서 자동 추출된 캐릭터의 이미지를 생성합니다.</li>
                                        <li><strong className="text-white">Step 4 - 에셋 생성:</strong> 캐릭터 데이터를 기반으로 전체 씬 이미지를 일괄 생성합니다.</li>
                                        <li><strong className="text-white">Step 5 - 미리보기/다운로드:</strong> 완성된 영상을 확인하고 내보냅니다.</li>
                                    </ol>
                                    <div className="p-2 bg-teal-900/20 rounded-lg">
                                        <p className="text-teal-300 text-xs">챕터 구조를 지원하며, 실패한 씬은 개별 재생성이 가능합니다.</p>
                                    </div>
                                </div>
                            </details>

                            {/* 음식 영상 탭 */}
                            <details className="group bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                                <summary className="flex items-center gap-2 p-3 sm:p-4 cursor-pointer hover:bg-gray-700/30 transition-colors">
                                    <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-amber-300 font-semibold text-sm sm:text-base">음식 영상 탭</span>
                                    <span className="text-gray-500 text-xs ml-auto">Hailuo AI 음식/먹방 영상</span>
                                </summary>
                                <div className="p-3 sm:p-4 pt-0 space-y-3 text-sm text-gray-400">
                                    <p>음식 사진을 업로드하면 Hailuo AI가 6초 세로 영상(9:16)으로 변환합니다.</p>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-white font-medium mb-1">기본 모드</p>
                                            <ol className="list-decimal list-inside space-y-1">
                                                <li>음식 이미지를 업로드합니다.</li>
                                                <li>음식의 움직임을 한국어로 설명합니다. (AI가 자동으로 영문 시네마틱 프롬프트로 변환)</li>
                                                <li>영상을 생성하고 다운로드합니다.</li>
                                            </ol>
                                        </div>
                                        <div>
                                            <p className="text-white font-medium mb-1">먹방 모드</p>
                                            <ol className="list-decimal list-inside space-y-1">
                                                <li>음식 이미지와 음식명을 입력합니다.</li>
                                                <li>인물 이미지를 업로드하거나, 프리셋(20대 여성/남성, 40대 여성/남성 등)으로 AI 생성합니다.</li>
                                                <li>AI가 인물+음식을 합성한 후 영상을 생성합니다.</li>
                                            </ol>
                                        </div>
                                    </div>
                                    <div className="p-2 bg-amber-900/20 rounded-lg">
                                        <p className="text-amber-300 text-xs">JPG, PNG, WebP 지원 (최대 10MB). 세로 영상(9:16) 전용입니다.</p>
                                    </div>
                                </div>
                            </details>

                            {/* 광고 탭 */}
                            <details className="group bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                                <summary className="flex items-center gap-2 p-3 sm:p-4 cursor-pointer hover:bg-gray-700/30 transition-colors">
                                    <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-orange-300 font-semibold text-sm sm:text-base">광고 탭</span>
                                    <span className="text-gray-500 text-xs ml-auto">15~60초 광고 영상 제작</span>
                                </summary>
                                <div className="p-3 sm:p-4 pt-0 space-y-3 text-sm text-gray-400">
                                    <p>3단계 마법사로 15~60초 분량의 광고 영상을 만듭니다.</p>
                                    <ol className="list-decimal list-inside space-y-2">
                                        <li>
                                            <strong className="text-white">Step 1 - 광고 유형:</strong> 제품 소개, 문제 해결, 라이프스타일, 후기, 프로모션, 브랜드 스토리 중 선택합니다.
                                        </li>
                                        <li>
                                            <strong className="text-white">Step 2 - 제품 정보:</strong> 업종, 상품명, 타겟 고객, 그리고 유형별 세부 정보(USP, 고객 문제/해결, 할인 정보 등)를 입력합니다. 참고 이미지(최대 3장)도 첨부할 수 있습니다.
                                        </li>
                                        <li>
                                            <strong className="text-white">Step 3 - 비주얼 설정:</strong> 영상 길이(15/30/45/60초), 이미지 엔진(Gemini 또는 FLUX), 이미지 스타일, 분위기를 선택합니다.
                                        </li>
                                    </ol>
                                    <p>생성 후 씬별 이미지 생성, 나레이션(TTS) 추가, 클라우드 저장/불러오기가 가능합니다.</p>
                                    <div className="p-2 bg-orange-900/20 rounded-lg">
                                        <p className="text-orange-300 text-xs">HDSER 스토리 구조(Hook-Discovery-Story-Experience-Reason)로 효과적인 마케팅 영상을 만듭니다.</p>
                                    </div>
                                </div>
                            </details>

                            {/* 클립 탭 */}
                            <details className="group bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                                <summary className="flex items-center gap-2 p-3 sm:p-4 cursor-pointer hover:bg-gray-700/30 transition-colors">
                                    <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-cyan-300 font-semibold text-sm sm:text-base">클립 탭</span>
                                    <span className="text-gray-500 text-xs ml-auto">30~120초 숏폼 클립</span>
                                </summary>
                                <div className="p-3 sm:p-4 pt-0 space-y-3 text-sm text-gray-400">
                                    <p>Hailuo AI 6초 클립 생성에 최적화된 숏폼 시나리오(9:16 세로)를 만듭니다.</p>
                                    <ol className="list-decimal list-inside space-y-2">
                                        <li><strong className="text-white">주제 입력:</strong> 영상 주제를 입력합니다.</li>
                                        <li><strong className="text-white">길이 선택:</strong> 30초(5씬), 60초(10씬), 90초(15씬), 120초(20씬) 중 선택합니다.</li>
                                        <li><strong className="text-white">시나리오 모드/스타일/분위기</strong>를 설정합니다.</li>
                                        <li><strong className="text-white">씬 편집:</strong> 나레이션(20~30자 권장), 비주얼 설명, 영상 모션 프롬프트를 수정합니다.</li>
                                        <li><strong className="text-white">이미지 생성:</strong> 각 씬의 이미지를 생성합니다.</li>
                                    </ol>
                                    <div className="p-2 bg-cyan-900/20 rounded-lg">
                                        <p className="text-cyan-300 text-xs">각 씬은 6초 고정이며, Shorts/Reels/TikTok에 최적화되어 있습니다.</p>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </section>

                    {/* 설정 안내 */}
                    <section>
                        <h3 className="text-xl sm:text-2xl font-semibold text-yellow-400 mb-3">4. 설정 안내</h3>
                        <div className="p-3 sm:p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-3 text-sm text-gray-400">
                            <div>
                                <p className="text-white font-medium mb-1">API 키 설정 (설정 버튼)</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li><strong className="text-gray-200">Gemini API:</strong> 이미지 생성, TTS, 텍스트 생성 (필수)</li>
                                    <li><strong className="text-gray-200">Hailuo API:</strong> 음식/클립 AI 영상 생성 (선택)</li>
                                    <li><strong className="text-gray-200">OpenAI API:</strong> TTS 나레이션 (선택, 롱폼 탭)</li>
                                </ul>
                            </div>
                            <div>
                                <p className="text-white font-medium mb-1">AI 모델 선택</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li><strong className="text-gray-200">텍스트 모델:</strong> Gemini 3 Pro/Flash, Gemini 2.5 Flash/Pro, GPT-5.2, o3-mini 등</li>
                                    <li><strong className="text-gray-200">이미지 모델:</strong> Gemini 3 Pro Image, Imagen 4.0, FLUX Kontext 등</li>
                                    <li><strong className="text-gray-200">TTS 음성:</strong> Kore(한국어 여성), Aoede(여성), Charon(남성), Fenrir(저음 남성), Puck(중성)</li>
                                </ul>
                            </div>
                            <div>
                                <p className="text-white font-medium mb-1">프로젝트 설정 (상단 드롭다운)</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li><strong className="text-gray-200">이미지 스타일:</strong> 포토리얼리즘, 애니메이션, 일러스트, 시네마틱, 수채화, 3D 렌더, 픽셀아트 등</li>
                                    <li><strong className="text-gray-200">화면 비율:</strong> 16:9 (유튜브/PC) 또는 9:16 (Shorts/Reels/TikTok)</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* 더보기 메뉴 */}
                    <section>
                        <h3 className="text-xl sm:text-2xl font-semibold text-yellow-400 mb-3">5. 더보기 메뉴</h3>
                        <div className="p-3 sm:p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-3 text-sm text-gray-400">
                            <p>하단 네비게이션의 <strong className="text-white">더보기</strong> 버튼에서 추가 도구에 접근할 수 있습니다.</p>
                            <div className="flex items-start gap-2">
                                <span className="text-red-400 mt-0.5">YT</span>
                                <p><strong className="text-gray-200">YT 채널검색:</strong> 유튜브 채널을 검색하여 레퍼런스/영감을 얻을 수 있습니다.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-blue-400 mt-0.5">P</span>
                                <p><strong className="text-gray-200">상페자동화:</strong> 상세페이지 협업/자동화 도구에 접근합니다.</p>
                            </div>
                        </div>
                    </section>

                    {/* 팁 */}
                    <section>
                        <h3 className="text-xl sm:text-2xl font-semibold text-yellow-400 mb-3">6. 유용한 팁</h3>
                        <div className="p-3 sm:p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-3">
                            <div className="flex items-start gap-2">
                                <span className="text-green-400 mt-0.5">&#10003;</span>
                                <p className="text-gray-300 text-sm">
                                    <strong className="text-white">일러스트/애니메이션 스타일</strong>을 사용하면 일관된 캐릭터 품질을 유지할 수 있습니다.
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-400 mt-0.5">&#10003;</span>
                                <p className="text-gray-300 text-sm">
                                    <strong className="text-white">시나리오 수정</strong>은 이미지 생성 전에 하는 것이 좋습니다.
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-400 mt-0.5">&#10003;</span>
                                <p className="text-gray-300 text-sm">
                                    <strong className="text-white">캐릭터 이미지</strong>를 먼저 생성한 후 씬 이미지를 생성하면 일관성이 높아집니다.
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-400 mt-0.5">&#10003;</span>
                                <p className="text-gray-300 text-sm">
                                    <strong className="text-white">광고 탭</strong>에서 참고 이미지를 첨부하면 브랜드에 맞는 비주얼을 얻을 수 있습니다.
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-400 mt-0.5">&#10003;</span>
                                <p className="text-gray-300 text-sm">
                                    <strong className="text-white">클립 탭</strong>의 나레이션은 20~30자로 짧게 작성해야 6초에 맞습니다.
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-yellow-400 mt-0.5">!</span>
                                <p className="text-gray-300 text-sm">
                                    <strong className="text-white">Remotion 영상 내보내기</strong>는 무료이며, Veo/Hailuo AI 영상 생성은 비용이 발생합니다.
                                </p>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};
