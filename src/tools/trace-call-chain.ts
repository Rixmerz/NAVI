import { BaseNaviTool } from './index.js';
import { TraceCallChainSchema } from '../types/index.js';
import type { TraceCallChainInput, CallChainNode } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';
import { promises as fs } from 'fs';
import { relative } from 'path';

/**
 * Tool for tracing function call chains to show who calls whom in the codebase
 */
export class TraceCallChainTool extends BaseNaviTool {
  name = 'trace-call-chain';
  description = 'Trace function call chains to show who calls whom in the codebase';

  private fileSystemHelper: FileSystemHelper;
  private functionCache: Map<string, CallChainNode> = new Map();

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<TraceCallChainInput>(args, TraceCallChainSchema);
      
      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      this.functionCache.clear();
      const callChain = await this.traceCallChain(input);
      const report = this.generateReport(callChain, input);
      
      const metadata = {
        functionName: input.functionName,
        searchPath: input.path,
        direction: input.direction,
        maxDepth: input.maxDepth,
        totalNodes: this.countNodes(callChain),
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Call chain tracing failed'));
    }
  }

  private async traceCallChain(input: TraceCallChainInput): Promise<CallChainNode | null> {
    // First, find the root function
    const rootFunction = await this.findFunction(input.functionName, input.path, input.languages);
    if (!rootFunction) {
      return null;
    }

    // Initialize visited set for cycle detection
    const visited = new Set<string>();
    const startTime = Date.now();
    const timeout = 30000; // 30 second timeout

    // Build the call chain based on direction
    if (input.direction === 'callers' || input.direction === 'both') {
      await this.findCallers(rootFunction, input, 0, visited, startTime, timeout);
    }

    if (input.direction === 'callees' || input.direction === 'both') {
      await this.findCallees(rootFunction, input, 0, visited, startTime, timeout);
    }

    return rootFunction;
  }

  private async findFunction(functionName: string, searchPath: string, languages?: string[]): Promise<CallChainNode | null> {
    const cacheKey = `${functionName}:${searchPath}`;
    if (this.functionCache.has(cacheKey)) {
      return this.functionCache.get(cacheKey)!;
    }

    // Get all files to search
    const options: Parameters<typeof this.fileSystemHelper.getAllFiles>[1] = {};
    if (languages) {
      const extensions = this.getExtensionsForLanguages(languages);
      options.extensions = extensions;
    }

    // Add default excludePatterns
    options.excludePatterns = this.config.excludePatterns;

    const allFiles = await this.fileSystemHelper.getAllFiles(searchPath, options);

    for (const filePath of allFiles) {
      const language = detectLanguage(filePath);
      if (languages && languages.length > 0) {
        if (!language || !languages.includes(language.name.toLowerCase())) {
          continue;
        }
      }

      const functionNode = await this.searchFunctionInFile(filePath, functionName, language?.name || 'Unknown', searchPath);
      if (functionNode) {
        this.functionCache.set(cacheKey, functionNode);
        return functionNode;
      }
    }

    return null;
  }

  private async searchFunctionInFile(
    filePath: string, 
    functionName: string, 
    language: string,
    rootPath: string
  ): Promise<CallChainNode | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const patterns = this.getFunctionDeclarationPatterns(language, functionName);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match) {
            const signature = this.extractFunctionSignature(line, lines, i);
            
            return {
              functionName,
              path: relative(rootPath, filePath),
              line: i + 1,
              signature,
              language,
              callers: [],
              callees: [],
              depth: 0
            };
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private async findCallers(
    node: CallChainNode,
    input: TraceCallChainInput,
    currentDepth: number,
    visited: Set<string>,
    startTime: number,
    timeout: number
  ): Promise<void> {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      console.warn(`Timeout reached while tracing callers for ${node.functionName}`);
      return;
    }

    if (currentDepth >= input.maxDepth) return;

    // Create unique key for cycle detection
    const nodeKey = `${node.path}:${node.functionName}:${currentDepth}`;
    if (visited.has(nodeKey)) {
      console.warn(`Cycle detected: ${nodeKey}`);
      return;
    }
    visited.add(nodeKey);

    const options: Parameters<typeof this.fileSystemHelper.getAllFiles>[1] = {};
    if (input.languages) {
      const extensions = this.getExtensionsForLanguages(input.languages);
      options.extensions = extensions;
    }

    // Add default excludePatterns
    options.excludePatterns = this.config.excludePatterns;

    const allFiles = await this.fileSystemHelper.getAllFiles(input.path, options);

    for (const filePath of allFiles) {
      const language = detectLanguage(filePath);
      if (input.languages && input.languages.length > 0) {
        if (!language || !input.languages.includes(language.name.toLowerCase())) {
          continue;
        }
      }

      const callers = await this.findCallersInFile(filePath, node.functionName, language?.name || 'Unknown', input.path);

      for (const caller of callers) {
        caller.depth = currentDepth + 1;
        node.callers.push(caller);

        // Recursively find callers of this caller
        if (currentDepth + 1 < input.maxDepth) {
          await this.findCallers(caller, input, currentDepth + 1, visited, startTime, timeout);
        }
      }
    }

    // Remove from visited set when done (backtrack)
    visited.delete(nodeKey);
  }

  private async findCallees(
    node: CallChainNode,
    input: TraceCallChainInput,
    currentDepth: number,
    visited: Set<string>,
    startTime: number,
    timeout: number
  ): Promise<void> {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      console.warn(`Timeout reached while tracing callees for ${node.functionName}`);
      return;
    }

    if (currentDepth >= input.maxDepth) return;

    // Create unique key for cycle detection
    const nodeKey = `${node.path}:${node.functionName}:${currentDepth}`;
    if (visited.has(nodeKey)) {
      console.warn(`Cycle detected: ${nodeKey}`);
      return;
    }
    visited.add(nodeKey);

    // Find callees in the same file as the function
    const fullPath = this.resolveFullPath(node.path, input.path);
    const callees = await this.findCalleesInFile(fullPath, node.functionName, node.language, input.path);
    
    for (const callee of callees) {
      callee.depth = currentDepth + 1;
      node.callees.push(callee);
      
      // Recursively find callees of this callee
      if (currentDepth + 1 < input.maxDepth) {
        await this.findCallees(callee, input, currentDepth + 1, visited, startTime, timeout);
      }
    }

    // Remove from visited set when done (backtrack)
    visited.delete(nodeKey);
  }

  private async findCallersInFile(
    filePath: string, 
    functionName: string, 
    language: string,
    rootPath: string
  ): Promise<CallChainNode[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const callers: CallChainNode[] = [];

      // Find function calls to the target function
      const callPattern = new RegExp(`\\b${functionName}\\s*\\(`, 'g');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const matches = line.matchAll(callPattern);
        
        for (const _match of matches) {
          // Find the containing function
          const containingFunction = this.findContainingFunction(lines, i, language);
          if (containingFunction && containingFunction.name !== functionName) {
            const existingCaller = callers.find(c => 
              c.functionName === containingFunction.name && 
              c.path === relative(rootPath, filePath)
            );
            
            if (!existingCaller) {
              callers.push({
                functionName: containingFunction.name,
                path: relative(rootPath, filePath),
                line: containingFunction.line,
                signature: containingFunction.signature,
                language,
                callers: [],
                callees: [],
                depth: 0
              });
            }
          }
        }
      }

      return callers;
    } catch {
      return [];
    }
  }

  private async findCalleesInFile(
    filePath: string, 
    functionName: string, 
    language: string,
    rootPath: string
  ): Promise<CallChainNode[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const callees: CallChainNode[] = [];

      // First find the function definition
      const functionDef = this.findFunctionDefinition(lines, functionName, language);
      if (!functionDef) return callees;

      // Find all function calls within this function
      const functionBody = this.extractFunctionBody(lines, functionDef.startLine, functionDef.endLine);
      
      const callPattern = /\b(\w+)\s*\(/g;
      const matches = functionBody.matchAll(callPattern);
      
      const foundCallees = new Set<string>();
      
      for (const match of matches) {
        const calledFunction = match[1];
        if (calledFunction && calledFunction !== functionName && !foundCallees.has(calledFunction)) {
          foundCallees.add(calledFunction);
          
          // Try to find the definition of this called function
          const calleeNode = await this.findFunction(calledFunction, rootPath, [language]);
          if (calleeNode) {
            callees.push(calleeNode);
          } else {
            // Create a placeholder node for external or unresolved functions
            callees.push({
              functionName: calledFunction,
              path: 'external',
              line: 0,
              signature: `${calledFunction}()`,
              language: 'unknown',
              callers: [],
              callees: [],
              depth: 0
            });
          }
        }
      }

      return callees;
    } catch {
      return [];
    }
  }

  private findContainingFunction(lines: string[], lineIndex: number, language: string): { name: string; line: number; signature: string } | null {
    // Look backwards to find the containing function
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i];
      if (!line) continue;
      const patterns = this.getFunctionDeclarationPatterns(language);

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const functionName = match[1] || match[2] || match[0];
          const signature = this.extractFunctionSignature(line, lines, i);
          
          return {
            name: functionName,
            line: i + 1,
            signature
          };
        }
      }
    }
    
    return null;
  }

  private findFunctionDefinition(lines: string[], functionName: string, language: string): { startLine: number; endLine: number } | null {
    const patterns = this.getFunctionDeclarationPatterns(language, functionName);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          // Find the end of the function (simplified)
          const endLine = this.findFunctionEnd(lines, i);
          return { startLine: i, endLine };
        }
      }
    }
    
    return null;
  }

  private findFunctionEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let inFunction = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inFunction = true;
        } else if (char === '}') {
          braceCount--;
          if (inFunction && braceCount === 0) {
            return i;
          }
        }
      }
    }
    
    return Math.min(startLine + 50, lines.length - 1); // Fallback
  }

  private extractFunctionBody(lines: string[], startLine: number, endLine: number): string {
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private getFunctionDeclarationPatterns(language: string, functionName?: string): RegExp[] {
    const name = functionName ? functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '(\\w+)';
    const patterns: RegExp[] = [];

    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        patterns.push(
          new RegExp(`\\b(?:function|async\\s+function)\\s+${name}\\s*\\(`, 'i'),
          new RegExp(`\\b${name}\\s*[:=]\\s*(?:async\\s+)?\\([^)]*\\)\\s*=>`, 'i'),
          new RegExp(`\\b${name}\\s*\\([^)]*\\)\\s*{`, 'i')
        );
        break;

      case 'python':
        patterns.push(
          new RegExp(`^\\s*(?:async\\s+)?def\\s+${name}\\s*\\(`, 'im')
        );
        break;

      case 'java':
        patterns.push(
          new RegExp(`\\b(?:public|private|protected|static|final|abstract)\\s+.*\\s+${name}\\s*\\(`, 'i')
        );
        break;

      case 'go':
        patterns.push(
          new RegExp(`^\\s*func\\s+(?:\\([^)]*\\)\\s+)?${name}\\s*\\(`, 'im')
        );
        break;

      default:
        patterns.push(new RegExp(`\\b${name}\\s*\\(`, 'i'));
    }

    return patterns;
  }

  private extractFunctionSignature(currentLine: string, allLines: string[], lineIndex: number): string {
    let signature = currentLine.trim();

    // Try to get complete signature for multi-line functions
    // Assume JavaScript/TypeScript for now
    {
      let parenCount = 0;
      let i = lineIndex;
      
      while (i < allLines.length && i < lineIndex + 3) {
        const line = allLines[i];
        if (!line) {
          i++;
          continue;
        }
        for (const char of line) {
          if (char === '(') parenCount++;
          if (char === ')') parenCount--;
        }
        
        if (i > lineIndex) {
          signature += ' ' + line.trim();
        }
        
        if (parenCount === 0 && (line.includes('{') || line.includes('=>'))) {
          break;
        }
        i++;
      }
    }
    
    return signature;
  }

  private getExtensionsForLanguages(languages: string[]): string[] {
    const extensionMap: Record<string, string[]> = {
      javascript: ['js', 'jsx', 'mjs'],
      typescript: ['ts', 'tsx'],
      python: ['py', 'pyx'],
      java: ['java'],
      go: ['go'],
      rust: ['rs'],
      cpp: ['cpp', 'cc', 'cxx', 'c++', 'c'],
      csharp: ['cs']
    };

    const extensions: string[] = [];
    for (const lang of languages) {
      const langExtensions = extensionMap[lang.toLowerCase()];
      if (langExtensions) {
        extensions.push(...langExtensions);
      }
    }

    return extensions.length > 0 ? extensions : [];
  }

  private resolveFullPath(relativePath: string, rootPath: string): string {
    if (relativePath.startsWith('/')) {
      return relativePath;
    }
    return `${rootPath}/${relativePath}`;
  }

  private countNodes(node: CallChainNode | null): number {
    if (!node) return 0;
    
    let count = 1;
    for (const caller of node.callers) {
      count += this.countNodes(caller);
    }
    for (const callee of node.callees) {
      count += this.countNodes(callee);
    }
    
    return count;
  }

  private generateReport(callChain: CallChainNode | null, input: TraceCallChainInput): string {
    let report = `# 🔗 Call Chain Analysis\n\n`;
    report += `**Function:** \`${input.functionName}\`\n`;
    report += `**Search Path:** \`${input.path}\`\n`;
    report += `**Direction:** ${input.direction}\n`;
    report += `**Max Depth:** ${input.maxDepth}\n\n`;

    if (!callChain) {
      report += `## ❌ Function Not Found\n\n`;
      report += `The function \`${input.functionName}\` was not found in the specified path.\n`;
      return report;
    }

    report += `## 🎯 Root Function\n\n`;
    report += `**Location:** \`${callChain.path}:${callChain.line}\`\n`;
    report += `**Language:** ${callChain.language}\n`;
    report += `**Signature:** \`${callChain.signature}\`\n\n`;

    if (input.direction === 'callers' || input.direction === 'both') {
      report += `## 📞 Callers\n\n`;
      if (callChain.callers.length > 0) {
        report += this.renderCallTree(callChain.callers, '📞', 0);
      } else {
        report += `No callers found.\n\n`;
      }
    }

    if (input.direction === 'callees' || input.direction === 'both') {
      report += `## 📤 Callees\n\n`;
      if (callChain.callees.length > 0) {
        report += this.renderCallTree(callChain.callees, '📤', 0);
      } else {
        report += `No callees found.\n\n`;
      }
    }

    return report;
  }

  private renderCallTree(nodes: CallChainNode[], icon: string, depth: number): string {
    let result = '';
    const indent = '  '.repeat(depth);
    
    for (const node of nodes) {
      result += `${indent}${icon} **${node.functionName}** (\`${node.path}:${node.line}\`)\n`;
      result += `${indent}   \`${node.signature}\`\n`;
      
      if (node.callers.length > 0) {
        result += this.renderCallTree(node.callers, '📞', depth + 1);
      }
      
      if (node.callees.length > 0) {
        result += this.renderCallTree(node.callees, '📤', depth + 1);
      }
      
      result += '\n';
    }
    
    return result;
  }

  protected override formatResult(report: string, metadata: Record<string, any>): string {
    return `${report}\n---\n\n**Metadata:**\n${JSON.stringify(metadata, null, 2)}`;
  }

  protected override formatError(error: unknown, context: string): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `${context}: ${message}`;
  }
}
