import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DiscussionsService } from '../discussions.service';
import { ProposalsService } from '../../proposals/proposals.service';
import { AgentsService } from '../../agents/agents.service';
import { AIOrchestrationService } from './ai-orchestration.service';
import { ModelCallerService } from './model-caller.service';
import { DiscussionMediatorService } from './discussion-mediator.service';
import { IDiscussion } from '../interfaces/discussion.interface';
import { AgentRole } from '../../agents/interfaces/agent.interface';

@Injectable()
export class DiscussionOrchestratorService {
  private readonly logger = new Logger(DiscussionOrchestratorService.name);

  constructor(
    private readonly discussionsService: DiscussionsService,
    private readonly proposalsService: ProposalsService,
    private readonly agentsService: AgentsService,
    private readonly aiOrchestrationService: AIOrchestrationService,
    private readonly modelCallerService: ModelCallerService,
    private readonly discussionMediator: DiscussionMediatorService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Listen for discussion creation events and trigger AI orchestration
   */
  @OnEvent('discussion.created')
  async handleDiscussionCreated(discussion: IDiscussion) {
    this.logger.log(`🎭 Auto-orchestrating discussion: ${discussion.id}`);

    try {
      // Get proposal details
      const proposal = await this.proposalsService.findById(discussion.proposalId);
      
      // Extract content for analysis
      const content = this.extractProposalContent(proposal.content);
      
      this.logger.log(`📝 Proposal content extracted: ${content.substring(0, 100)}...`);
      
      // Start AI orchestration immediately (blocking for testing)
      await this.orchestrateAIComments(discussion.id, proposal.title, content);
        
    } catch (error) {
      this.logger.error(`Error handling discussion creation for ${discussion.id}: ${error.message}`);
    }
  }

  /**
   * Orchestrate AI models to comment on discussion
   */
  private async orchestrateAIComments(
    discussionId: string, 
    proposalTitle: string, 
    proposalContent: string
  ): Promise<void> {
    this.logger.log(`🤖 Starting AI orchestration for discussion: ${discussionId}`);

    try {
      // Wait a bit for discussion to be fully created
      await this.delay(2000);
      
      // Get available models
      const availableModels = this.aiOrchestrationService.getAvailableModels();
      
      // Select diverse models from different providers for richer discussion
      const selectedModels = this.selectDiverseModelsForDiscussion(availableModels, 8);
      
      this.logger.log(`🎯 Selected ${selectedModels.length} models: ${selectedModels.map(m => m.id).join(', ')}`);

      // Use mediator-driven discussion for dynamic interaction
      const successfulComments = [];
      const maxRounds = 6; // Maximum discussion rounds
      const modelIds = selectedModels.map(m => m.id);
      
      for (let round = 0; round < maxRounds; round++) {
        try {
          this.logger.log(`🎭 Discussion Round ${round + 1}/${maxRounds}`);
          
          // Get current comments for context
          const existingComments = await this.discussionsService.getDiscussionComments(discussionId);
          
          // Check if discussion should continue
          const continuationDecision = await this.discussionMediator.shouldContinueDiscussion(
            existingComments, 
            maxRounds
          );
          
          if (!continuationDecision.shouldContinue) {
            this.logger.log(`🏁 Discussion concluded: ${continuationDecision.reason}`);
            break;
          }
          
          // Check discussion timeout
          const discussion = await this.discussionsService.getDiscussion(discussionId);
          if (discussion.timeoutAt && new Date() > discussion.timeoutAt) {
            this.logger.log(`⏰ Discussion timeout reached, concluding discussion`);
            break;
          }

          // Use mediator to decide next model and context
          const mediatorDecision = await this.discussionMediator.mediateDiscussion(
            proposalTitle,
            proposalContent,
            existingComments,
            modelIds
          );
          
          this.logger.log(`🤔 Mediator chose: ${mediatorDecision.nextModel} (${mediatorDecision.reasoning})`);
          
          // Check if chosen model has exceeded comment limit
          const modelCommentCount = existingComments.filter(c => c.authorId === mediatorDecision.nextModel).length;
          const maxCommentsPerAgent = discussion.settings?.maxCommentsPerAgent || 10;
          
          if (modelCommentCount >= maxCommentsPerAgent) {
            this.logger.log(`🚫 Model ${mediatorDecision.nextModel} has reached comment limit (${modelCommentCount}/${maxCommentsPerAgent})`);
            // Ask mediator to choose a different model
            const alternativeModels = modelIds.filter(id => {
              const count = existingComments.filter(c => c.authorId === id).length;
              return count < maxCommentsPerAgent;
            });
            
            if (alternativeModels.length === 0) {
              this.logger.log(`🏁 All models have reached comment limits, concluding discussion`);
              break;
            }
            
            continue; // Skip this round and let mediator choose again
          }
          
          // Find the model object
          const chosenModel = selectedModels.find(m => m.id === mediatorDecision.nextModel);
          if (!chosenModel) {
            this.logger.warn(`Model ${mediatorDecision.nextModel} not found, skipping round`);
            continue;
          }
          
          // Generate comment with mediator's contextual prompt
          const comment = await this.generateMediatedComment(
            chosenModel,
            discussionId,
            mediatorDecision.contextualPrompt,
            existingComments
          );
          
          if (comment) {
            successfulComments.push(comment);
            this.logger.log(`✅ Round ${round + 1} complete: ${chosenModel.id} commented (${mediatorDecision.discussionPhase})`);
            
            // Wait between rounds for processing
            if (round < maxRounds - 1) {
              await this.delay(8000); // 8 second delay between mediated rounds
            }
          }
          
        } catch (error) {
          this.logger.error(`Failed in discussion round ${round + 1}: ${error.message}`);
        }
      }

      this.logger.log(`✅ AI Orchestration complete: ${successfulComments.length}/${selectedModels.length} comments generated`);
      
      // Emit completion event
      this.eventEmitter.emit('discussion.ai.orchestration.complete', {
        discussionId,
        totalModels: selectedModels.length,
        successfulComments,
        models: selectedModels.map(m => m.id)
      });

    } catch (error) {
      this.logger.error(`AI orchestration failed for discussion ${discussionId}: ${error.message}`);
    }
  }

  /**
   * Generate mediated comment using mediator's specific prompt
   */
  private async generateMediatedComment(
    model: any,
    discussionId: string,
    contextualPrompt: string,
    existingComments: any[]
  ): Promise<any> {
    this.logger.debug(`💭 Generating mediated comment from ${model.id}...`);

    try {
      // Ensure model is registered as agent
      await this.ensureModelAgentExists(model);

      // Use the mediator's contextual prompt directly
      const response = await this.callModel(model, contextualPrompt);
      
      if (!response || response.trim().length < 20) {
        throw new Error('Response too short or empty');
      }

      // Determine comment type
      const commentType = this.determineCommentType(response);
      
      // Add comment to discussion
      const comment = await this.discussionsService.addComment({
        discussionId,
        authorId: model.id,
        type: commentType,
        content: response.trim(),
        metadata: {
          generatedBy: 'mediated-orchestration',
          modelProvider: model.provider,
          modelName: model.name,
          generatedAt: new Date().toISOString(),
          orchestrationId: `mediated-${discussionId}-${Date.now()}`,
          mediatedResponse: true,
          previousComments: existingComments.length
        }
      });

      this.logger.log(`✅ Mediated comment added from ${model.id}: ${commentType} (${response.length} chars)`);
      return comment;

    } catch (error) {
      this.logger.error(`Failed to generate mediated comment from ${model.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate and add comment from a specific model (legacy method)
   */
  private async generateAndAddComment(
    model: any,
    discussionId: string,
    proposalTitle: string,
    proposalContent: string,
    existingComments: any[] = []
  ): Promise<any> {
    this.logger.debug(`💭 Generating comment from ${model.id}...`);

    try {
      // Ensure model is registered as agent
      await this.ensureModelAgentExists(model);

      // Create model-specific prompt with existing comments context
      const prompt = this.createModelPrompt(model, proposalTitle, proposalContent, existingComments);
      
      // Get response from model
      const response = await this.callModel(model, prompt);
      
      if (!response || response.trim().length < 20) {
        throw new Error('Response too short or empty');
      }

      // Determine comment type
      const commentType = this.determineCommentType(response);
      
      // Add comment to discussion
      const comment = await this.discussionsService.addComment({
        discussionId,
        authorId: model.id,
        type: commentType,
        content: response.trim(),
        metadata: {
          generatedBy: 'ai-orchestration',
          modelProvider: model.provider,
          modelName: model.name,
          generatedAt: new Date().toISOString(),
          orchestrationId: `orch-${discussionId}-${Date.now()}`
        }
      });

      this.logger.log(`✅ Comment added from ${model.id}: ${commentType} (${response.length} chars)`);
      return comment;

    } catch (error) {
      this.logger.error(`Failed to generate comment from ${model.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure model is registered as agent
   */
  private async ensureModelAgentExists(model: any): Promise<void> {
    try {
      // Try to find existing agent
      await this.agentsService.findById(model.id);
      this.logger.debug(`Agent ${model.id} already exists`);
    } catch (error) {
      // Agent doesn't exist, create it
      this.logger.log(`Creating agent for model: ${model.id}`);
      
      try {
        await this.agentsService.createAgent({
          id: model.id,
          name: model.name,
          organization: model.provider === 'cursor-agent' ? 'Cursor' : this.getProviderOrganization(model.id),
          roles: [AgentRole.DISCUSSANT, AgentRole.REVIEWER],
          initialPermissions: {
            canDiscuss: true,
            canReview: true,
            canVote: false,
            canPropose: false
          }
        });
        
        this.logger.log(`✅ Agent created for model: ${model.id}`);
      } catch (createError) {
        this.logger.warn(`Failed to create agent for ${model.id}: ${createError.message}`);
        // Continue anyway - might be a race condition
      }
    }
  }

  /**
   * Get organization name from model ID
   */
  private getProviderOrganization(modelId: string): string {
    if (modelId.startsWith('openai/')) return 'OpenAI';
    if (modelId.startsWith('anthropic/')) return 'Anthropic';
    if (modelId.startsWith('gemini/')) return 'Google';
    if (modelId.startsWith('xai/')) return 'xAI';
    if (modelId.startsWith('deepseek/')) return 'DeepSeek';
    if (modelId.startsWith('groq/')) return 'Groq';
    return 'Unknown';
  }

  /**
   * Call model via ModelCallerService (same as chat-hub)
   */
  private async callModel(model: any, prompt: string): Promise<string> {
    return this.modelCallerService.callLLM(model.id, prompt);
  }

  /**
   * Call cursor-agent with fallback to demo responses
   */
  private async callCursorAgent(modelId: string, prompt: string): Promise<string> {
    try {
      // First try to check if cursor-agent is available
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('which cursor-agent', (error) => {
          if (error) reject(new Error('cursor-agent not found'));
          else resolve(true);
        });
      });

      // If available, use real cursor-agent
      return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        
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
          reject(new Error(`Cursor-agent timeout for ${modelId}`));
        }, 60000); // Increased timeout to 60s

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
            reject(new Error(`Cursor-agent failed: ${errorOutput || 'Invalid or empty response'}`));
          }
        });

