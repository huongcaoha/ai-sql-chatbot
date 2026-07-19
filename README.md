# AI SQL Chatbot Library 🤖📊

Thư viện **AI SQL Chatbot** là một giải pháp "Auto-Database-Agent" mạnh mẽ giúp bạn nhanh chóng tích hợp một trợ lý AI thông minh vào ứng dụng web của mình. Trợ lý này có khả năng tự động đọc cấu trúc cơ sở dữ liệu (Database Schema), nhận câu hỏi của người dùng bằng ngôn ngữ tự nhiên, tự động chuyển đổi thành câu lệnh SQL (Text-to-SQL), thực thi truy vấn và trả lời người dùng một cách chính xác.

Được thiết kế gồm 2 phần độc lập: **Backend SDK** (Node.js) và **Frontend Component** (React), giúp bảo mật tuyệt đối thông tin cơ sở dữ liệu và API Key của bạn.

## ✨ Tính năng nổi bật

- **Tự động hóa hoàn toàn (Auto-SQL):** Tự động đọc cấu trúc các bảng trong Database để làm ngữ cảnh (Context) cho AI.
- **Hỗ trợ đa Database:** Hiện tại hỗ trợ MySQL (PostgreSQL và MongoDB đang được phát triển).
- **Trí tuệ nhân tạo:** Tích hợp sẵn sức mạnh của Google Gemini (Hỗ trợ mô hình `gemini-flash-lite-latest` tối ưu hóa cho Text-to-SQL).
- **Giao diện React mượt mà:** Cung cấp sẵn component `<ChatBot />` đẹp mắt, dễ tuỳ chỉnh, dễ tích hợp.
- **Bảo mật cao:** Cơ chế kiểm tra bảo mật ngăn chặn các câu lệnh SQL độc hại (`DROP`, `DELETE`, `UPDATE`, `INSERT`).

---

## ⚠️ CẢNH BÁO BẢO MẬT (QUAN TRỌNG)

> **BẮT BUỘC:** Bạn **PHẢI** tạo một tài khoản Database có quyền **READ-ONLY (Chỉ đọc)** để cung cấp cho thư viện này. 
> Tuyệt đối không sử dụng tài khoản `root` hoặc tài khoản có quyền `INSERT`, `UPDATE`, `DELETE`, `DROP`.
> Vì AI sẽ tự động sinh ra các câu lệnh SQL, nếu bạn cấp quyền ghi/xóa, dữ liệu của bạn có thể bị phá hủy nếu AI sinh ra lệnh xóa dữ liệu do người dùng cố tình "tiêm nhiễm" (Prompt Injection). Thư viện có cơ chế chặn bằng Regex, nhưng cấp quyền Read-Only ở mức Database là lá chắn an toàn nhất.

---

## 📦 Cài đặt

Cài đặt thư viện thông qua `npm`:


```bash
# Trỏ đường dẫn tới thư mục ai-sql-chatbot của bạn
npm install https://github.com/huongcaoha/ai-sql-chatbot
```

---

## 🚀 Hướng dẫn sử dụng

### 1. Cấu hình Backend (Node.js / Express)

Ở phía server, bạn sử dụng `AutoSqlAgent` để thiết lập kết nối và xử lý logic.

```javascript
// 1. Cài đặt các thư viện cần thiết cho server:
// npm install express cors

import express from 'express';
import cors from 'cors';
import { AutoSqlAgent } from 'ai-sql-chatbot/server';

const app = express();
app.use(cors()); // Bắt buộc phải có để Frontend có thể gọi API
app.use(express.json());

// Khởi tạo Agent
const chatAgent = new AutoSqlAgent({
  ai: {
    provider: 'google-gemini',
    apiKey: 'YOUR_GEMINI_API_KEY', // Khuyên dùng biến môi trường process.env.GEMINI_API_KEY
    model: 'gemini-flash-lite-latest' 
  },
  database: {
    type: 'mysql',
    host: 'localhost',
    user: 'readonly_user', // TÀI KHOẢN CHỈ ĐỌC
    password: 'your_password',
    databaseName: 'my_shop_db',
    // autoFilterTables: true, // (Mặc định là true) AI sẽ tự động phân tích và chặn truy cập các bảng nhạy cảm (users, payment...)
    // allowedTables: ['products', 'movies'], // Nếu muốn tự thiết lập bằng tay, hãy bỏ comment dòng này
  },
  systemPrompt: 'Bạn là một trợ lý dữ liệu thân thiện. Nếu có link ảnh hãy hiển thị bằng cú pháp Markdown.'
});

// Chạy hàm khởi tạo để kết nối DB và đọc Schema
chatAgent.initialize().then(() => {
  console.log("Agent đã sẵn sàng!");
});

// Tạo API Endpoint để Frontend gọi tới
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    // Hàm processMessage lo toàn bộ quy trình: Text -> SQL -> Truy vấn -> Sinh câu trả lời
    const response = await chatAgent.processMessage(message);
    res.json(response);
  } catch (error) {
    res.status(500).json({ text: "Lỗi hệ thống: " + error.message });
  }
});

app.listen(3000, () => console.log('Server chạy tại port 3000'));
```

**Cách chạy Backend:**
1. Mở Terminal tại thư mục chứa file `server.js`.
2. Chạy lệnh: `node server.js`

> 💡 **Lưu ý quan trọng (Troubleshooting):**
> - **Lỗi `Warning: To load an ES module...`**: Vì code trên dùng `import`, bạn cần mở file `package.json` của thư mục backend và thêm dòng `"type": "module"` vào.
> - **Lỗi `MODULE_NOT_FOUND`**: Đảm bảo bạn đang chạy lệnh `node server.js` ở ĐÚNG thư mục chứa file đó, và gõ đúng tên file (ví dụ nếu bạn đặt tên là `service.js` thì phải gõ `node service.js`).

### 2. Tích hợp Frontend (React)

Trong ứng dụng React của bạn, chỉ cần import component `<ChatBot />` và trỏ `apiEndpoint` về API bạn vừa tạo ở Backend.

```tsx
// App.tsx
import React from 'react';
import { ChatBot } from 'ai-sql-chatbot/react';

function App() {
  return (
    <div style={{ padding: '50px', display: 'flex', justifyContent: 'center' }}>
      <ChatBot 
        apiEndpoint="http://localhost:3000/api/chat"
        title="Trợ lý Dữ liệu Thông minh"
        placeholder="Ví dụ: Có bao nhiêu nhân viên trong công ty?"
        primaryColor="#10b981" // Tùy chỉnh màu sắc thương hiệu của bạn
      />
    </div>
  );
}

export default App;
```

---

## 🛠 Cấu trúc thư viện

Thư viện hỗ trợ cả `CommonJS` và `ESModules`, tự động xuất (export) ra 2 entry path:
- `ai-sql-chatbot/server`: Dành riêng cho môi trường Node.js.
- `ai-sql-chatbot/react`: Dành riêng cho môi trường trình duyệt (Tránh việc bundle mã Backend như MySQL, GenAI vào Frontend).

## 📄 Giấy phép (License)
Dự án được phát hành dưới giấy phép ISC.
