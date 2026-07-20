import { GoogleGenAI } from '@google/genai';

export interface ToolProperty {
  type: string;
  description?: string;
  items?: ToolProperty;
  properties?: Record<string, ToolProperty>;
}

export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: string; // usually 'object'
    properties: Record<string, ToolProperty>;
    required?: string[];
  };
}

export interface GenerateOptions {
  model: string;
  systemInstruction?: string;
  temperature?: number;
  tools?: ToolFunction[];
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface AIResponse {
  text: string;
  toolCalls?: ToolCall[];
}

export interface AIAdapter {
  generate(userMessage: string, options: GenerateOptions): Promise<AIResponse>;
}

export class GoogleAIAdapter implements AIAdapter {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(userMessage: string, options: GenerateOptions): Promise<AIResponse> {
    const config: any = {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
    };

    if (options.tools && options.tools.length > 0) {
      config.tools = [{
        functionDeclarations: options.tools
      }];
    }

    const response = await this.ai.models.generateContent({
      model: options.model,
      contents: userMessage,
      config: config
    });

    const toolCalls: ToolCall[] = [];
    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const call of response.functionCalls) {
        toolCalls.push({
          name: call.name,
          args: call.args as Record<string, any>
        });
      }
    }

    return {
      text: response.text || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }
}

export class OpenAICompatibleAdapter implements AIAdapter {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash if any
  }

  async generate(userMessage: string, options: GenerateOptions): Promise<AIResponse> {
    const messages = [];

    if (options.systemInstruction) {
      messages.push({
        role: 'system',
        content: options.systemInstruction
      });
    }

    messages.push({
      role: 'user',
      content: userMessage
    });

    const body: any = {
      model: options.model,
      messages: messages,
      temperature: options.temperature ?? 0.1,
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(t => ({
        type: 'function',
        function: t
      }));
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    
    const toolCalls: ToolCall[] = [];
    if (message?.tool_calls && message.tool_calls.length > 0) {
      for (const call of message.tool_calls) {
        if (call.type === 'function') {
          try {
            toolCalls.push({
              name: call.function.name,
              args: JSON.parse(call.function.arguments)
            });
          } catch (e) {
            console.error('Failed to parse tool arguments from OpenAI:', e);
          }
        }
      }
    }

    return {
      text: message?.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }
}
