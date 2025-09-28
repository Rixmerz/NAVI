import { z } from 'zod';

// Core types for the NAVI MCP Codebase Navigator

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
  language?: string;
  extension?: string;
}

export interface DependencyNode {
  id: string;
  name: string;
  path: string;
  type: 'module' | 'class' | 'function' | 'variable' | 'import';
  language: string;
  dependencies: string[];
  dependents: string[];
  metadata?: Record<string, unknown>;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Array<{ from: string; to: string; type: string }>;
}

export interface SearchResult {
  path: string;
  line: number;
  column: number;
  content: string;
  context: string[];
  score: number;
  type: 'exact' | 'fuzzy' | 'semantic';
  metadata?: Record<string, unknown>;
}

export interface AuthPattern {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  frameworks: string[];
  confidence: number;
  category: 'jwt' | 'oauth' | 'session' | 'api-key' | 'password' | 'middleware' | 'other';
}

export interface AuthDiscoveryResult {
  path: string;
  line: number;
  pattern: AuthPattern;
  context: string;
  confidence: number;
  framework?: string;
}

// Navigation tool result types
export interface FunctionDefinition {
  name: string;
  path: string;
  line: number;
  column: number;
  language: string;
  signature: string;
  documentation?: string;
  parentClass?: string;
  module?: string;
  parameters: Array<{
    name: string;
    type?: string;
    optional?: boolean;
  }>;
  returnType?: string;
}

export interface FunctionReference {
  path: string;
  line: number;
  column: number;
  context: string;
  type: 'call' | 'declaration' | 'assignment' | 'import';
}

export interface FunctionResult {
  definition?: FunctionDefinition;
  references: FunctionReference[];
  totalReferences: number;
}

export interface CallChainNode {
  functionName: string;
  path: string;
  line: number;
  signature: string;
  language: string;
  callers: CallChainNode[];
  callees: CallChainNode[];
  depth: number;
}

export interface PatternMatch {
  path: string;
  line: number;
  column: number;
  content: string;
  context: string[];
  scope: 'function' | 'class' | 'variable' | 'import' | 'other';
  language: string;
}

export interface FunctionContext {
  function: FunctionDefinition;
  parentClass?: {
    name: string;
    line: number;
    methods: string[];
    properties: string[];
  };
  module: {
    name: string;
    path: string;
    exports: string[];
    imports: string[];
  };
  relatedFunctions: string[];
}

export interface Implementation {
  name: string;
  path: string;
  line: number;
  language: string;
  signature: string;
  isAbstract: boolean;
  parentInterface: string;
  methods: Array<{
    name: string;
    signature: string;
    line: number;
  }>;
}

export interface ImportAnalysis {
  filePath: string;
  language: string;
  imports: Array<{
    source: string;
    type: 'external' | 'internal';
    items: Array<{
      name: string;
      alias?: string;
      isDefault?: boolean;
      isNamespace?: boolean;
    }>;
    line: number;
    used: boolean;
  }>;
  exports: Array<{
    name: string;
    type: 'default' | 'named';
    line: number;
  }>;
  dependencies: {
    internal: string[];
    external: string[];
  };
}

// Zod schemas for tool input validation

export const GenerateTreeSchema = z.object({
  path: z.string().describe('Root path to generate tree from'),
  maxDepth: z.number().optional().default(10).describe('Maximum depth to traverse'),
  includeHidden: z.boolean().optional().default(false).describe('Include hidden files and directories'),
  extensions: z.array(z.string()).optional().describe('Filter by file extensions'),
  excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude (glob format)'),
  showSizes: z.boolean().optional().default(false).describe('Show file sizes in the tree')
});

export const AnalyzeDependenciesSchema = z.object({
  path: z.string().describe('Root path to analyze dependencies'),
  languages: z.array(z.string()).optional().describe('Programming languages to analyze'),
  includeExternal: z.boolean().optional().default(false).describe('Include external dependencies'),
  maxDepth: z.number().optional().default(5).describe('Maximum dependency depth'),
  outputFormat: z.enum(['graph', 'list', 'tree']).optional().default('graph').describe('Output format')
});

export const SemanticSearchSchema = z.object({
  query: z.string().describe('Search query'),
  path: z.string().describe('Root path to search in'),
  languages: z.array(z.string()).optional().describe('Programming languages to search'),
  searchType: z.enum(['semantic', 'fuzzy', 'exact', 'regex']).optional().default('semantic').describe('Type of search'),
  maxResults: z.number().optional().default(20).describe('Maximum number of results'),
  includeContext: z.boolean().optional().default(true).describe('Include surrounding context lines'),
  contextLines: z.number().optional().default(3).describe('Number of context lines to include')
});

export const FindAuthSchema = z.object({
  path: z.string().describe('Root path to search for authentication logic'),
  frameworks: z.array(z.string()).optional().describe('Specific frameworks to look for'),
  categories: z.array(z.string()).optional().describe('Authentication categories to focus on'),
  minConfidence: z.number().optional().default(0.5).describe('Minimum confidence threshold'),
  includeTests: z.boolean().optional().default(false).describe('Include test files in search')
});

export const VisualizeGraphSchema = z.object({
  dependencyData: z.string().describe('JSON string of dependency graph data'),
  format: z.enum(['ascii', 'dot', 'json']).optional().default('ascii').describe('Output format'),
  layout: z.enum(['hierarchical', 'circular', 'force']).optional().default('hierarchical').describe('Graph layout'),
  maxNodes: z.number().optional().default(50).describe('Maximum nodes to display'),
  showLabels: z.boolean().optional().default(true).describe('Show node labels')
});

