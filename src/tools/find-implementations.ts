import { BaseNaviTool } from './index.js';
import { FindImplementationsSchema } from '../types/index.js';
import type { FindImplementationsInput, Implementation } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';
import { promises as fs } from 'fs';
import { relative } from 'path';

/**
 * Tool for finding all implementations of an interface or abstract class
 */
export class FindImplementationsTool extends BaseNaviTool {
  name = 'find-implementations';
  description = 'Find all implementations of an interface or abstract class';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<FindImplementationsInput>(args, FindImplementationsSchema);
      
      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      const implementations = await this.findImplementations(input);
      const report = this.generateReport(implementations, input);
      
      const metadata = {
        interfaceName: input.interfaceName,
        searchPath: input.path,
        totalImplementations: implementations.length,
        includeAbstract: input.includeAbstract,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Implementation search failed'));
    }
  }

  private async findImplementations(input: FindImplementationsInput): Promise<Implementation[]> {
    const implementations: Implementation[] = [];

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
      if (implementations.length >= input.maxResults) break;

      const language = detectLanguage(filePath);
      if (input.languages && input.languages.length > 0) {
        if (!language || !input.languages.includes(language.name.toLowerCase())) {
          continue;
        }
      }

      const fileImplementations = await this.searchImplementationsInFile(
        filePath, 
        input.interfaceName, 
        language?.name || 'Unknown',
        input.path,
        input.includeAbstract
      );
      
      implementations.push(...fileImplementations);

      if (implementations.length >= input.maxResults) {
        implementations.splice(input.maxResults);
        break;
      }
    }

    return implementations;
  }

  private async searchImplementationsInFile(
    filePath: string, 
    interfaceName: string, 
    language: string,
    rootPath: string,
    includeAbstract: boolean
  ): Promise<Implementation[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const implementations: Implementation[] = [];

      const patterns = this.getImplementationPatterns(language, interfaceName);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        for (const pattern of patterns) {
          const match = line.match(pattern.regex);
          if (match) {
            const className = match[pattern.classNameGroup];
            if (!className) continue;
            const isAbstract = pattern.isAbstract || this.isAbstractClass(line, language);
            
            // Skip abstract classes if not requested
            if (isAbstract && !includeAbstract) {
              continue;
            }

            const signature = this.extractClassSignature(line, lines, i);
            const methods = this.extractClassMethods(lines, i, language);

            implementations.push({
              name: className,
              path: relative(rootPath, filePath),
              line: i + 1,
              language,
              signature,
              isAbstract,
              parentInterface: interfaceName,
              methods
            });
          }
        }
      }

      return implementations;
    } catch {
      return [];
    }
  }

  private getImplementationPatterns(language: string, interfaceName: string): Array<{
    regex: RegExp;
    classNameGroup: number;
    isAbstract?: boolean;
  }> {
    const escapedInterface = interfaceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns: Array<{ regex: RegExp; classNameGroup: number; isAbstract?: boolean }> = [];

    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        // Class implements interface
        patterns.push({
          regex: new RegExp(`class\\s+(\\w+)\\s+implements\\s+.*\\b${escapedInterface}\\b`, 'i'),
          classNameGroup: 1
        });

        // Abstract class implements interface
        patterns.push({
          regex: new RegExp(`abstract\\s+class\\s+(\\w+)\\s+implements\\s+.*\\b${escapedInterface}\\b`, 'i'),
          classNameGroup: 1,
          isAbstract: true
        });

        // Class extends abstract class or base class
        patterns.push({
          regex: new RegExp(`class\\s+(\\w+)\\s+extends\\s+${escapedInterface}\\b`, 'i'),
          classNameGroup: 1
        });

        // Function/class that contains the interface name (duck typing)
        patterns.push({
          regex: new RegExp(`(?:class|function)\\s+(\\w*${escapedInterface}\\w*)`, 'i'),
          classNameGroup: 1
        });

        // Constructor function pattern
        patterns.push({
          regex: new RegExp(`function\\s+(\\w+)\\s*\\([^)]*\\)\\s*{[^}]*${escapedInterface}`, 'i'),
          classNameGroup: 1
        });

        // Factory function pattern
        patterns.push({
          regex: new RegExp(`(?:const|let|var)\\s+(create${escapedInterface}|make${escapedInterface}|new${escapedInterface}|${escapedInterface}Factory)`, 'i'),
          classNameGroup: 1
        });

        // Object literal that might implement interface
        patterns.push({
          regex: new RegExp(`(?:const|let|var)\\s+(\\w*${escapedInterface}\\w*)\\s*=\\s*{`, 'i'),
          classNameGroup: 1
        });
        break;

      case 'java':
        // Class implements interface
        patterns.push({
          regex: new RegExp(`class\\s+(\\w+)\\s+implements\\s+.*\\b${escapedInterface}\\b`, 'i'),
          classNameGroup: 1
        });
        
        // Abstract class implements interface
        patterns.push({
          regex: new RegExp(`abstract\\s+class\\s+(\\w+)\\s+implements\\s+.*\\b${escapedInterface}\\b`, 'i'),
          classNameGroup: 1,
          isAbstract: true
        });
        
        // Class extends abstract class
        patterns.push({
          regex: new RegExp(`class\\s+(\\w+)\\s+extends\\s+${escapedInterface}\\b`, 'i'),
          classNameGroup: 1
        });
        break;

      case 'csharp':
        // Class implements interface
        patterns.push({
          regex: new RegExp(`class\\s+(\\w+)\\s*:\\s*.*\\b${escapedInterface}\\b`, 'i'),
          classNameGroup: 1
        });
        
        // Abstract class implements interface
        patterns.push({
          regex: new RegExp(`abstract\\s+class\\s+(\\w+)\\s*:\\s*.*\\b${escapedInterface}\\b`, 'i'),
          classNameGroup: 1,
          isAbstract: true
        });
        break;

      case 'python':
        // Class inherits from interface/base class
        patterns.push({
          regex: new RegExp(`class\\s+(\\w+)\\s*\\([^)]*\\b${escapedInterface}\\b[^)]*\\)`, 'i'),
          classNameGroup: 1
        });
        break;

      case 'go':
        // Go doesn't have explicit implements, but we can look for struct types
        // that might implement the interface methods
        patterns.push({
          regex: new RegExp(`type\\s+(\\w+)\\s+struct`, 'i'),
          classNameGroup: 1
        });
        break;

      case 'rust':
        // impl Trait for Struct
        patterns.push({
          regex: new RegExp(`impl\\s+${escapedInterface}\\s+for\\s+(\\w+)`, 'i'),
          classNameGroup: 1
        });
        break;

      default:
        // Generic pattern for unknown languages
        patterns.push({
          regex: new RegExp(`class\\s+(\\w+)\\s+.*\\b${escapedInterface}\\b`, 'i'),
          classNameGroup: 1
        });
    }

    return patterns;
  }

  private isAbstractClass(line: string, language: string): boolean {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
      case 'java':
      case 'csharp':
        return /\babstract\s+class\b/i.test(line);
        
      case 'python':
        // Check for ABC import or abstractmethod decorators
        return /ABC|@abstractmethod/i.test(line);
        
      default:
        return false;
    }
  }

  private extractClassSignature(currentLine: string, allLines: string[], lineIndex: number): string {
    let signature = currentLine.trim();
    
    // Try to get complete signature for multi-line class declarations
    let i = lineIndex;
    let braceFound = false;
    
    while (i < allLines.length && i < lineIndex + 5 && !braceFound) {
      const line = allLines[i];
      if (!line) {
        i++;
        continue;
      }

      if (i > lineIndex) {
        signature += ' ' + line.trim();
      }

      if (line.includes('{') || line.includes(':')) {
        braceFound = true;
      }
      
      i++;
    }
    
    return signature;
  }

  private extractClassMethods(
    lines: string[],
    classStartLine: number,
    language: string
  ): Array<{ name: string; signature: string; line: number }> {
    const methods: Array<{ name: string; signature: string; line: number }> = [];
    let braceCount = 0;
    let inClass = false;

    for (let i = classStartLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmedLine = line.trim();
      
      // Track braces to know when we're inside the class
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inClass = true;
        }
        if (char === '}') {
          braceCount--;
          if (braceCount === 0 && inClass) {
            // Exited the class
            return methods;
          }
        }
      }
      
      if (inClass && braceCount > 0) {
        // Look for method definitions
        const methodPatterns = this.getMethodPatterns(language);
        
        for (const pattern of methodPatterns) {
          const match = trimmedLine.match(pattern);
          if (match) {
            const methodName = match[1];
            if (!methodName) continue;
            const signature = this.extractMethodSignature(trimmedLine, lines, i, language);

            methods.push({
              name: methodName,
              signature,
              line: i + 1
            });
          }
        }
      }
    }

    return methods;
  }

  private getMethodPatterns(language: string): RegExp[] {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return [
          /(\w+)\s*\([^)]*\)\s*{/,
          /(\w+)\s*[:=]\s*(?:async\s+)?\([^)]*\)\s*=>/,
          /(?:public|private|protected|static|async)\s+(\w+)\s*\(/
        ];
        
      case 'java':
        return [
          /\b(?:public|private|protected|static|final|abstract|synchronized)\s+.*\s+(\w+)\s*\(/
        ];
        
      case 'csharp':
        return [
          /\b(?:public|private|protected|static|virtual|override|abstract)\s+.*\s+(\w+)\s*\(/
        ];
        
      case 'python':
        return [
          /^\s*(?:async\s+)?def\s+(\w+)\s*\(/
        ];
        
      case 'go':
        return [
          /^\s*func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/
        ];
        
      case 'rust':
        return [
          /^\s*(?:pub\s+)?fn\s+(\w+)\s*\(/
        ];
        
      default:
        return [/(\w+)\s*\(/];
    }
  }

  private extractMethodSignature(currentLine: string, allLines: string[], lineIndex: number, language: string): string {
    let signature = currentLine.trim();
    
    // Try to get complete signature for multi-line methods
    if (language.toLowerCase() === 'java' || language.toLowerCase() === 'csharp') {
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
          signature += ' ' + line?.trim();
        }

        if (parenCount === 0 && line?.includes('{')) {
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

  private generateReport(implementations: Implementation[], input: FindImplementationsInput): string {
    let report = `# 🔍 Interface Implementations\n\n`;
    report += `**Interface/Abstract Class:** \`${input.interfaceName}\`\n`;
    report += `**Search Path:** \`${input.path}\`\n`;
    report += `**Include Abstract:** ${input.includeAbstract}\n`;
    report += `**Total Implementations:** ${implementations.length}\n\n`;

    if (implementations.length === 0) {
      report += `## ❌ No Implementations Found\n\n`;
      report += `No implementations were found for \`${input.interfaceName}\` in the specified path.\n`;
      return report;
    }

    // Group implementations by language
    const groupedImplementations = this.groupImplementationsByLanguage(implementations);
    
    for (const [language, impls] of Object.entries(groupedImplementations)) {
      if (impls.length === 0) continue;
      
      report += `## ${this.getLanguageIcon(language)} ${language} Implementations (${impls.length})\n\n`;
      
      for (const impl of impls) {
        report += `### ${impl.isAbstract ? '🔶' : '🔷'} ${impl.name}\n\n`;
        report += `**Location:** \`${impl.path}:${impl.line}\`\n`;
        report += `**Type:** ${impl.isAbstract ? 'Abstract Class' : 'Concrete Class'}\n`;
        report += `**Signature:** \`${impl.signature}\`\n\n`;
        
        if (impl.methods.length > 0) {
          report += `**Methods (${impl.methods.length}):**\n`;
          for (const method of impl.methods.slice(0, 10)) {
            report += `- **${method.name}** (line ${method.line}) - \`${method.signature}\`\n`;
          }
          if (impl.methods.length > 10) {
            report += `- ... and ${impl.methods.length - 10} more methods\n`;
          }
          report += `\n`;
        }
      }
    }

    // Summary statistics
    report += `## 📊 Summary\n\n`;
    const stats = this.getImplementationStats(implementations);
    
    report += `**By Type:**\n`;
    report += `- Concrete Classes: ${stats.concrete}\n`;
    report += `- Abstract Classes: ${stats.abstract}\n\n`;
    
    report += `**By Language:**\n`;
    for (const [lang, count] of Object.entries(stats.byLanguage)) {
      report += `- ${lang}: ${count} implementations\n`;
    }
    
    report += `\n**Average Methods per Implementation:** ${stats.avgMethods.toFixed(1)}\n`;

    return report;
  }

  private groupImplementationsByLanguage(implementations: Implementation[]): Record<string, Implementation[]> {
    const grouped: Record<string, Implementation[]> = {};

    for (const impl of implementations) {
      if (!grouped[impl.language]) {
        grouped[impl.language] = [];
      }
      grouped[impl.language]?.push(impl);
    }

    return grouped;
  }

  private getImplementationStats(implementations: Implementation[]): {
    concrete: number;
    abstract: number;
    byLanguage: Record<string, number>;
    avgMethods: number;
  } {
    const stats = {
      concrete: 0,
      abstract: 0,
      byLanguage: {} as Record<string, number>,
      avgMethods: 0
    };

    let totalMethods = 0;

    for (const impl of implementations) {
      if (impl.isAbstract) {
        stats.abstract++;
      } else {
        stats.concrete++;
      }

      stats.byLanguage[impl.language] = (stats.byLanguage[impl.language] || 0) + 1;
      totalMethods += impl.methods.length;
    }

    stats.avgMethods = implementations.length > 0 ? totalMethods / implementations.length : 0;

    return stats;
  }

  private getLanguageIcon(language: string): string {
    const icons: Record<string, string> = {
      typescript: '🔷',
      javascript: '🟨',
      java: '☕',
      python: '🐍',
      csharp: '🔷',
      go: '🐹',
      rust: '🦀',
      cpp: '⚙️'
    };
    return icons[language.toLowerCase()] || '📄';
  }

  protected override formatResult(report: string, metadata: Record<string, any>): string {
    return `${report}\n---\n\n**Metadata:**\n${JSON.stringify(metadata, null, 2)}`;
  }

  protected override formatError(error: unknown, context: string): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `${context}: ${message}`;
  }
}
