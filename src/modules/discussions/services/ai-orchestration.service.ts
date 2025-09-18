import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { spawn } from 'child_process';
import { DiscussionsService } from '../discussions.service';
import { ProposalsService } from '../../proposals/proposals.service';
import { CommentType } from '../interfaces/discussion.interface';

export interface ModelProvider {
  id: string;
  name: string;
  provider: 'cursor-agent' | 'aider';
  config?: {
    apiKey?: string;
    model?: string;
    endpoint?: string;
  };
}

export interface OrchestrationConfig {
  maxModels: number;
  timeoutMs: number;
  enabledProviders: string[];
  commentTypes: CommentType[];
  systemPrompt: string;
  proposalId?: string;
}

@Injectable()
export class AIOrchestrationService {
  private readonly logger = new Logger(AIOrchestrationService.name);
  
  private readonly modelProviders: ModelProvider[] = [
    // Cursor-agent models (built-in) - 4 models
    { id: 'auto', name: 'Auto Mediator', provider: 'cursor-agent' },
    { id: 'gpt-5', name: 'GPT-5', provider: 'cursor-agent' },
    { id: 'sonnet-4', name: 'Claude Sonnet 4', provider: 'cursor-agent' },
    { id: 'opus-4.1', name: 'Claude Opus 4.1', provider: 'cursor-agent' },
    
    // Aider models (external APIs) - 32 models
    // OpenAI - 8 models
    { id: 'openai/chatgpt-4o-latest', name: 'ChatGPT-4o Latest', provider: 'aider', config: { model: 'chatgpt-4o-latest' } },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'aider', config: { model: 'gpt-4o' } },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'aider', config: { model: 'gpt-4o-mini' } },
    { id: 'openai/gpt-4o-search-preview', name: 'GPT-4o Search', provider: 'aider', config: { model: 'gpt-4o-search-preview' } },
    { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'aider', config: { model: 'gpt-5-mini' } },
    { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'aider', config: { model: 'gpt-4.1-mini' } },
    { id: 'openai/o1-mini', name: 'O1 Mini', provider: 'aider', config: { model: 'o1-mini' } },
    { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'aider', config: { model: 'gpt-4-turbo' } },
    
    // Anthropic - 7 models
    { id: 'anthropic/claude-4-sonnet-20250514', name: 'Claude 4 Sonnet', provider: 'aider', config: { model: 'claude-4-sonnet-20250514' } },
    { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'aider', config: { model: 'claude-sonnet-4-20250514' } },
    { id: 'anthropic/claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', provider: 'aider', config: { model: 'claude-3-7-sonnet-latest' } },
    { id: 'anthropic/claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'aider', config: { model: 'claude-3-5-sonnet-20241022' } },
    { id: 'anthropic/claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet Latest', provider: 'aider', config: { model: 'claude-3-5-sonnet-latest' } },
    { id: 'anthropic/claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', provider: 'aider', config: { model: 'claude-3-5-haiku-latest' } },
    { id: 'anthropic/claude-3-opus-latest', name: 'Claude 3 Opus', provider: 'aider', config: { model: 'claude-3-opus-latest' } },
    
    // Gemini (Google) - 5 models
    { id: 'gemini/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'aider', config: { model: 'gemini-2.0-flash' } },
    { id: 'gemini/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'aider', config: { model: 'gemini-2.5-pro' } },
    { id: 'gemini/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'aider', config: { model: 'gemini-2.5-flash' } },
    { id: 'gemini/gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', provider: 'aider', config: { model: 'gemini-1.5-pro-latest' } },
    { id: 'gemini/gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', provider: 'aider', config: { model: 'gemini-1.5-flash-latest' } },
    
    // xAI (Grok) - 5 models
    { id: 'xai/grok-4-latest', name: 'Grok 4', provider: 'aider', config: { model: 'grok-4-latest' } },
    { id: 'xai/grok-3-latest', name: 'Grok 3', provider: 'aider', config: { model: 'grok-3-latest' } },
    { id: 'xai/grok-3-fast-latest', name: 'Grok 3 Fast', provider: 'aider', config: { model: 'grok-3-fast-latest' } },
    { id: 'xai/grok-3-mini-latest', name: 'Grok 3 Mini', provider: 'aider', config: { model: 'grok-3-mini-latest' } },
    { id: 'xai/grok-code-fast-1', name: 'Grok Code Fast', provider: 'aider', config: { model: 'grok-code-fast-1' } },
    
    // DeepSeek - 2 models (same as chat-hub)
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'aider', config: { model: 'deepseek-chat' } },
    { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', provider: 'aider', config: { model: 'deepseek-coder' } },
    
    // Groq - 3 models
    { id: 'groq/llama-3.1-70b-versatile', name: 'Llama 3.1 70B', provider: 'aider', config: { model: 'llama-3.1-70b-versatile' } },
    { id: 'groq/llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'aider', config: { model: 'llama-3.1-8b-instant' } },
    { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'aider', config: { model: 'llama-3.3-70b-versatile' } }
  ];

  private readonly defaultConfig: OrchestrationConfig = {
    maxModels: 6, // Reduced for faster orchestration
    timeoutMs: 45000, // 45 seconds for model responses
    enabledProviders: ['cursor-agent', 'aider'],
    commentTypes: [CommentType.COMMENT, CommentType.SUGGESTION, CommentType.SUPPORT, CommentType.OBJECTION],
    systemPrompt: `Você é um modelo de IA especializado participando de uma discussão de governança sobre uma proposta específica.

IDENTIDADE CRÍTICA:
- VOCÊ É: {MODEL_ID}
- NUNCA simule, imite ou fale em nome de outros modelos AI
- JAMAIS forneça opiniões que não sejam suas como {MODEL_ID}
- Se questionado sobre outros modelos, responda "Consulte diretamente o modelo específico"
- SEMPRE identifique-se corretamente como {MODEL_ID} quando relevante

INSTRUÇÕES DE ANÁLISE:
- Analise a proposta com foco técnico e estratégico
- Forneça feedback construtivo e específico baseado em sua expertise
- Use seu conhecimento especializado para avaliar viabilidade técnica
- Seja conciso mas informativo (100-150 palavras)
- Foque em aspectos técnicos, de implementação, segurança ou governança
- Identifique potenciais riscos ou benefícios

TIPOS DE COMENTÁRIO:
- COMMENT: Observação geral técnica
- SUGGESTION: Sugestão específica de melhoria técnica
- SUPPORT: Apoio com justificativa técnica detalhada
- OBJECTION: Objeção fundamentada com alternativas técnicas

Responda em português brasileiro, sendo direto e técnico.`
  };

  constructor(
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Orchestrate AI models to comment on a discussion
   */
  async orchestrateDiscussion(
    discussionId: string, 
    proposalContent: string, 
    proposalTitle: string,
    config?: Partial<OrchestrationConfig>
  ): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    this.logger.log(`🎭 Orchestrating discussion ${discussionId} with ${finalConfig.maxModels} models`);

    // Select models for orchestration
    const selectedModels = this.selectModelsForDiscussion(finalConfig.maxModels);
    
    // Create discussion prompt
    const discussionPrompt = this.createDiscussionPrompt(proposalTitle, proposalContent, config.proposalId);
    
    // Orchestrate comments in parallel
    const commentPromises = selectedModels.map(async (model, index) => {
      try {
        // Add delay to avoid overwhelming APIs
        await this.delay(index * 2000); // 2 second delay between model calls
        
        return await this.generateModelComment(
          model,
          discussionId,
          discussionPrompt,
          finalConfig
        );
      } catch (error) {
        this.logger.error(`Failed to get comment from ${model.id}: ${error.message}`);
        return null;
      }
    });

    // Wait for all comments
    const results = await Promise.allSettled(commentPromises);
    const successfulComments = results
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value);

    this.logger.log(`✅ Generated ${successfulComments.length}/${selectedModels.length} comments for discussion ${discussionId}`);
    
    // Emit orchestration complete event
    this.eventEmitter.emit('discussion.orchestration.complete', {
      discussionId,
      totalModels: selectedModels.length,
      successfulComments: successfulComments.length,
      models: selectedModels.map(m => m.id)
    });
  }

  /**
   * Generate a comment from a specific model
   */
  private async generateModelComment(
    model: ModelProvider,
    discussionId: string,
    prompt: string,
    config: OrchestrationConfig
  ): Promise<any> {
    this.logger.debug(`💬 Generating comment from ${model.id} for discussion ${discussionId}`);

    try {
      // Get model response
      const response = await this.callModel(model, prompt, config.timeoutMs);
      
      if (!response || response.trim().length < 10) {
        throw new Error('Empty or too short response');
      }

      // Clean response from model commands
      const cleanedResponse = this.cleanModelResponse(response.trim());
      
      // Determine comment type based on response content
      const commentType = this.determineCommentType(cleanedResponse);
      
      // The actual comment creation will be handled by the DiscussionsService
      // We return the data for the caller to create the comment
      return {
        authorId: model.id,
        type: commentType,
        content: cleanedResponse,
        metadata: {
          generatedBy: 'ai-orchestration',
          modelProvider: model.provider,
          modelName: model.name,
          generatedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      this.logger.error(`Error generating comment from ${model.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Call a model via cursor-agent or aider
   */
  private async callModel(model: ModelProvider, prompt: string, timeoutMs: number): Promise<string> {
    if (model.provider === 'cursor-agent') {
      return this.callCursorAgent(model.id, prompt, timeoutMs);
    } else {
      return this.callAiderModel(model.id, prompt, timeoutMs);
    }
  }

  /**
   * Call model via cursor-agent
   */
  private async callCursorAgent(modelId: string, prompt: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const cursorAgent = spawn('cursor-agent', [
        '--print',
        '--output-format', 'text',
        '--model', modelId,
        '-p', prompt
      ], {
        cwd: process.cwd().includes('/governance') ? process.cwd().replace('/governance', '') : process.cwd() // Execute from project root
      });

      let output = '';
      let errorOutput = '';

      const timeout = setTimeout(() => {
        cursorAgent.kill();
        reject(new Error(`Cursor-agent timeout for model ${modelId}`));
      }, timeoutMs);

      cursorAgent.stdout.on('data', (data) => {
        output += data.toString();
      });

      cursorAgent.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      cursorAgent.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0 && output.trim() && this.isValidResponse(output.trim())) {
          resolve(output.trim());
        } else {
          reject(new Error(`Cursor-agent failed for ${modelId}: ${errorOutput || 'Invalid or empty response'}`));
        }
      });

      cursorAgent.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn cursor-agent for ${modelId}: ${error.message}`));
      });
    });
  }

  /**
   * Call model via aider
   */
  private async callAiderModel(modelId: string, prompt: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use same parameters as chat-hub (without map-tokens to avoid repo errors)
      const aiderArgs = [
        '--model', modelId,
        '--no-pretty',
        '--yes',
        '--no-stream',
        '--exit',
        '--subtree-only',
        '--dry-run',
        '--no-auto-commits',
        '--no-dirty-commits',
        '--no-git',
        '--timeout', '60',
        '--message', prompt
      ];

      const aider = spawn('aider', aiderArgs, {
        cwd: process.cwd().includes('/governance') ? process.cwd().replace('/governance', '') : process.cwd() // Execute from project root
      });

      let output = '';
      let errorOutput = '';

      const timeout = setTimeout(() => {
        aider.kill();
        reject(new Error(`Aider timeout for model ${modelId}`));
      }, timeoutMs);

      aider.stdout.on('data', (data) => {
        output += data.toString();
      });

      aider.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      aider.on('close', (code) => {
        clearTimeout(timeout);
        
        // Extract response from aider output
        const response = this.extractAiderResponse(output);
        
        if (response && response.trim() && this.isValidResponse(response)) {
          resolve(response.trim());
        } else {
          reject(new Error(`Aider failed for ${modelId}: ${errorOutput || 'Invalid or empty response'}`));
        }
      });

      aider.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn aider for ${modelId}: ${error.message}`));
      });
    });
  }

  /**
   * Extract response from aider output (improved header removal)
   */
  private extractAiderResponse(output: string): string {
    if (!output) return '';
    
    const lines = output.split('\n');
    let contentStart = 0;
    let contentEnd = lines.length;
    
    // More comprehensive header detection
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip common Aider header patterns and repo-map errors
      if (line.startsWith('Aider v') ||
          line.startsWith('Model:') ||
          line.startsWith('Git repo:') ||
          line.startsWith('Repo-map:') ||
          line.includes('working dir:') ||
          line.includes('with diff edit format') ||
          line.includes('infinite output') ||
          line.includes('auto refresh') ||
          line.includes("Repo-map can't include") ||
          line.includes("Has it been deleted from the file system") ||
          line === '' ||
          line.startsWith('────')) {
        continue;
      }
      
      // Look for actual content start
      if (line.startsWith('Como ') || 
          line.length > 50 ||
          line.includes('análise') ||
          line.includes('proposta') ||
          line.includes('técnica') ||
          line.includes('Analisando') ||
          line.includes('Esta proposta')) {
        contentStart = i;
        break;
      }
    }
    
    // Find content end (before cost information)
    for (let i = contentStart; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('Tokens:') || line.includes('Cost:') || line.includes('$0.')) {
        contentEnd = i;
        break;
      }
    }
    
    // Extract content from the identified range
    const cleanedLines = lines.slice(contentStart, contentEnd);
    let response = cleanedLines.join('\n').trim();
    
    // Remove any remaining Aider artifacts
    response = response.replace(/Tokens:.*Cost:.*$/gm, '').trim();
    response = response.replace(/Repo-map can't include.*$/gm, '').trim();
    response = response.replace(/Has it been deleted from the file system.*$/gm, '').trim();
    
    if (contentStart > 0) {
      console.log(`🧹 Cleaned Aider headers (removed ${contentStart} lines)`);
    }
    
    return response;
  }

  /**
   * Validate if response is a valid comment (not an API error)
   */
  private isValidResponse(response: string): boolean {
    if (!response || response.trim().length < 10) {
      return false;
    }

    const lowerResponse = response.toLowerCase();
    
    // Check for API errors
    const apiErrorPatterns = [
      'credit balance is too low',
      'invalid_request_error',
      'authentication failed',
      'api key',
      'rate limit',
      'quota exceeded',
      'billing',
      'payment required',
      'unauthorized',
      'forbidden',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'timeout',
      'connection refused',
      'network error',
      '"type":"error"',
      '"error":',
      'request_id',
      'anthropic api',
      'openai api',
      'your credit'
    ];

    // Check if response contains API error patterns
    for (const pattern of apiErrorPatterns) {
      if (lowerResponse.includes(pattern)) {
        console.log(`🚫 Filtered API error response: ${pattern}`);
        return false;
      }
    }

    // Check for JSON error responses
    try {
      const parsed = JSON.parse(response);
      if (parsed.error || parsed.type === 'error') {
        console.log(`🚫 Filtered JSON error response`);
        return false;
      }
    } catch {
      // Not JSON, continue validation
    }

    // Check if response looks like a proper analysis/comment
    const validContentPatterns = [
      'análise',
      'proposta',
      'técnica',
      'implementação',
      'considera',
      'sugiro',
      'recomendo',
      'viabilidade',
      'arquitetura',
      'segurança',
      'performance',
      'como ',
      'esta proposta',
      'analisando'
    ];

    const hasValidContent = validContentPatterns.some(pattern => 
      lowerResponse.includes(pattern)
    );

    if (!hasValidContent) {
      console.log(`🚫 Response doesn't contain valid analysis content`);
      return false;
    }

    return true;
  }

  /**
   * Select models for discussion
   */
  private selectModelsForDiscussion(maxModels: number): ModelProvider[] {
    // Always include the mediator (auto)
    const selected = [this.modelProviders.find(m => m.id === 'auto')!];
    
    // Add diverse models from different providers
    const remaining = this.modelProviders
      .filter(m => m.id !== 'auto')
      .sort(() => Math.random() - 0.5) // Randomize
      .slice(0, maxModels - 1);
    
    return [...selected, ...remaining];
  }

  /**
   * Create discussion prompt
   */
  private createDiscussionPrompt(title: string, content: string, proposalId?: string): string {
    const extractedId = proposalId || this.extractProposalId(title);
    
    return `${this.defaultConfig.systemPrompt}

PROPOSTA ESPECÍFICA PARA ANÁLISE:
- ID: ${extractedId}
- Título: ${title}
- Localização: governance/proposals/*/${extractedId}*.json
- Conteúdo: Fornecido abaixo (NÃO busque arquivos externos)

IMPORTANTE: 
- Analise APENAS esta proposta específica
- NÃO busque arquivos externos (Read, Grepped, Searched files)
- NÃO use comandos de busca - todo conteúdo necessário está fornecido
- Responda DIRETAMENTE com sua análise técnica

CONTEÚDO COMPLETO DA PROPOSTA ${extractedId}:
${typeof content === 'string' ? content : JSON.stringify(content, null, 2)}

Forneça sua análise técnica focando em viabilidade, arquitetura, segurança e implementação.`;
  }

  /**
   * Clean model response from search commands and artifacts
   */
  private cleanModelResponse(response: string): string {
    if (!response) return '';
    
    const lines = response.split('\n');
    const cleanedLines = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip lines that are model commands or artifacts
      if (trimmedLine.startsWith('Read ') ||
          trimmedLine.startsWith('Grepped ') ||
          trimmedLine.startsWith('Searched ') ||
          trimmedLine.startsWith('Search ') ||
          trimmedLine.includes('Searched files') ||
          trimmedLine.includes('I\'ll search') ||
          trimmedLine.includes('I\'ll open') ||
          trimmedLine.includes('I\'ll locate') ||
          trimmedLine.includes('Vou procurar') ||
          trimmedLine.includes('Vou localizar') ||
          trimmedLine.includes('Vou buscar') ||
          trimmedLine.match(/^[A-Z][a-z]+ \([^)]+\)$/) || // Skip pattern like "Read (filename)"
          trimmedLine === '' && cleanedLines.length === 0) { // Skip empty lines at start
        continue;
      }
      
      cleanedLines.push(line);
    }
    
    // Join and clean up extra whitespace
    let cleaned = cleanedLines.join('\n').trim();
    
    // Remove multiple consecutive newlines
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return cleaned;
  }

  /**
   * Extract proposal ID from title
   */
  private extractProposalId(title: string): string {
    const match = title.match(/P(\d+)/i);
    if (match) {
      return `${match[1].padStart(3, '0')}`;
    }
    
    const numberMatch = title.match(/(\d+)/);
    if (numberMatch) {
      return `${numberMatch[1].padStart(3, '0')}`;
    }
    
    return 'UNKNOWN';
  }

  /**
   * Determine comment type based on response content
   */
  private determineCommentType(response: string): CommentType {
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('sugiro') || lowerResponse.includes('recomendo') || lowerResponse.includes('proposta')) {
      return CommentType.SUGGESTION;
    }
    
    if (lowerResponse.includes('apoio') || lowerResponse.includes('concordo') || lowerResponse.includes('excelente')) {
      return CommentType.SUPPORT;
    }
    
    if (lowerResponse.includes('problema') || lowerResponse.includes('preocupa') || lowerResponse.includes('risco')) {
      return CommentType.OBJECTION;
    }
    
    if (lowerResponse.includes('?') || lowerResponse.includes('esclarec') || lowerResponse.includes('dúvida')) {
      return CommentType.QUESTION;
    }
    
    return CommentType.COMMENT;
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get available models
   */
  getAvailableModels(): ModelProvider[] {
    return this.modelProviders;
  }

  /**
   * Check if model is available
   */
  isModelAvailable(modelId: string): boolean {
    return this.modelProviders.some(m => m.id === modelId);
  }
}
