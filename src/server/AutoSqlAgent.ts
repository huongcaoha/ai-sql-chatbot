import { DatabaseAdapter, DbConfig } from './db/types';
import { MySQLAdapter } from './db/MySQLAdapter';
import { GoogleGenAI } from '@google/genai';

export interface AutoSqlAgentConfig {
  ai: {
    provider: 'google-gemini';
    apiKey: string;
    model?: string;
  };
  database: DbConfig;
  systemPrompt?: string;
}

export class AutoSqlAgent {
  private db: DatabaseAdapter;
  private ai: GoogleGenAI;
  private schemaContext: string = '';
  private config: AutoSqlAgentConfig;

  constructor(config: AutoSqlAgentConfig) {
    this.config = config;
    this.ai = new GoogleGenAI({ apiKey: config.ai.apiKey });
    
    switch (config.database.type) {
      case 'mysql':
        this.db = new MySQLAdapter(config.database);
        break;
      // TODO: Add postgres and mongodb adapters
      default:
        throw new Error(`Database type ${config.database.type} is not supported yet`);
    }
  }

  /**
   * Initializes the agent: connects to DB and extracts the schema.
   */
  async initialize(): Promise<void> {
    await this.db.connect();
    
    let safeTables = this.config.database.allowedTables;

    if (!safeTables && this.config.database.autoFilterTables !== false) {
      console.log('[AutoSqlAgent] Phân tích bảo mật các bảng bằng AI...');
      const allTables = await this.db.getAllTableNames();
      safeTables = await this.analyzeSecureTables(allTables);
      console.log('[AutoSqlAgent] AI đã chọn các bảng an toàn:', safeTables);
    } else if (!safeTables) {
      safeTables = undefined; // Quét tất cả nếu autoFilter = false và ko có allowedTables
    }

    this.schemaContext = await this.db.getSchemaContext(safeTables);
    console.log('[AutoSqlAgent] Initialized successfully. Schema loaded.');
  }

