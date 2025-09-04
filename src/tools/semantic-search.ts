import { BaseNaviTool } from './index.js';
import { SemanticSearchSchema } from '../types/index.js';
import type { SemanticSearchInput } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';
import { promises as fs } from 'fs';
import { relative } from 'path';

interface SearchMatch {
  file: string;
  line: number;
  content: string;
  context: string[];
  score: number;
  language: string;
}

interface SearchResult {
  query: string;
  matches: SearchMatch[];
  totalFiles: number;
  totalMatches: number;
  searchTime: number;
}

/**
 * Tool for performing intelligent semantic code search
 */
export class SemanticSearchTool extends BaseNaviTool {
  name = 'semantic-search';
  description = 'Perform intelligent semantic code search';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<SemanticSearchInput>(args, SemanticSearchSchema);

      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      const startTime = Date.now();
      const result = await this.performSearch(input);
      const searchTime = Date.now() - startTime;

      result.searchTime = searchTime;
      const report = this.generateReport(result, input);

      const metadata = {
        query: input.query,
        searchType: input.searchType,
        totalMatches: result.totalMatches,
        totalFiles: result.totalFiles,
        searchTime: `${searchTime}ms`,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Semantic search failed'));
    }
  }

  private async performSearch(input: SemanticSearchInput): Promise<SearchResult> {
    const result: SearchResult = {
      query: input.query,
      matches: [],
      totalFiles: 0,
      totalMatches: 0,
      searchTime: 0
    };

    // Get all files to search
    const allFiles = await this.fileSystemHelper.getAllFiles(input.path, {
      extensions: this.getSupportedExtensions(input.languages)
    });

    // Filter files by language if specified
    const filesToSearch = allFiles.filter(filePath => {
      if (!input.languages || input.languages.length === 0) return true;
      const lang = detectLanguage(filePath);
      return lang && input.languages.some(l =>
        l.toLowerCase() === lang.name.toLowerCase()
      );
    });

    result.totalFiles = filesToSearch.length;

    // Search each file
    for (const filePath of filesToSearch) {
      const matches = await this.searchFile(filePath, input);
      result.matches.push(...matches);
    }

    // Sort matches by score (descending)
    result.matches.sort((a, b) => b.score - a.score);

    // Limit results
    result.matches = result.matches.slice(0, input.maxResults);
    result.totalMatches = result.matches.length;

    return result;
  }

  private async searchFile(filePath: string, input: SemanticSearchInput): Promise<SearchMatch[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches: SearchMatch[] = [];
      const language = detectLanguage(filePath);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const score = this.calculateMatchScore(line, input.query, input.searchType || 'semantic');

        if (score > 0.3) { // Minimum threshold
          const context = this.getContext(lines, i, input.contextLines || 3);

          matches.push({
            file: relative(input.path, filePath),
            line: i + 1,
            content: line.trim(),
            context,
            score,
            language: language?.name || 'Unknown'
          });
        }
      }

      return matches;
    } catch {
      return [];
    }
  }

  private calculateMatchScore(line: string, query: string, searchType: string): number {
    const normalizedLine = line.toLowerCase();
    const normalizedQuery = query.toLowerCase();

    switch (searchType) {
      case 'exact':
        return normalizedLine.includes(normalizedQuery) ? 1.0 : 0;

      case 'regex':
        try {
          const regex = new RegExp(query, 'i');
          return regex.test(line) ? 1.0 : 0;
        } catch {
          return 0;
        }

      case 'fuzzy':
        return this.fuzzyMatch(normalizedLine, normalizedQuery);

      case 'semantic':
      default:
        return this.semanticMatch(normalizedLine, normalizedQuery);
    }
  }

  private fuzzyMatch(text: string, query: string): number {
    // Simple fuzzy matching
    const words = query.split(/\s+/);
    let totalScore = 0;

    for (const word of words) {
      if (text.includes(word)) {
        totalScore += 1.0;
      } else {
        // Check for partial matches
        const textWords = text.split(/\s+/);
        for (const textWord of textWords) {
          const distance = this.levenshteinDistance(word, textWord);
          const similarity = 1 - (distance / Math.max(word.length, textWord.length));
          if (similarity > 0.7) {
            totalScore += similarity;
            break;
          }
        }
      }
    }

    return Math.min(totalScore / words.length, 1.0);
  }

  private semanticMatch(text: string, query: string): number {
    // Enhanced semantic matching with programming context
    const queryWords = query.toLowerCase().split(/\s+/);
    const textWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);

    let score = 0;
    let matches = 0;

    for (const queryWord of queryWords) {
      let bestMatch = 0;

      for (const textWord of textWords) {
        if (textWord === queryWord) {
          bestMatch = 1.0;
          break;
        } else if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
          bestMatch = Math.max(bestMatch, 0.8);
        } else if (this.areSynonyms(queryWord, textWord)) {
          bestMatch = Math.max(bestMatch, 0.9);
        }
      }

      if (bestMatch > 0) {
        matches++;
        score += bestMatch;
      }
    }

    // Boost score for programming keywords and patterns
    if (this.containsProgrammingPatterns(text, query)) {
      score *= 1.2;
    }

    return matches > 0 ? Math.min(score / queryWords.length, 1.0) : 0;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1,
          matrix[j - 1]![i]! + 1,
          matrix[j - 1]![i - 1]! + indicator
        );
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  private areSynonyms(word1: string, word2: string): boolean {
    const synonyms: Record<string, string[]> = {
      'function': ['method', 'func', 'procedure', 'routine'],
      'variable': ['var', 'field', 'property', 'attribute'],
      'class': ['type', 'struct', 'interface', 'object'],
      'import': ['require', 'include', 'using', 'from'],
      'export': ['module', 'public', 'expose'],
      'async': ['asynchronous', 'await', 'promise'],
      'error': ['exception', 'err', 'failure', 'bug'],
      'config': ['configuration', 'settings', 'options'],
      'auth': ['authentication', 'login', 'security'],
      'api': ['endpoint', 'service', 'interface'],
      'db': ['database', 'storage', 'persistence'],
      'test': ['spec', 'unittest', 'check']
    };

    for (const [key, values] of Object.entries(synonyms)) {
      if ((key === word1 && values.includes(word2)) ||
          (key === word2 && values.includes(word1))) {
        return true;
      }
    }

    return false;
  }

  private containsProgrammingPatterns(text: string, query: string): boolean {
    const programmingPatterns = [
      /function\s+\w+/i,
      /class\s+\w+/i,
      /interface\s+\w+/i,
      /import\s+.*from/i,
      /export\s+(default\s+)?/i,
      /async\s+function/i,
      /await\s+/i,
      /try\s*{/i,
      /catch\s*\(/i,
      /if\s*\(/i,
      /for\s*\(/i,
      /while\s*\(/i,
      /return\s+/i,
      /const\s+\w+/i,
      /let\s+\w+/i,
      /var\s+\w+/i
    ];

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Check if query contains programming keywords
    const programmingKeywords = [
      'function', 'class', 'interface', 'import', 'export', 'async', 'await',
      'try', 'catch', 'if', 'else', 'for', 'while', 'return', 'const', 'let', 'var'
    ];

    const hasKeyword = programmingKeywords.some(keyword =>
      queryLower.includes(keyword) && textLower.includes(keyword)
    );

    // Check if text matches programming patterns
    const hasPattern = programmingPatterns.some(pattern => pattern.test(text));

    return hasKeyword || hasPattern;
  }

  private getContext(lines: string[], lineIndex: number, contextLines: number): string[] {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    return lines.slice(start, end);
  }

  private getSupportedExtensions(languages?: string[]): string[] {
    if (!languages || languages.length === 0) {
      return ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'rs', 'cpp', 'c', 'cs', 'php', 'rb', 'swift'];
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
      'php': ['php'],
      'ruby': ['rb'],
      'swift': ['swift']
    };

    const extensions: string[] = [];
    for (const lang of languages) {
      const exts = extensionMap[lang.toLowerCase()];
      if (exts) extensions.push(...exts);
    }

    return extensions.length > 0 ? extensions : ['ts', 'tsx', 'js', 'jsx'];
  }

  private generateReport(result: SearchResult, input: SemanticSearchInput): string {
    let report = '# 🔍 Semantic Search Results\n\n';

    // Summary
    report += '## 📊 Search Summary\n';
    report += `- **Query**: "${result.query}"\n`;
    report += `- **Search Type**: ${input.searchType}\n`;
    report += `- **Files Searched**: ${result.totalFiles}\n`;
    report += `- **Matches Found**: ${result.totalMatches}\n`;
    report += `- **Search Time**: ${result.searchTime}ms\n\n`;

    if (result.matches.length === 0) {
      report += '## ❌ No Results Found\n';
      report += 'Try adjusting your search query or search type.\n\n';
      return report;
    }

    // Group matches by file
    const matchesByFile = new Map<string, SearchMatch[]>();
    for (const match of result.matches) {
      if (!matchesByFile.has(match.file)) {
        matchesByFile.set(match.file, []);
      }
      matchesByFile.get(match.file)!.push(match);
    }

    report += '## 🎯 Results\n\n';

    for (const [file, matches] of matchesByFile) {
      const avgScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;
      const language = matches[0]?.language || 'Unknown';

      report += `### 📄 **${file}** [${language}] (Score: ${avgScore.toFixed(2)})\n\n`;

      for (const match of matches.slice(0, 3)) { // Show top 3 matches per file
        report += `**Line ${match.line}** (Score: ${match.score.toFixed(2)}):\n`;
        report += '```\n';
        report += `${match.content}\n`;
        report += '```\n\n';

        if (input.includeContext && match.context.length > 1) {
          report += '<details><summary>Show Context</summary>\n\n';
          report += '```\n';
          match.context.forEach((line, idx) => {
            const lineNum = match.line - input.contextLines + idx;
            const marker = lineNum === match.line ? '→ ' : '  ';
            report += `${marker}${lineNum}: ${line}\n`;
          });
          report += '```\n\n';
          report += '</details>\n\n';
        }
      }

      if (matches.length > 3) {
        report += `... and ${matches.length - 3} more matches in this file\n\n`;
      }
    }

    return report;
  }
}
