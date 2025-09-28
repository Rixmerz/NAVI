import { BaseNaviTool } from './index.js';
import { AnalyzeDependenciesSchema } from '../types/index.js';
import type { AnalyzeDependenciesInput } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';
import { promises as fs } from 'fs';
import { relative, dirname, resolve, extname } from 'path';

interface DependencyNode {
  id: string;
  path: string;
  language: string;
  dependencies: string[];
  dependents: string[];
  isExternal: boolean;
  size: number;
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Array<{ from: string; to: string; type: 'import' | 'require' | 'include' }>;
  circularDependencies: string[][];
  externalDependencies: Set<string>;
  metrics: {
    totalFiles: number;
    totalDependencies: number;
    circularCount: number;
    maxDepth: number;
    avgDependenciesPerFile: number;
  };
}

/**
 * Tool for analyzing code dependencies and creating dependency graphs
 */
export class AnalyzeDependenciesTool extends BaseNaviTool {
  name = 'analyze-dependencies';
  description = 'Analyze code dependencies and create dependency graph';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<AnalyzeDependenciesInput>(args, AnalyzeDependenciesSchema);

      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      const graph = await this.analyzeDependencies(input);
      const report = this.generateReport(graph, input);

      const metadata = {
        analyzedPath: input.path,
        totalFiles: graph.metrics.totalFiles,
        totalDependencies: graph.metrics.totalDependencies,
        circularDependencies: graph.metrics.circularCount,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Dependency analysis failed'));
    }
  }

  private async analyzeDependencies(input: AnalyzeDependenciesInput): Promise<DependencyGraph> {
    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: [],
      circularDependencies: [],
      externalDependencies: new Set(),
      metrics: {
        totalFiles: 0,
        totalDependencies: 0,
        circularCount: 0,
        maxDepth: 0,
        avgDependenciesPerFile: 0
      }
    };

    // Get all files to analyze
    const allFiles = await this.fileSystemHelper.getAllFiles(input.path, {
      extensions: this.getSupportedExtensions(input.languages),
      excludePatterns: this.config.excludePatterns
    });

    // Filter files by language if specified
    const filesToAnalyze = allFiles.filter(filePath => {
      if (!input.languages || input.languages.length === 0) return true;
      const lang = detectLanguage(filePath);
      return lang && input.languages.includes(lang.name.toLowerCase());
    });

    // Analyze each file
    for (const filePath of filesToAnalyze) {
      await this.analyzeFile(filePath, input.path, graph, input);
    }

    // Detect circular dependencies
    graph.circularDependencies = this.detectCircularDependencies(graph);

    // Calculate metrics
    this.calculateMetrics(graph);

    return graph;
  }

  private async analyzeFile(
    filePath: string,
    rootPath: string,
    graph: DependencyGraph,
    input: AnalyzeDependenciesInput
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await this.fileSystemHelper.getStats(filePath);
      const relativePath = relative(rootPath, filePath);
      const language = detectLanguage(filePath);

      const node: DependencyNode = {
        id: relativePath,
        path: filePath,
        language: language?.name || 'Unknown',
        dependencies: [],
        dependents: [],
        isExternal: false,
        size: stats?.size || 0
      };

      // Extract dependencies based on language
      const dependencies = this.extractDependencies(content, filePath, language?.name || 'Unknown');

      for (const dep of dependencies) {
        const resolvedDep = await this.resolveDependency(dep, filePath, rootPath);

        if (resolvedDep) {
          if (resolvedDep.isExternal) {
            if (input.includeExternal) {
              graph.externalDependencies.add(resolvedDep.path);
            }
          } else {
            node.dependencies.push(resolvedDep.path);
            graph.edges.push({
              from: relativePath,
              to: resolvedDep.path,
              type: resolvedDep.type as 'import' | 'require' | 'include'
            });
          }
        }
      }

      graph.nodes.set(relativePath, node);
    } catch (error) {
      // Skip files that can't be read
    }
  }

  private getSupportedExtensions(languages?: string[]): string[] {
    if (!languages || languages.length === 0) {
      return ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'rs', 'cpp', 'c', 'cs', 'php'];
    }

    const extensionMap: Record<string, string[]> = {
      'typescript': ['ts', 'tsx'],
      'javascript': ['js', 'jsx'],
      'python': ['py'],
      'go': ['go'],
      'java': ['java'],
      'rust': ['rs'],
      'cpp': ['cpp', 'cxx', 'cc'],
      'c': ['c', 'h'],
      'csharp': ['cs'],
      'php': ['php']
    };

    const extensions: string[] = [];
    for (const lang of languages) {
      const exts = extensionMap[lang.toLowerCase()];
      if (exts) extensions.push(...exts);
    }

    return extensions.length > 0 ? extensions : ['ts', 'tsx', 'js', 'jsx'];
  }

  private extractDependencies(content: string, filePath: string, _language: string): string[] {
    const dependencies: string[] = [];
    const ext = extname(filePath).toLowerCase();

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      // TypeScript/JavaScript imports
      const importRegex = /(?:import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]|require\s*\(\s*['"`]([^'"`]+)['"`]\s*\))/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const dep = match[1] || match[2];
        if (dep) dependencies.push(dep);
      }
    } else if (ext === '.py') {
      // Python imports
      const importRegex = /(?:from\s+([^\s]+)\s+import|import\s+([^\s,]+))/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const dep = match[1] || match[2];
        if (dep) dependencies.push(dep);
      }
    } else if (ext === '.go') {
      // Go imports
      const importRegex = /import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1]) {
          // Multi-line imports
          const imports = match[1].split('\n').map(line => {
            const m = line.match(/"([^"]+)"/);
            return m ? m[1] : null;
          }).filter(Boolean);
          dependencies.push(...imports as string[]);
        } else if (match[2]) {
          dependencies.push(match[2]);
        }
      }
    }

    return dependencies;
  }

  private async resolveDependency(
    dep: string,
    fromFile: string,
    rootPath: string
  ): Promise<{ path: string; isExternal: boolean; type: string } | null> {
    // Check if it's an external dependency (npm package, etc.)
    if (!dep.startsWith('.') && !dep.startsWith('/')) {
      return { path: dep, isExternal: true, type: 'import' };
    }

    // Resolve relative path
    try {
      const fromDir = dirname(fromFile);
      let resolvedPath = resolve(fromDir, dep);

      // Try different extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java'];
      for (const ext of extensions) {
        const pathWithExt = resolvedPath + ext;
        if (await this.fileSystemHelper.exists(pathWithExt)) {
          return {
            path: relative(rootPath, pathWithExt),
            isExternal: false,
            type: 'import'
          };
        }
      }

      // Try index files
      for (const ext of extensions) {
        const indexPath = resolve(resolvedPath, 'index' + ext);
        if (await this.fileSystemHelper.exists(indexPath)) {
          return {
            path: relative(rootPath, indexPath),
            isExternal: false,
            type: 'import'
          };
        }
      }
    } catch {
      // Ignore resolution errors
    }

    return null;
  }

  private detectCircularDependencies(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), nodeId]);
        }
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = graph.nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          dfs(dep, [...path]);
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  private calculateMetrics(graph: DependencyGraph): void {
    graph.metrics.totalFiles = graph.nodes.size;
    graph.metrics.totalDependencies = graph.edges.length;
    graph.metrics.circularCount = graph.circularDependencies.length;

    if (graph.nodes.size > 0) {
      const totalDeps = Array.from(graph.nodes.values())
        .reduce((sum, node) => sum + node.dependencies.length, 0);
      graph.metrics.avgDependenciesPerFile = totalDeps / graph.nodes.size;
    }

    // Calculate max depth (simplified)
    graph.metrics.maxDepth = Math.max(
      ...Array.from(graph.nodes.values()).map(node => node.dependencies.length),
      0
    );
  }

  private generateReport(graph: DependencyGraph, input: AnalyzeDependenciesInput): string {
    let report = '# 🔗 Dependency Analysis Report\n\n';

    // Overview
    report += '## 📊 Overview\n';
    report += `- **Total Files**: ${graph.metrics.totalFiles}\n`;
    report += `- **Total Dependencies**: ${graph.metrics.totalDependencies}\n`;
    report += `- **Circular Dependencies**: ${graph.metrics.circularCount}\n`;
    report += `- **External Dependencies**: ${graph.externalDependencies.size}\n`;
    report += `- **Average Dependencies per File**: ${graph.metrics.avgDependenciesPerFile.toFixed(1)}\n\n`;

    // Circular Dependencies
    if (graph.circularDependencies.length > 0) {
      report += '## 🔄 Circular Dependencies\n';
      for (const cycle of graph.circularDependencies.slice(0, 5)) {
        report += `- ${cycle.join(' → ')}\n`;
      }
      if (graph.circularDependencies.length > 5) {
        report += `... and ${graph.circularDependencies.length - 5} more\n`;
      }
      report += '\n';
    }

    // Most Connected Files
    const nodesByDeps = Array.from(graph.nodes.values())
      .sort((a, b) => b.dependencies.length - a.dependencies.length);

    if (nodesByDeps.length > 0) {
      report += '## 📈 Most Connected Files\n';
      for (const node of nodesByDeps.slice(0, 10)) {
        report += `- **${node.id}** (${node.dependencies.length} dependencies)\n`;
      }
      report += '\n';
    }

    // External Dependencies
    if (input.includeExternal && graph.externalDependencies.size > 0) {
      report += '## 📦 External Dependencies\n';
      const sortedExternal = Array.from(graph.externalDependencies).sort();
      for (const dep of sortedExternal.slice(0, 20)) {
        report += `- ${dep}\n`;
      }
      if (sortedExternal.length > 20) {
        report += `... and ${sortedExternal.length - 20} more\n`;
      }
      report += '\n';
    }

    return report;
  }
}
