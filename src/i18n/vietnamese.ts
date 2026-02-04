/**
 * Vietnamese Language Support Module
 * Provides Vietnamese-specific utilities for LongBest AI system
 */

/**
 * Vietnamese stopwords for text processing
 * Common words that can be filtered out in analysis
 */
export const VIETNAMESE_STOPWORDS = new Set([
  // Articles & Determiners
  "một",
  "các",
  "những",
  "này",
  "đó",
  "kia",
  "nọ",
  "mỗi",
  "mọi",
  // Prepositions
  "của",
  "cho",
  "với",
  "về",
  "từ",
  "tại",
  "trong",
  "ngoài",
  "trên",
  "dưới",
  "sau",
  "trước",
  "giữa",
  // Pronouns
  "tôi",
  "bạn",
  "anh",
  "chị",
  "em",
  "họ",
  "chúng",
  "ta",
  "mình",
  // Conjunctions
  "và",
  "hoặc",
  "nhưng",
  "mà",
  "hay",
  "nên",
  "vì",
  "nếu",
  "thì",
  // Common verbs
  "là",
  "có",
  "được",
  "đã",
  "sẽ",
  "đang",
  "bị",
  "rất",
  "lắm",
  "quá",
]);

/**
 * Vietnamese response templates
 * Pre-defined templates for common AI responses
 */
export const VIETNAMESE_RESPONSE_TEMPLATES = {
  greeting: {
    formal: "Xin chào! Tôi có thể giúp gì cho bạn?",
    casual: "Chào bạn! Cần tôi hỗ trợ điều gì không?",
    morning: "Chào buổi sáng! Hôm nay tôi có thể giúp gì?",
    afternoon: "Chào buổi chiều! Bạn cần hỗ trợ gì ạ?",
    evening: "Chào buổi tối! Tôi có thể giúp bạn điều gì?",
  },
  confirmation: {
    success: "✅ Đã hoàn thành thành công!",
    processing: "⏳ Đang xử lý, vui lòng đợi...",
    done: "✓ Xong!",
    understood: "Đã hiểu rồi!",
    noted: "Đã ghi nhận!",
  },
  error: {
    general: "❌ Đã xảy ra lỗi. Vui lòng thử lại.",
    notFound: "🔍 Không tìm thấy kết quả.",
    invalidInput: "⚠️ Dữ liệu đầu vào không hợp lệ.",
    apiError: "🔌 Lỗi kết nối API. Vui lòng kiểm tra lại.",
    timeout: "⏱️ Hết thời gian chờ. Vui lòng thử lại.",
  },
  help: {
    commandList: "📋 Danh sách lệnh có sẵn:",
    needHelp: "Bạn cần trợ giúp về điều gì?",
    documentation: "📚 Xem tài liệu hướng dẫn",
    examples: "💡 Ví dụ sử dụng:",
  },
  workflow: {
    brainstorm: "🧠 Bắt đầu brainstorming...",
    feature: "✨ Phân tích yêu cầu tính năng...",
    bugfix: "🐛 Điều tra lỗi...",
    deploy: "🚀 Chuẩn bị triển khai...",
  },
  obsidian: {
    noteCreated: "📝 Đã tạo ghi chú trong Obsidian",
    noteSaved: "💾 Đã lưu vào vault",
    searching: "🔍 Đang tìm kiếm trong vault...",
    linking: "🔗 Đang tạo liên kết...",
  },
};

/**
 * Vietnamese error messages with localization
 */
export const VIETNAMESE_ERROR_MESSAGES: Record<string, string> = {
  FILE_NOT_FOUND: "Không tìm thấy tệp tin",
  INVALID_PATH: "Đường dẫn không hợp lệ",
  PERMISSION_DENIED: "Không có quyền truy cập",
  NETWORK_ERROR: "Lỗi kết nối mạng",
  TIMEOUT_ERROR: "Vượt quá thời gian chờ",
  INVALID_CREDENTIALS: "Thông tin đăng nhập không hợp lệ",
  RESOURCE_NOT_FOUND: "Không tìm thấy tài nguyên",
  SERVICE_UNAVAILABLE: "Dịch vụ tạm thời không khả dụng",
  RATE_LIMIT_EXCEEDED: "Đã vượt quá giới hạn yêu cầu",
  INVALID_FORMAT: "Định dạng không đúng",
};

