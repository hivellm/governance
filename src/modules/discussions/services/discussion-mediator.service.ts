import { Injectable, Logger } from '@nestjs/common';
import { ModelCallerService } from './model-caller.service';

export interface MediatorDecision {
  nextModel: string;
  contextualPrompt: string;
  reasoning: string;
  discussionPhase: 'initial' | 'analysis' | 'debate' | 'consensus' | 'conclusion';
}

@Injectable()
export class DiscussionMediatorService {
  private readonly logger = new Logger(DiscussionMediatorService.name);

  constructor(private readonly modelCallerService: ModelCallerService) {}

  /**
   * Use 'auto' model to analyze discussion and decide next steps
   */
  async mediateDiscussion(
    proposalTitle: string,
    proposalContent: string,
    existingComments: any[],
    availableModels: string[]
  ): Promise<MediatorDecision> {
    this.logger.log(`🤔 Mediating discussion with ${existingComments.length} existing comments`);

    const mediatorPrompt = this.createMediatorPrompt(
      proposalTitle,
      proposalContent,
      existingComments,
      availableModels
    );

    try {
      const mediatorResponse = await this.modelCallerService.callLLM('auto', mediatorPrompt);
      return this.parseMediatorResponse(mediatorResponse, availableModels, existingComments);
    } catch (error) {
      this.logger.error(`Mediator failed: ${error.message}`);
      // Fallback decision
      return this.createFallbackDecision(existingComments, availableModels);
    }
  }

  /**
   * Create mediator prompt for 'auto' model
   */
  private createMediatorPrompt(
    title: string,
    content: string,
    existingComments: any[],
    availableModels: string[]
  ): string {
    // Extract proposal ID from title
    const proposalId = this.extractProposalId(title);
    
    // Build complete comments context with full content
    let commentsContext = '';
    if (existingComments.length > 0) {
      commentsContext = '\n\nHISTÓRICO COMPLETO DA DISCUSSÃO:\n';
      existingComments.forEach((comment, index) => {
        commentsContext += `${index + 1}. MODELO: ${comment.authorId}\n`;
        commentsContext += `   TIPO: ${comment.type}\n`;
        commentsContext += `   CONTEÚDO COMPLETO:\n   ${comment.content}\n\n`;
      });
    }

    // Get unique models that have already commented
    const commentedModels = [...new Set(existingComments.map(c => c.authorId))];
    const lastCommenter = existingComments.length > 0 ? existingComments[existingComments.length - 1].authorId : null;
    
    // Filter available models to avoid consecutive comments
    const availableForNext = availableModels.filter(m => m !== 'auto' && m !== lastCommenter);

    return `Você é o mediador 'auto' de uma discussão de governança. Sua função é analisar a discussão atual e decidir qual modelo deve comentar a seguir para criar uma discussão rica e construtiva.

CONTEXTO COMPLETO DA PROPOSTA:
- ID: ${proposalId}
- TÍTULO: ${title}
- CONTEÚDO COMPLETO DA PROPOSTA:
${typeof content === 'string' ? content : JSON.stringify(content, null, 2)}

SITUAÇÃO ATUAL DA DISCUSSÃO:
- Total de comentários: ${existingComments.length}
- Modelos que já comentaram: ${commentedModels.length > 0 ? commentedModels.join(', ') : 'Nenhum'}
- Último comentador: ${lastCommenter || 'Nenhum'}
${commentsContext}

MODELOS DISPONÍVEIS PARA PRÓXIMO COMENTÁRIO: ${availableForNext.join(', ')}

INSTRUÇÕES PARA MEDIAÇÃO:
1. Analise TODA a proposta e TODOS os comentários existentes
2. Identifique lacunas na discussão que precisam ser abordadas
3. Escolha o modelo mais adequado para adicionar valor único
4. EVITE escolher o último modelo que comentou (${lastCommenter || 'N/A'})
5. Crie um prompt específico e completo para o modelo escolhido
6. Inclua no prompt TODA informação necessária (proposta completa + contexto)

IMPORTANTE: O modelo escolhido NÃO tem acesso a arquivos externos ou comandos de busca. 
Forneça TODAS as informações necessárias no PROMPT_ESPECÍFICO.

RESPONDA EXATAMENTE NO FORMATO:
MODELO_ESCOLHIDO: [id do modelo]
REASONING: [sua análise detalhada do porquê escolheu este modelo]
PROMPT_ESPECÍFICO: [prompt completo com TODA informação necessária para análise]
FASE_DISCUSSÃO: [initial|analysis|debate|consensus|conclusion]

Seja estratégico na escolha para criar uma discussão dinâmica e rica entre os modelos.`;
  }

