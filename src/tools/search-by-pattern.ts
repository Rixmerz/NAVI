import { BaseNaviTool } from './index.js';
import { SearchByPatternSchema } from '../types/index.js';
import type { SearchByPatternInput, PatternMatch } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';
import { promises as fs } from 'fs';
import { relative } from 'path';

/**
 * Tool for advanced pattern search with regex support and scope filtering
 */
export class SearchByPatternTool extends BaseNaviTool {
  name = 'search-by-pattern';
  description = 'Advanced pattern search tool with regex support and scope filtering';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<SearchByPatternInput>(args, SearchByPatternSchema);
      
      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      // Validate regex pattern
      try {
        new RegExp(input.pattern, input.caseSensitive ? 'g' : 'gi');
      } catch (error) {
        throw new Error(`Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      const matches = await this.searchByPattern(input);
      const report = this.generateReport(matches, input);
      
      const metadata = {
        pattern: input.pattern,
        searchPath: input.path,
        scope: input.scope,
        totalMatches: matches.length,
        caseSensitive: input.caseSensitive,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Pattern search failed'));
    }
  }

  private async searchByPattern(input: SearchByPatternInput): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

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
      if (matches.length >= input.maxResults) break;

      const language = detectLanguage(filePath);
      if (input.languages && input.languages.length > 0) {
        if (!language || !input.languages.includes(language.name.toLowerCase())) {
          continue;
        }
      }

      const fileMatches = await this.searchInFile(filePath, input, language?.name || 'Unknown');
      matches.push(...fileMatches);

      if (matches.length >= input.maxResults) {
        matches.splice(input.maxResults);
        break;
      }
    }

    return matches;
  }

  private async searchInFile(
    filePath: string, 
    input: SearchByPatternInput, 
    language: string
  ): Promise<PatternMatch[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches: PatternMatch[] = [];

      const regex = new RegExp(input.pattern, input.caseSensitive ? 'g' : 'gi');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line || !line.trim()) continue;

        const lineMatches = line.matchAll(regex);
        
        for (const match of lineMatches) {
          if (!match.index) continue;

          // Determine the scope of this match
          const scope = this.determineScope(lines, i, language, input.scope);
          
          // Skip if scope doesn't match the requested scope
          if (input.scope !== 'all' && scope !== input.scope) {
            continue;
          }

          const context = input.includeContext ? 
            this.getContext(lines, i, 3) : [];

          matches.push({
            path: relative(input.path, filePath),
            line: i + 1,
            column: match.index + 1,
            content: line.trim(),
            context,
            scope: scope as any,
            language
          });
        }
      }

      return matches;
    } catch {
      return [];
    }
  }

  private determineScope(
    lines: string[],
    lineIndex: number,
    language: string,
    _requestedScope: string
  ): string {
    const line = lines[lineIndex];
    
    // Quick scope detection based on line content and context
    if (this.isInFunction(lines, lineIndex, language)) {
      return 'function';
    } else if (this.isInClass(lines, lineIndex, language)) {
      return 'class';
    } else if (line && this.isVariableDeclaration(line, language)) {
      return 'variable';
    } else if (line && this.isImportStatement(line, language)) {
      return 'import';
    }
    
    return 'other';
  }

  private isInFunction(lines: string[], lineIndex: number, language: string): boolean {
    // Look backwards to find function declaration
    for (let i = lineIndex; i >= Math.max(0, lineIndex - 20); i--) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      switch (language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          if (line.match(/\b(?:function|async\s+function)\s+\w+\s*\(/) ||
              line.match(/\w+\s*[:=]\s*(?:async\s+)?\([^)]*\)\s*=>/) ||
              line.match(/\w+\s*\([^)]*\)\s*{/)) {
            return true;
          }
          break;
          
        case 'python':
          if (line.match(/^\s*(?:async\s+)?def\s+\w+\s*\(/)) {
            return true;
          }
          break;
          
        case 'java':
          if (line.match(/\b(?:public|private|protected|static|final|abstract)\s+.*\s+\w+\s*\(/)) {
            return true;
          }
          break;
          
        case 'go':
          if (line.match(/^\s*func\s+(?:\([^)]*\)\s+)?\w+\s*\(/)) {
            return true;
          }
          break;
      }
    }
    
    return false;
  }

  private isInClass(lines: string[], lineIndex: number, language: string): boolean {
    // Look backwards to find class declaration
    for (let i = lineIndex; i >= Math.max(0, lineIndex - 50); i--) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      switch (language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          if (line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+\w+/)) {
            return true;
          }
          break;
          
        case 'python':
          if (line.match(/^class\s+\w+/)) {
            return true;
          }
          break;
          
        case 'java':
          if (line.match(/\b(?:public|private|protected|abstract|final)\s+class\s+\w+/)) {
            return true;
          }
          break;
          
        case 'go':
          if (line.match(/^type\s+\w+\s+struct/)) {
            return true;
          }
          break;
      }
    }
    
    return false;
  }

  private isVariableDeclaration(line: string, language: string): boolean {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return /\b(?:const|let|var)\s+\w+/.test(line) ||
               /\w+\s*[:=]\s*/.test(line);
               
      case 'python':
        return /^\s*\w+\s*=/.test(line);
        
      case 'java':
        return /\b(?:public|private|protected|static|final)\s+\w+\s+\w+/.test(line);
        
      case 'go':
        return /\b(?:var|const)\s+\w+/.test(line) ||
               /\w+\s*:=/.test(line);
               
      default:
        return /\w+\s*[:=]/.test(line);
    }
  }

  private isImportStatement(line: string, language: string): boolean {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return /^\s*import\s+/.test(line) ||
               /^\s*export\s+/.test(line) ||
               /require\s*\(/.test(line);
               
      case 'python':
        return /^\s*(?:import|from)\s+/.test(line);
        
      case 'java':
        return /^\s*import\s+/.test(line);
        
      case 'go':
        return /^\s*import\s+/.test(line);
        
      default:
        return /^\s*(?:import|include|require)\s+/.test(line);
    }
  }

  private getContext(lines: string[], lineIndex: number, contextLines: number): string[] {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    
    const context: string[] = [];
    for (let i = start; i < end; i++) {
      const prefix = i === lineIndex ? '>>> ' : '    ';
      context.push(`${prefix}${i + 1}: ${lines[i]}`);
    }
    
    return context;
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

  private generateReport(matches: PatternMatch[], input: SearchByPatternInput): string {
    let report = `# 🔍 Pattern Search Results\n\n`;
    report += `**Pattern:** \`${input.pattern}\`\n`;
    report += `**Search Path:** \`${input.path}\`\n`;
    report += `**Scope:** ${input.scope}\n`;
    report += `**Case Sensitive:** ${input.caseSensitive}\n`;
    report += `**Total Matches:** ${matches.length}\n\n`;

    if (matches.length === 0) {
      report += `## ❌ No Matches Found\n\n`;
      report += `No matches were found for the pattern \`${input.pattern}\` in the specified scope.\n`;
      return report;
    }

    // Group matches by scope
    const groupedMatches = this.groupMatchesByScope(matches);
    
    for (const [scope, scopeMatches] of Object.entries(groupedMatches)) {
      if (scopeMatches.length === 0) continue;
      
      report += `## ${this.getScopeIcon(scope)} ${this.capitalizeFirst(scope)} Matches (${scopeMatches.length})\n\n`;
      
      // Group by file
      const fileGroups = this.groupMatchesByFile(scopeMatches);
      
      for (const [filePath, fileMatches] of Object.entries(fileGroups)) {
        report += `### 📄 ${filePath} (${fileMatches.length} matches)\n\n`;
        
        for (const match of fileMatches.slice(0, 10)) { // Limit to 10 per file
          report += `**Line ${match.line}:${match.column}** - \`${match.content}\`\n`;
          
          if (input.includeContext && match.context.length > 0) {
            report += `\`\`\`${match.language.toLowerCase()}\n`;
            report += match.context.join('\n');
            report += `\n\`\`\`\n`;
          }
          report += `\n`;
        }
        
        if (fileMatches.length > 10) {
          report += `... and ${fileMatches.length - 10} more matches in this file\n\n`;
        }
      }
    }

    // Summary statistics
    report += `## 📊 Summary\n\n`;
    const languageStats = this.getLanguageStats(matches);
    const scopeStats = this.getScopeStats(matches);
    
    report += `**Languages:**\n`;
    for (const [lang, count] of Object.entries(languageStats)) {
      report += `- ${lang}: ${count} matches\n`;
    }
    
    report += `\n**Scopes:**\n`;
    for (const [scope, count] of Object.entries(scopeStats)) {
      report += `- ${this.capitalizeFirst(scope)}: ${count} matches\n`;
    }

    return report;
  }

  private groupMatchesByScope(matches: PatternMatch[]): Record<string, PatternMatch[]> {
    const grouped: Record<string, PatternMatch[]> = {
      function: [],
      class: [],
      variable: [],
      import: [],
      other: []
    };

    for (const match of matches) {
      const scope = match.scope || 'other';
      if (grouped[scope]) {
        grouped[scope].push(match);
      }
    }

    return grouped;
  }

  private groupMatchesByFile(matches: PatternMatch[]): Record<string, PatternMatch[]> {
    const grouped: Record<string, PatternMatch[]> = {};

    for (const match of matches) {
      const path = match.path || 'unknown';
      if (!grouped[path]) {
        grouped[path] = [];
      }
      grouped[path].push(match);
    }

    return grouped;
  }

  private getLanguageStats(matches: PatternMatch[]): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const match of matches) {
      stats[match.language] = (stats[match.language] || 0) + 1;
    }
    
    return stats;
  }

  private getScopeStats(matches: PatternMatch[]): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const match of matches) {
      stats[match.scope] = (stats[match.scope] || 0) + 1;
    }
    
    return stats;
  }

  private getScopeIcon(scope: string): string {
    const icons: Record<string, string> = {
      function: '🔧',
      class: '🏗️',
      variable: '📝',
      import: '📦',
      other: '📄'
    };
    return icons[scope] || '📄';
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
