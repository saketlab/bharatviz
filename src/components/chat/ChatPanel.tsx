/**
 * Chat Panel Component
 * Main chat interface with model loading, message history, and input
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, X, Send, RotateCcw, Loader2, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { WebLLMEngine, type InitProgress } from '@/lib/chat/webLLMEngine';
import { getStarterQuestions } from '@/lib/chat/promptBuilder';
import { AVAILABLE_MODELS, getModelInfo, MODEL_GROUPS } from '@/lib/chat/models';
import { ModelSelector } from './ModelSelector';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import type { DynamicChatContext, ChatMessage, MapAction } from '@/lib/chat/types';

interface ChatPanelProps {
  context: DynamicChatContext | null;
  onMapAction?: (action: MapAction) => void;
}

export function ChatPanel({ context, onMapAction }: ChatPanelProps) {
  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(true);

  // Model state
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [modelReady, setModelReady] = useState(false);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [llmQuestions, setLlmQuestions] = useState<string[]>([]);
  const [toolStatus, setToolStatus] = useState<string | null>(null);

  // Refs
  const engineRef = useRef<WebLLMEngine | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const starterQuestions = useMemo(() => getStarterQuestions(context), [context]);
  const currentModelName = useMemo(() => currentModelId ? getModelInfo(currentModelId)?.name || currentModelId : null, [currentModelId]);
  const groupedModels = useMemo(() => MODEL_GROUPS.map(group => ({
    ...group,
    models: AVAILABLE_MODELS.filter(m => group.filter(m))
  })), []);

  const contextFingerprint = context
    ? `${context.currentView.tab}:${context.currentView.mapType}:${context.userData.metricName || ''}:${context.userData.count}`
    : null;

  useEffect(() => {
    if (!modelReady || !contextFingerprint || !engineRef.current || !context) return;
    let stale = false;
    const engine = engineRef.current;
    setLlmQuestions([]);
    engine.generateDataQuestions(context).then(questions => {
      if (!stale && questions.length > 0) setLlmQuestions(questions);
    });
    return () => { stale = true; };
  }, [contextFingerprint, modelReady, context]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && modelReady && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, modelReady]);

  // Listen for suggestion clicks
  useEffect(() => {
    const handleSuggestionClick = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setInput(customEvent.detail);
        inputRef.current?.focus();
      }
    };

    window.addEventListener('suggestion-click', handleSuggestionClick);
    return () => window.removeEventListener('suggestion-click', handleSuggestionClick);
  }, []);

  /**
   * Initialize model
   */
  const handleModelSelect = async (modelId: string) => {
    setIsModelLoading(true);
    setShowModelSelector(false);

    try {
      const engine = new WebLLMEngine(modelId);

      await engine.initialize((progress: InitProgress) => {
        setLoadingProgress(progress.progress * 100);
        setLoadingText(progress.text);
      });

      engineRef.current = engine;
      setCurrentModelId(modelId);
      setModelReady(true);
      setIsModelLoading(false);

      // Add welcome message
      addSystemMessage('AI assistant ready! Ask me about patterns in your map data.');

    } catch (error) {
      console.error('Failed to load model:', error);
      setIsModelLoading(false);
      setShowModelSelector(true);
      addSystemMessage(`❌ Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /**
   * Add a system message
   */
  const addSystemMessage = (content: string) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      role: 'system',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  /**
   * Handle sending a message
   */
  const handleSendMessage = async () => {
    // Validate input
    if (!input.trim()) {
      return;
    }

    // Check if engine is ready
    if (!engineRef.current || !modelReady) {
      addSystemMessage('❌ Please wait for the model to finish loading before sending messages.');
      return;
    }

    // CRITICAL: Check if context exists and capture it immediately
    // to prevent race conditions during async operations
    if (!context) {
      addSystemMessage('❌ Context not available. Please make sure you have uploaded data to the map. The chatbot needs data context to answer questions.');
      return;
    }

    // Validate context structure
    if (!context.currentView || !context.geoMetadata || !context.userData) {
      console.error('ChatPanel - Context structure is invalid:', context);
      addSystemMessage('❌ Context structure is invalid. Please try reloading the data.');
      return;
    }

    // Capture context value to prevent race conditions
    const currentContext = context;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setStreamingContent('');

    // Create assistant message placeholder
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Update context with current conversation (exclude system messages)
      const updatedContext: DynamicChatContext = {
        ...currentContext,
        conversationHistory: messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role,
            content: m.content
          }))
      };

      // Query with tool support (falls back to streaming if no data)
      let fullResponse = '';

      await engineRef.current.queryWithTools(
        input.trim(),
        updatedContext,
        (chunk) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);

          // Update message in real-time
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
        },
        (status) => {
          setToolStatus(status);
        },
        () => {
          // On complete
          setIsGenerating(false);
          setStreamingContent('');
          setToolStatus(null);
        }
      );

    } catch (error) {
      console.error('Query error:', error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }
            : msg
        )
      );
      setIsGenerating(false);
      setStreamingContent('');
    }
  };

  /**
   * Handle key press in input
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * Reset chat
   */
  const handleReset = async () => {
    if (engineRef.current) {
      await engineRef.current.resetChat();
      setMessages([]);
      addSystemMessage('Chat history cleared.');
    }
  };

  const handleChangeModel = async (newModelId?: string) => {
    // Guard against rapid clicks during model switch
    if (isModelLoading) return;

    if (engineRef.current) {
      await engineRef.current.unload();
      engineRef.current = null;
    }
    setModelReady(false);
    setCurrentModelId(null);
    setMessages([]);
    setLoadingProgress(0);
    setLoadingText('');
    setModelPopoverOpen(false);

    if (newModelId) {
      // Direct switch — skip the full model selector, go straight to loading
      handleModelSelect(newModelId);
    } else {
      // Go back to the full model selector screen
      setShowModelSelector(true);
    }
  };

  if (!isOpen) {
    return (
      <Button
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 rounded-full h-12 w-12 sm:h-14 sm:w-14 shadow-lg z-50"
        size="icon"
        onClick={() => setIsOpen(true)}
      >
        <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 sm:bottom-6 sm:right-6 sm:left-auto sm:w-[420px] h-[600px] sm:h-[700px] bg-background border sm:rounded-lg shadow-2xl flex flex-col overflow-hidden z-50">
      <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-card">
        <div className="min-w-0 flex-1">
          {modelReady && currentModelId ? (
            <>
              <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 text-sm sm:text-base font-semibold hover:text-primary transition-colors">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span className="truncate">{currentModelName}</span>
                    <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 max-h-80 overflow-y-auto p-1" align="start" sideOffset={8}>
                  {groupedModels.map(group => (
                    <div key={group.label}>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group.label}</div>
                      {group.models.map(model => (
                        <button
                          key={model.id}
                          className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          onClick={() => {
                            if (model.id !== currentModelId) {
                              handleChangeModel(model.id);
                            } else {
                              setModelPopoverOpen(false);
                            }
                          }}
                        >
                          <div className="flex flex-col items-start min-w-0">
                            <span className="truncate">{model.name}</span>
                            <span className="text-xs text-muted-foreground">{model.size} · {model.speed}</span>
                          </div>
                          {model.id === currentModelId && (
                            <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
              {context && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {context.currentView.selectedState
                    ? `${context.currentView.selectedState} districts`
                    : `${context.currentView.tab} • ${context.currentView.mapType}`}
                  {context.userData.hasData && ` • ${context.userData.count} entities`}
                </p>
              )}
            </>
          ) : (
            <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              Map Assistant
            </h3>
          )}
        </div>
        <div className="flex items-center gap-1">
          {modelReady && (
            <Button variant="ghost" size="icon" onClick={handleReset} title="Clear chat">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Model Selector */}
      {showModelSelector && !modelReady && (
        <div className="flex-1 overflow-y-auto">
          <ModelSelector
            onSelectModel={handleModelSelect}
            onCancel={() => setIsOpen(false)}
          />
        </div>
      )}

      {/* Model Loading */}
      {isModelLoading && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h4 className="font-semibold mb-2">Loading AI Model...</h4>
          <Progress value={loadingProgress} className="w-full mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            {loadingText || `${loadingProgress.toFixed(0)}%`}
          </p>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            This is a one-time download. The model will be cached for future use.
          </p>
        </div>
      )}

      {/* Chat Interface */}
      {modelReady && !showModelSelector && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!context && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p className="font-semibold mb-1">⚠️ No data context</p>
                  <p className="text-sm">Please upload data to the map first. The chatbot needs data to analyze.</p>
                </AlertDescription>
              </Alert>
            )}
            {!messages.some(m => m.role === 'user') && context && (
              <Alert>
                <AlertDescription>
                  <p className="font-semibold mb-1">Map Assistant</p>
                  <p className="text-sm mb-2">
                    {context.userData.hasData
                      ? `${context.userData.count} entities loaded. Try asking:`
                      : 'Upload data to get started, or ask about geographic information.'}
                  </p>
                  {(llmQuestions.length > 0 || starterQuestions.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {(llmQuestions.length > 0 ? llmQuestions : starterQuestions).map((q, i) => (
                        <button
                          key={i}
                          className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors text-left"
                          onClick={() => {
                            setInput(q);
                            inputRef.current?.focus();
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {messages.map(msg => (
              <ChatMessageComponent key={msg.id} message={msg} />
            ))}

            {isGenerating && !streamingContent && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {toolStatus || 'Thinking...'}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-card">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={context?.userData.hasData ? "Ask about your data..." : "Ask a question..."}
                className="flex-1 px-3 py-2 border rounded-md resize-none min-h-[44px] max-h-[120px] bg-background text-foreground"
                rows={1}
                disabled={isGenerating || !context}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isGenerating || !input.trim() || !context}
                size="icon"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
