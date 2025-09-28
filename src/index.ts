#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { registerTools } from './tools/index.js';
import type { NaviConfig } from './types/index.js';
import { DEFAULT_CONFIG } from './types/index.js';
import { Logger } from './utils/logger.js';

/**
 * NAVI MCP Codebase Navigator Server
 * 
 * An advanced repository exploration tool that implements the MCP protocol
 * with capabilities for:
 * - ASCII tree visualization
 * - Dependency graph analysis  
 * - Semantic code search
 * - Authentication logic discovery
 */
class NaviMCPServer {
  private server: Server;
  private config: NaviConfig;
  private logger: Logger;

  constructor(config: NaviConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.logger = new Logger('NaviMCPServer');
    
    this.server = new Server(
      {
        name: 'navi-codebase-navigator',
        version: '1.0.0',
        description: 'Advanced MCP Codebase Navigator with tree visualization, dependency analysis, semantic search, and authentication discovery'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupErrorHandling();
    this.setupRequestHandlers();
  }

  private setupErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
  }

  private setupRequestHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Received tools/list request');
      
      return {
        tools: [
          {
            name: 'generate-tree',
            description: 'Generate ASCII tree visualization of directory structure',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Root path to generate tree from' },
                maxDepth: { type: 'number', description: 'Maximum depth to traverse', default: 10 },
                includeHidden: { type: 'boolean', description: 'Include hidden files and directories', default: false },
                extensions: { type: 'array', items: { type: 'string' }, description: 'Filter by file extensions' },
                excludePatterns: { type: 'array', items: { type: 'string' }, description: 'Patterns to exclude (glob format)' },
                showSizes: { type: 'boolean', description: 'Show file sizes in the tree', default: false }
              },
              required: ['path']
            }
          },
          {
            name: 'analyze-dependencies',
            description: 'Analyze code dependencies and create dependency graph',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Root path to analyze dependencies' },
                languages: { type: 'array', items: { type: 'string' }, description: 'Programming languages to analyze' },
                includeExternal: { type: 'boolean', description: 'Include external dependencies', default: false },
                maxDepth: { type: 'number', description: 'Maximum dependency depth', default: 5 },
                outputFormat: { type: 'string', enum: ['graph', 'list', 'tree'], description: 'Output format', default: 'graph' }
              },
              required: ['path']
            }
          },
          {
            name: 'semantic-search',
            description: 'Perform intelligent semantic code search',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                path: { type: 'string', description: 'Root path to search in' },
                languages: { type: 'array', items: { type: 'string' }, description: 'Programming languages to search' },
                searchType: { type: 'string', enum: ['semantic', 'fuzzy', 'exact', 'regex'], description: 'Type of search', default: 'semantic' },
                maxResults: { type: 'number', description: 'Maximum number of results', default: 20 },
                includeContext: { type: 'boolean', description: 'Include surrounding context lines', default: true },
                contextLines: { type: 'number', description: 'Number of context lines to include', default: 3 }
              },
              required: ['query', 'path']
            }
          },
          {
            name: 'find-auth',
            description: 'Discover authentication logic and security implementations',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Root path to search for authentication logic' },
                frameworks: { type: 'array', items: { type: 'string' }, description: 'Specific frameworks to look for' },
                categories: { type: 'array', items: { type: 'string' }, description: 'Authentication categories to focus on' },
                minConfidence: { type: 'number', description: 'Minimum confidence threshold', default: 0.7 },
                includeTests: { type: 'boolean', description: 'Include test files in search', default: false }
              },
              required: ['path']
            }
          },
          {
            name: 'visualize-graph',
            description: 'Create visual representation of dependency graphs',
            inputSchema: {
              type: 'object',
              properties: {
                dependencyData: { type: 'string', description: 'JSON string of dependency graph data' },
                format: { type: 'string', enum: ['ascii', 'dot', 'json'], description: 'Output format', default: 'ascii' },
                layout: { type: 'string', enum: ['hierarchical', 'circular', 'force'], description: 'Graph layout', default: 'hierarchical' },
                maxNodes: { type: 'number', description: 'Maximum nodes to display', default: 50 },
                showLabels: { type: 'boolean', description: 'Show node labels', default: true }
              },
              required: ['dependencyData']
            }
          },
          {
            name: 'analyze-codebase',
            description: 'Analyze codebase statistics, language distribution, and file composition',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Root path to analyze' },
                includeHidden: { type: 'boolean', description: 'Include hidden files', default: false },
                excludePatterns: { type: 'array', items: { type: 'string' }, description: 'Patterns to exclude' },
                detailed: { type: 'boolean', description: 'Include detailed file analysis', default: false }
              },
              required: ['path']
            }
          },
          {
            name: 'find-files',
            description: 'Find files based on name patterns, content, size, language, and other criteria',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Root path to search in' },
                pattern: { type: 'string', description: 'File name pattern (glob)' },
                content: { type: 'string', description: 'Content to search for' },
                extensions: { type: 'array', items: { type: 'string' }, description: 'File extensions to include' },
                languages: { type: 'array', items: { type: 'string' }, description: 'Programming languages to include' },
                minSize: { type: 'number', description: 'Minimum file size in bytes' },
                maxSize: { type: 'number', description: 'Maximum file size in bytes' },
                maxResults: { type: 'number', description: 'Maximum number of results', default: 50 },
                includeHidden: { type: 'boolean', description: 'Include hidden files', default: false },
                excludePatterns: { type: 'array', items: { type: 'string' }, description: 'Patterns to exclude' },
                caseSensitive: { type: 'boolean', description: 'Case sensitive search', default: false }
              },
              required: ['path']
            }
          },
          {
            name: 'compare-projects',
            description: 'Compare two project structures and identify differences in files, sizes, and languages',
            inputSchema: {
              type: 'object',
              properties: {
                pathA: { type: 'string', description: 'First project path to compare' },
                pathB: { type: 'string', description: 'Second project path to compare' },
                maxDepth: { type: 'number', description: 'Maximum depth to compare', default: 5 },
                includeHidden: { type: 'boolean', description: 'Include hidden files', default: false },
                excludePatterns: { type: 'array', items: { type: 'string' }, description: 'Patterns to exclude' },
                compareContent: { type: 'boolean', description: 'Compare file contents (slower)', default: false }
              },
              required: ['pathA', 'pathB']
            }
          },
          {
            name: 'find-function',
            description: 'Find function definitions by name, return exact location, code, and references across the codebase',
            inputSchema: {
              type: 'object',
              properties: {
                functionName: { type: 'string', description: 'Name of the function to find' },
                path: { type: 'string', description: 'Root path to search in' },
                languages: { type: 'array', items: { type: 'string' }, description: 'Programming languages to search' },
                includeReferences: { type: 'boolean', description: 'Include function references/calls', default: true },
                exactMatch: { type: 'boolean', description: 'Require exact name match', default: false },
                maxResults: { type: 'number', description: 'Maximum number of results', default: 50 }
              },
              required: ['functionName', 'path']
            }
          },
          {
            name: 'trace-call-chain',
            description: 'Trace function call chains to show who calls whom in the codebase',
            inputSchema: {
              type: 'object',
              properties: {
                functionName: { type: 'string', description: 'Name of the function to trace' },
                path: { type: 'string', description: 'Root path to search in' },
                direction: { type: 'string', enum: ['callers', 'callees', 'both'], description: 'Direction to trace', default: 'both' },
                maxDepth: { type: 'number', description: 'Maximum depth to trace', default: 5 },
                languages: { type: 'array', items: { type: 'string' }, description: 'Programming languages to analyze' },
                includeExternal: { type: 'boolean', description: 'Include external library calls', default: false }
              },
              required: ['functionName', 'path']
            }
          },
          {
            name: 'search-by-pattern',
            description: 'Advanced pattern search tool with regex support and scope filtering',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: { type: 'string', description: 'Regex pattern to search for' },
                path: { type: 'string', description: 'Root path to search in' },
                scope: { type: 'string', enum: ['functions', 'classes', 'variables', 'imports', 'all'], description: 'Scope to search within', default: 'all' },
                languages: { type: 'array', items: { type: 'string' }, description: 'Programming languages to search' },
                caseSensitive: { type: 'boolean', description: 'Case sensitive pattern matching', default: true },
                maxResults: { type: 'number', description: 'Maximum number of results', default: 100 },
                includeContext: { type: 'boolean', description: 'Include surrounding context', default: true }
              },
              required: ['pattern', 'path']
            }
          },
          {
            name: 'get-function-context',
            description: 'Find the containing class/module context for a given function',
            inputSchema: {
              type: 'object',
              properties: {
                functionName: { type: 'string', description: 'Name of the function to get context for' },
                path: { type: 'string', description: 'Root path to search in' },
                languages: { type: 'array', items: { type: 'string' }, description: 'Programming languages to search' },
                includeParentClass: { type: 'boolean', description: 'Include parent class information', default: true },
                includeModule: { type: 'boolean', description: 'Include module/file information', default: true },
                includeDocumentation: { type: 'boolean', description: 'Include function documentation', default: true }
              },
              required: ['functionName', 'path']
            }
          },
          {
            name: 'find-implementations',
            description: 'Find all implementations of an interface or abstract class',
            inputSchema: {
              type: 'object',
              properties: {
                interfaceName: { type: 'string', description: 'Name of the interface or abstract class' },
                path: { type: 'string', description: 'Root path to search in' },
                languages: { type: 'array', items: { type: 'string' }, description: 'Programming languages to search' },
                includeAbstract: { type: 'boolean', description: 'Include abstract implementations', default: true },
                maxResults: { type: 'number', description: 'Maximum number of results', default: 50 }
              },
              required: ['interfaceName', 'path']
            }
          },
          {
            name: 'analyze-imports',
            description: 'Analyze import dependencies for a specific file',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: { type: 'string', description: 'Path to the file to analyze imports for' },
                includeExternal: { type: 'boolean', description: 'Include external library imports', default: true },
                includeInternal: { type: 'boolean', description: 'Include internal project imports', default: true },
                resolveTypes: { type: 'boolean', description: 'Resolve import types and usage', default: false },
                showUnused: { type: 'boolean', description: 'Show potentially unused imports', default: false }
              },
              required: ['filePath']
            }
          }
        ]
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      this.logger.debug(`Received tools/call request for tool: ${name}`);
      
      try {
        const result = await this.executeTool(name, args);
        
        return {
          content: [
            {
              type: 'text',
              text: result
            }
          ]
        };
      } catch (error) {
        this.logger.error(`Error executing tool ${name}:`, error);
        
        throw {
          code: -32603,
          message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          data: {
            tool: name,
            arguments: args
          }
        };
      }
    });
  }

  private async executeTool(name: string, args: unknown): Promise<string> {
    // Tool execution will be implemented by the tools registry
    const tools = await registerTools(this.config);
    
    if (!tools.has(name)) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const tool = tools.get(name)!;
    return await tool.execute(args);
  }

  async start(): Promise<void> {
    this.logger.info('Starting NAVI MCP Codebase Navigator server...');
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    this.logger.info('NAVI MCP server started successfully');
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Load configuration from environment variables
  const config = {
    ...DEFAULT_CONFIG,
    maxFileSize: parseInt(process.env['NAVI_MAX_FILE_SIZE'] || DEFAULT_CONFIG.maxFileSize.toString()),
    excludePatterns: [
      ...DEFAULT_CONFIG.excludePatterns,
      ...(process.env['NAVI_EXCLUDE_PATTERNS']?.split(',').filter(Boolean) || [])
    ]
  };

  const server = new NaviMCPServer(config);
  server.start().catch((error) => {
    console.error('Failed to start NAVI MCP server:', error);
    process.exit(1);
  });
}

export { NaviMCPServer };
