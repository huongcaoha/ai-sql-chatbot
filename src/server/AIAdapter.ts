import { GoogleGenAI } from '@google/genai';

export interface GenerateOptions {
  model: string;
  systemInstruction?: string;
  temperature?: number;
}

export interface AIAdapter {
  generate(userMessage: string, options: GenerateOptions): Promise<string>;
}

export class GoogleAIAdapter implements AIAdapter {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(userMessage: string, options: GenerateOptions): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: options.model,
      contents: userMessage,
      config: {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature,
      }
    });
    return response.text || '';
  }
}

export class OpenAICompatibleAdapter implements AIAdapter {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash if any
  }

  async generate(userMessage: string, options: GenerateOptions): Promise<string> {
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

    const body = {
      model: options.model,
      messages: messages,
      temperature: options.temperature ?? 0.1,
    };

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
    return data.choices?.[0]?.message?.content || '';
  }
}
