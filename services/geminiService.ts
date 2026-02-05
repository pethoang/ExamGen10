import { GoogleGenAI } from "@google/genai";
import { ExamData, AnalysisResult } from "../types";

// Initialize Gemini Client
const getClient = () => {
  // Use process.env.API_KEY directly as required by guidelines. 
  // Assume it is valid and accessible.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const MODEL_NAME = "gemini-3-flash-preview"; 

// Helper to clean JSON string from Markdown formatting
const cleanJsonString = (str: string) => {
  if (!str) return "";
  let cleaned = str.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
  return cleaned.trim();
};

/**
 * Step 1: Analyze the uploaded exam text
 */
export const analyzeExamFile = async (fileContent: string): Promise<AnalysisResult> => {
  const client = getClient();
  
  const prompt = `
    Bạn là một chuyên gia giáo dục Tiếng Anh tại Việt Nam. 
    Hãy phân tích nội dung đề thi dưới đây (được trích xuất từ file).
    
    Nhiệm vụ:
    1. Xác định mức độ khó tổng thể (Dễ/Trung bình/Khá/Khó).
    2. Tóm tắt cấu trúc (Các phần chính, số lượng câu).
    3. Đánh giá khung năng lực ngoại ngữ (CEFR Level ước lượng, ví dụ A2, B1).
    4. PHÂN TÍCH RIÊNG PHẦN ĐỌC HIỂU (READING):
       - Tính toán ước lượng số lượng từ (word count) trung bình của các đoạn văn/bài đọc có trong đề.
       - Mô tả ngắn gọn độ phức tạp của ngữ liệu đọc (ví dụ: Chủ đề quen thuộc, câu đơn giản hay văn bản học thuật, câu ghép phức tạp).
    
    Trả về định dạng JSON:
    {
      "difficulty": "string",
      "structureSummary": "string",
      "cefrLevel": "string",
      "readingStats": {
        "avgWordCount": number, // Ví dụ: 150
        "difficultyDesc": "string" // Ví dụ: "Văn bản thông tin, từ vựng chủ đề môi trường, câu phức trung bình"
      }
    }

    Nội dung đề thi:
    ${fileContent.substring(0, 15000)} 
  `;

  try {
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    if (response.text) {
      const cleanedText = cleanJsonString(response.text);
      return JSON.parse(cleanedText);
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Error analyzing exam:", error);
    return {
      difficulty: "Chưa xác định",
      structureSummary: "Không thể phân tích cấu trúc",
      cefrLevel: "N/A",
      readingStats: {
        avgWordCount: 150, // Default fallback
        difficultyDesc: "Trung bình"
      }
    };
  }
};

/**
 * Step 3: Generate the full exam based on matrix and analysis
 */
export const generateFullExam = async (
  matrixText: string,
  analysisData: AnalysisResult
): Promise<ExamData> => {
  const client = getClient();

  const systemInstruction = `
    Bạn là chuyên gia soạn đề thi Tiếng Anh tuyển sinh vào lớp 10 THPT tại Việt Nam.
    Bạn nắm vững chương trình GDPT 2018 (Sách Global Success, Friends Plus...).
    
    Yêu cầu quan trọng:
    - Nội dung: 85% kiến thức lớp 9, 10% lớp 8, 5% nâng cao.
    - Không trùng lặp câu hỏi cũ.
    - Ngôn ngữ: Tiếng Anh chuẩn mực.
  `;

  const prompt = `
    Hãy tạo một đề thi hoàn chỉnh dựa trên MA TRẬN và CÁC RÀNG BUỘC sau đây.

    1. ĐỘ KHÓ MỤC TIÊU: ${analysisData.difficulty} (Tương đương ${analysisData.cefrLevel}).
    
    2. RÀNG BUỘC PHẦN ĐỌC HIỂU (READING) - BẮT BUỘC TUÂN THỦ:
       - ĐỘ DÀI: Các bài đọc phải có độ dài khoảng ${analysisData.readingStats.avgWordCount} từ/bài (Chấp nhận sai số ±10%). 
       - NGỮ LIỆU: Sử dụng ngữ liệu có độ khó tương đương mô tả: "${analysisData.readingStats.difficultyDesc}".
       - CHỦ ĐỀ: Nằm trong chương trình SGK Tiếng Anh 9 mới (Global Success, Friends Plus...).
       - LƯU Ý: Nếu ma trận yêu cầu 2 bài đọc, cả 2 bài phải tuân thủ độ dài này.

    3. CẤU TRÚC JSON CHO BÀI ĐỌC (READING/CLOZE TEST):
       - NỘI DUNG ĐOẠN VĂN: Phải đặt trong trường "passageContent" của đối tượng Section. Tuyệt đối không đặt đoạn văn vào nội dung câu hỏi (Questions).
       - CÁC CÂU HỎI: Nằm trong mảng "questions" như bình thường.
       - Với Cloze Test (điền từ): Đoạn văn chứa các chỗ trống đánh số (1), (2)... nằm trong "passageContent". Các câu hỏi trắc nghiệm tương ứng nằm trong "questions".

    4. QUY ĐỊNH ĐỊNH DẠNG ĐẶC BIỆT CHO DẠNG BÀI HỘI THOẠI (GAP-FILL CONVERSATION):
       - Nếu ma trận có dạng bài "Read the conversation and choose the correct letter...", hãy tạo ra MỘT câu hỏi duy nhất (Question object) đại diện cho cả bài.
       - Type: "conversation-matching"
       - Content: Chứa toàn bộ đoạn hội thoại, với các vị trí điền khuyết dạng (1), (2), (3)...
       - Options: Chứa danh sách các câu trả lời (A, B, C, D, E, F, G...).
       - questionCount: Bắt buộc phải có trường này, giá trị là số lượng ô trống cần điền (ví dụ: 5).
       - correctAnswer: Liệt kê đáp án theo thứ tự, ví dụ: "1-A, 2-C, 3-D...".

    5. MA TRẬN ĐỀ THI:
    ${matrixText}

    6. YÊU CẦU QUAN TRỌNG VỀ TIÊU ĐỀ PHẦN (Sections Title):
       - Field "title" trong mảng "sections" PHẢI chứa đầy đủ tên phần và hướng dẫn làm bài (Instruction).
       - Định dạng bắt buộc: "Part [số]. [Hướng dẫn chi tiết]". 
       - Ví dụ đúng: "Part 1. Choose the letter (A, B, C or D) to indicate the correct answer to each of the following questions."

    7. YÊU CẦU ĐẦU RA (JSON):
    Trả về JSON cấu trúc như sau (KHÔNG thêm markdown block):
    {
      "title": "KỲ THI TUYỂN SINH VÀO LỚP 10 THPT",
      "subtitle": "MÔN: TIẾNG ANH - NĂM HỌC 2024-2025",
      "duration": 60,
      "sections": [
        {
          "title": "Part 1. Choose the letter...",
          "totalPoints": 0.0,
          "questions": [...]
        },
        {
          "title": "Part 5. Read the following passage...",
          "passageContent": "Plastic pollution is one of the most serious... (Nội dung đoạn văn ở đây)",
          "totalPoints": 0.0,
          "questions": [
            {
              "id": "13",
              "partName": "Reading",
              "type": "multiple-choice",
              "content": "What is the main topic of the passage?",
              "options": ["A...", "B..."],
              "correctAnswer": "C",
              "level": "Thông hiểu"
            }
          ]
        }
      ]
    }
  `;

  try {
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
      }
    });

    if (response.text) {
        const cleanedText = cleanJsonString(response.text);
        try {
          return JSON.parse(cleanedText) as ExamData;
        } catch (parseError) {
          console.error("JSON Parse Error:", parseError);
          console.log("Raw Response:", response.text);
          throw new Error("Dữ liệu trả về từ AI không đúng định dạng JSON.");
        }
    }
    throw new Error("Failed to generate exam content");
  } catch (error) {
    console.error("Generation Error:", error);
    throw error;
  }
};