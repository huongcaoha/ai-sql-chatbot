import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChatBotProps {
  apiEndpoint: string;
  title?: string;
  placeholder?: string;
  primaryColor?: string;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

export const ChatBot: React.FC<ChatBotProps> = ({
  apiEndpoint,
  title = 'Data Assistant',
  placeholder = 'Hỏi bất kỳ điều gì về dữ liệu...',
  primaryColor = '#2563eb'
}) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'bot', text: 'Xin chào! Tôi có thể giúp bạn truy vấn dữ liệu nào hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg.text,
          history: messages.map(m => ({ role: m.role, text: m.text }))
        })
      });
      
      const data = await response.json();
      
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'bot', 
        text: data.text || 'Lỗi xử lý dữ liệu.' 
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', text: 'Lỗi kết nối tới máy chủ.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      width: '350px',
      height: '500px',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      backgroundColor: '#fff',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        padding: '16px',
        backgroundColor: primaryColor,
        color: 'white',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
        fontWeight: 'bold',
        textAlign: 'center'
      }}>
        {title}
      </div>
      
      <div style={{
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            backgroundColor: msg.role === 'user' ? primaryColor : '#f3f4f6',
            color: msg.role === 'user' ? 'white' : '#1f2937',
            padding: '8px 12px',
            borderRadius: '16px',
            maxWidth: '80%',
            lineHeight: 1.4
          }}>
            {msg.role === 'user' ? (
              msg.text
            ) : (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({node, ...props}) => <table style={{ borderCollapse: 'collapse', width: '100%', margin: '10px 0', fontSize: '13px', backgroundColor: 'white', color: '#1f2937' }} {...props} />,
                  th: ({node, ...props}) => <th style={{ border: '1px solid #d1d5db', padding: '6px', backgroundColor: '#f9fafb', textAlign: 'left' }} {...props} />,
                  td: ({node, ...props}) => <td style={{ border: '1px solid #d1d5db', padding: '6px' }} {...props} />,
                  img: ({node, ...props}) => <img style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} {...props} />,
                  p: ({node, ...props}) => <p style={{ margin: '4px 0' }} {...props} />
                }}
              >
                {msg.text}
              </ReactMarkdown>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', color: '#6b7280', fontSize: '14px' }}>
            AI đang truy vấn cơ sở dữ liệu...
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>
      
      <div style={{
        padding: '12px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: '8px'
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '20px',
            outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            backgroundColor: primaryColor,
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          Gửi
        </button>
      </div>
    </div>
  );
};
