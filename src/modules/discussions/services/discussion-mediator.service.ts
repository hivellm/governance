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
      return this.parseMediatorResponse(mediatorResponse, availableModels);
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
    let commentsContext = '';
    
    if (existingComments.length > 0) {
      commentsContext = '\n\nCOMENTÁRIOS EXISTENTES:\n';
      existingComments.forEach((comment, index) => {
        commentsContext += `${index + 1}. ${comment.authorId} (${comment.type}): ${comment.content}\n\n`;
      });
    }

    return `Você é o mediador 'auto' de uma discussão de governança. Sua função é analisar a discussão atual e decidir qual modelo deve comentar a seguir para criar uma discussão rica e construtiva.

PROPOSTA EM DISCUSSÃO:
Título: ${title}
Conteúdo: ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}
${commentsContext}

MODELOS DISPONÍVEIS: ${availableModels.join(', ')}

INSTRUÇÕES:
1. Analise os comentários existentes e identifique lacunas na discussão
2. Escolha o próximo modelo mais adequado para adicionar valor
3. Crie um prompt específico que incentive esse modelo a responder aos pontos levantados
4. Evite repetir modelos que já comentaram recentemente

RESPONDA NO FORMATO:
MODELO_ESCOLHIDO: [id do modelo]
REASONING: [sua análise do porquê escolheu este modelo]
PROMPT_ESPECÍFICO: [prompt direcionado para o modelo escolhido]
FASE_DISCUSSÃO: [initial|analysis|debate|consensus|conclusion]

Seja estratégico na escolha para criar uma discussão dinâmica entre os modelos.`;
  }

  /**
   * Parse mediator response to extract decision
   */
  private parseMediatorResponse(response: string, availableModels: string[]): MediatorDecision {
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

    // Validate chosen model
    if (!nextModel || !availableModels.includes(nextModel)) {
      this.logger.warn(`Invalid model chosen: ${nextModel}, using fallback`);
      nextModel = availableModels.find(m => m !== 'auto') || availableModels[0];
    }

    // Ensure we have a contextual prompt
    if (!contextualPrompt) {
      contextualPrompt = `Analise esta proposta e forneça sua perspectiva técnica especializada, considerando os comentários já feitos por outros modelos.`;
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
    // Get models that haven't commented yet
    const commentedModels = existingComments.map(c => c.authorId);
    const availableForComment = availableModels.filter(m => 
      m !== 'auto' && !commentedModels.includes(m)
    );

    const nextModel = availableForComment.length > 0 
      ? availableForComment[0] 
      : availableModels.find(m => m !== 'auto') || 'gpt-5';

    return {
      nextModel,
      contextualPrompt: 'Analise esta proposta e forneça sua perspectiva técnica, considerando os comentários anteriores.',
      reasoning: 'Seleção automática para continuar discussão',
      discussionPhase: existingComments.length === 0 ? 'initial' : 'analysis'
    };
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
- Se há menos de 3 comentários: CONTINUAR
- Se há diversidade de perspectivas: CONTINUAR  
- Se discussão está repetitiva: PARAR
- Se há consenso claro: PARAR

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
        // If no clear decision, be more permissive - continue if we have few comments
        shouldContinue = existingComments.length < 4;
        this.logger.warn(`Mediator gave unclear response: "${response.substring(0, 100)}", defaulting to ${shouldContinue ? 'continue' : 'stop'}`);
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
