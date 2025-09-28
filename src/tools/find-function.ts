import { BaseNaviTool } from './index.js';
import { FindFunctionSchema } from '../types/index.js';
import type { FindFunctionInput, FunctionDefinition, FunctionReference, FunctionResult } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';
import { promises as fs } from 'fs';
import { relative } from 'path';

/**
 * Tool for finding function definitions and references across the codebase
 */
export class FindFunctionTool extends BaseNaviTool {
  name = 'find-function';
  description = 'Find function definitions by name, return exact location, code, and references across the codebase';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<FindFunctionInput>(args, FindFunctionSchema);
      
      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      const result = await this.findFunction(input);
      const report = this.generateReport(result, input);
      
      const metadata = {
        functionName: input.functionName,
        searchPath: input.path,
        totalReferences: result.totalReferences,
        hasDefinition: !!result.definition,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Function search failed'));
    }
  }

  private async findFunction(input: FindFunctionInput): Promise<FunctionResult> {
    const result: FunctionResult = {
      references: [],
      totalReferences: 0
    };

    // Get all files to search
    const options: Parameters<typeof this.fileSystemHelper.getAllFiles>[1] = {};
    if (input.languages) {
      const extensions = this.getExtensionsForLanguages(input.languages);
      options.extensions = extensions;
    }

    // Add default excludePatterns
    options.excludePatterns = this.config.excludePatterns;

    const allFiles = await this.fileSystemHelper.getAllFiles(input.path, options);
    let processedFiles = 0;

    for (const filePath of allFiles) {
      if (result.references.length >= input.maxResults) break;

      const language = detectLanguage(filePath);
      if (input.languages && input.languages.length > 0) {
        if (!language || !input.languages.includes(language.name.toLowerCase())) {
          continue;
        }
      }

      const fileResult = await this.searchInFile(filePath, input, language?.name || 'Unknown');
      
      if (fileResult.definition && !result.definition) {
        result.definition = fileResult.definition;
      }
      
      result.references.push(...fileResult.references);
      processedFiles++;
    }

    result.totalReferences = result.references.length;
    
    // Sort references by relevance (definitions first, then calls)
    result.references.sort((a, b) => {
      if (a.type === 'declaration' && b.type !== 'declaration') return -1;
      if (b.type === 'declaration' && a.type !== 'declaration') return 1;
      return a.path.localeCompare(b.path);
    });

    return result;
  }

  private async searchInFile(
    filePath: string, 
    input: FindFunctionInput, 
    language: string
  ): Promise<{ definition?: FunctionDefinition; references: FunctionReference[] }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const references: FunctionReference[] = [];
      let definition: FunctionDefinition | undefined;

      const patterns = this.getFunctionPatterns(language, input.functionName, input.exactMatch);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line?.trim()) continue;

        for (const pattern of patterns) {
          const matches = line?.matchAll(pattern.regex);
          
          for (const match of matches) {
            if (!match.index) continue;

            const matchedName = match[pattern.nameGroup] || match[0];
            
            // Check if this is the function we're looking for
            if (!this.isMatchingFunction(matchedName, input.functionName, input.exactMatch)) {
              continue;
            }

            const ref: FunctionReference = {
              path: relative(input.path, filePath),
              line: i + 1,
              column: match.index + 1,
              context: line?.trim() || '',
              type: pattern.type
            };

            references.push(ref);

            // If this is a function definition, create the definition object
            if (pattern.type === 'declaration' && !definition && line) {
              definition = this.createFunctionDefinition(
                matchedName,
                filePath,
                i + 1,
                match.index + 1,
                language,
                line,
                lines,
                i,
                input.path
              );
            }
          }
        }
      }

      return definition ? { definition, references } : { references };
    } catch {
      return { references: [] };
    }
  }

  private getFunctionPatterns(language: string, functionName: string, exactMatch: boolean) {
    const escapedName = exactMatch ? 
      functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : 
      functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');

    const patterns = [];

    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        patterns.push(
          // Function declarations
          { regex: new RegExp(`\\b(?:function|async\\s+function)\\s+(${escapedName})\\s*\\(`, 'g'), nameGroup: 1, type: 'declaration' as const },
          // Arrow functions
          { regex: new RegExp(`\\b(${escapedName})\\s*[:=]\\s*(?:async\\s+)?\\([^)]*\\)\\s*=>`, 'g'), nameGroup: 1, type: 'declaration' as const },
          // Method definitions
          { regex: new RegExp(`\\b(${escapedName})\\s*\\([^)]*\\)\\s*{`, 'g'), nameGroup: 1, type: 'declaration' as const },
          // Function calls
          { regex: new RegExp(`\\b(${escapedName})\\s*\\(`, 'g'), nameGroup: 1, type: 'call' as const }
        );
        break;

      case 'python':
        patterns.push(
          // Function definitions
          { regex: new RegExp(`^\\s*(?:async\\s+)?def\\s+(${escapedName})\\s*\\(`, 'gm'), nameGroup: 1, type: 'declaration' as const },
          // Function calls
          { regex: new RegExp(`\\b(${escapedName})\\s*\\(`, 'g'), nameGroup: 1, type: 'call' as const }
        );
        break;

      case 'java':
        patterns.push(
          // Method definitions
          { regex: new RegExp(`\\b(?:public|private|protected|static|final|abstract|synchronized|native|strictfp)\\s+.*\\s+(${escapedName})\\s*\\(`, 'g'), nameGroup: 1, type: 'declaration' as const },
          // Method calls
          { regex: new RegExp(`\\b(${escapedName})\\s*\\(`, 'g'), nameGroup: 1, type: 'call' as const }
        );
        break;

      case 'go':
        patterns.push(
          // Function definitions
          { regex: new RegExp(`^\\s*func\\s+(?:\\([^)]*\\)\\s+)?(${escapedName})\\s*\\(`, 'gm'), nameGroup: 1, type: 'declaration' as const },
          // Function calls
          { regex: new RegExp(`\\b(${escapedName})\\s*\\(`, 'g'), nameGroup: 1, type: 'call' as const }
        );
        break;

      default:
        // Generic patterns for unknown languages
        patterns.push(
          { regex: new RegExp(`\\b(${escapedName})\\s*\\(`, 'g'), nameGroup: 1, type: 'call' as const }
        );
    }

    return patterns;
  }

  private isMatchingFunction(matchedName: string, targetName: string, exactMatch: boolean): boolean {
    if (exactMatch) {
      return matchedName === targetName;
    }
    return matchedName.toLowerCase().includes(targetName.toLowerCase());
  }

  private createFunctionDefinition(
    name: string,
    filePath: string,
    line: number,
    column: number,
    language: string,
    currentLine: string,
    allLines: string[],
    lineIndex: number,
    rootPath: string
  ): FunctionDefinition {
    const signature = this.extractFunctionSignature(currentLine, allLines, lineIndex, language);
    const documentation = this.extractDocumentation(allLines, lineIndex);
    const parameters = this.extractParameters(signature, language);
    const returnType = this.extractReturnType(signature, language);
    const parentClass = this.findParentClass(allLines, lineIndex, language);
    const module = this.extractModuleName(filePath);

    return {
      name,
      path: relative(rootPath, filePath),
      line,
      column,
      language,
      signature,
      documentation: documentation || '',
      parentClass: parentClass || '',
      module,
      parameters,
      returnType: returnType || ''
    };
  }

  private extractFunctionSignature(currentLine: string, allLines: string[], lineIndex: number, language: string): string {
    // Try to get the complete function signature, which might span multiple lines
    let signature = currentLine.trim();
    
    // For languages with opening braces, find the complete signature
    if (language.toLowerCase() === 'javascript' || language.toLowerCase() === 'typescript') {
      let braceCount = 0;
      let parenCount = 0;
      let i = lineIndex;
      
      while (i < allLines.length && i < lineIndex + 5) { // Limit to 5 lines
        const line = allLines[i];
        if (!line) {
          i++;
          continue;
        }
        for (const char of line) {
          if (char === '(') parenCount++;
          if (char === ')') parenCount--;
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        
        if (i > lineIndex) {
          signature += ' ' + line?.trim();
        }
        
        if (parenCount === 0 && (braceCount > 0 || line?.includes('=>'))) {
          break;
        }
        i++;
      }
    }
    
    return signature;
  }

  private extractDocumentation(allLines: string[], lineIndex: number): string | undefined {
    // Look for documentation comments above the function
    let docLines: string[] = [];
    let i = lineIndex - 1;
    
    while (i >= 0 && i >= lineIndex - 10) { // Look up to 10 lines above
      const line = allLines[i]?.trim();
      
      if (line && (line.startsWith('/**') || line.startsWith('/*') || line.startsWith('*') || line.startsWith('//'))) {
        docLines.unshift(line);
      } else if (line === '' || (line && line.startsWith('*'))) {
        docLines.unshift(line);
      } else {
        break;
      }
      i--;
    }
    
    return docLines.length > 0 ? docLines.join('\n') : undefined;
  }

  private extractParameters(signature: string, language: string): Array<{ name: string; type?: string; optional?: boolean }> {
    const parameters: Array<{ name: string; type?: string; optional?: boolean }> = [];
    
    // Extract parameter list from signature
    const parenMatch = signature.match(/\(([^)]*)\)/);
    if (!parenMatch) return parameters;
    
    const paramStr = parenMatch[1]?.trim();
    if (!paramStr) return parameters;
    
    const params = paramStr.split(',').map(p => p.trim());
    
    for (const param of params) {
      if (!param) continue;
      
      const paramInfo: { name: string; type?: string; optional?: boolean } = { name: param };
      
      // TypeScript/JavaScript parameter parsing
      if (language.toLowerCase() === 'typescript') {
        const tsMatch = param.match(/^(\w+)(\?)?:\s*(.+)$/);
        if (tsMatch && tsMatch[1]) {
          paramInfo.name = tsMatch[1];
          paramInfo.optional = !!tsMatch[2];
          paramInfo.type = tsMatch[3] || '';
        }
      }
      
      parameters.push(paramInfo);
    }
    
    return parameters;
  }

  private extractReturnType(signature: string, language: string): string | undefined {
    if (language.toLowerCase() === 'typescript') {
      const returnMatch = signature.match(/:\s*([^{=]+)(?:\s*[{=]|$)/);
      return returnMatch && returnMatch[1] ? returnMatch[1].trim() : undefined;
    }
    return undefined;
  }

  private findParentClass(allLines: string[], lineIndex: number, language: string): string | undefined {
    // Look backwards for class definition
    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = allLines[i]?.trim();
      
      if (line && (language.toLowerCase() === 'javascript' || language.toLowerCase() === 'typescript')) {
        const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
        if (classMatch) {
          return classMatch[1];
        }
      } else if (line && language.toLowerCase() === 'python') {
        const classMatch = line.match(/^class\s+(\w+)/);
        if (classMatch) {
          return classMatch[1];
        }
      }
    }
    
    return undefined;
  }

  private extractModuleName(filePath: string): string {
    const parts = filePath.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart ? lastPart.replace(/\.[^.]+$/, '') : '';
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

  private generateReport(result: FunctionResult, input: FindFunctionInput): string {
    let report = `# 🔍 Function Search Results\n\n`;
    report += `**Function:** \`${input.functionName}\`\n`;
    report += `**Search Path:** \`${input.path}\`\n\n`;

    if (result.definition) {
      report += `## 📍 Definition\n\n`;
      report += `**Location:** \`${result.definition.path}:${result.definition.line}:${result.definition.column}\`\n`;
      report += `**Language:** ${result.definition.language}\n`;
      if (result.definition.parentClass) {
        report += `**Class:** ${result.definition.parentClass}\n`;
      }
      report += `**Module:** ${result.definition.module}\n\n`;
      report += `**Signature:**\n\`\`\`${result.definition.language.toLowerCase()}\n${result.definition.signature}\n\`\`\`\n\n`;
      
      if (result.definition.parameters.length > 0) {
        report += `**Parameters:**\n`;
        for (const param of result.definition.parameters) {
          report += `- \`${param.name}\``;
          if (param.type) report += `: ${param.type}`;
          if (param.optional) report += ` (optional)`;
          report += `\n`;
        }
        report += `\n`;
      }

      if (result.definition.documentation) {
        report += `**Documentation:**\n\`\`\`\n${result.definition.documentation}\n\`\`\`\n\n`;
      }
    } else {
      report += `## ❌ No Definition Found\n\n`;
    }

    if (result.references.length > 0) {
      report += `## 📚 References (${result.totalReferences})\n\n`;
      
      const groupedRefs = this.groupReferencesByType(result.references);
      
      for (const [type, refs] of Object.entries(groupedRefs)) {
        if (refs.length === 0) continue;
        
        report += `### ${this.getTypeIcon(type)} ${this.capitalizeFirst(type)}s (${refs.length})\n\n`;
        
        for (const ref of refs.slice(0, 20)) { // Limit to 20 per type
          report += `- **${ref.path}:${ref.line}** - \`${ref.context}\`\n`;
        }
        
        if (refs.length > 20) {
          report += `- ... and ${refs.length - 20} more\n`;
        }
        report += `\n`;
      }
    } else {
      report += `## 📚 No References Found\n\n`;
    }

    return report;
  }

  private groupReferencesByType(references: FunctionReference[]): Record<string, FunctionReference[]> {
    const grouped: Record<string, FunctionReference[]> = {
      declaration: [],
      call: [],
      assignment: [],
      import: []
    };

    for (const ref of references) {
      if (grouped[ref.type]) {
        grouped[ref.type]?.push(ref);
      }
    }

    return grouped;
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      declaration: '🏷️',
      call: '📞',
      assignment: '📝',
      import: '📦'
    };
    return icons[type] || '📄';
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  protected override formatResult(report: string, metadata: Record<string, any>): string {
    return `${report}\n---\n\n**Metadata:**\n${JSON.stringify(metadata, null, 2)}`;
  }

  protected override formatError(error: unknown, context: string): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `${context}: ${message}`;
  }
}
