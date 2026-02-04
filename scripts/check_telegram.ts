import { probeTelegram } from "../src/telegram/probe.js";

async function main() {
    try {
        const token = "8534724411:AAHHCQIk9DZJf4ovkx3LJx-jQWY0d3jJSDQ";

        console.log("🔍 Đang kiểm tra kết nối Telegram...");
        
        const result = await probeTelegram(token, 10000);
        
        if (result.ok) {
            console.log("\n✅ Kết nối Telegram thành công!");
            console.log("🤖 Thông tin Bot:");
            console.log("   - Username: @" + result.bot?.username);
            console.log("   - ID: " + result.bot?.id);
            if (result.webhook?.url) {
                console.log("🔗 Webhook URL: " + result.webhook.url);
            } else {
                console.log("🔄 Chế độ: Long Polling (không có Webhook)");
            }
        } else {
            console.log("\n❌ Kết nối Telegram thất bại!");
            console.log("   - Lỗi: " + result.error);
            console.log("   - Status code: " + result.status);
            
            if (result.status === 401) {
                console.log("\n💡 Gợi ý: Token có vẻ không hợp lệ hoặc đã hết hạn.");
            }
        }
    } catch (err) {
        console.error("❌ Lỗi thực thi script: " + err.message);
    }
}

void main();
