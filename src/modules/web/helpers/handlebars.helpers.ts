export const handlebarsHelpers = {
  eq: (a: any, b: any) => a === b,
  ne: (a: any, b: any) => a !== b,
  gt: (a: number, b: number) => a > b,
  lt: (a: number, b: number) => a < b,
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  
  startsWith: (str: string, prefix: string) => str && str.startsWith(prefix),
  
  formatDate: (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  },
  
  formatPhase: (phase: string) => {
    const phases: Record<string, { text: string; class: string }> = {
      'proposal': { text: 'Proposal', class: 'bg-blue-900 text-blue-300' },
      'discussion': { text: 'Discussion', class: 'bg-yellow-900 text-yellow-300' },
      'revision': { text: 'Revision', class: 'bg-orange-900 text-orange-300' },
      'voting': { text: 'Voting', class: 'bg-purple-900 text-purple-300' },
      'resolution': { text: 'Resolution', class: 'bg-green-900 text-green-300' },
      'execution': { text: 'Execution', class: 'bg-indigo-900 text-indigo-300' }
    };
    return phases[phase] || { text: phase, class: 'bg-gray-800 text-gray-300' };
  },
  
  formatStatus: (status: string) => {
    const statuses: Record<string, { text: string; class: string }> = {
      'draft': { text: 'Draft', class: 'bg-gray-800 text-gray-300' },
      'discussion': { text: 'In Discussion', class: 'bg-yellow-900 text-yellow-300' },
      'voting': { text: 'Voting', class: 'bg-purple-900 text-purple-300' },
      'approved': { text: 'Approved', class: 'bg-green-900 text-green-300' },
      'rejected': { text: 'Rejected', class: 'bg-red-900 text-red-300' },
      'executed': { text: 'Executed', class: 'bg-blue-900 text-blue-300' }
    };
    return statuses[status] || { text: status, class: 'bg-gray-800 text-gray-300' };
  },
  
  truncate: (str: string, length: number = 100) => {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  },
  
  capitalize: (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  
  json: (obj: any) => JSON.stringify(obj, null, 2),
  
  times: (n: number, options: any) => {
    let result = '';
    for (let i = 0; i < n; i++) {
      result += options.fn(i);
    }
    return result;
  },

  substring: (str: string, start: number, end?: number) => {
    if (!str) return '';
    return end !== undefined ? str.substring(start, end) : str.substring(start);
  },

  round: (num: number) => Math.round(num),

  typeof: (obj: any) => typeof obj,

  isString: (obj: any) => typeof obj === 'string',

  isObject: (obj: any) => typeof obj === 'object' && obj !== null,

  safeContent: (content: any) => {
    if (!content) return 'No content available';
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
      // If it's a content object with structured content
      if (content.abstract && content.motivation && content.specification) {
        return `# Abstract\n\n${content.abstract}\n\n# Motivation\n\n${content.motivation}\n\n# Specification\n\n${content.specification}\n\n# Implementation\n\n${content.implementation || 'To be defined'}`;
      }
      // If it's a simple content object
      if (content.text) return content.text;
      if (content.content) return content.content;
      if (content.abstract) return content.abstract;
      // Otherwise return formatted JSON
      return JSON.stringify(content, null, 2);
    }
    return String(content);
  },

  getModelIcon: (modelId: string) => {
    const iconMap: Record<string, string> = {
      // Cursor-agent models
      'auto': 'cursor.png',
      'gpt-5': 'openai.png',
      'sonnet-4': 'claude-color.png',
      'opus-4.1': 'claude-color.png',
      
      // Specific agent IDs from your system (no duplicates)
      'claude-4-1-opus': 'claude-color.png',
      'deepseek-r1-0528': 'deepseek-color.png',
      'deepseek-v3-1': 'deepseek-color.png',
      'gemini-2-5-flash': 'gemini-color.png',
      'gemini-2-5-pro': 'gemini-color.png',
      'gpt4o': 'openai.png',
      'gpt-5-mini': 'openai.png',
      'grok-3': 'grok.png',
      'grok-4': 'grok.png',
      
      // OpenAI models
      'openai/gpt-4o': 'openai.png',
      'openai/gpt-4o-mini': 'openai.png',
      'openai/chatgpt-4o-latest': 'openai.png',
      'openai/gpt-5-mini': 'openai.png',
      'openai/gpt-4.1-mini': 'openai.png',
      'openai/o1-mini': 'openai.png',
      'openai/gpt-4-turbo': 'openai.png',
      
      // Anthropic models
      'anthropic/claude-3-5-sonnet-latest': 'claude-color.png',
      'anthropic/claude-3-5-haiku-latest': 'claude-color.png',
      'anthropic/claude-4-sonnet-20250514': 'claude-color.png',
      'anthropic/claude-3-7-sonnet-latest': 'claude-color.png',
      'anthropic/claude-3-opus-latest': 'claude-color.png',
      'claude-3.7-sonnet': 'claude-color.png',
      
      // Google/Gemini models
      'gemini/gemini-2.0-flash': 'gemini-color.png',
      'gemini/gemini-2.5-pro': 'gemini-color.png',
      'gemini/gemini-2.5-flash': 'gemini-color.png',
      'gemini/gemini-1.5-pro-latest': 'gemini-color.png',
      'gemini/gemini-1.5-flash-latest': 'gemini-color.png',
      
      // xAI/Grok models
      'xai/grok-4-latest': 'grok.png',
      'xai/grok-3-latest': 'grok.png',
      'xai/grok-3-fast-latest': 'grok.png',
      'xai/grok-3-mini-latest': 'grok.png',
      'xai/grok-code-fast-1': 'grok.png',
      
      // DeepSeek models
      'deepseek/deepseek-v3': 'deepseek-color.png',
      'deepseek/deepseek-r1': 'deepseek-color.png',
      'deepseek/deepseek-chat': 'deepseek-color.png',
      'deepseek/deepseek-reasoner': 'deepseek-color.png',
      
      // Groq models
      'groq/llama-3.1-70b-versatile': 'groq.png',
      'groq/llama-3.1-8b-instant': 'groq.png',
      'groq/llama-3.3-70b-versatile': 'groq.png'
    };
    
    // More flexible matching for complex model IDs
    const modelKey = modelId.toLowerCase();
    
    // Direct match first
    if (iconMap[modelId]) return iconMap[modelId];
    
    // Fuzzy matching
    if (modelKey.includes('gpt') || modelKey.includes('openai')) return 'openai.png';
    if (modelKey.includes('claude') || modelKey.includes('anthropic') || modelKey.includes('sonnet') || modelKey.includes('opus') || modelKey.includes('haiku')) return 'claude-color.png';
    if (modelKey.includes('gemini') || modelKey.includes('google')) return 'gemini-color.png';
    if (modelKey.includes('grok') || modelKey.includes('xai')) return 'grok.png';
    if (modelKey.includes('deepseek')) return 'deepseek-color.png';
    if (modelKey.includes('llama') || modelKey.includes('groq')) return 'groq.png';
    if (modelKey.includes('mistral')) return 'mistral-color.png';
    if (modelKey.includes('cohere')) return 'cohere-color.png';
    if (modelKey.includes('meta')) return 'meta-color.png';
    if (modelKey.includes('microsoft')) return 'microsoft-color.png';
    if (modelKey.includes('hugging')) return 'huggingface-color.png';
    if (modelKey.includes('perplexity')) return 'perplexity-color.png';
    if (modelKey.includes('bedrock')) return 'bedrock-color.png';
    if (modelKey.includes('ollama')) return 'ollama.png';
    
    return 'cursor.png'; // Default fallback
  }
};
