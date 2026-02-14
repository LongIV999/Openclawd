---
name: open_memory
description: Hệ thống bộ nhớ dài hạn giúp lưu trữ và truy xuất thông tin người dùng. Hỗ trợ thêm ký ức, tìm kiếm theo ngữ nghĩa và lấy ngữ cảnh.
---

# Kỹ năng OpenMemory (Bộ nhớ mở rộng)

OpenMemory cung cấp một lớp bộ nhớ bền vững cho AI agent. Nó cho phép bạn lưu trữ các thông tin quan trọng của người dùng, truy xuất ngữ cảnh liên quan và tìm kiếm lại các tương tác trong quá khứ.

## Khả năng
Kỹ năng này được hỗ trợ bởi cơ sở dữ liệu vector cục bộ (hoặc SQLite nếu vector không khả dụng) và sử dụng tìm kiếm ngữ nghĩa để tìm thông tin liên quan. Dữ liệu được lưu trữ cục bộ để đảm bảo quyền riêng tư.

## Cách sử dụng

Sử dụng công cụ `open_memory` với một trong các lệnh sau:

### 1. Thêm ký ức (Add)
Lưu trữ một thông tin mới.
`add "Người dùng thích giao diện tối (dark mode)"`
`add --category preference "Người dùng muốn câu trả lời ngắn gọn"`

### 2. Tìm kiếm ký ức (Search)
Tìm các ký ức liên quan đến câu truy vấn.
`search "Sở thích của người dùng là gì?"`
`search --limit 3 "hạn chót dự án"`

### 3. Lấy ngữ cảnh (Context)
Lấy ngữ cảnh chung cho người dùng hiện tại (thường dùng ở đầu cuộc hội thoại).
`context`
`context --max-tokens 500`

### 4. Trích xuất (Extract)
Trích xuất các thông tin quan trọng từ một đoạn văn bản hội thoại để lưu vào bộ nhớ.
`extract "Tôi có cuộc họp lúc 2 giờ chiều và tôi rất thích uống cà phê đen"`

## Ví dụ cho dự án LongBest AI & Moltbot

### Quản lý Brand Voice & Content
*   **Lưu Brand Voice**:
    `add --category brand_guide "LongBest AI sử dụng giọng văn chuyên nghiệp nhưng hóm hỉnh, tập trung vào giá trị thực tế cho SME."`
*   **Lưu lịch đăng bài**:
    `add --category schedule "Lịch đăng bài Facebook: 2 bài/ngày vào lúc 09:00 và 19:00."`
*   **Truy xuất khi viết content**:
    `search "giọng văn thương hiệu LongBest AI"`

### Quản lý Lead & Khách hàng
*   **Ghi nhớ thông tin khách hàng (từ Telegram/Form)**:
    `add --category lead_info "Khách hàng Nguyễn Văn A quan tâm đến giải pháp Automation cho Bất động sản."`
*   **Tìm kiếm thông tin trước khi follow-up**:
    `search "nhu cầu khách hàng bất động sản"`

### Cấu hình Hệ thống
*   **Ghi nhớ cấu hình server**:
    `add --category config "BlueBubbles server đang chạy tại port 1234 với password là 'secret'."`
