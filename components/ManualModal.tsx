
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
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-gray-800 text-gray-300 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-lg z-10">
                    <h2 className="text-2xl font-bold text-indigo-400">AI 캐릭터 일러스트 생성기 설명서</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-white hover:bg-gray-600 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white"
                        aria-label="Close manual"
                    >
                        <span className="text-lg">❌</span>
                    </button>
                </header>
                <main className="overflow-y-auto p-6 space-y-8">
                    <section>
                        <h3 className="text-2xl font-semibold text-yellow-400 mb-3">1. 앱 개요</h3>
                        <p className="text-gray-400 leading-relaxed">
                            <strong className="text-white">AI 캐릭터 일러스트 생성기</strong>는 일관성 있는 캐릭터 이미지를 손쉽게 만들 수 있도록 돕는 도구입니다. 이 앱은 AI가 캐릭터 참조 이미지에서 외형을 학습한 뒤, 사용자의 프롬프트에 맞춰 새로운 장면을 생성합니다. 모든 결과물은 <strong className="text-teal-300">다양한 사진 스타일(Photorealistic)</strong>로 자동 생성되어, 별도의 스타일 지정 없이도 사실적인 이미지를 얻을 수 있습니다.
                            <br/><br/>
                            이를 통해 웹소설 삽화, 컨셉 아트 등 다양한 용도의 캐릭터 이미지를 사실적인 스타일로 빠르고 일관되게 제작할 수 있습니다.
                        </p>
                    </section>
                    
                    <section>
                        <h3 className="text-2xl font-semibold text-yellow-400 mb-3">2. 사용 방법 (Step-by-Step)</h3>
                        <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-6">
                            <div>
                                <h5 className="font-semibold text-white text-lg mb-2">Step 1: 캐릭터 라이브러리</h5>
                                <p className="text-gray-400 text-sm">
                                   이곳에서 생성할 캐릭터의 원본 이미지를 관리합니다. 최대 5개의 캐릭터를 보관할 수 있습니다.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm mt-2">
                                    <li><strong className="text-white">이미지 추가 (업로드):</strong> 빈 슬롯을 클릭하여 PC에서 직접 이미지를 업로드할 수 있습니다.</li>
                                    <li><strong className="text-white">이미지 추가 (AI 생성):</strong>
                                        <ol className="list-decimal list-inside ml-4 mt-1 space-y-1">
                                            <li>'등장인물 생성' 버튼을 눌러 텍스트로 캐릭터를 묘사하고 생성합니다.</li>
                                            <li>생성된 캐릭터 이미지는 중앙의 <strong className="text-yellow-300">'생성된 결과물'</strong> 패널에 먼저 나타납니다.</li>
                                            <li>결과물 패널 상단의 <strong className="text-yellow-300">'등장인물 선택'</strong> 버튼을 누릅니다.</li>
                                            <li>라이브러리에 추가하고 싶은 이미지를 클릭하여 선택한 후, <strong className="text-yellow-300">'라이브러리로 이동'</strong> 버튼을 누르면 빈 슬롯에 추가됩니다.</li>
                                        </ol>
                                    </li>
                                    <li><strong className="text-white">정보 수정 및 삭제:</strong> 이미지 위에 마우스를 올리면 정보 수정, 확대, 삭제 버튼이 나타납니다.</li>
                                </ul>
                            </div>

                            <div>
                                <h5 className="font-semibold text-white text-lg mb-2">Step 2: 캐릭터 참조 이미지 (활성화)</h5>
                                <p className="text-gray-400 text-sm">
                                    실제 이미지 생성에 사용할 캐릭터를 선택하는 공간입니다. AI는 여기에 활성화된 캐릭터(들)의 외형을 학습하여 새로운 이미지를 생성합니다.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm mt-2">
                                     <li><strong className="text-yellow-300">캐릭터 활성화:</strong> 라이브러리의 이미지 하단에 있는 '+' 버튼을 클릭하면, 이곳의 빈 슬롯으로 복사되어 활성화됩니다.</li>
                                     <li><strong className="text-white">캐릭터 비활성화:</strong> 활성화된 캐릭터 이미지 우측 상단의 '❌' 버튼을 누르면 목록에서 제거됩니다. (라이브러리의 원본은 삭제되지 않습니다.)</li>
                                </ul>
                            </div>

                             <div>
                                <h5 className="font-semibold text-white text-lg mb-2">Step 3: Cinematic Look</h5>
                                <p className="text-gray-400 text-sm">
                                    생성될 이미지에 전문적인 영상미를 더하는 필터 기능입니다. 장르, 시대, 촬영 기법에 기반한 다양한 스타일을 조합하여 원하는 분위기를 연출할 수 있습니다.
                                </p>
                                <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm mt-2">
                                    <li><strong className="text-white">필터 추가:</strong> 원하는 필터 버튼을 클릭하여 활성화합니다. 최대 3개까지 필터를 동시에 적용할 수 있습니다.</li>
                                    <li><strong className="text-white">강도 조절:</strong> 활성화된 필터 옆의 슬라이더를 이용해 각 필터의 적용 강도를 10%부터 100%까지 조절할 수 있습니다.</li>
                                    <li><strong className="text-white">필터 제거:</strong> 활성화된 필터 우측의 'X' 버튼을 눌러 제거할 수 있습니다.</li>
                                </ul>
                            </div>

                             <div>
                                <h5 className="font-semibold text-white text-lg mb-2">Step 4: 이미지 생성 설정</h5>
                                <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm">
                                    <li><strong className="text-white">장면 설명:</strong> 활성화된 캐릭터(들)가 어떤 행동을 하거나 어떤 장소에 있는지 <strong className="text-white">영어로 구체적으로 묘사</strong>해주세요. AI는 Step 2의 캐릭터 외형을 유지하면서, 이 프롬프트에 맞는 장면을 그려냅니다.</li>
                                    <li><strong className="text-white">카메라/구도:</strong> 드롭다운 메뉴에서 원하는 카메라 앵글을 선택하여 장면의 구도를 지정할 수 있습니다.</li>
                                    <li><strong className="text-white">생성 개수:</strong> 한 번의 클릭으로 생성할 이미지의 개수를 선택합니다. (1~5개)</li>
                                </ul>
                            </div>
                            
                            <div>
                                 <h5 className="font-semibold text-white text-lg mb-2">Step 5: 생성 및 결과 확인</h5>
                                 <p className="text-gray-400 mb-2 text-sm">모든 설정이 끝나면 <strong className="text-yellow-300">'이미지 생성'</strong> 버튼을 클릭합니다.</p>
                                <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm">
                                    <li><strong>결과 확인:</strong> 중앙의 '생성된 결과물' 창에 이미지가 나타납니다. 새로운 이미지를 생성하면 이곳에 계속해서 추가됩니다.</li>
                                    <li><strong>이미지 변경:</strong> 각 이미지 하단의 <strong className="text-yellow-300">'이미지 변경'</strong> 버튼을 누르면, 해당 이미지를 기준으로 변경하고 싶은 부분만 지시하여 수정할 수 있습니다.</li>
                                    <li><strong>동영상 편집:</strong> 이미지 하단의 <strong className="text-cyan-300">'동영상 편집'</strong> 버튼을 누르면, 해당 이미지를 바탕으로 짧은 동영상을 생성할 수 있습니다. (약 1~2분 소요)</li>
                                    <li><strong>저장:</strong> 각 이미지의 저장 버튼이나 '이미지 .zip 저장' 버튼을 사용하여 결과물을 저장할 수 있습니다.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-2xl font-semibold text-yellow-400 mb-3">3. 챕터 기능 활용하기</h3>
                        <p className="text-gray-400 leading-relaxed">
                            화면 우측의 <strong className="text-white">'챕터'</strong> 패널을 사용하여 생성된 이미지들을 체계적으로 관리할 수 있습니다.
                        </p>
                         <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm mt-2">
                            <li><strong className="text-white">챕터 추가/삭제:</strong> '챕터 추가' 버튼으로 새 챕터를 만들고, 각 챕터의 휴지통 아이콘으로 삭제할 수 있습니다. 챕터를 삭제하면 안의 이미지들은 '생성된 결과물' 목록으로 안전하게 이동됩니다.</li>
                            <li><strong className="text-white">이름 변경:</strong> 챕터 이름을 더블클릭하여 수정할 수 있습니다.</li>
                            <li><strong className="text-yellow-300">이미지 정리:</strong> '생성된 결과물' 목록의 이미지를 원하는 챕터로 드래그 앤 드롭하여 옮길 수 있습니다. 챕터 간 이미지 이동이나 챕터에서 결과물 목록으로 다시 이동하는 것도 가능합니다.</li>
                        </ul>
                    </section>
                </main>
            </div>
        </div>
    );
};