import { BaseNaviTool } from './index.js';
import { promises as fs } from 'fs';
import { relative } from 'path';
import { detectLanguage } from '../utils/language-detection.js';
import { FileSystemHelper } from '../utils/file-system.js';
import type { FindFunctionCallsInput, FunctionCall } from '../types/index.js';

export class FindFunctionCallsTool extends BaseNaviTool {
  name = 'find-function-calls';
  description = 'Find all direct function calls made by a specific function';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: FindFunctionCallsInput): Promise<string> {
    try {
      const calls = await this.findFunctionCalls(args);
      return this.formatCallsResult(calls);
    } catch (error) {
      return this.formatCallsError(error, 'Failed to find function calls');
    }
  }



  private async findFunctionCalls(input: FindFunctionCallsInput): Promise<FunctionCall[]> {
    const calls: FunctionCall[] = [];
    
    // Get all files to search
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

      const fileCalls = await this.findCallsInFile(
        filePath,
        input.functionName,
        language?.name || 'Unknown',
        input.path,
        input.includeBuiltins || false
      );
      
      calls.push(...fileCalls);
      
      if (calls.length >= (input.maxResults || 50)) {
        calls.splice(input.maxResults || 50);
        break;
      }
    }

    return calls;
  }

  private async findCallsInFile(
    filePath: string,
    functionName: string,
    language: string,
    rootPath: string,
    includeBuiltins: boolean
  ): Promise<FunctionCall[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const calls: FunctionCall[] = [];

      // First, find the function definition
      const functionDef = this.findFunctionDefinition(lines, functionName, language);
      if (!functionDef) {
        return calls;
      }

      // Extract function body
      const functionBody = this.extractFunctionBody(lines, functionDef.startLine, functionDef.endLine);
      const bodyLines = functionBody.split('\n');

      // Find all function calls within the body
      for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i];
        if (!line) continue;

        const lineCalls = this.extractFunctionCalls(line, language, includeBuiltins);
        for (const call of lineCalls) {
          calls.push({
            functionName: call,
            calledFrom: functionName,
            path: relative(rootPath, filePath),
            line: functionDef.startLine + i + 1,
            language,
            context: line.trim()
          });
        }
      }

      return calls;
    } catch {
      return [];
    }
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
    
    return lines.length - 1;
  }

  private extractFunctionBody(lines: string[], startLine: number, endLine: number): string {
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private extractFunctionCalls(line: string, language: string, includeBuiltins: boolean): string[] {
    const calls: string[] = [];
    
    // Basic function call pattern: functionName(
    const callPattern = /(\w+)\s*\(/g;
    let match;
    
    while ((match = callPattern.exec(line)) !== null) {
      const functionName = match[1];
      
      // Skip keywords and built-ins if not requested
      if (functionName && (!includeBuiltins && this.isBuiltinOrKeyword(functionName, language))) {
        continue;
      }

      if (functionName) {
        calls.push(functionName);
      }
    }
    
    // Method calls: object.method(
    const methodPattern = /(\w+)\.(\w+)\s*\(/g;
    while ((match = methodPattern.exec(line)) !== null) {
      const methodName = match[2];
      
      if (methodName && (!includeBuiltins && this.isBuiltinOrKeyword(methodName, language))) {
        continue;
      }

      if (methodName) {
        calls.push(`${match[1]}.${methodName}`);
      }
    }
    
    return calls;
  }

  private isBuiltinOrKeyword(name: string, language: string): boolean {
    const builtins = {
      javascript: ['console', 'setTimeout', 'setInterval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent'],
      typescript: ['console', 'setTimeout', 'setInterval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent'],
      python: ['print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed'],
      java: ['System', 'String', 'Integer', 'Double', 'Boolean'],
      go: ['fmt', 'len', 'make', 'append', 'copy', 'delete'],
    };
    
    const keywords = {
      javascript: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw'],
      typescript: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw'],
      python: ['if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'return', 'try', 'except', 'finally', 'raise'],
      java: ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw'],
      go: ['if', 'else', 'for', 'switch', 'case', 'break', 'continue', 'return', 'defer', 'go', 'select'],
    };
    
    const langKey = language.toLowerCase() as keyof typeof builtins;
    return (builtins[langKey] || []).includes(name) || (keywords[langKey] || []).includes(name);
  }

  private getFunctionDeclarationPatterns(language: string, functionName?: string): RegExp[] {
    const escapedName = functionName ? functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '\\w+';
    const patterns: RegExp[] = [];

    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        patterns.push(
          new RegExp(`^\\s*function\\s+${escapedName}\\s*\\(`),
          new RegExp(`^\\s*const\\s+${escapedName}\\s*=\\s*function`),
          new RegExp(`^\\s*const\\s+${escapedName}\\s*=\\s*\\(`),
          new RegExp(`^\\s*${escapedName}\\s*:\\s*function`),
          new RegExp(`^\\s*async\\s+function\\s+${escapedName}\\s*\\(`),
          new RegExp(`^\\s*${escapedName}\\s*\\([^)]*\\)\\s*=>`)
        );
        break;
      case 'python':
        patterns.push(new RegExp(`^\\s*def\\s+${escapedName}\\s*\\(`));
        break;
      case 'java':
        patterns.push(new RegExp(`^\\s*(?:public|private|protected)?\\s*(?:static)?\\s*\\w+\\s+${escapedName}\\s*\\(`));
        break;
      case 'go':
        patterns.push(new RegExp(`^\\s*func\\s+${escapedName}\\s*\\(`));
        break;
    }

    return patterns;
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

  private formatCallsResult(calls: FunctionCall[]): string {
    if (calls.length === 0) {
      return 'No function calls found.';
    }

    let report = `# 📞 Function Calls Analysis\n\n`;
    report += `**Total calls found:** ${calls.length}\n\n`;

    // Group by called function
    const groupedCalls = calls.reduce((acc, call) => {
      if (!acc[call.functionName]) {
        acc[call.functionName] = [];
      }
      acc[call.functionName]!.push(call);
      return acc;
    }, {} as Record<string, FunctionCall[]>);

    for (const [functionName, functionCalls] of Object.entries(groupedCalls)) {
      report += `## 🎯 ${functionName}\n\n`;
      report += `**Called ${functionCalls.length} time(s)**\n\n`;

      for (const call of functionCalls) {
        report += `- **Location:** \`${call.path}:${call.line}\`\n`;
        report += `  **Context:** \`${call.context}\`\n\n`;
      }
    }

    return report;
  }

  private formatCallsError(error: unknown, context: string): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `${context}: ${message}`;
  }
}
