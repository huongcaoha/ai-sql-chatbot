# AI SQL Chatbot Library 🤖📊

Thư viện **AI SQL Chatbot** là một giải pháp "Auto-Database-Agent" mạnh mẽ giúp bạn nhanh chóng tích hợp một trợ lý AI thông minh vào ứng dụng web của mình. Trợ lý này có khả năng tự động đọc cấu trúc cơ sở dữ liệu (Database Schema), nhận câu hỏi của người dùng bằng ngôn ngữ tự nhiên, tự động chuyển đổi thành câu lệnh SQL (Text-to-SQL), thực thi truy vấn và trả lời người dùng một cách chính xác.

Được thiết kế gồm 2 phần độc lập: **Backend SDK** (Node.js) và **Frontend Component** (React), giúp bảo mật tuyệt đối thông tin cơ sở dữ liệu và API Key của bạn.

## ✨ Tính năng nổi bật

- **Tự động hóa hoàn toàn (Auto-SQL):** Tự động đọc cấu trúc các bảng trong Database để làm ngữ cảnh (Context) cho AI.
- **Hỗ trợ đa Database:** Hiện tại hỗ trợ MySQL (PostgreSQL và MongoDB đang được phát triển).
- **Trí tuệ nhân tạo:** Hỗ trợ đa nền tảng AI bao gồm **Google Gemini**, **NVIDIA NIM**, **OpenAI**, **Groq**, **Ollama**, v.v. (thông qua chuẩn OpenAI-Compatible).
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
// B1. Cài đặt các thư viện cần thiết cho server:
npm install express cors

// B2 : Tạo thư mục servers và tạo file server.js 
import express from 'express';
import cors from 'cors';
import { AutoSqlAgent } from 'ai-sql-chatbot/server';

const app = express();
app.use(cors()); // Bắt buộc phải có để Frontend có thể gọi API
app.use(express.json());

// Khởi tạo Agent
const chatAgent = new AutoSqlAgent({
  ai: {
    // ----------------------------------------------------
    // CÁCH 1: Dùng Google Gemini (Mặc định)
    // ----------------------------------------------------
    provider: 'google-gemini',
    apiKey: 'YOUR_GEMINI_API_KEY', 
    model: 'gemini-flash-lite-latest', // Khuyên dùng gemini-flash-lite-latest cho tài khoản free

    // ----------------------------------------------------
    // CÁCH 2: Dùng NVIDIA NIM hoặc OpenAI-Compatible (Khuyên dùng)
    // ----------------------------------------------------
    // provider: 'openai-compatible',
    // baseURL: 'https://integrate.api.nvidia.com/v1', // Hoặc URL của OpenAI, Groq, Ollama...
    // apiKey: 'YOUR_NVIDIA_API_KEY', // Khuyên dùng biến môi trường process.env.API_KEY
    // model: 'meta/llama-3.1-70b-instruct' // Đổi tên model tương ứng với provider
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
  systemPrompt: 'Bạn là một trợ lý dữ liệu thân thiện. Nếu có link ảnh hãy hiển thị bằng cú pháp Markdown.',
  
  // (Mới) Cấu hình các đường dẫn (Routes) để AI tự động chuyển trang khi cần 
  // Bạn hãy sửa lại các đường dẫn này theo dự án của mình nhé (có thể đưa các trang định tuyến routes lên AI bắt trả về định dạng mẫu giống bên dưới)
  routes: [
    // { path: '/movies', description: 'Trang danh sách các bộ phim' },
    // { path: '/movie-detail', description: 'Trang chi tiết của một bộ phim' },
    // { path: '/cart', description: 'Giỏ hàng của người dùng' }
  ]
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
// Import hook chuyển trang của bạn (ví dụ React Router)

// Copy phần import , biến navigate và hàm handleNavigate vào component của bạn => thêm component ChatBot vào phần giao diện bạn muốn hiển thị (thường là footer)
import { useNavigate } from 'react-router-dom'; 
import { ChatBot } from 'ai-sql-chatbot/react';

function App() {
  const navigate = useNavigate();

  // Xử lý sự kiện AI muốn chuyển trang
  const handleNavigate = (path, params) => {
    console.log("AI yêu cầu chuyển đến:", path, params);
    const queryString = params ? new URLSearchParams(params).toString() : '';
    navigate(queryString ? `${path}?${queryString}` : path);
  };

  return (
    <div>
      <ChatBot 
        apiEndpoint="http://localhost:3000/api/chat"
        title="Trợ lý Dữ liệu Thông minh"
        placeholder="Ví dụ: Có bao nhiêu nhân viên trong công ty?"
        primaryColor="#10b981" // Tùy chỉnh màu sắc thương hiệu của bạn
        onNavigate={handleNavigate} // Truyền callback chuyển trang
      />
    </div>
  );
}

export default App;
```

### 3. Tự động sinh Code Giao diện (Auto-Generative UI)

Thư viện cung cấp công cụ AI tự động viết code giao diện (React Component) dựa trên Database của bạn:

1. Chạy lệnh sau tại thư mục Frontend của bạn:
   ```bash
   npx ai-sql-chatbot-gen
   ```
2. Nhập thông tin Database khi được yêu cầu. AI sẽ tự động phân tích và sinh ra file `ChatAutoUI.tsx`. Bạn hãy di chuyển file này vào thư mục cùng cấp với file bạn import ChatBot .
3. Import file này vào `ChatBot`:
   ```tsx
   import { renderAutoUI } from './ChatAutoUI';
   
   <ChatBot 
     apiEndpoint="http://localhost:3000/api/chat"
     renderCustomData={renderAutoUI} 
   />
   ```
Bạn có thể tự do mở file `ChatAutoUI.tsx` để chỉnh sửa màu sắc, bố cục CSS theo ý muốn!

---

## 🛠 Cấu trúc thư viện

Thư viện hỗ trợ cả `CommonJS` và `ESModules`, tự động xuất (export) ra 2 entry path:
- `ai-sql-chatbot/server`: Dành riêng cho môi trường Node.js.
- `ai-sql-chatbot/react`: Dành riêng cho môi trường trình duyệt (Tránh việc bundle mã Backend như MySQL, GenAI vào Frontend).

## 📄 Giấy phép (License)
Dự án được phát hành dưới giấy phép ISC.