        cursorAgent.on('error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Failed to spawn cursor-agent: ${error.message}`));
        });
      });

    } catch (error) {
      // Fallback to demo responses for development/testing
      this.logger.warn(`Cursor-agent not available for ${modelId}, using demo response: ${error.message}`);
      return this.generateDemoResponse(modelId, prompt);
    }
  }

  /**
   * Call aider model
   */
  private async callAiderModel(modelId: string, prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      // Use same parameters as chat-hub (without map-tokens to avoid repo errors)
      const aider = spawn('aider', [
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
      ], {
        cwd: process.cwd().includes('/governance') ? process.cwd().replace('/governance', '') : process.cwd() // Execute from project root
      });

      let output = '';
      let errorOutput = '';

      const timeout = setTimeout(() => {
        aider.kill();
        reject(new Error(`Aider timeout for ${modelId}`));
      }, 30000);

      aider.stdout.on('data', (data) => {
        output += data.toString();
      });

      aider.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      aider.on('close', (code) => {
        clearTimeout(timeout);
        
        const response = this.extractAiderResponse(output);
        
        if (response && response.trim() && this.isValidResponse(response)) {
          resolve(response.trim());
        } else {
          reject(new Error(`Aider failed: ${errorOutput || 'Invalid or empty response'}`));
        }
      });
    });
  }

  // Helper methods
  private extractProposalContent(content: any): string {
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null) {
      // Build comprehensive content from structured proposal
      let fullContent = '';
      
      if (content.abstract) {
        fullContent += `ABSTRACT:\n${content.abstract}\n\n`;
      }
      
      if (content.motivation) {
        fullContent += `MOTIVATION:\n${content.motivation}\n\n`;
      }
      
      if (content.specification) {
        fullContent += `SPECIFICATION:\n${content.specification}\n\n`;
      }
      
      if (content.implementation) {
        fullContent += `IMPLEMENTATION:\n${content.implementation}\n\n`;
      }
      
      if (content.rationale) {
        fullContent += `RATIONALE:\n${content.rationale}\n\n`;
      }
      
      if (content.backwards_compatibility) {
        fullContent += `BACKWARDS COMPATIBILITY:\n${content.backwards_compatibility}\n\n`;
      }
      
      if (content.security_considerations) {
        fullContent += `SECURITY CONSIDERATIONS:\n${content.security_considerations}\n\n`;
      }
      
      // Fallback to content field or JSON
      if (!fullContent && content.content) {
        fullContent = content.content;
      }
      
      return fullContent.trim() || JSON.stringify(content, null, 2);
    }
    return JSON.stringify(content);
  }

  private createModelPrompt(model: any, title: string, content: string, existingComments: any[] = []): string {
    let commentContext = '';
    
    if (existingComments.length > 0) {
      commentContext = '\n\nCOMENTÁRIOS ANTERIORES NA DISCUSSÃO:\n';
      existingComments.forEach((comment, index) => {
        commentContext += `${index + 1}. ${comment.authorId} (${comment.type}): ${comment.content.substring(0, 200)}${comment.content.length > 200 ? '...' : ''}\n\n`;
      });
      commentContext += 'IMPORTANTE: Considere os comentários acima em sua análise. Você pode concordar, discordar, ou adicionar perspectivas complementares.\n';
    }

    return `ANÁLISE DE GOVERNANÇA - NÃO É SESSÃO DE CÓDIGO

Você é ${model.name} (${model.id}) participando de uma discussão de governança do projeto HiveLLM.

IMPORTANTE: Esta é uma análise de proposta de governança, não uma sessão de edição de código. Não peça para adicionar arquivos ao chat. Analise diretamente o conteúdo fornecido abaixo.

CONTEXTO DO PROJETO:
O HiveLLM é um sistema de governança distribuída que utiliza múltiplos modelos de IA para análise e tomada de decisões. O projeto inclui:
- Sistema de propostas (BIPs) com fases de discussão, votação e implementação
- Orquestração de modelos AI via cursor-agent e aider
- Interface web com Handlebars e NestJS backend
- Banco SQLite para persistência
- Integração com múltiplos provedores de LLM (OpenAI, Anthropic, Gemini, xAI, DeepSeek, Groq)

PROPOSTA EM ANÁLISE: ${title}

CONTEÚDO COMPLETO DA PROPOSTA:
${content}
${commentContext}

TAREFA ESPECÍFICA:
Forneça APENAS sua análise técnica desta proposta em até 150 palavras. ${existingComments.length > 0 ? 'Considere os comentários anteriores e adicione sua perspectiva única.' : 'Seja o primeiro a comentar com foco em viabilidade técnica.'} 

NÃO peça arquivos adicionais. NÃO mencione que precisa de mais informações. Analise com base no conteúdo fornecido.

Foque especificamente em:
- Viabilidade técnica da implementação
- Impacto na arquitetura atual do sistema
- Considerações de segurança e performance
- Compatibilidade com o ecossistema existente
- Riscos e benefícios da implementação

Responda DIRETAMENTE em português brasileiro de forma concisa e técnica.`;
  }

  private determineCommentType(response: string): any {
    const lower = response.toLowerCase();
    
    if (lower.includes('sugiro') || lower.includes('recomendo')) return 'suggestion';
    if (lower.includes('apoio') || lower.includes('concordo')) return 'support';
    if (lower.includes('problema') || lower.includes('preocupa')) return 'objection';
    if (lower.includes('?') || lower.includes('dúvida')) return 'question';
    
    return 'comment';
  }

  private selectDiverseModels(models: any[], count: number): any[] {
    // Always include auto (mediator)
    const selected = [models.find(m => m.id === 'auto')];
    
    // Add diverse models from different providers
    const providers = ['cursor-agent', 'aider'];
    const remaining = [];
    
    providers.forEach(provider => {
      const providerModels = models.filter(m => m.provider === provider && m.id !== 'auto');
      remaining.push(...providerModels.slice(0, Math.floor(count / 2)));
    });
    
    return [...selected, ...remaining.slice(0, count - 1)].filter(Boolean);
  }

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
      this.logger.log(`🧹 Cleaned Aider headers (removed ${contentStart} lines)`);
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
        this.logger.warn(`🚫 Filtered API error response: ${pattern}`);
        return false;
      }
    }

    // Check for JSON error responses
    try {
      const parsed = JSON.parse(response);
      if (parsed.error || parsed.type === 'error') {
        this.logger.warn(`🚫 Filtered JSON error response`);
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
      this.logger.warn(`🚫 Response doesn't contain valid analysis content`);
      return false;
    }

    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Select diverse models for discussion from different providers
   */
  private selectDiverseModelsForDiscussion(availableModels: any[], maxModels: number): any[] {
    const selected = [];
    
    // Always include auto as mediator (but it won't comment directly)
    const autoModel = availableModels.find(m => m.id === 'auto');
    
    // Separate models by provider
    const cursorModels = availableModels.filter(m => m.provider === 'cursor-agent' && m.id !== 'auto');
    const aiderModels = availableModels.filter(m => m.provider === 'aider');
    
    // Group aider models by provider for diversity
    const providerGroups = {
      openai: aiderModels.filter(m => m.id.startsWith('openai/')),
      anthropic: aiderModels.filter(m => m.id.startsWith('anthropic/')),
      gemini: aiderModels.filter(m => m.id.startsWith('gemini/')),
      xai: aiderModels.filter(m => m.id.startsWith('xai/')),
      deepseek: aiderModels.filter(m => m.id.startsWith('deepseek/')),
      groq: aiderModels.filter(m => m.id.startsWith('groq/'))
    };
    
    // Select 2-3 cursor models (more reliable)
    selected.push(...cursorModels.slice(0, 3));
    
    // Select 1 model from each provider for diversity
    Object.entries(providerGroups).forEach(([provider, models]) => {
      if (models.length > 0 && selected.length < maxModels) {
        // Pick a good model from each provider
        const preferredModels = {
          openai: models.find(m => m.id.includes('gpt-4o')) || models[0],
          anthropic: models.find(m => m.id.includes('claude-3-5-sonnet')) || models[0],
          gemini: models.find(m => m.id.includes('gemini-2.5')) || models[0],
          xai: models.find(m => m.id.includes('grok-3')) || models[0],
          deepseek: models.find(m => m.id.includes('deepseek-v3')) || models[0],
          groq: models.find(m => m.id.includes('llama-3.1-70b')) || models[0]
        };
        
        const chosenModel = preferredModels[provider as keyof typeof preferredModels];
        if (chosenModel) {
          selected.push(chosenModel);
        }
      }
    });
    
    // Shuffle for randomness but keep auto separate
    const shuffledSelected = selected.sort(() => Math.random() - 0.5);
    
    this.logger.log(`📊 Model selection breakdown:`);
    this.logger.log(`   Cursor-agent: ${shuffledSelected.filter(m => m.provider === 'cursor-agent').length}`);
    this.logger.log(`   Aider: ${shuffledSelected.filter(m => m.provider === 'aider').length}`);
    
    return shuffledSelected.slice(0, maxModels);
  }

  /**
   * Generate demo response when real models are not available
   */
  private generateDemoResponse(modelId: string, prompt: string): string {
    const demoResponses = {
      'auto': `Como mediador desta discussão, vejo que esta proposta tem mérito técnico significativo. A implementação parece viável e alinhada com os objetivos do sistema. Recomendo proceder com análise detalhada dos requisitos técnicos.`,
      
      'gpt-5': `Analisando esta proposta do ponto de vista de arquitetura de sistemas, identifico potencial para otimização significativa. A abordagem proposta é sólida, mas sugiro considerar aspectos de escalabilidade e performance. A implementação deve incluir métricas de monitoramento.`,
      
      'sonnet-4': `Esta proposta demonstra compreensão profunda dos desafios técnicos envolvidos. Apoio a implementação com algumas considerações: 1) Validação de entrada robusta, 2) Tratamento de erros abrangente, 3) Testes de integração completos. A proposta está bem fundamentada tecnicamente.`,
      
      'opus-4.1': `Do ponto de vista de segurança e governança, esta proposta apresenta benefícios claros para o ecossistema. Recomendo atenção especial aos aspectos de autenticação e autorização. A implementação deve seguir as melhores práticas de segurança estabelecidas no framework.`
    };

    const response = demoResponses[modelId] || `Como ${modelId}, analiso que esta proposta tem potencial técnico interessante. A implementação requer análise cuidadosa dos requisitos e dependências. Recomendo proceder com prototipagem inicial para validar a viabilidade técnica.`;
    
    this.logger.log(`🎭 Generated demo response for ${modelId}: ${response.substring(0, 50)}...`);
    return response;
  }
}
