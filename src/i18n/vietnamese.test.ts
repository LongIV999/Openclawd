import { describe, it, expect } from "vitest";
import {
  formatVietnameseDateTime,
  formatVietnameseDate,
  formatVietnameseTime,
  formatVietnameseCurrency,
  formatVietnameseNumber,
  normalizeVietnameseTones,
  removeVietnameseTones,
  getVietnameseGreeting,
  getVietnameseTemplate,
  isVietnameseText,
  VIETNAMESE_STOPWORDS,
  VIETNAMESE_RESPONSE_TEMPLATES,
} from "./vietnamese.js";

describe("Vietnamese Language Support", () => {
  describe("Date/Time Formatting", () => {
    it("should format Vietnamese date/time correctly", () => {
      const testDate = new Date("2026-02-01T12:30:00+07:00");
      const formatted = formatVietnameseDateTime(testDate);

      expect(formatted).toContain("12:30");
      expect(formatted).toContain("01/02/2026");
      expect(formatted).toMatch(/(Thứ|Chủ nhật)/);
    });

    it("should format Vietnamese date only", () => {
      const testDate = new Date("2026-02-01T12:30:00+07:00");
      const formatted = formatVietnameseDate(testDate);

      expect(formatted).toBe("01/02/2026");
    });

    it("should format Vietnamese time only", () => {
      const testDate = new Date("2026-02-01T12:30:45+07:00");
      const formatted = formatVietnameseTime(testDate);

      expect(formatted).toBe("12:30:45");
    });
  });

  describe("Number Formatting", () => {
    it("should format Vietnamese currency (VND)", () => {
      const amount = 1000000;
      const formatted = formatVietnameseCurrency(amount);

      expect(formatted).toContain("₫");
      expect(formatted).toContain("1.000.000");
    });

    it("should format large numbers with Vietnamese separators", () => {
      const num = 1234567;
      const formatted = formatVietnameseNumber(num);

      expect(formatted).toBe("1.234.567");
    });
  });

  describe("Tone Mark Processing", () => {
    it("should normalize Vietnamese tone marks", () => {
      const text = "Tiếng Việt";
      const normalized = normalizeVietnameseTones(text);

      // NFD normalization should decompose combined characters
      expect(normalized.length).toBeGreaterThanOrEqual(text.length);
    });

    it("should remove Vietnamese tone marks", () => {
      const text = "Tiếng Việt";
      const withoutTones = removeVietnameseTones(text);

      expect(withoutTones).toBe("Tieng Viet");
    });

    it("should handle complex Vietnamese text", () => {
      const text = "Xin chào! Đây là hệ thống LongBest AI.";
      const withoutTones = removeVietnameseTones(text);

      expect(withoutTones).toBe("Xin chao! Day la he thong LongBest AI.");
    });
  });

  describe("Template System", () => {
    it("should retrieve greeting templates", () => {
      const greeting = getVietnameseTemplate("greeting", "formal");
      expect(greeting).toBe("Xin chào! Tôi có thể giúp gì cho bạn?");
    });

    it("should retrieve confirmation templates", () => {
      const success = getVietnameseTemplate("confirmation", "success");
      expect(success).toContain("✅");
      expect(success).toContain("thành công");
    });

    it("should retrieve error templates", () => {
      const error = getVietnameseTemplate("error", "general");
      expect(error).toContain("❌");
      expect(error).toContain("lỗi");
    });

    it("should return undefined for non-existent templates", () => {
      const invalid = getVietnameseTemplate("greeting", "nonexistent");
      expect(invalid).toBeUndefined();
    });
  });

  describe("Time-based Greeting", () => {
    it("should return a valid greeting", () => {
      const greeting = getVietnameseGreeting();

      expect(greeting).toBeTruthy();
      expect(
        greeting === VIETNAMESE_RESPONSE_TEMPLATES.greeting.morning ||
          greeting === VIETNAMESE_RESPONSE_TEMPLATES.greeting.afternoon ||
          greeting === VIETNAMESE_RESPONSE_TEMPLATES.greeting.evening,
      ).toBe(true);
    });
  });

  describe("Vietnamese Text Detection", () => {
    it("should detect Vietnamese text", () => {
      expect(isVietnameseText("Xin chào")).toBe(true);
      expect(isVietnameseText("Tiếng Việt")).toBe(true);
      expect(isVietnameseText("Đây là văn bản tiếng Việt")).toBe(true);
    });

    it("should return false for non-Vietnamese text", () => {
      expect(isVietnameseText("Hello world")).toBe(false);
      expect(isVietnameseText("English text")).toBe(false);
      expect(isVietnameseText("123456")).toBe(false);
    });

    it("should detect mixed Vietnamese-English text", () => {
      expect(isVietnameseText("Hello Việt Nam")).toBe(true);
      expect(isVietnameseText("LongBest AI hệ thống")).toBe(true);
    });
  });

  describe("Stopwords", () => {
    it("should contain common Vietnamese stopwords", () => {
      expect(VIETNAMESE_STOPWORDS.has("và")).toBe(true);
      expect(VIETNAMESE_STOPWORDS.has("của")).toBe(true);
      expect(VIETNAMESE_STOPWORDS.has("là")).toBe(true);
      expect(VIETNAMESE_STOPWORDS.has("có")).toBe(true);
    });

    it("should not contain content words", () => {
      expect(VIETNAMESE_STOPWORDS.has("máy tính")).toBe(false);
      expect(VIETNAMESE_STOPWORDS.has("công nghệ")).toBe(false);
    });
  });

  describe("Response Templates Structure", () => {
    it("should have all required template categories", () => {
      expect(VIETNAMESE_RESPONSE_TEMPLATES.greeting).toBeDefined();
      expect(VIETNAMESE_RESPONSE_TEMPLATES.confirmation).toBeDefined();
      expect(VIETNAMESE_RESPONSE_TEMPLATES.error).toBeDefined();
      expect(VIETNAMESE_RESPONSE_TEMPLATES.help).toBeDefined();
      expect(VIETNAMESE_RESPONSE_TEMPLATES.workflow).toBeDefined();
      expect(VIETNAMESE_RESPONSE_TEMPLATES.obsidian).toBeDefined();
    });

    it("should have workflow templates for custom commands", () => {
      expect(VIETNAMESE_RESPONSE_TEMPLATES.workflow.brainstorm).toContain("🧠");
      expect(VIETNAMESE_RESPONSE_TEMPLATES.workflow.feature).toContain("✨");
      expect(VIETNAMESE_RESPONSE_TEMPLATES.workflow.bugfix).toContain("🐛");
      expect(VIETNAMESE_RESPONSE_TEMPLATES.workflow.deploy).toContain("🚀");
    });

    it("should have Obsidian integration templates", () => {
      expect(VIETNAMESE_RESPONSE_TEMPLATES.obsidian.noteCreated).toContain("📝");
      expect(VIETNAMESE_RESPONSE_TEMPLATES.obsidian.noteSaved).toContain("💾");
    });
  });
});
