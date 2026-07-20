import { DatabaseAdapter, DbConfig } from './db/types';
import { MySQLAdapter } from './db/MySQLAdapter';
import { AIAdapter, GoogleAIAdapter, OpenAICompatibleAdapter, ToolFunction } from './AIAdapter';

export interface RouteConfig {
  path: string;
  description: string;
}

export interface AutoSqlAgentConfig {
  ai: {
    provider: 'google-gemini' | 'openai-compatible';
    apiKey: string;
    model?: string;
    baseURL?: string; // Bắt buộc nếu provider là openai-compatible (vd: https://integrate.api.nvidia.com/v1)
  };
  database: DbConfig;
  systemPrompt?: string;
  routes?: RouteConfig[];
}

export class AutoSqlAgent {
  private db: DatabaseAdapter;
  private aiAdapter: AIAdapter;
  private schemaContext: string = '';
  private config: AutoSqlAgentConfig;

  constructor(config: AutoSqlAgentConfig) {
    this.config = config;
    
    // Khởi tạo AI Provider
    if (config.ai.provider === 'openai-compatible') {
      if (!config.ai.baseURL) throw new Error('baseURL is required for openai-compatible provider');
      this.aiAdapter = new OpenAICompatibleAdapter(config.ai.apiKey, config.ai.baseURL);
    } else {
      this.aiAdapter = new GoogleAIAdapter(config.ai.apiKey);
    }
    
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
    const response = await this.aiAdapter.generate(prompt, {
      model: modelName,
      temperature: 0.1
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
  async processMessage(userMessage: string, history: Array<{role: string, text: string}> = []): Promise<{ text: string; data?: any[]; navigateAction?: any }> {
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
      const { text, navigateAction } = await this.generateReply(userMessage, queryResult, history);
      
      return {
        text,
        data: queryResult,
        navigateAction
      };

    } catch (err: any) {
      console.error('[AutoSqlAgent] Error processing message:', err.message);
      // Giấu nhẹm lỗi kỹ thuật, đưa nó vào data dưới dạng Error Object để AI tự ứng xử khéo léo
      const errorData = { error: true, technical_message: err.message };
      const { text, navigateAction } = await this.generateReply(userMessage, [errorData], history);
      
      return {
        text,
        data: undefined, // Không trả về lỗi kỹ thuật ra ngoài client
        navigateAction
      };
    }
  }

  private async generateSQL(userMessage: string, history: Array<{role: string, text: string}>): Promise<string> {
    const historyStr = history.length > 0 
      ? history.map(h => `${h.role === 'user' ? 'Khách' : 'Bot'}: ${h.text}`).join('\n')
      : 'Không có';

    const currentDate = new Date().toISOString().split('T')[0];
    const sysPrompt = `Bạn là một AI Data Analyst chuyên nghiệp. Nhiệm vụ của bạn là chuyển đổi câu hỏi của người dùng thành câu lệnh SQL (chỉ áp dụng cho truy vấn SELECT).
Tuyệt đối không sử dụng DELETE, UPDATE, INSERT, DROP.

THÔNG TIN HỆ THỐNG:
- Ngày hôm nay là: ${currentDate} (Hãy dùng thông tin này để xử lý các từ "hôm nay", "ngày mai", v.v. bằng SQL như DATE(departure_time) = '${currentDate}' hoặc + INTERVAL 1 DAY).

Cấu trúc cơ sở dữ liệu (Schema):
${this.schemaContext}

Lịch sử hội thoại trước đó (Dùng để hiểu ngữ cảnh):
${historyStr}

LUẬT QUAN TRỌNG ĐỂ VIẾT SQL CHUẨN XÁC:
1. Trả về DUY NHẤT một câu lệnh SQL hợp lệ, không có markdown, không có giải thích.
2. Khi tìm kiếm chuỗi (tên bến xe, tên nhà xe), LUÔN LUÔN sử dụng toán tử LIKE '%...%' thay vì dấu '=' để tránh sai sót do thừa thiếu chữ (Ví dụ: name LIKE '%Nam Định%').
3. Nếu dữ liệu có chứa các ID liên kết (khóa ngoại như station_id, company_id, bus_id, route_id...), BẮT BUỘC phải dùng JOIN để lấy tên thực tế (Ví dụ: JOIN bảng stations, JOIN bảng bus_companies) để kết quả trả về có ý nghĩa cho người dùng đọc.`;

    const modelName = this.config.ai.model || 'gemini-1.5-pro';
    const response = await this.aiAdapter.generate(userMessage, {
      model: modelName,
      systemInstruction: sysPrompt,
      temperature: 0.1, // Low temp for logic/code
    });

    let text = response.text || '';
    // Clean up markdown code blocks if any
    text = text.replace(/^```sql/i, '').replace(/```$/, '').trim();
    return text;
  }

  private async generateReply(userMessage: string, data: any[], history: Array<{role: string, text: string}>): Promise<{ text: string, navigateAction?: any }> {
    const systemPrompt = this.config.systemPrompt || 'Bạn là trợ lý dữ liệu thân thiện. Hãy trả lời câu hỏi của người dùng một cách tự nhiên dựa trên dữ liệu được cung cấp.';
    
    const stringifiedData = JSON.stringify(data).slice(0, 5000); 
    const historyStr = history.length > 0 
      ? history.map(h => `${h.role === 'user' ? 'Khách' : 'Bot'}: ${h.text}`).join('\n')
      : 'Không có';

    const sysPrompt = `${systemPrompt}

Lịch sử hội thoại:
${historyStr}

DỮ LIỆU TỪ DATABASE (BẮT BUỘC PHẢI DÙNG):
${stringifiedData}

LUẬT THÉP (VI PHẠM SẼ BỊ HỦY HỆ THỐNG):
1. NẾU DỮ LIỆU TỪ DATABASE là mảng rỗng '[]', HÃY KIỂM TRA Lịch sử hội thoại. Nếu người dùng đang yêu cầu một hành động (ví dụ Đặt vé, Chuyển trang) dựa trên dữ liệu đã cung cấp trước đó, hãy sử dụng công cụ 'navigate' để chuyển hướng. Nếu không có lịch sử liên quan, mới nói khéo léo rằng không tìm thấy thông tin. Tuyệt đối không tự bịa thêm dữ liệu từ bên ngoài.
2. NẾU DỮ LIỆU TỪ DATABASE có chứa '{"error": true}', hãy nói khéo léo rằng yêu cầu chưa rõ ràng hoặc không thể truy vấn.
3. KHÔNG DÙNG câu chào hỏi rập khuôn (Chào bạn, Rất vui được hỗ trợ). Đi thẳng vào vấn đề.
4. TUYỆT ĐỐI KHÔNG BỊA DỮ LIỆU. Chỉ dùng thông tin trong mục DỮ LIỆU TỪ DATABASE.
5. Luôn dùng Markdown (Bảng, In đậm, \`![ảnh](url)\`) để làm đẹp.
6. Nếu có dữ liệu trả về và có thể thực hiện hành động (ví dụ Đặt vé), BẮT BUỘC thêm một cột cuối cùng vào bảng có chứa thẻ Link Markdown để người dùng click chuyển trang. Ví dụ: \`[Đặt vé](/book?id=123)\`. Mặc định dùng các route có sẵn trong hệ thống nếu phù hợp.
7. ĐIỀU HƯỚNG TỰ ĐỘNG: Nếu chủ đề dữ liệu đang hiển thị (ví dụ: danh sách phim, danh sách chuyến xe) khớp với một trang trong \`routes\`, BẠN ĐƯỢC PHÉP đồng thời GỌI CÔNG CỤ \`navigate\` để tự động chuyển màn hình của người dùng sang trang đó, kết hợp với việc hiển thị dữ liệu trong chatbox.`;

    const tools: ToolFunction[] = [];
    if (this.config.routes && this.config.routes.length > 0) {
      tools.push({
        name: 'navigate',
        description: 'Navigate the user to a specific page on the frontend based on the available routes. Call this to auto-redirect the user whenever their query matches a route (e.g., asking for a list of items and there is a route for it), even while you are returning the data in the chat.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to navigate to. Available routes: ' + this.config.routes.map(r => `${r.path} (${r.description})`).join(', ')
            },
            params: {
              type: 'object',
              description: 'Key-value pairs of request parameters to pass to the route. E.g. {"id": 123}'
            }
          },
          required: ['path']
        }
      });
    }

    const modelName = this.config.ai.model || 'gemini-1.5-pro';
    const response = await this.aiAdapter.generate(userMessage, {
      model: modelName,
      systemInstruction: sysPrompt,
      temperature: 0.0, // Nhiệt độ 0 để model tuân thủ tuyệt đối
      tools: tools.length > 0 ? tools : undefined
    });

    let navigateAction: any = undefined;
    if (response.toolCalls && response.toolCalls.length > 0) {
      const navCall = response.toolCalls.find(c => c.name === 'navigate');
      if (navCall) {
        navigateAction = navCall.args;
      }
    }

    return { 
      text: response.text || (navigateAction ? 'Đang chuyển hướng...' : 'Không có câu trả lời.'), 
      navigateAction 
    };
  }
}
