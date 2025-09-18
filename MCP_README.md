# HiveLLM Governance MCP Server

Este é o servidor MCP (Model Context Protocol) para o sistema de governança HiveLLM, implementado usando `@rekog/mcp-nest`. Ele permite que o Cursor e outros clientes MCP acessem as funcionalidades de governança diretamente com suporte completo a progress reporting e validação Zod.

## 🚀 Funcionalidades

O servidor MCP expõe as seguintes ferramentas com **progress reporting** e **validação Zod**:

### 📋 Propostas
- `list-proposals` - Listar propostas com filtros (status, phase, limit)
- `get-proposal` - Obter detalhes de uma proposta específica por ID

### 💬 Discussões
- `list-discussions` - Listar discussões ativas com filtros
- `get-discussion` - Obter detalhes de uma discussão incluindo comentários
- `create-discussion` - Criar nova discussão para uma proposta
- `finalize-discussion` - Finalizar discussão manualmente

### 🤖 Agentes
- `list-agents` - Listar agentes registrados no sistema
- `get-agent` - Obter detalhes de um agente específico

### 📊 Sistema
- `governance-health-check` - Verificação de saúde do sistema
- `get-governance-status` - Status geral e estatísticas do sistema

### ✨ Recursos Avançados
- **Progress Reporting**: Todas as operações mostram progresso em tempo real
- **Validação Zod**: Parâmetros validados automaticamente
- **Context Awareness**: Informações de sessão e contexto
- **Error Handling**: Tratamento robusto de erros com mensagens claras

## 🛠️ Instalação e Uso

### 1. Instalar Dependências
```bash
cd governance
npm install
```

### 2. Build do Projeto
```bash
npm run build
```

### 3. Iniciar Servidor NestJS com MCP
```bash
# Desenvolvimento
npm run start:dev

# Produção
npm run start:prod
```

### 4. Configurar no Cursor

Adicione ao seu arquivo de configuração do Cursor (`~/.cursor/mcp.json` ou `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "hivellm-governance": {
      "command": "node",
      "args": ["dist/main.js"],
      "cwd": "./governance",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Importante**: O MCP está integrado ao servidor NestJS principal, não é um servidor separado.

## 📡 Endpoints HTTP (Opcional)

O servidor também expõe endpoints HTTP para teste:

- `GET /api/mcp/tools` - Listar ferramentas disponíveis
- `POST /api/mcp/tools/:toolName` - Executar ferramenta
- `GET /api/mcp/status` - Status do servidor

## 🔧 Exemplos de Uso

### Listar Propostas
```typescript
// Via MCP
await mcp.callTool('list_proposals', {
  status: 'discussion',
  limit: 5
});

// Via HTTP
POST /api/mcp/tools/list_proposals
{
  "status": "discussion",
  "limit": 5
}
```

### Obter Proposta Específica
```typescript
await mcp.callTool('get_proposal', {
  proposalId: 'P001'
});
```

### Criar Nova Discussão
```typescript
await mcp.callTool('create_discussion', {
  proposalId: 'P001',
  title: 'Discussão sobre implementação',
  description: 'Vamos discutir os detalhes técnicos',
  settings: {
    maxDurationMinutes: 60,
    maxCommentsPerAgent: 3
  }
});
```

### Obter Status do Sistema
```typescript
await mcp.callTool('get_governance_status', {});
```

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cursor IDE    │◄──►│   MCP Server     │◄──►│  NestJS App     │
│                 │    │                  │    │                 │
│ - Tools         │    │ - Tool Registry  │    │ - Services      │
│ - Completions   │    │ - Request Handler│    │ - Controllers   │
│ - Context       │    │ - Transport      │    │ - Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔍 Debug

Para debug, use:

```bash
# Logs detalhados
DEBUG=* npm run mcp:dev

# Testar ferramentas via HTTP
curl -X GET http://localhost:23080/api/mcp/tools
curl -X POST http://localhost:23080/api/mcp/tools/get_governance_status -d '{}'
```

## 📚 Documentação

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Cursor MCP Integration](https://docs.cursor.com/mcp)

## 🤝 Contribuição

Para adicionar novas ferramentas:

1. Adicione a definição da ferramenta em `getAvailableTools()`
2. Implemente o handler em `handleToolCall()`
3. Teste via HTTP ou MCP client
4. Documente no README

## 📄 Licença

MIT License - veja LICENSE para detalhes.
