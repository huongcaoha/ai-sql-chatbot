#!/usr/bin/env node

import { GoogleGenAI } from '@google/genai';
import { MySQLAdapter } from '../server/db/MySQLAdapter';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function run() {
  console.log('🤖 AI-SQL Chatbot: Khởi động cỗ máy tạo Code giao diện (Auto Code Generator)\n');
  
  const apiKey = process.env.GEMINI_API_KEY || await question('Nhập GEMINI_API_KEY: ');
  const dbHost = process.env.DB_HOST || await question('Nhập DB Host (VD: localhost): ');
  const dbUser = process.env.DB_USER || await question('Nhập DB User (Read Only): ');
  const dbPass = process.env.DB_PASS || await question('Nhập DB Password: ');
  const dbName = process.env.DB_NAME || await question('Nhập Tên Database: ');

  rl.close();

  if (!apiKey || !dbHost || !dbUser || !dbName) {
    console.error('❌ Thiếu thông tin cấu hình. Vui lòng nhập đầy đủ.');
    process.exit(1);
  }

  console.log('\n🔄 Đang kết nối tới Database và phân tích Schema...');
  const db = new MySQLAdapter({
    type: 'mysql',
    host: dbHost,
    user: dbUser,
    password: dbPass,
    databaseName: dbName
  });

  try {
    await db.connect();
    // Bỏ qua lọc bảng ở đây, chỉ lấy schema cơ bản hoặc dùng chung logic. 
    // Để tối ưu cho người dùng, ta lấy toàn bộ schema và bảo AI tự chọn bảng an toàn để vẽ giao diện.
    const schemaContext = await db.getSchemaContext();
    await db.disconnect();

    console.log('✅ Đã phân tích xong Schema. Bắt đầu gọi AI để viết code React (Có thể mất 10-20 giây)...');

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Bạn là một Frontend Developer ReactJS tài năng.
Nhiệm vụ của bạn là viết một file code React (TSX) hoàn chỉnh có chứa một hàm tên là \`renderAutoUI(data: any[])\`.
Hàm này sẽ nhận vào mảng dữ liệu (được truy vấn từ Database) và trả về một ReactNode (Giao diện) tương ứng.

Dưới đây là cấu trúc các bảng trong hệ thống:
${schemaContext}

Yêu cầu kỹ thuật:
1. Bạn hãy tự nhận diện các bảng công cộng (như Phim, Sản phẩm, Lịch chiếu...). KHÔNG tạo giao diện cho bảng nhạy cảm (users, admin, passwords).
2. Viết các câu lệnh \`if\` để kiểm tra dữ liệu. Ví dụ: \`if (data && data[0] && 'ten_phim' in data[0]) { return (giao diện danh sách phim) }\`.
3. Sử dụng Inline CSS để làm cho giao diện CỰC KỲ ĐẸP MẮT (Bo góc, Đổ bóng, Hiệu ứng Hover, Nút bấm Đặt Hàng/Mua). Nó phải vừa vặn trong một khung Chatbox có chiều rộng khoảng 300px.
4. Nếu dữ liệu có đường dẫn ảnh, bắt buộc phải render thẻ \`<img src={...} />\`.
5. Cuối hàm, nếu dữ liệu không khớp với bất kỳ form nào bạn đã định nghĩa, bắt buộc phải \`return null;\` để hệ thống tự động fallback về Markdown.
6. File code phải tự import React: \`import React from 'react';\`
7. Trả về DUY NHẤT một khối code TSX. KHÔNG giải thích lằng nhằng.

Ví dụ định dạng trả về:
\`\`\`tsx
import React from 'react';

export const renderAutoUI = (data: any[]) => {
  if (!data || data.length === 0) return null;
  // logic kiểm tra và render...
  return null;
}
\`\`\`
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: prompt,
      config: { temperature: 0.2 }
    });

    let code = response.text || '';
    code = code.replace(/^```tsx/i, '').replace(/^```/i, '').replace(/```$/, '').trim();

    if (!code) {
        throw new Error('AI không sinh được code.');
    }

    const outputPath = path.join(process.cwd(), 'ChatAutoUI.tsx');
    fs.writeFileSync(outputPath, code, 'utf-8');
    
    console.log(`\n🎉 THÀNH CÔNG! Đã sinh ra file code giao diện tại: ${outputPath}`);
    console.log(`👉 Hướng dẫn sử dụng:`);
    console.log(`Hãy mở ứng dụng React của bạn, import hàm vừa tạo và truyền vào ChatBot:`);
    console.log(`import { renderAutoUI } from './ChatAutoUI';`);
    console.log(`<ChatBot apiEndpoint="..." renderCustomData={renderAutoUI} />`);

  } catch (err: any) {
    console.error('❌ Có lỗi xảy ra:', err.message);
  }
}

run();