  private async analyzeSecureTables(allTables: string[]): Promise<string[]> {
    const prompt = `Đóng vai một chuyên gia bảo mật cơ sở dữ liệu.
Dưới đây là danh sách toàn bộ các bảng (tables) trong Database của hệ thống:
${JSON.stringify(allTables)}

Nhiệm vụ của bạn:
Lọc ra danh sách các bảng "An toàn" có thể hiển thị cho người dùng công cộng xem (ví dụ: sản phẩm, phim, lịch chiếu, danh mục...).
LOẠI BỎ tuyệt đối các bảng chứa thông tin nhạy cảm, riêng tư, hoặc liên quan đến quản trị (ví dụ: users, accounts, passwords, payments, admins, roles, doanh_thu, orders, settings...).

Trả về kết quả DUY NHẤT là một mảng JSON các chuỗi (tên bảng). KHÔNG có chú thích, KHÔNG có markdown block.
Ví dụ: ["products", "movies", "categories"]`;

    const modelName = this.config.ai.model || 'gemini-1.5-pro';
    const response = await this.ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { temperature: 0.1 }
    });

    try {
      let text = response.text || '[]';
      text = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed as string[];
      return allTables; 
    } catch (e) {
      console.warn('[AutoSqlAgent] AI failed to parse secure tables, falling back to all tables');
      return allTables;
    }
  }

  /**
   * Process a user message end-to-end
   * @param userMessage Tin nhắn của người dùng
   * @param history Lịch sử các tin nhắn trước đó (chứa role 'user' hoặc 'bot')
   */
  async processMessage(userMessage: string, history: Array<{role: string, text: string}> = []): Promise<{ text: string; data?: any[] }> {
    if (!this.schemaContext) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      // Step 1: Text-to-SQL
      const sqlQuery = await this.generateSQL(userMessage, history);
      console.log(`[AutoSqlAgent] Generated SQL: ${sqlQuery}`);

      // Step 2: Execute query
      const queryResult = await this.db.executeQuery(sqlQuery);

      // Step 3: Generate Natural Language Reply
      const finalReply = await this.generateReply(userMessage, queryResult, history);
      
      return {
        text: finalReply,
        data: queryResult
      };

    } catch (err: any) {
      console.error('[AutoSqlAgent] Error processing message:', err.message);
      // Giấu nhẹm lỗi kỹ thuật, đưa nó vào data dưới dạng Error Object để AI tự ứng xử khéo léo
      const errorData = { error: true, technical_message: err.message };
      const finalReply = await this.generateReply(userMessage, [errorData], history);
      
      return {
        text: finalReply,
        data: undefined // Không trả về lỗi kỹ thuật ra ngoài client
      };
    }
  }

  private async generateSQL(userMessage: string, history: Array<{role: string, text: string}>): Promise<string> {
    const historyStr = history.length > 0 
      ? history.map(h => `${h.role === 'user' ? 'Khách' : 'Bot'}: ${h.text}`).join('\n')
      : 'Không có';

    const prompt = `
Bạn là một AI Data Analyst chuyên nghiệp. Nhiệm vụ của bạn là chuyển đổi câu hỏi của người dùng thành câu lệnh SQL (chỉ áp dụng cho truy vấn SELECT).
Tuyệt đối không sử dụng DELETE, UPDATE, INSERT, DROP.

Cấu trúc cơ sở dữ liệu (Schema):
${this.schemaContext}

Lịch sử hội thoại trước đó (Dùng để hiểu ngữ cảnh, các đại từ "đó", "họ", "vừa nãy"):
${historyStr}

Câu hỏi người dùng: "${userMessage}"

Trả về DUY NHẤT một câu lệnh SQL hợp lệ, không có markdown, không có giải thích.`;

    const modelName = this.config.ai.model || 'gemini-1.5-pro';
    const response = await this.ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.1, // Low temp for logic/code
      }
    });

    let text = response.text || '';
    // Clean up markdown code blocks if any
    text = text.replace(/^```sql/i, '').replace(/```$/, '').trim();
    return text;
  }

  private async generateReply(userMessage: string, data: any[], history: Array<{role: string, text: string}>): Promise<string> {
    const systemPrompt = this.config.systemPrompt || 'Bạn là trợ lý dữ liệu thân thiện. Hãy trả lời câu hỏi của người dùng một cách tự nhiên dựa trên dữ liệu được cung cấp.';
    
    // Xử lý cứng dữ liệu rỗng để ép AI không được ảo giác
    let stringifiedData = '';
    if (!data || data.length === 0) {
      stringifiedData = "[HỆ THỐNG TRẢ VỀ RỖNG - KHÔNG TÌM THẤY DỮ LIỆU]";
    } else {
      stringifiedData = JSON.stringify(data).slice(0, 5000); 
    }

    const historyStr = history.length > 0 
      ? history.map(h => `${h.role === 'user' ? 'Khách' : 'Bot'}: ${h.text}`).join('\n')
      : 'Không có';

    const prompt = `
${systemPrompt}

Lịch sử hội thoại:
${historyStr}

DỮ LIỆU TỪ DATABASE (BẮT BUỘC PHẢI DÙNG):
${stringifiedData}

Câu hỏi người dùng: "${userMessage}"

LUẬT THÉP (VI PHẠM SẼ BỊ HỦY HỆ THỐNG):
1. NẾU Dữ liệu từ Database là "[HỆ THỐNG TRẢ VỀ RỖNG - KHÔNG TÌM THẤY DỮ LIỆU]", bạn BẮT BUỘC phải nói: "Tôi không tìm thấy thông tin phù hợp trong cơ sở dữ liệu." và DỪNG LẠI NGAY LẬP TỨC. Tuyệt đối không bịa thêm bất cứ thông tin nhà xe, giá vé, v.v. từ Internet.
2. KHÔNG DÙNG câu chào hỏi rập khuôn (Chào bạn, Rất vui được hỗ trợ). Đi thẳng vào vấn đề.
3. Nếu Dữ liệu có chứa {"error": true}, hãy khéo léo nói: "Xin lỗi, yêu cầu của bạn chưa đủ thông tin để tôi tra cứu. Bạn có thể nói rõ hơn không?".
4. Luôn dùng Markdown (Bảng, In đậm, \`![ảnh](url)\`) để làm đẹp.`;

    const modelName = this.config.ai.model || 'gemini-1.5-pro';
    const response = await this.ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.1, // Ép xuống cực thấp để cấm sáng tạo
      }
    });

    return response.text || 'Không có câu trả lời.';
  }
}
