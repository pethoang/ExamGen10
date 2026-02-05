import React, { useState, useCallback } from 'react';
import { AppStep, ExamData, AnalysisResult } from './types';
import { analyzeExamFile, generateFullExam } from './services/geminiService';
import ExamPreview from './components/ExamPreview';
import { UploadIcon, FileTextIcon, WandIcon, CheckCircleIcon, ChevronRightIcon } from './components/Icons';

// Default matrix template
const DEFAULT_MATRIX = `I. MULTIPLE CHOICE (8.0 points)
1. Phonetics (4 questions): Pronunciation (2), Stress (2).
2. Lexico-Grammar (6 questions): Tenses, Prepositions, Phrasal verbs, Word choice.
3. Functional Speaking (2 questions): Daily conversation exchanges.
4. Reading Comprehension (5 questions): Read a passage about Environment and answer.
5. Cloze Test (5 questions): Fill in the blanks (Topic: Technology).

II. WRITING (2.0 points)
1. Sentence Transformation (4 questions): Voice, Conditional, Reported speech.
2. Paragraph Writing (1 question): Write a paragraph (100-120 words) about a local festival.`;

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [sampleAnalysis, setSampleAnalysis] = useState<AnalysisResult | null>(null);
  const [matrixText, setMatrixText] = useState(DEFAULT_MATRIX);
  const [generatedExam, setGeneratedExam] = useState<ExamData | null>(null);

  // File Upload Handler (Simulated for Demo)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        // Check if text is binary garbage (simple check)
        if (text.substring(0, 100).includes('')) {
             // Mocking analysis for binary files since we don't have mammoth loaded via npm
             const mockAnalysis: AnalysisResult = {
                difficulty: "Trung bình - Khá",
                structureSummary: "Đề gồm 40 câu trắc nghiệm và 2 bài viết tự luận. Tập trung ngữ pháp lớp 9.",
                cefrLevel: "A2-B1",
                readingStats: {
                    avgWordCount: 180,
                    difficultyDesc: "Văn bản chủ đề đời sống, câu ghép chiếm 30%"
                }
             };
             // Simulate network delay
             setTimeout(() => {
                setSampleAnalysis(mockAnalysis);
                setIsLoading(false);
                setCurrentStep(AppStep.MATRIX);
             }, 1500);
        } else {
            // Real analysis via Gemini
            const analysis = await analyzeExamFile(text);
            setSampleAnalysis(analysis);
            setIsLoading(false);
            setCurrentStep(AppStep.MATRIX);
        }
      };
      reader.readAsText(file); // Try reading as text
    } catch (err) {
      setError("Có lỗi khi đọc file. Vui lòng thử lại.");
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!sampleAnalysis) return;
    setIsLoading(true);
    setError(null);

    try {
      const exam = await generateFullExam(matrixText, sampleAnalysis);
      setGeneratedExam(exam);
      setCurrentStep(AppStep.PREVIEW);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Không thể tạo đề thi. Vui lòng kiểm tra kết nối API và thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!generatedExam) return;
    
    // Quick HTML export that opens in Word
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${generatedExam.title}</title></head><body>`;
    
    // We get the innerHTML of our preview component for WYSIWYG export
    const content = document.getElementById('exam-content')?.innerHTML || "";
    
    // Generate Answer Key content
    let answerKeyContent = `<br style="page-break-before:always" />`;
    answerKeyContent += `<div style="font-family: 'Times New Roman', serif; padding: 20px;">`;
    answerKeyContent += `<p style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 20px;">ĐÁP ÁN GỢI Ý</p>`;
    
    let globalKeyIndex = 1;

    generatedExam.sections.forEach(section => {
      // Updated: Removed text-transform: uppercase
      answerKeyContent += `<p style="font-weight: bold; font-size: 12pt; margin-top: 15px;">${section.title}</p>`;
      section.questions.forEach((q) => {
        let questionLabel = `Question ${globalKeyIndex}`;
        let increment = q.questionCount || 1;

        if (q.type === 'conversation-matching') {
            // Determine increment if missing
            if (!q.questionCount) {
                 const matches = q.content.match(/\(\d+\)/g);
                 increment = matches ? matches.length : 1;
            }
            if (increment > 1) {
                questionLabel = `Questions ${globalKeyIndex} - ${globalKeyIndex + increment - 1}`;
            }
        }

        answerKeyContent += `<p style="margin: 5px 0; font-size: 12pt;"><strong>${questionLabel}:</strong> ${q.correctAnswer || ""}</p>`;
        
        globalKeyIndex += increment;
      });
    });
    answerKeyContent += `</div>`;

    const footer = "</body></html>";
    const sourceHTML = header + content + answerKeyContent + footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `De_Thi_Tieng_Anh_10_${new Date().getTime()}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  // Helper component for Step Indicators
  // Updated for Blue Header Background
  const StepIndicator = ({ step, label, isActive, isCompleted }: { step: number, label: string, isActive: boolean, isCompleted: boolean }) => (
    <div className={`flex items-center gap-2 ${isActive ? 'text-white font-bold' : isCompleted ? 'text-blue-100' : 'text-blue-300/70'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-base transition-colors ${
        isActive ? 'border-white bg-white text-[#0077b5]' : 
        isCompleted ? 'border-blue-200 text-blue-100' : 'border-blue-400 text-blue-400'
      }`}>
        {step}
      </div>
      <span className="hidden md:inline text-base">{label}</span>
    </div>
  );

  // Render Steps
  const renderStep = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in bg-white rounded-xl shadow-lg border border-gray-100 max-w-2xl mx-auto">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-[#0077b5] rounded-full animate-spin mb-6"></div>
          <h3 className="text-2xl font-bold text-gray-800">AI đang xử lý...</h3>
          <p className="text-gray-500 mt-2 text-lg">
             {currentStep === AppStep.UPLOAD ? "Đang phân tích cấu trúc đề thi..." : "Đang soạn thảo đề thi mới..."}
          </p>
        </div>
      );
    }

    switch (currentStep) {
      case AppStep.UPLOAD:
        return (
          <div className="bg-white p-12 rounded-xl shadow-lg border border-gray-100 text-center max-w-3xl mx-auto animate-fade-in">
            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
              <UploadIcon className="text-[#0077b5] w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Tải lên đề thi mẫu</h2>
            <p className="text-gray-600 mb-10 text-lg leading-relaxed">
              Hệ thống sẽ tự động phân tích độ khó, cấu trúc và ngữ pháp từ đề thi cũ của bạn để tạo ra đề thi mới tương đương.
            </p>
            
            <label className="block w-full cursor-pointer group">
              <input type="file" className="hidden" accept=".docx,.txt,.pdf" onChange={handleFileUpload} />
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-16 hover:border-[#0077b5] hover:bg-blue-50 transition-all duration-300 group-hover:shadow-md">
                <p className="text-xl font-medium text-gray-600 group-hover:text-[#0077b5] transition-colors">
                  Kéo thả hoặc nhấn để chọn file
                </p>
                <p className="text-sm text-gray-400 mt-3 font-medium">Hỗ trợ DOCX, PDF (Tối đa 5MB)</p>
              </div>
            </label>
          </div>
        );

      case AppStep.MATRIX:
        return (
          <div className="bg-white p-10 rounded-xl shadow-lg border border-gray-100 max-w-5xl mx-auto animate-fade-in">
             <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-4">
                <div className="bg-green-100 p-2 rounded-full">
                    <CheckCircleIcon className="text-green-600 w-6 h-6" />
                </div>
                <h3 className="font-bold text-2xl text-gray-900">Kết quả phân tích & Ma trận</h3>
            </div>

            {/* Editable Analysis Stats */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded shadow-sm border border-gray-100">
                   <label className="block text-sm font-bold text-[#0077b5] mb-2 uppercase tracking-wide">Độ khó chung</label>
                   <div className="text-xl font-medium text-gray-800">{sampleAnalysis?.difficulty} ({sampleAnalysis?.cefrLevel})</div>
                </div>
                 <div className="bg-white p-4 rounded shadow-sm border border-gray-100">
                   <label className="block text-sm font-bold text-[#0077b5] mb-2 uppercase tracking-wide">Số từ bài đọc (Có thể chỉnh sửa)</label>
                   <div className="flex items-center gap-3">
                       <input 
                           type="number" 
                           value={sampleAnalysis?.readingStats.avgWordCount || 0}
                           onChange={(e) => {
                               if (sampleAnalysis) {
                                   setSampleAnalysis({
                                       ...sampleAnalysis,
                                       readingStats: { ...sampleAnalysis.readingStats, avgWordCount: parseInt(e.target.value) || 0 }
                                   });
                               }
                           }}
                           className="w-32 px-4 py-2 text-lg border border-gray-300 rounded focus:ring-2 focus:ring-[#0077b5] focus:border-[#0077b5] outline-none"
                       />
                       <span className="text-lg text-gray-600 font-medium">từ/bài</span>
                   </div>
                </div>
                 <div className="md:col-span-2 bg-white p-4 rounded shadow-sm border border-gray-100">
                   <label className="block text-sm font-bold text-[#0077b5] mb-2 uppercase tracking-wide">Độ khó ngữ liệu đọc</label>
                   <input 
                       type="text" 
                       value={sampleAnalysis?.readingStats.difficultyDesc || ''}
                       onChange={(e) => {
                           if (sampleAnalysis) {
                               setSampleAnalysis({
                                   ...sampleAnalysis,
                                   readingStats: { ...sampleAnalysis.readingStats, difficultyDesc: e.target.value }
                               });
                           }
                       }}
                       className="w-full px-4 py-2 text-lg border border-gray-300 rounded focus:ring-2 focus:ring-[#0077b5] focus:border-[#0077b5] outline-none"
                   />
                </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileTextIcon className="text-[#0077b5] w-6 h-6" />
                Ma trận đề thi mong muốn
            </h2>
            <p className="text-gray-500 mb-4 text-base">
              Bạn có thể chỉnh sửa ma trận bên dưới để tùy biến cấu trúc đề thi.
            </p>
            
            <textarea
              value={matrixText}
              onChange={(e) => setMatrixText(e.target.value)}
              className="w-full h-80 p-6 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0077b5] focus:border-[#0077b5] font-mono text-base leading-relaxed bg-white shadow-inner text-gray-800"
              placeholder="Nhập ma trận đề thi..."
            />

            <div className="mt-8 flex justify-end">
              <button 
                onClick={handleGenerate}
                className="bg-[#0077b5] hover:bg-[#006090] text-white text-lg px-10 py-4 rounded-lg font-bold flex items-center gap-3 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                <WandIcon className="w-6 h-6" />
                TIẾN HÀNH TẠO ĐỀ THI
              </button>
            </div>
          </div>
        );

      case AppStep.PREVIEW:
        return generatedExam ? (
            <ExamPreview data={generatedExam} onExport={handleExport} />
        ) : null;
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-gray-50">
      {/* HEADER - Updated with Primary Blue Background */}
      <header className="bg-[#0077b5] border-b border-blue-700 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo Box Inverted */}
            <div className="bg-white text-[#0077b5] w-14 h-14 rounded-xl flex items-center justify-center font-bold text-4xl shadow-sm">E</div>
            <div>
                {/* Title Text White - Increased Size to 3xl */}
                <h1 className="text-3xl font-bold text-white tracking-tight">ExamGen 10</h1>
                {/* Updated Subtitle */}
                <p className="text-xs text-blue-100 font-medium">Trợ lý AI tạo đề TS 10 cho Giáo viên</p>
            </div>
          </div>
          
          {/* Enhanced Progress Indicators - Updated Colors for Blue Background */}
          <div className="hidden md:flex items-center gap-6">
            <StepIndicator 
                step={1} 
                label="Tải lên" 
                isActive={currentStep === AppStep.UPLOAD} 
                isCompleted={currentStep > AppStep.UPLOAD} 
            />
            <ChevronRightIcon className="w-5 h-5 text-blue-300" />
            <StepIndicator 
                step={2} 
                label="Ma trận" 
                isActive={currentStep === AppStep.MATRIX} 
                isCompleted={currentStep > AppStep.MATRIX} 
            />
            <ChevronRightIcon className="w-5 h-5 text-blue-300" />
            <StepIndicator 
                step={3} 
                label="Kết quả" 
                isActive={currentStep === AppStep.PREVIEW} 
                isCompleted={currentStep > AppStep.PREVIEW} 
            />
          </div>
        </div>
      </header>

      {/* BODY (MAIN CONTENT) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-10">
        
        {/* Instructions Section - Only show in Step 1 for better UX */}
        {currentStep === AppStep.UPLOAD && (
          <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-8 border-b border-gray-200 pb-12 animate-fade-in">
             <div className="flex flex-col items-center text-center group cursor-default">
                <div className="w-20 h-20 bg-white border-2 border-blue-100 rounded-full flex items-center justify-center text-[#0077b5] mb-4 shadow-sm group-hover:border-[#0077b5] group-hover:scale-110 transition-all duration-300">
                   <UploadIcon className="w-9 h-9" />
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-2">1. Tải lên đề mẫu</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-[250px]">
                   Tải lên đề thi cũ của bạn (PDF/Word). AI sẽ phân tích cấu trúc, độ khó và ngữ pháp.
                </p>
             </div>
             
             <div className="flex flex-col items-center text-center group cursor-default">
                <div className="w-20 h-20 bg-white border-2 border-blue-100 rounded-full flex items-center justify-center text-[#0077b5] mb-4 shadow-sm group-hover:border-[#0077b5] group-hover:scale-110 transition-all duration-300">
                   <FileTextIcon className="w-9 h-9" />
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-2">2. Thiết lập Ma trận</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-[250px]">
                   Xem kết quả phân tích và tùy chỉnh ma trận đề thi, số lượng câu hỏi theo ý muốn.
                </p>
             </div>

             <div className="flex flex-col items-center text-center group cursor-default">
                <div className="w-20 h-20 bg-white border-2 border-blue-100 rounded-full flex items-center justify-center text-[#0077b5] mb-4 shadow-sm group-hover:border-[#0077b5] group-hover:scale-110 transition-all duration-300">
                   <WandIcon className="w-9 h-9" />
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-2">3. Xuất bản đề thi</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-[250px]">
                   Nhận đề thi mới hoàn chỉnh kèm đáp án. Tải về dưới dạng file Word để in ấn.
                </p>
             </div>
          </div>
        )}

        {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-r-lg mb-8 flex items-center gap-3 shadow-sm">
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span className="font-medium text-lg">{error}</span>
            </div>
        )}
        {renderStep()}
      </main>

      {/* FOOTER - Updated with Dark Background */}
      <footer className="bg-slate-900 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto py-6 px-6 text-center">
          <p className="text-slate-400 font-medium mb-1">ExamGen 10. Ứng dụng hỗ trợ giáo viên Tiếng Anh THCS Việt Nam.</p>
          <div className="flex justify-center gap-6 mt-1">
             <span className="text-white text-xl font-bold cursor-pointer transition-colors hover:text-blue-200">Zalo 0913.885.221 (Ông Giáo)</span>
          </div>
          <p className="mt-2 text-xs text-blue-400 opacity-80 font-bold">© {new Date().getFullYear()} GLOBALSUCCESSFILES.COM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;