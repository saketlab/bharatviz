import * as webllm from "@mlc-ai/web-llm";
import { functionCallingModelIds } from "@mlc-ai/web-llm";
import type { DynamicChatContext, ChatResponse, ConversationMessage } from './types';
import { buildSystemPrompt, getStarterQuestions } from './promptBuilder';
import { toolDefinitions, executeTool, getToolStatusMessage, clearSpatialCache } from './spatialTools';

export interface InitProgress {
  progress: number;
  timeElapsed: number;
  text: string;
}

function extractMentionedStates(query: string, availableStates: string[]): string[] {
  const queryLower = query.toLowerCase();
  const mentioned: string[] = [];

  for (const state of availableStates) {
    const stateLower = state.toLowerCase();
    if (queryLower.includes(stateLower)) {
      mentioned.push(state);
    }
  }

  return mentioned;
}

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trimStart();
}

function isKVCacheError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('filledKVCacheLength') || msg.includes('KVCache');
}

function isToolCallParseError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('is not valid JSON') || msg.includes('parsing outputMessage');
}

const TOOL_TRIGGER_PATTERNS = /\b(morans?|lisa|cluster|hotspot|coldspot|spatial|autocorrelation|gi\*|getis|compare.*(region|north|south|east|west)|top\s+\d+|bottom\s+\d+|rank|summary\s+stat|descriptive\s+stat)\b/i;

function inferToolFromQuery(query: string): string | null {
  const q = query.toLowerCase();
  if (/\blisa\b/.test(q) || /\blocal.*(cluster|spatial|indicator)/i.test(q)) return 'local_spatial_clusters';
  if (/\bhotspot|coldspot|gi\*|getis/i.test(q)) return 'hotspot_analysis';
  if (/\bmorans?|spatial\s*auto|autocorrelation/i.test(q)) return 'spatial_autocorrelation';
  if (/\bcompare.*(region|north|south|east|west)/i.test(q)) return 'compare_regions';
  if (/\b(top|bottom|rank)\b/i.test(q)) return 'rank_entities';
  if (/\bsummar|descriptive/i.test(q)) return 'summarize_data';
  return null;
}

async function streamWithThinkTagStripping(
  chunks: AsyncIterable<webllm.ChatCompletionChunk>,
  onChunk: (text: string) => void
): Promise<void> {
  let insideThink = false;
  let pendingBuffer = '';

  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (!delta) continue;

    pendingBuffer += delta;

    while (pendingBuffer.length > 0) {
      if (insideThink) {
        const closeIdx = pendingBuffer.indexOf('</think>');
        if (closeIdx === -1) {
          pendingBuffer = '';
          break;
        }
        pendingBuffer = pendingBuffer.slice(closeIdx + 8);
        insideThink = false;
      } else {
        const openIdx = pendingBuffer.indexOf('<think>');
        if (openIdx === -1) {
          if (pendingBuffer.length > 7) {
            const safe = pendingBuffer.slice(0, -7);
            if (safe) onChunk(safe);
            pendingBuffer = pendingBuffer.slice(-7);
          }
          break;
        }
        if (openIdx > 0) {
          onChunk(pendingBuffer.slice(0, openIdx));
        }
        pendingBuffer = pendingBuffer.slice(openIdx + 7);
        insideThink = true;
      }
    }
  }

  if (pendingBuffer && !insideThink) {
    onChunk(pendingBuffer.trimStart());
  }
}

export class WebLLMEngine {
  private engine: webllm.MLCEngine | null = null;
  private isInitializing = false;
  private isReady = false;
  private selectedModel: string;
  private recovering = false;

  private supportsToolCalling: boolean;

  constructor(modelId: string = "Qwen3-4B-q4f16_1-MLC") {
    this.selectedModel = modelId;
    this.supportsToolCalling = functionCallingModelIds.includes(modelId);
  }

