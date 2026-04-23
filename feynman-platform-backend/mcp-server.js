#!/usr/bin/env node

/**
 * mcp-server.js
 *
 * Feynman Platform MCP Server
 *
 * 说明：
 * - 基于 Model Context Protocol (MCP) 的服务端，允许 AI 应用访问本平台的知识点、
 *   用户信息，以及集成的 Context7、DeepWiki 等外部服务。
 * - 运行方式：node mcp-server.js（使用 stdio 传输）
 *
 * 依赖环境变量：
 *   MONGO_URI             数据库连接字符串
 *   CONTEXT7_API_KEY      (可选) Context7 密钥
 *   DEEPWIKI_API_KEY      (可选) DeepWiki 密钥
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// 加载环境变量
dotenv.config();

// Context7 和 DeepWiki 配置
const CONTEXT7_API_URL = process.env.CONTEXT7_API_URL || 'https://api.context7.com';
const CONTEXT7_API_KEY = process.env.CONTEXT7_API_KEY;
const DEEPWIKI_API_URL = process.env.DEEPWIKI_API_URL || 'https://api.deepwiki.com';
const DEEPWIKI_API_KEY = process.env.DEEPWIKI_API_KEY;

// 导入模型 (需要根据实际路径调整)
const KnowledgePoint = (await import('./models/KnowledgePoint.js')).default;
const User = (await import('./models/User.js')).default;

// 连接数据库
await mongoose.connect(process.env.MONGO_URI);

// 创建 MCP Server 实例
const server = new Server(
  {
    name: 'feynman-platform-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============ Context7 辅助函数 ============

async function queryContext7(query, options = {}) {
  if (!CONTEXT7_API_KEY) {
    throw new Error('Context7 API Key 未配置');
  }

  const response = await fetch(`${CONTEXT7_API_URL}/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONTEXT7_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      limit: options.limit || 10,
      filters: options.filters || {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Context7 请求失败: ${response.statusText}`);
  }

  return await response.json();
}

async function addToContext7(content, metadata = {}) {
  if (!CONTEXT7_API_KEY) {
    throw new Error('Context7 API Key 未配置');
  }

  const response = await fetch(`${CONTEXT7_API_URL}/api/contexts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONTEXT7_API_KEY}`,
    },
    body: JSON.stringify({ content, metadata }),
  });

  if (!response.ok) {
    throw new Error(`Context7 添加失败: ${response.statusText}`);
  }

  return await response.json();
}

// ============ DeepWiki 辅助函数 ============

async function searchDeepWiki(query, options = {}) {
  if (!DEEPWIKI_API_KEY) {
    throw new Error('DeepWiki API Key 未配置');
  }

  const response = await fetch(`${DEEPWIKI_API_URL}/api/wiki/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPWIKI_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      maxResults: options.maxResults || 10,
      includeContent: options.includeContent !== false,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepWiki 请求失败: ${response.statusText}`);
  }

  return await response.json();
}

async function getDeepWikiPage(pageId) {
  if (!DEEPWIKI_API_KEY) {
    throw new Error('DeepWiki API Key 未配置');
  }

  const response = await fetch(`${DEEPWIKI_API_URL}/api/wiki/pages/${pageId}`, {
    headers: {
      'Authorization': `Bearer ${DEEPWIKI_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`DeepWiki 页面获取失败: ${response.statusText}`);
  }

  return await response.json();
}

async function createDeepWikiPage(title, content, tags = []) {
  if (!DEEPWIKI_API_KEY) {
    throw new Error('DeepWiki API Key 未配置');
  }

  const response = await fetch(`${DEEPWIKI_API_URL}/api/wiki/pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPWIKI_API_KEY}`,
    },
    body: JSON.stringify({ title, content, tags }),
  });

  if (!response.ok) {
    throw new Error(`DeepWiki 页面创建失败: ${response.statusText}`);
  }

  return await response.json();
}

// ============ 工具定义 ============

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_knowledge_points',
        description: '获取所有知识点列表',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: '用户ID (可选,用于筛选特定用户的知识点)',
            },
          },
        },
      },
      {
        name: 'create_knowledge_point',
        description: '创建新的知识点',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: '知识点标题',
            },
            content: {
              type: 'string',
              description: '知识点内容',
            },
            userId: {
              type: 'string',
              description: '创建者用户ID',
            },
          },
          required: ['title', 'content', 'userId'],
        },
      },
      {
        name: 'search_knowledge_points',
        description: '搜索知识点 (按标题或内容)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词',
            },
          },
          required: ['query'],
        },
      },
      // Context7 工具
      {
        name: 'context7_search',
        description: '在 Context7 中搜索上下文信息',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索查询',
            },
            limit: {
              type: 'number',
              description: '返回结果数量限制 (默认 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'context7_add',
        description: '向 Context7 添加新的上下文内容',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: '要添加的内容',
            },
            metadata: {
              type: 'object',
              description: '元数据 (如标签、分类等)',
            },
          },
          required: ['content'],
        },
      },
      // DeepWiki 工具
      {
        name: 'deepwiki_search',
        description: '在 DeepWiki 知识库中搜索',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索查询',
            },
            maxResults: {
              type: 'number',
              description: '最大结果数 (默认 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'deepwiki_get_page',
        description: '获取 DeepWiki 特定页面内容',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: {
              type: 'string',
              description: '页面 ID',
            },
          },
          required: ['pageId'],
        },
      },
      {
        name: 'deepwiki_create_page',
        description: '在 DeepWiki 中创建新页面',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: '页面标题',
            },
            content: {
              type: 'string',
              description: '页面内容 (支持 Markdown)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '页面标签',
            },
          },
          required: ['title', 'content'],
        },
      },
    ],
  };
});

// ============ 工具执行 ============

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_knowledge_points': {
        const filter = args.userId ? { user: args.userId } : {};
        const knowledgePoints = await KnowledgePoint.find(filter)
          .populate('user', 'username email')
          .sort({ createdAt: -1 })
          .limit(50);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(knowledgePoints, null, 2),
            },
          ],
        };
      }

      case 'create_knowledge_point': {
        const newKP = new KnowledgePoint({
          title: args.title,
          content: args.content,
          user: args.userId,
        });
        await newKP.save();

        return {
          content: [
            {
              type: 'text',
              text: `知识点创建成功: ${JSON.stringify(newKP, null, 2)}`,
            },
          ],
        };
      }

      case 'search_knowledge_points': {
        const knowledgePoints = await KnowledgePoint.find({
          $or: [
            { title: { $regex: args.query, $options: 'i' } },
            { content: { $regex: args.query, $options: 'i' } },
          ],
        })
          .populate('user', 'username')
          .limit(20);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(knowledgePoints, null, 2),
            },
          ],
        };
      }

      // Context7 工具执行
      case 'context7_search': {
        const results = await queryContext7(args.query, {
          limit: args.limit,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'context7_add': {
        const result = await addToContext7(args.content, args.metadata || {});

        return {
          content: [
            {
              type: 'text',
              text: `Context7 添加成功: ${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      // DeepWiki 工具执行
      case 'deepwiki_search': {
        const results = await searchDeepWiki(args.query, {
          maxResults: args.maxResults,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'deepwiki_get_page': {
        const page = await getDeepWikiPage(args.pageId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page, null, 2),
            },
          ],
        };
      }

      case 'deepwiki_create_page': {
        const page = await createDeepWikiPage(
          args.title,
          args.content,
          args.tags || []
        );

        return {
          content: [
            {
              type: 'text',
              text: `DeepWiki 页面创建成功: ${JSON.stringify(page, null, 2)}`,
            },
          ],
        };
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `错误: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ============ 资源定义 ============

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'feynman://knowledge-points/all',
        name: '所有知识点',
        description: '获取平台上的所有知识点',
        mimeType: 'application/json',
      },
      {
        uri: 'feynman://stats/overview',
        name: '平台统计概览',
        description: '用户数量、知识点数量等统计信息',
        mimeType: 'application/json',
      },
      {
        uri: 'context7://recent',
        name: 'Context7 最近上下文',
        description: 'Context7 中最近添加的上下文',
        mimeType: 'application/json',
      },
      {
        uri: 'deepwiki://popular',
        name: 'DeepWiki 热门页面',
        description: 'DeepWiki 中访问量最高的页面',
        mimeType: 'application/json',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'feynman://knowledge-points/all': {
      const kps = await KnowledgePoint.find().limit(100);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(kps, null, 2),
          },
        ],
      };
    }

    case 'feynman://stats/overview': {
      const [userCount, kpCount] = await Promise.all([
        User.countDocuments(),
        KnowledgePoint.countDocuments(),
      ]);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                users: userCount,
                knowledgePoints: kpCount,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case 'context7://recent': {
      try {
        const results = await queryContext7('*', { limit: 20 });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ error: error.message }, null, 2),
            },
          ],
        };
      }
    }

    case 'deepwiki://popular': {
      try {
        // 获取热门页面 (假设 API 支持此查询)
        const response = await fetch(`${DEEPWIKI_API_URL}/api/wiki/popular`, {
          headers: {
            'Authorization': `Bearer ${DEEPWIKI_API_KEY}`,
          },
        });

        if (!response.ok) {
          throw new Error(`请求失败: ${response.statusText}`);
        }

        const pages = await response.json();

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(pages, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ error: error.message }, null, 2),
            },
          ],
        };
      }
    }

    default:
      throw new Error(`未知资源: ${uri}`);
  }
});

// ============ 启动 Server ============

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Feynman Platform MCP Server 已启动');
}

main().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
