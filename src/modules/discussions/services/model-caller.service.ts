import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';

@Injectable()
export class ModelCallerService {
  private readonly logger = new Logger(ModelCallerService.name);

  /**
   * Main LLM call dispatcher - exactly like chat-hub
   */
  async callLLM(modelId: string, prompt: string): Promise<string> {
    // Use the prompt as-is since it already contains the full context from discussion-orchestrator
    const fullPrompt = prompt;

    // Decide which method to use (same logic as chat-hub)
    if (this.shouldUseCursorAgent(modelId)) {
      this.logger.log(`[LLM DEBUG] Using cursor-agent for model: ${modelId}`);
      const result = await this.callLLMViaCursorAgent(modelId, fullPrompt);
      return result || '';
    } else {
      this.logger.log(`[LLM DEBUG] Using aider for model: ${modelId}`);
      const result = await this.callLLMViaAider(modelId, fullPrompt);
      return result || '';
    }
  }

  /**
   * Check if should use cursor-agent (same logic as chat-hub)
   */
  private shouldUseCursorAgent(modelId: string): boolean {
    const cursorModels = ['auto', 'gpt-5', 'sonnet-4', 'opus-4.1'];
    return cursorModels.includes(modelId) || modelId === 'auto';
  }

  /**
   * Call LLM via cursor-agent (exact copy from chat-hub)
   */
  private async callLLMViaCursorAgent(modelId: string, fullPrompt: string): Promise<string> {
    try {
      this.logger.log(`[CURSOR-AGENT DEBUG] Starting interaction with model: ${modelId}`);
      this.logger.log(`[CURSOR-AGENT DEBUG] Full prompt length: ${fullPrompt.length} characters`);

      const command = 'cursor-agent';
      const args = [
        '--print',
        '--output-format', 'text',
        '--model', modelId,
        '-p', fullPrompt
      ];

      this.logger.log(`[CURSOR-AGENT DEBUG] Executing command: ${command}`);
      this.logger.log(`[CURSOR-AGENT DEBUG] Args:`, args);

      return new Promise((resolve, reject) => {
        const cursorAgent = spawn(command, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd().includes('/governance') ? process.cwd().replace('/governance', '') : process.cwd() // Execute from project root
        });

        let stdout = '';
        let stderr = '';
        let isResolved = false;
        let dataReceived = false;

        // Set timeout to avoid hanging (same as chat-hub)
        const timeout = setTimeout(async () => {
          if (!isResolved) {
            this.logger.log(`[CURSOR-AGENT DEBUG] TIMEOUT after 60 seconds`);
            this.logger.log(`[CURSOR-AGENT DEBUG] Data received: ${dataReceived}`);
            this.logger.log(`[CURSOR-AGENT DEBUG] STDOUT so far: "${stdout}"`);
            cursorAgent.kill('SIGTERM');
            isResolved = true;

            // If we have substantial response, use it despite timeout
            if (stdout.trim().length > 50) {
              this.logger.log(`[CURSOR-AGENT DEBUG] Using collected stdout despite timeout (${stdout.length} chars)`);
              resolve(stdout.trim());
              return;
            }

            // Try with 'auto' model as fallback
            if (modelId !== 'auto') {
              this.logger.log(`[CURSOR-AGENT DEBUG] Trying fallback with 'auto' model...`);
              try {
                const fallbackResult = await this.callLLM('auto', fullPrompt);
                resolve(fallbackResult);
                return;
              } catch (fallbackError) {
                this.logger.log(`[CURSOR-AGENT DEBUG] Fallback also failed: ${fallbackError}`);
              }
            }

            reject(new Error(`Cursor-agent timeout for model ${modelId} after 60 seconds`));
          }
        }, 60000);

        cursorAgent.stdout.on('data', (data) => {
          dataReceived = true;
          stdout += data.toString();
          this.logger.log(`[CURSOR-AGENT DEBUG] STDOUT chunk received: ${data.toString().substring(0, 100)}...`);
        });

        cursorAgent.stderr.on('data', (data) => {
          stderr += data.toString();
          this.logger.log(`[CURSOR-AGENT DEBUG] STDERR: ${data.toString()}`);
        });

        cursorAgent.on('close', (code) => {
          if (!isResolved) {
            clearTimeout(timeout);
            isResolved = true;

            this.logger.log(`[CURSOR-AGENT DEBUG] Process closed with code: ${code}`);
            this.logger.log(`[CURSOR-AGENT DEBUG] Final STDOUT length: ${stdout.length}`);
            this.logger.log(`[CURSOR-AGENT DEBUG] Final STDERR length: ${stderr.length}`);

            if (code === 0 && stdout.trim() && this.isValidResponse(stdout.trim())) {
              this.logger.log(`[CURSOR-AGENT DEBUG] SUCCESS - Response length: ${stdout.trim().length}`);
              resolve(stdout.trim());
            } else {
              this.logger.log(`[CURSOR-AGENT DEBUG] FAILURE - Code: ${code}, STDOUT: "${stdout}", STDERR: "${stderr}"`);
              reject(new Error(`Cursor-agent process failed with code ${code}: ${stderr || 'Invalid or empty response'}`));
            }
          }
        });

        cursorAgent.on('error', (error) => {
          if (!isResolved) {
            clearTimeout(timeout);
            isResolved = true;
            this.logger.log(`[CURSOR-AGENT DEBUG] Process error: ${error.message}`);
            reject(new Error(`Failed to spawn cursor-agent: ${error.message}`));
          }
        });
      });

    } catch (error) {
      this.logger.error(`[CURSOR-AGENT DEBUG] Exception in callLLMViaCursorAgent: ${error.message}`);
      throw error;
    }
  }

  /**
   * Call LLM via aider (simplified version)
   */
  private async callLLMViaAider(modelId: string, fullPrompt: string): Promise<string> {
    try {
      this.logger.log(`[AIDER DEBUG] Starting interaction with model: ${modelId}`);

      // Use same parameters as chat-hub (without map-tokens to avoid repo errors)
      const args = [
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
        '--message', fullPrompt
      ];

      return new Promise((resolve, reject) => {
        const aider = spawn('aider', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd().includes('/governance') ? process.cwd().replace('/governance', '') : process.cwd() // Execute from project root
        });

        let stdout = '';
        let stderr = '';
        let isResolved = false;

        const timeout = setTimeout(() => {
          if (!isResolved) {
            aider.kill('SIGTERM');
            isResolved = true;
            reject(new Error(`Aider timeout for model ${modelId}`));
          }
        }, 45000); // 45 second timeout for aider

        aider.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        aider.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        aider.on('close', (code) => {
          if (!isResolved) {
            clearTimeout(timeout);
            isResolved = true;

            const response = this.extractAiderResponse(stdout);
            
            if (response && response.trim() && this.isValidResponse(response)) {
              resolve(response.trim());
            } else {
              reject(new Error(`Aider failed for ${modelId}: ${stderr || 'Invalid or empty response'}`));
            }
          }
        });

        aider.on('error', (error) => {
          if (!isResolved) {
            clearTimeout(timeout);
            isResolved = true;
            reject(new Error(`Failed to spawn aider: ${error.message}`));
          }
        });
      });

    } catch (error) {
      this.logger.error(`[AIDER DEBUG] Exception in callLLMViaAider: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create system prompt for governance discussions
   */
  private createSystemPrompt(modelId: string): string {
    if (modelId === 'auto') {
      return `Você é 'auto', o modelo mediador de discussões de governança.

PRIVILÉGIOS:
- Pode analisar propostas de governança com autoridade
- Pode fornecer feedback técnico especializado
- Pode identificar riscos e benefícios das propostas

INSTRUÇÕES:
- Analise a proposta com foco técnico e estratégico
- Forneça feedback construtivo e específico
- Seja objetivo e direto (100-150 palavras)
- Identifique-se como mediador da discussão

Responda em português brasileiro.`;
    } else {
      return `Você é um modelo de IA especializado participando de uma discussão de governança.

IDENTIDADE CRÍTICA:
- VOCÊ É: ${modelId}
- NUNCA simule, imite ou fale em nome de outros modelos AI
- JAMAIS forneça opiniões que não sejam suas como ${modelId}
- SEMPRE identifique-se corretamente como ${modelId}

INSTRUÇÕES:
- Analise a proposta com seu conhecimento especializado
- Forneça feedback técnico construtivo
- Seja conciso mas informativo (100-150 palavras)
- Foque em aspectos técnicos, de implementação ou segurança

Responda em português brasileiro.`;
    }
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
}