  async initialize(
    onProgress?: (progress: InitProgress) => void
  ): Promise<void> {
    if (this.isReady) {
      console.log('WebLLM already initialized');
      return;
    }

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isInitializing = true;

    try {
      console.log(`Initializing WebLLM with model: ${this.selectedModel}`);

      this.engine = await webllm.CreateMLCEngine(
        this.selectedModel,
        {
          initProgressCallback: (report) => {
            if (onProgress) {
              onProgress({
                progress: report.progress,
                timeElapsed: report.timeElapsed,
                text: report.text
              });
            }
          },
          logLevel: "WARN"
        }
      );

      this.isReady = true;
      console.log('WebLLM initialized successfully');
    } catch (error) {
      console.error("Failed to initialize WebLLM:", error);
      this.isReady = false;
      throw new Error(`WebLLM initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isInitializing = false;
    }
  }

  private async recoverFromKVCacheError(): Promise<boolean> {
    if (this.recovering) return false;
    this.recovering = true;
    try {
      console.warn('KV cache corrupted, reloading engine...');
      if (this.engine) {
        try { await this.engine.unload(); } catch (_) {
          // Ignore unload errors
        }
      }
      this.isReady = false;
      this.engine = await webllm.CreateMLCEngine(this.selectedModel, { logLevel: "WARN" });
      this.isReady = true;
      console.log('Engine reloaded after KV cache recovery');
      return true;
    } catch (e) {
      console.error('KV cache recovery failed:', e);
      return false;
    } finally {
      this.recovering = false;
    }
  }

  async query(
    userQuery: string,
    context: DynamicChatContext
  ): Promise<ChatResponse> {
    if (!this.isReady || !this.engine) {
      throw new Error("WebLLM not initialized. Call initialize() first.");
    }

    if (!context) {
      throw new Error("context is not defined");
    }

    const startTime = performance.now();

    try {
      await this.engine.resetChat();

      const mentionedStates = extractMentionedStates(userQuery, context.geoMetadata.stateList);
      const contextWithMentions: DynamicChatContext = { ...context, mentionedStates };
      const systemPrompt = buildSystemPrompt(contextWithMentions);

      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt }
      ];

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentHistory = context.conversationHistory
          .filter(msg => msg.role !== 'system')
          .slice(-10);
        messages.push(...recentHistory.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        })));
      }

      messages.push({ role: "user", content: userQuery });

      const completion = await this.engine.chat.completions.create({
        messages,
        temperature: 0,
        max_tokens: 512,
      });

      const raw = completion.choices[0].message.content || "No response generated";
      const answer = stripThinkTags(raw);
      const suggestions = this.generateSuggestions(context, userQuery);

      const processingTime = performance.now() - startTime;

      return {
        answer,
        confidence: 0.85,
        processingTime,
        suggestions
      };

    } catch (error) {
      if (isKVCacheError(error) && await this.recoverFromKVCacheError()) {
        return this.query(userQuery, context);
      }
      console.error("WebLLM query error:", error);
      return {
        answer: `❌ Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        processingTime: performance.now() - startTime,
        suggestions: ["Try rephrasing your question", "Check if the model is loaded properly"]
      };
    }
  }

