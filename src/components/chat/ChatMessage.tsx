import React from 'react';
import { Bot, User } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/lib/chat/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="text-center py-2">
        <div className="inline-block px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
        }`}
      >
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </div>

      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
        <div
          className={`inline-block px-4 py-2 rounded-lg ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {formatMessage(message.content)}
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-1 px-1">
          {formatTimestamp(message.timestamp)}
        </div>

        {message.response?.suggestions && message.response.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.response.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                onClick={() => {
                  const event = new CustomEvent('suggestion-click', { detail: suggestion });
                  window.dispatchEvent(event);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatMessage(content: string): JSX.Element {
  const paragraphs = content.split('\n\n');

  return (
    <>
      {paragraphs.map((para, idx) => {
        if (para.trim().startsWith('-') || para.trim().startsWith('•')) {
          const items = para.split('\n').filter(line => line.trim());
          return (
            <ul key={idx} className="list-disc list-inside my-2 space-y-1">
              {items.map((item, itemIdx) => (
                <li key={itemIdx} className="text-sm">
                  {item.replace(/^[-•]\s*/, '')}
                </li>
              ))}
            </ul>
          );
        }

        if (/^\d+\./.test(para.trim())) {
          const items = para.split('\n').filter(line => line.trim());
          return (
            <ol key={idx} className="list-decimal list-inside my-2 space-y-1">
              {items.map((item, itemIdx) => (
                <li key={itemIdx} className="text-sm">
                  {item.replace(/^\d+\.\s*/, '')}
                </li>
              ))}
            </ol>
          );
        }

        if (para.startsWith('##')) {
          return (
            <h3 key={idx} className="font-semibold text-base mt-3 mb-2">
              {para.replace(/^##\s*/, '')}
            </h3>
          );
        }

        return (
          <p key={idx} className="text-sm my-2">
            {formatInlineMarkdown(para)}
          </p>
        );
      })}
    </>
  );
}

function formatInlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const current = text;
  let key = 0;

  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;

  current.replace(boldRegex, (match, content, index) => {
    if (index > lastIndex) {
      parts.push(current.substring(lastIndex, index));
    }
    parts.push(<strong key={key++}>{content}</strong>);
    lastIndex = index + match.length;
    return match;
  });

  if (lastIndex < current.length) {
    parts.push(current.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) {
    return 'Just now';
  }

  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
