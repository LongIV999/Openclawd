# Đề xuất Thiết kế & Theme cho `code_to_image` (LongBest AI Style)

Dựa trên yêu cầu "thời đại công nghệ" và định hướng thương hiệu LongBest AI ("Dark Engineer", Brutalist), tôi đề xuất 3 concept thiết kế sau để nâng cấp tool `code_to_image`.

Tool hiện tại đang sử dụng `ray.so` để tạo ảnh. Để có thiết kế riêng biệt (custom branding), tôi sẽ nâng cấp code để **can thiệp (inject) CSS** vào trang `ray.so` trước khi chụp ảnh. Điều này giúp chúng ta giữ được tính năng highlight code đẹp của Ray.so nhưng hoàn toàn làm chủ phần background và watermark thương hiệu.

## 1. Theme: "Tech Noir" (Công Nghệ Đen / Cyberpunk Tối Giản)
*Đây là lựa chọn an toàn và phù hợp nhất với định hướng "Dark Engineer".*

*   **Vibe:** Bí ẩn, chuyên sâu, hacker, high-tech.
*   **Màu sắc chủ đạo:** 
    *   Background: Gradient tối (Deep Blue -> Black) hoặc pattern lưới (Grid) mờ màu xanh neon.
    *   Code Container: Glassmorphism (hiệu ứng kính mờ), bóng đổ nhẹ.
*   **Font chữ:** JetBrains Mono hoặc Fira Code (đậm chất lập trình).
*   **Chi tiết Brand:** 
    *   Thêm watermark "LongBest AI" phát sáng nhẹ ở góc dưới phải.
    *   Thanh tiêu đề (Window controls) tối giản.

## 2. Theme: "Brutalist Code" (Thô Mộc & Mạnh Mẽ)
*Phù hợp để tạo ấn tượng mạnh (viral) trên social media, đúng chất "Brutalist aesthetic" đã đề cập.*

*   **Vibe:** Mạnh mẽ, trực diện, không rườm rà, "công nghiệp".
*   **Màu sắc chủ đạo:**
    *   Background: Màu đơn sắc có độ tương phản cao (Ví dụ: Xám bê tông đậm, Cam cháy, hoặc Xanh Electric).
    *   Code Container: Viền đen dày (2px-4px), đổ bóng cứng (hard shadow) không làm mờ.
*   **Font chữ:** Space Mono hoặc Courier Prime (nét dày, thô).
*   **Chi tiết Brand:**
    *   Logo/Tên LongBest AI in to, đậm, đặt ở góc hoặc chạy dọc cạnh ảnh.

## 3. Theme: "Clean Future" (Tương Lai Tinh Khiết)
*Phù hợp cho các bài viết dạng "Tutorial", "Kiến thức", dễ đọc và chuyên nghiệp.*

*   **Vibe:** Hiện đại, SaaS product, Clean, Tin cậy.
*   **Màu sắc chủ đạo:**
    *   Background: Trắng ngà (Off-white) hoặc Xám nhạt (Silver), kết hợp với các hình khối abstract (trừu tượng) mờ.
    *   Code Container: Bo góc lớn (Rounded), đổ bóng mềm (Soft shadow), nền code trắng hoặc xám rất nhạt.
*   **Font chữ:** Inter hoặc San Francisco (hiện đại, sạch).
*   **Chi tiết Brand:**
    *   Logo LongBest AI nhỏ gọn, tinh tế đặt chính giữa phía dưới hoặc góc trên.

---

## Kế hoạch Cải tiến Code (`main.py`)

Để thực hiện các theme trên, tôi sẽ sửa file `main.py` để thêm các tính năng sau:

1.  **Custom CSS Injection:** Thêm hàm để chèn CSS tùy chỉnh vào trang `ray.so` trước khi chụp màn hình.
    *   Thay đổi Background image/color.
    *   Thêm quy tắc `@font-face` nếu cần.
    *   Thêm phần tử `div` chứa Watermark "LongBest AI".
2.  **Cấu hình Theme Mở rộng:**
    *   Update `config.json` để hỗ trợ chọn các theme mới (`tech-noir`, `brutalist`, `clean-future`) thay vì chỉ các theme mặc định của Ray.so.
3.  **Watermark:** Tự động thêm text "LongBest AI" hoặc logo vào ảnh đầu ra.
4.  **Font chữ:** Cấu hình font chữ cho snippet theo theme.

Bạn thích concept nào nhất trong 3 concept trên? Hoặc bạn muốn kết hợp các yếu tố nào? Hãy cho tôi biết để tôi tiến hành code.