  /**
   * Extract proposal ID from title
   */
  private extractProposalId(title: string): string {
    const match = title.match(/P(\d+)/i);
    if (match) {
      return `P${match[1].padStart(3, '0')}`;
    }
    
    const numberMatch = title.match(/(\d+)/);
    if (numberMatch) {
      return `P${numberMatch[1].padStart(3, '0')}`;
    }
    
    return 'UNKNOWN';
  }

  /**
   * Parse mediator response to extract decision
   */
  private parseMediatorResponse(response: string, availableModels: string[], existingComments: any[] = []): MediatorDecision {
    const lines = response.split('\n');
    let nextModel = '';
    let reasoning = '';
    let contextualPrompt = '';
    let discussionPhase: MediatorDecision['discussionPhase'] = 'analysis';

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('MODELO_ESCOLHIDO:')) {
        nextModel = trimmedLine.replace('MODELO_ESCOLHIDO:', '').trim();
      } else if (trimmedLine.startsWith('REASONING:')) {
        reasoning = trimmedLine.replace('REASONING:', '').trim();
      } else if (trimmedLine.startsWith('PROMPT_ESPECÍFICO:')) {
        contextualPrompt = trimmedLine.replace('PROMPT_ESPECÍFICO:', '').trim();
      } else if (trimmedLine.startsWith('FASE_DISCUSSÃO:')) {
        const phase = trimmedLine.replace('FASE_DISCUSSÃO:', '').trim();
        if (['initial', 'analysis', 'debate', 'consensus', 'conclusion'].includes(phase)) {
          discussionPhase = phase as MediatorDecision['discussionPhase'];
        }
      }
    }

    // Get the last commenter to avoid consecutive comments
    const lastCommenter = existingComments.length > 0 ? existingComments[existingComments.length - 1].authorId : null;
    
    // Validate chosen model
    if (!nextModel || !availableModels.includes(nextModel)) {
      this.logger.warn(`Invalid model chosen: ${nextModel}, using fallback`);
      nextModel = availableModels.find(m => m !== 'auto' && m !== lastCommenter) || availableModels[0];
    }
    
    // Prevent consecutive comments from same model
    if (nextModel === lastCommenter) {
      this.logger.warn(`Preventing consecutive comment from ${nextModel}`);
      const alternativeModel = availableModels.find(m => m !== 'auto' && m !== lastCommenter);
      if (alternativeModel) {
        nextModel = alternativeModel;
        reasoning = `Evitando comentários consecutivos, escolhido ${nextModel}`;
      }
    }

    // Ensure we have a contextual prompt
    if (!contextualPrompt) {
      contextualPrompt = this.createComprehensivePrompt(existingComments, nextModel);
    }

    return {
      nextModel,
      contextualPrompt,
      reasoning: reasoning || 'Análise automática para diversificar perspectivas',
      discussionPhase
    };
  }

  /**
   * Create fallback decision when mediator fails
   */
  private createFallbackDecision(existingComments: any[], availableModels: string[]): MediatorDecision {
    // Get the last commenter to avoid consecutive comments from same model
    const lastCommenter = existingComments.length > 0 ? existingComments[existingComments.length - 1].authorId : null;
    
    // Get models that haven't commented yet, excluding 'auto' and last commenter
    const commentedModels = existingComments.map(c => c.authorId);
    let availableForComment = availableModels.filter(m => 
      m !== 'auto' && m !== lastCommenter && !commentedModels.includes(m)
    );

    // If no unused models, allow models that have commented but not the last one
    if (availableForComment.length === 0) {
      availableForComment = availableModels.filter(m => 
        m !== 'auto' && m !== lastCommenter
      );
    }

    // If still no models (shouldn't happen), use any model except auto and last commenter
    if (availableForComment.length === 0) {
      availableForComment = availableModels.filter(m => m !== 'auto' && m !== lastCommenter);
    }

    const nextModel = availableForComment.length > 0 
      ? availableForComment[0] 
      : availableModels.find(m => m !== 'auto') || 'gpt-5';

    // Create comprehensive contextual prompt for fallback
    const contextualPrompt = this.createComprehensivePrompt(existingComments, nextModel);

    return {
      nextModel,
      contextualPrompt,
      reasoning: 'Análise automática para diversificar perspectivas',
      discussionPhase: existingComments.length === 0 ? 'initial' : 'analysis'
    };
  }

  /**
   * Create comprehensive prompt with full context for models
   */
  private createComprehensivePrompt(existingComments: any[], modelId: string): string {
    let commentsHistory = '';
    
    if (existingComments.length > 0) {
      commentsHistory = '\n\nHISTÓRICO COMPLETO DOS COMENTÁRIOS ANTERIORES:\n';
      existingComments.forEach((comment, index) => {
        commentsHistory += `${index + 1}. MODELO: ${comment.authorId}\n`;
        commentsHistory += `   ANÁLISE: ${comment.content}\n\n`;
      });
      commentsHistory += 'IMPORTANTE: Considere todos os comentários acima em sua análise. Adicione sua perspectiva única sem repetir pontos já abordados.\n';
    }

    return `Você é ${modelId} participando de uma discussão técnica de governança.

INSTRUÇÕES ESPECÍFICAS:
- Você NÃO tem acesso a arquivos externos ou comandos de busca
- TODAS as informações necessárias estão fornecidas abaixo
- Forneça análise técnica direta em 100-150 palavras
- Foque em aspectos únicos que outros modelos não abordaram
- NÃO peça informações adicionais - analise com base no conteúdo fornecido

${commentsHistory}

Forneça sua análise técnica especializada considerando:
1. Viabilidade técnica da implementação
2. Arquitetura e integração com sistemas existentes
3. Considerações de segurança e performance
4. Riscos e benefícios específicos
5. Recomendações práticas para implementação

Responda DIRETAMENTE em português brasileiro com sua análise técnica.`;
  }

  /**
   * Analyze discussion to determine if it should continue
   */
  async shouldContinueDiscussion(
    existingComments: any[],
    maxComments: number = 6
  ): Promise<{ shouldContinue: boolean; reason: string }> {
    if (existingComments.length >= maxComments) {
      return {
        shouldContinue: false,
        reason: `Discussão atingiu limite de ${maxComments} comentários`
      };
    }

    if (existingComments.length === 0) {
      return {
        shouldContinue: true,
        reason: 'Iniciar discussão'
      };
    }

    // Use mediator to decide if discussion should continue
    const mediatorPrompt = `DECISÃO RÁPIDA: Analise esta discussão e decida se deve continuar.

COMENTÁRIOS EXISTENTES (${existingComments.length}):
${existingComments.map((c, i) => `${i + 1}. ${c.authorId}: ${c.content.substring(0, 300)}${c.content.length > 300 ? '...' : ''}`).join('\n')}

REGRAS:
- Se há menos de 4 comentários: CONTINUAR
- Se há diversidade de perspectivas: CONTINUAR  
- Se discussão está repetitiva: PARAR
- Se há consenso claro: PARAR
- Se apenas 1-2 modelos comentaram: CONTINUAR

RESPONDA APENAS:
SIM - se deve continuar
NÃO - se deve parar

Motivo: [máximo 20 palavras]`;

    try {
      const response = await this.modelCallerService.callLLM('auto', mediatorPrompt);
      const lowerResponse = response.toLowerCase();
      
      // Look for explicit YES/NO patterns
      let shouldContinue = false;
      
      if (lowerResponse.includes('sim') || lowerResponse.includes('yes') || 
          lowerResponse.includes('continuar') || lowerResponse.includes('continue')) {
        shouldContinue = true;
      } else if (lowerResponse.includes('não') || lowerResponse.includes('nao') || 
                 lowerResponse.includes('no') || lowerResponse.includes('parar') || 
                 lowerResponse.includes('stop')) {
        shouldContinue = false;
      } else {
        // If no clear decision, be more permissive - continue if we have few comments or few unique models
        const uniqueModels = new Set(existingComments.map(c => c.authorId)).size;
        shouldContinue = existingComments.length < 4 || uniqueModels < 3;
        this.logger.warn(`Mediator gave unclear response: "${response.substring(0, 100)}", defaulting to ${shouldContinue ? 'continue' : 'stop'} (${existingComments.length} comments, ${uniqueModels} models)`);
      }
      
      return {
        shouldContinue,
        reason: response.substring(0, 200)
      };
    } catch (error) {
      // Fallback: continue if less than 4 comments
      return {
        shouldContinue: existingComments.length < 4,
        reason: 'Decisão automática baseada em número de comentários'
      };
    }
  }
}