  async streamQuery(
    userQuery: string,
    context: DynamicChatContext,
    onChunk: (chunk: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (!this.isReady || !this.engine) {
      throw new Error("WebLLM not initialized. Call initialize() first.");
    }

    if (!context) {
      throw new Error("context is not defined");
    }

    if (!context.currentView || !context.geoMetadata || !context.userData) {
      throw new Error("context structure is invalid");
    }

    try {
      await this.engine.resetChat();

      const mentionedStates = extractMentionedStates(userQuery, context.geoMetadata.stateList);

      const contextWithMentions: DynamicChatContext = {
        ...context,
        mentionedStates
      };

      const systemPrompt = buildSystemPrompt(contextWithMentions);

      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt }
      ];

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentHistory = context.conversationHistory
          .filter(msg => msg.role !== 'system')
          .slice(-10);
        messages.push(...recentHistory.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        })));
      }

      messages.push({ role: "user", content: userQuery });

      const asyncChunkGenerator = await this.engine.chat.completions.create({
        messages,
        temperature: 0,
        max_tokens: 512,
        stream: true
      });

      await streamWithThinkTagStripping(asyncChunkGenerator, onChunk);

      if (onComplete) {
        onComplete();
      }

    } catch (error) {
      if (isKVCacheError(error) && await this.recoverFromKVCacheError()) {
        return this.streamQuery(userQuery, context, onChunk, onComplete);
      }
      console.error("WebLLM streaming error:", error);
      onChunk(`\n\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (onComplete) {
        onComplete();
      }
    }
  }

  async queryWithTools(
    userQuery: string,
    context: DynamicChatContext,
    onChunk: (chunk: string) => void,
    onToolStatus?: (status: string | null) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (!this.isReady || !this.engine) {
      throw new Error("WebLLM not initialized. Call initialize() first.");
    }

    if (!context?.currentView || !context?.geoMetadata || !context?.userData) {
      throw new Error("context structure is invalid");
    }

    if (!context.userData.hasData || !this.supportsToolCalling) {
      return this.streamQuery(userQuery, context, onChunk, onComplete);
    }

    try {
      clearSpatialCache();
      await this.engine.resetChat();

      const mentionedStates = extractMentionedStates(userQuery, context.geoMetadata.stateList);
      const contextWithMentions: DynamicChatContext = { ...context, mentionedStates };
      const systemPrompt = buildSystemPrompt(contextWithMentions, { useTools: true });

      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt }
      ];

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentHistory = context.conversationHistory
          .filter(msg => msg.role !== 'system')
          .slice(-10);
        messages.push(...recentHistory.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        })));
      }

      messages.push({ role: "user", content: userQuery });

      const forceTools = TOOL_TRIGGER_PATTERNS.test(userQuery);
      let completion: webllm.ChatCompletion;
      try {
        completion = await this.engine.chat.completions.create({
          messages,
          temperature: 0,
          max_tokens: 512,
          tools: toolDefinitions as webllm.ChatCompletionTool[],
          tool_choice: forceTools ? "auto" : "auto"
        });
      } catch (toolCallError) {
        if (isToolCallParseError(toolCallError)) {
          console.warn('Model produced invalid tool-call output, attempting auto-dispatch');
          const inferredTool = inferToolFromQuery(userQuery);
          if (inferredTool) {
            return this.autoDispatchTool(inferredTool, userQuery, context, messages, onChunk, onToolStatus, onComplete);
          }
          return this.streamQuery(userQuery, context, onChunk, onComplete);
        }
        throw toolCallError;
      }

      const choice = completion.choices[0];
      const toolCalls = choice.message.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: choice.message.content || null,
          tool_calls: toolCalls
        } as webllm.ChatCompletionMessageParam);

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            toolArgs = {};
          }

          if (onToolStatus) {
            onToolStatus(getToolStatusMessage(toolName));
          }

          const result = await executeTool(toolName, toolArgs, context);

          messages.push({
            role: "tool",
            content: JSON.stringify(result.data),
            tool_call_id: toolCall.id
          } as webllm.ChatCompletionMessageParam);
        }

        if (onToolStatus) {
          onToolStatus(null);
        }

        await this.engine.resetChat();

        const asyncChunkGenerator = await this.engine.chat.completions.create({
          messages,
          temperature: 0,
          max_tokens: 512,
          stream: true
        });

        await streamWithThinkTagStripping(asyncChunkGenerator, onChunk);
      } else if (forceTools) {
        const inferredTool = inferToolFromQuery(userQuery);
        if (inferredTool) {
          return this.autoDispatchTool(inferredTool, userQuery, context, messages, onChunk, onToolStatus, onComplete);
        }
        const raw = choice.message.content || '';
        const answer = stripThinkTags(raw);
        if (answer) onChunk(answer);
      } else {
        const raw = choice.message.content || '';
        const answer = stripThinkTags(raw);
        if (answer) onChunk(answer);
      }

      if (onComplete) {
        onComplete();
      }

    } catch (error) {
      if (isKVCacheError(error) && await this.recoverFromKVCacheError()) {
        return this.queryWithTools(userQuery, context, onChunk, onToolStatus, onComplete);
      }
      console.error("WebLLM tool query error:", error);
      onChunk(`\n\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (onComplete) {
        onComplete();
      }
    }
  }

  private async autoDispatchTool(
    toolName: string,
    userQuery: string,
    context: DynamicChatContext,
    messages: webllm.ChatCompletionMessageParam[],
    onChunk: (chunk: string) => void,
    onToolStatus?: (status: string | null) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (!this.engine) throw new Error("Engine not initialized");

    if (onToolStatus) onToolStatus(getToolStatusMessage(toolName));

    const result = await executeTool(toolName, {}, context);

    if (onToolStatus) onToolStatus(null);

    const syntheticCallId = `auto_${Date.now()}`;
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: [{
        id: syntheticCallId,
        type: "function" as const,
        function: { name: toolName, arguments: '{}' }
      }]
    } as webllm.ChatCompletionMessageParam);

    messages.push({
      role: "tool",
      content: JSON.stringify(result.data),
      tool_call_id: syntheticCallId
    } as webllm.ChatCompletionMessageParam);

    await this.engine.resetChat();

    const asyncChunkGenerator = await this.engine.chat.completions.create({
      messages,
      temperature: 0,
      max_tokens: 512,
      stream: true
    });

    await streamWithThinkTagStripping(asyncChunkGenerator, onChunk);

    if (onComplete) onComplete();
  }

  async generateDataQuestions(context: DynamicChatContext): Promise<string[]> {
    if (!this.isReady || !this.engine) return [];

    try {
      await this.engine.resetChat();
      const systemPrompt = buildSystemPrompt(context);
      const completion = await this.engine.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Suggest exactly 4 short questions (max 12 words each) a user might ask about this data. Output ONLY the questions, one per line, no numbering or bullets." }
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const raw = stripThinkTags(completion.choices[0].message.content || '');
      const questions = raw
        .split('\n')
        .map(l => l.replace(/^\d+[.)]\s*/, '').replace(/^[-•*]\s*/, '').trim())
        .filter(l => l.length > 10 && l.length < 120);

      await this.engine.resetChat();
      return questions.slice(0, 4);
    } catch (error) {
      if (isKVCacheError(error) && await this.recoverFromKVCacheError()) {
        return this.generateDataQuestions(context);
      }
      console.error("Failed to generate data questions:", error);
      try { await this.engine?.resetChat(); } catch (_) {
        // Ignore errors
      }
      return [];
    }
  }

  private generateSuggestions(context: DynamicChatContext, lastQuery: string): string[] {
    const questions = getStarterQuestions(context);
    const queryLower = lastQuery.toLowerCase();
    return questions
      .filter(q => !queryLower.includes(q.toLowerCase().slice(0, 20)))
      .slice(0, 3);
  }

  isInitialized(): boolean {
    return this.isReady;
  }

  async resetChat(): Promise<void> {
    if (this.engine) {
      await this.engine.resetChat();
      console.log('Chat history reset');
    }
  }

  async getRuntimeStats(): Promise<string> {
    if (this.engine) {
      return await this.engine.runtimeStatsText();
    }
    return "Engine not initialized";
  }

  async interrupt(): Promise<void> {
    if (this.engine) {
      await this.engine.interruptGenerate();
    }
  }

  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.isReady = false;
      console.log('WebLLM engine unloaded');
    }
  }

  getModelId(): string {
    return this.selectedModel;
  }
}