// New navigation tool schemas
export const FindFunctionSchema = z.object({
  functionName: z.string().describe('Name of the function to find'),
  path: z.string().describe('Root path to search in'),
  languages: z.array(z.string()).optional().describe('Programming languages to search'),
  includeReferences: z.boolean().optional().default(true).describe('Include function references/calls'),
  exactMatch: z.boolean().optional().default(false).describe('Require exact name match'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results')
});

export const TraceCallChainSchema = z.object({
  functionName: z.string().describe('Name of the function to trace'),
  path: z.string().describe('Root path to search in'),
  direction: z.enum(['callers', 'callees', 'both']).optional().default('both').describe('Direction to trace'),
  maxDepth: z.number().optional().default(5).describe('Maximum depth to trace'),
  languages: z.array(z.string()).optional().describe('Programming languages to analyze'),
  includeExternal: z.boolean().optional().default(false).describe('Include external library calls')
});

export const SearchByPatternSchema = z.object({
  pattern: z.string().describe('Regex pattern to search for'),
  path: z.string().describe('Root path to search in'),
  scope: z.enum(['functions', 'classes', 'variables', 'imports', 'all']).optional().default('all').describe('Scope to search within'),
  languages: z.array(z.string()).optional().describe('Programming languages to search'),
  caseSensitive: z.boolean().optional().default(true).describe('Case sensitive pattern matching'),
  maxResults: z.number().optional().default(100).describe('Maximum number of results'),
  includeContext: z.boolean().optional().default(true).describe('Include surrounding context')
});

export const GetFunctionContextSchema = z.object({
  functionName: z.string().describe('Name of the function to get context for'),
  path: z.string().describe('Root path to search in'),
  languages: z.array(z.string()).optional().describe('Programming languages to search'),
  includeParentClass: z.boolean().optional().default(true).describe('Include parent class information'),
  includeModule: z.boolean().optional().default(true).describe('Include module/file information'),
  includeDocumentation: z.boolean().optional().default(true).describe('Include function documentation')
});

export const FindImplementationsSchema = z.object({
  interfaceName: z.string().describe('Name of the interface or abstract class'),
  path: z.string().describe('Root path to search in'),
  languages: z.array(z.string()).optional().describe('Programming languages to search'),
  includeAbstract: z.boolean().optional().default(true).describe('Include abstract implementations'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results')
});

export const AnalyzeImportsSchema = z.object({
  filePath: z.string().describe('Path to the file to analyze imports for'),
  includeExternal: z.boolean().optional().default(true).describe('Include external library imports'),
  includeInternal: z.boolean().optional().default(true).describe('Include internal project imports'),
  resolveTypes: z.boolean().optional().default(false).describe('Resolve import types and usage'),
  showUnused: z.boolean().optional().default(false).describe('Show potentially unused imports')
});

// Tool input types
export type GenerateTreeInput = z.infer<typeof GenerateTreeSchema>;
export type AnalyzeDependenciesInput = z.infer<typeof AnalyzeDependenciesSchema>;
export type SemanticSearchInput = z.infer<typeof SemanticSearchSchema>;
export type FindAuthInput = z.infer<typeof FindAuthSchema>;
export type VisualizeGraphInput = z.infer<typeof VisualizeGraphSchema>;
export type FindFunctionInput = z.infer<typeof FindFunctionSchema>;
export type TraceCallChainInput = z.infer<typeof TraceCallChainSchema>;
export type SearchByPatternInput = z.infer<typeof SearchByPatternSchema>;
export type GetFunctionContextInput = z.infer<typeof GetFunctionContextSchema>;
export type FindImplementationsInput = z.infer<typeof FindImplementationsSchema>;
export type AnalyzeImportsInput = z.infer<typeof AnalyzeImportsSchema>;

// Language detection types
export interface LanguageInfo {
  name: string;
  extensions: string[];
  parser?: string;
  keywords: string[];
  commentPatterns: {
    single?: string;
    multiStart?: string;
    multiEnd?: string;
  };
}

// Configuration types
export interface NaviConfig {
  maxFileSize: number;
  excludePatterns: string[];
  supportedLanguages: string[];
  authPatterns: AuthPattern[];
  searchIndexSize: number;
}

export const DEFAULT_CONFIG: NaviConfig = {
  maxFileSize: 1024 * 1024, // 1MB
  excludePatterns: [
    // Package managers and dependencies
    'node_modules',
    'vendor',
    'packages',
    'bower_components',

    // Version control
    '.git',
    '.svn',
    '.hg',

    // Build outputs
    'dist',
    'build',
    'out',
    'target',
    'bin',
    'obj',

    // Framework specific
    '.next',
    '.nuxt',
    '.vuepress',
    '.docusaurus',

    // Testing and coverage
    'coverage',
    '.nyc_output',
    '.coverage',
    'htmlcov',
    'test-results',
    'junit',

    // IDE and editor files
    '.vscode',
    '.idea',
    '.vs',
    '*.swp',
    '*.swo',
    '*~',

    // OS files
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',

    // Logs and temporary files
    'logs',
    '*.log',
    'tmp',
    'temp',
    '.tmp',
    '.temp',

    // Cache directories
    '.cache',
    '.parcel-cache',
    '.webpack',
    '.rollup.cache',
    'node_modules/.cache'
  ],
  supportedLanguages: ['javascript', 'typescript', 'python', 'go', 'java', 'rust', 'cpp', 'csharp'],
  authPatterns: [],
  searchIndexSize: 10000
};

// Find Function Calls types
export interface FindFunctionCallsInput {
  functionName: string;
  path: string;
  languages?: string[];
  includeBuiltins?: boolean;
  maxResults?: number;
}

export interface FunctionCall {
  functionName: string;
  calledFrom: string;
  path: string;
  line: number;
  language: string;
  context: string;
}
