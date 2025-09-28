import type { NaviConfig } from '../types/index.js';

/**
 * Base interface for all NAVI tools
 */
export interface NaviTool {
  name: string;
  description: string;
  execute(args: unknown): Promise<string>;
}

/**
 * Tool registry for NAVI MCP server
 */
export async function registerTools(config: NaviConfig): Promise<Map<string, NaviTool>> {
  const tools = new Map<string, NaviTool>();

  // Dynamic imports to avoid circular dependencies
  const { GenerateTreeTool } = await import('./generate-tree.js');
  const { AnalyzeDependenciesTool } = await import('./analyze-dependencies.js');
  const { SemanticSearchTool } = await import('./semantic-search.js');
  const { FindAuthTool } = await import('./find-auth.js');
  const { VisualizeGraphTool } = await import('./visualize-graph.js');
  const { AnalyzeCodebaseTool } = await import('./analyze-codebase.js');
  const { FindFilesTool } = await import('./find-files.js');
  const { CompareProjectsTool } = await import('./compare-projects.js');

  // New navigation tools
  const { FindFunctionTool } = await import('./find-function.js');
  const { TraceCallChainTool } = await import('./trace-call-chain.js');
  const { SearchByPatternTool } = await import('./search-by-pattern.js');
  const { GetFunctionContextTool } = await import('./get-function-context.js');
  const { FindImplementationsTool } = await import('./find-implementations.js');
  const { AnalyzeImportsTool } = await import('./analyze-imports.js');
  const { FindFunctionCallsTool } = await import('./find-function-calls.js');

  // Register all available tools
  tools.set('generate-tree', new GenerateTreeTool(config));
  tools.set('analyze-dependencies', new AnalyzeDependenciesTool(config));
  tools.set('semantic-search', new SemanticSearchTool(config));
  tools.set('find-auth', new FindAuthTool(config));
  tools.set('visualize-graph', new VisualizeGraphTool(config));
  tools.set('analyze-codebase', new AnalyzeCodebaseTool(config));
  tools.set('find-files', new FindFilesTool(config));
  tools.set('compare-projects', new CompareProjectsTool(config));

  // Register new navigation tools
  tools.set('find-function', new FindFunctionTool(config));
  tools.set('trace-call-chain', new TraceCallChainTool(config));
  tools.set('search-by-pattern', new SearchByPatternTool(config));
  tools.set('get-function-context', new GetFunctionContextTool(config));
  tools.set('find-implementations', new FindImplementationsTool(config));
  tools.set('analyze-imports', new AnalyzeImportsTool(config));
  tools.set('find-function-calls', new FindFunctionCallsTool(config));

  return tools;
}

/**
 * Abstract base class for NAVI tools
 */
export abstract class BaseNaviTool implements NaviTool {
  protected config: NaviConfig;

  constructor(config: NaviConfig) {
    this.config = config;
  }

  abstract name: string;
  abstract description: string;
  abstract execute(args: unknown): Promise<string>;

  /**
   * Validate and parse tool arguments using Zod schema
   */
  protected validateArgs<T>(args: unknown, schema: any): T {
    try {
      return schema.parse(args);
    } catch (error) {
      throw new Error(`Invalid arguments: ${error instanceof Error ? error.message : 'Unknown validation error'}`);
    }
  }

  /**
   * Format error message for tool execution
   */
  protected formatError(error: unknown, context?: string): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const prefix = context ? `${context}: ` : '';
    return `${prefix}${message}`;
  }

  /**
   * Format success result with metadata
   */
  protected formatResult(result: string, metadata?: Record<string, unknown>): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return result;
    }

    const metadataStr = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ');

    return `${result}\n\n--- Metadata ---\n${metadataStr}`;
  }
}
