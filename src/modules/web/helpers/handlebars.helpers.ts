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
  }
};
