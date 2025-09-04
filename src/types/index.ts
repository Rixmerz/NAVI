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
  minConfidence: z.number().optional().default(0.7).describe('Minimum confidence threshold'),
  includeTests: z.boolean().optional().default(false).describe('Include test files in search')
});

export const VisualizeGraphSchema = z.object({
  dependencyData: z.string().describe('JSON string of dependency graph data'),
  format: z.enum(['ascii', 'dot', 'json']).optional().default('ascii').describe('Output format'),
  layout: z.enum(['hierarchical', 'circular', 'force']).optional().default('hierarchical').describe('Graph layout'),
  maxNodes: z.number().optional().default(50).describe('Maximum nodes to display'),
  showLabels: z.boolean().optional().default(true).describe('Show node labels')
});

// Tool input types
export type GenerateTreeInput = z.infer<typeof GenerateTreeSchema>;
export type AnalyzeDependenciesInput = z.infer<typeof AnalyzeDependenciesSchema>;
export type SemanticSearchInput = z.infer<typeof SemanticSearchSchema>;
export type FindAuthInput = z.infer<typeof FindAuthSchema>;
export type VisualizeGraphInput = z.infer<typeof VisualizeGraphSchema>;

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
  excludePatterns: ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt'],
  supportedLanguages: ['javascript', 'typescript', 'python', 'go', 'java', 'rust', 'cpp', 'csharp'],
  authPatterns: [],
  searchIndexSize: 10000
};