/**
 * Format date/time in Vietnamese style
 */
export function formatVietnameseDateTime(date: Date): string {
  const days = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

  const dayOfWeek = days[date.getDay()];
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${dayOfWeek}, ${day}/${month}/${year} lúc ${hours}:${minutes}`;
}

/**
 * Format date only in Vietnamese style
 */
export function formatVietnameseDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format time only in Vietnamese style
 */
export function formatVietnameseTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format currency in Vietnamese Dong (VND)
 */
export function formatVietnameseCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

/**
 * Format large numbers with Vietnamese separators
 */
export function formatVietnameseNumber(num: number): string {
  return new Intl.NumberFormat("vi-VN").format(num);
}

/**
 * Normalize Vietnamese tone marks
 * Converts composite Unicode characters to decomposed form for consistent processing
 */
export function normalizeVietnameseTones(text: string): string {
  // Normalize to NFD (decomposed form) for consistent processing
  return text.normalize("NFD");
}

/**
 * Remove Vietnamese tone marks (for search/matching)
 */
export function removeVietnameseTones(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove combining diacritical marks
    .normalize("NFC");
}

/**
 * Get time-based greeting in Vietnamese
 */
export function getVietnameseGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return VIETNAMESE_RESPONSE_TEMPLATES.greeting.morning;
  }
  if (hour < 18) {
    return VIETNAMESE_RESPONSE_TEMPLATES.greeting.afternoon;
  }
  return VIETNAMESE_RESPONSE_TEMPLATES.greeting.evening;
}

/**
 * Cultural context hints for AI responses
 */
export const VIETNAMESE_CULTURAL_CONTEXT = {
  formality: {
    description: "Vietnamese uses different pronouns based on age and social hierarchy",
    guidelines: [
      'Use "anh/chị" for peers or slightly older',
      'Use "em" for younger people',
      'Use "bạn" for casual/neutral situations',
      'Formal business: "quý khách", "quý vị"',
    ],
  },
  honorifics: {
    description: "Respectful language is important in Vietnamese culture",
    guidelines: [
      'Add "ạ" at the end of sentences for politeness',
      'Use "dạ" to show respect when responding',
      "Avoid being too direct; use softening language",
    ],
  },
  numbering: {
    description: "Vietnamese number system preferences",
    guidelines: [
      "Day/Month/Year format (DD/MM/YYYY)",
      "24-hour time format preferred",
      'Use "." for thousands separator',
      'Use "," for decimal separator',
    ],
  },
};

/**
 * Get response template by key
 */
export function getVietnameseTemplate(
  category: keyof typeof VIETNAMESE_RESPONSE_TEMPLATES,
  key: string,
): string | undefined {
  const categoryTemplates = VIETNAMESE_RESPONSE_TEMPLATES[category];
  if (categoryTemplates && typeof categoryTemplates === "object") {
    return (categoryTemplates as Record<string, string>)[key];
  }
  return undefined;
}

/**
 * Detect if text is primarily Vietnamese
 */
export function isVietnameseText(text: string): boolean {
  // Check for Vietnamese-specific characters
  const vietnamesePattern =
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  return vietnamesePattern.test(text);
}

/**
 * Vietnamese-specific text processing utilities
 */
export const vietnameseTextUtils = {
  stopwords: VIETNAMESE_STOPWORDS,
  templates: VIETNAMESE_RESPONSE_TEMPLATES,
  errors: VIETNAMESE_ERROR_MESSAGES,
  formatDateTime: formatVietnameseDateTime,
  formatDate: formatVietnameseDate,
  formatTime: formatVietnameseTime,
  formatCurrency: formatVietnameseCurrency,
  formatNumber: formatVietnameseNumber,
  normalizeTones: normalizeVietnameseTones,
  removeTones: removeVietnameseTones,
  getGreeting: getVietnameseGreeting,
  getTemplate: getVietnameseTemplate,
  isVietnamese: isVietnameseText,
  culturalContext: VIETNAMESE_CULTURAL_CONTEXT,
};

export default vietnameseTextUtils;
