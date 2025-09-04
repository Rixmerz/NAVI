import { BaseNaviTool } from './index.js';
import { z } from 'zod';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';

const FindFilesSchema = z.object({
  path: z.string().describe('Root path to search in'),
  pattern: z.string().optional().describe('File name pattern (glob)'),
  content: z.string().optional().describe('Content to search for'),
  extensions: z.array(z.string()).optional().describe('File extensions to include'),
  languages: z.array(z.string()).optional().describe('Programming languages to include'),
  minSize: z.number().optional().describe('Minimum file size in bytes'),
  maxSize: z.number().optional().describe('Maximum file size in bytes'),
  maxResults: z.number().optional().default(50).describe('Maximum number of results'),
  includeHidden: z.boolean().optional().default(false).describe('Include hidden files'),
  excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
  caseSensitive: z.boolean().optional().default(false).describe('Case sensitive search')
});

type FindFilesInput = z.infer<typeof FindFilesSchema>;

interface FileMatch {
  path: string;
  relativePath: string;
  size: number;
  language?: string;
  matches?: Array<{ line: number; content: string; context: string[] }>;
}

/**
 * Tool for finding files based on various criteria
 */
export class FindFilesTool extends BaseNaviTool {
  name = 'find-files';
  description = 'Find files based on name patterns, content, size, language, and other criteria';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<FindFilesInput>(args, FindFilesSchema);
      
      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      const matches = await this.findFiles(input);
      const report = this.generateReport(matches, input);
      
      const metadata = {
        searchPath: input.path,
        totalMatches: matches.length,
        pattern: input.pattern,
        contentSearch: !!input.content,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'File search failed'));
    }
  }

  private async findFiles(input: FindFilesInput): Promise<FileMatch[]> {
    const matches: FileMatch[] = [];
    
    // Get all files first
    const options: Parameters<typeof this.fileSystemHelper.getAllFiles>[1] = {};

    if (input.extensions) {
      options.extensions = input.extensions;
    }

    if (input.excludePatterns) {
      options.excludePatterns = input.excludePatterns;
    }

    const allFiles = await this.fileSystemHelper.getAllFiles(input.path, options);

    for (const filePath of allFiles) {
      if (matches.length >= input.maxResults) break;

      const fileStats = await this.fileSystemHelper.getStats(filePath);
      if (!fileStats || !fileStats.isFile) continue;

      // Size filtering
      if (input.minSize && fileStats.size < input.minSize) continue;
      if (input.maxSize && fileStats.size > input.maxSize) continue;

      // Hidden files filtering
      if (!input.includeHidden && this.isHiddenFile(filePath)) continue;

      // Pattern matching
      if (input.pattern && !this.matchesPattern(filePath, input.pattern)) continue;

      // Language filtering
      const language = detectLanguage(filePath);
      if (input.languages && input.languages.length > 0) {
        if (!language || !input.languages.includes(language.name.toLowerCase())) continue;
      }

      const match: FileMatch = {
        path: filePath,
        relativePath: this.fileSystemHelper.getRelativePath(filePath, input.path),
        size: fileStats.size
      };

      if (language?.name) {
        match.language = language.name;
      }

      // Content search
      if (input.content) {
        const contentMatches = await this.searchInFile(filePath, input.content, input.caseSensitive);
        if (contentMatches.length === 0) continue;
        match.matches = contentMatches;
      }

      matches.push(match);
    }

    return matches;
  }

  private async searchInFile(
    filePath: string, 
    searchTerm: string, 
    caseSensitive: boolean
  ): Promise<Array<{ line: number; content: string; context: string[] }>> {
    const content = await this.fileSystemHelper.readFile(filePath);
    if (!content) return [];

    const lines = content.split('\n');
    const matches: Array<{ line: number; content: string; context: string[] }> = [];
    const searchPattern = caseSensitive ? searchTerm : searchTerm.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const searchLine = caseSensitive ? line : line.toLowerCase();

      if (searchLine.includes(searchPattern)) {
        // Get context lines (2 before, 2 after)
        const context: string[] = [];
        for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
          if (j !== i) {
            context.push(`${j + 1}: ${lines[j]}`);
          }
        }

        matches.push({
          line: i + 1,
          content: line.trim(),
          context
        });
      }
    }

    return matches;
  }

  private isHiddenFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    return fileName.startsWith('.');
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(fileName);
  }

  private generateReport(matches: FileMatch[], input: FindFilesInput): string {
    let report = '# 🔍 File Search Results\n\n';

    if (matches.length === 0) {
      report += '❌ No files found matching the criteria.\n\n';
      report += '## Search Criteria\n';
      if (input.pattern) report += `- **Pattern**: ${input.pattern}\n`;
      if (input.content) report += `- **Content**: "${input.content}"\n`;
      if (input.extensions) report += `- **Extensions**: ${input.extensions.join(', ')}\n`;
      if (input.languages) report += `- **Languages**: ${input.languages.join(', ')}\n`;
      return report;
    }

    report += `✅ Found **${matches.length}** file(s) matching criteria\n\n`;

    // Group by language if available
    const byLanguage = new Map<string, FileMatch[]>();
    for (const match of matches) {
      const lang = match.language || 'Unknown';
      if (!byLanguage.has(lang)) byLanguage.set(lang, []);
      byLanguage.get(lang)!.push(match);
    }

    for (const [language, files] of byLanguage) {
      report += `## 📁 ${language} Files (${files.length})\n\n`;
      
      for (const file of files) {
        const sizeStr = this.formatFileSize(file.size);
        report += `### 📄 ${file.relativePath} (${sizeStr})\n`;
        
        if (file.matches && file.matches.length > 0) {
          report += `**Content matches**: ${file.matches.length}\n\n`;
          
          for (const match of file.matches.slice(0, 3)) { // Show first 3 matches
            report += `**Line ${match.line}**: \`${match.content}\`\n`;
            if (match.context.length > 0) {
              report += '```\n';
              report += match.context.join('\n');
              report += '\n```\n';
            }
            report += '\n';
          }
          
          if (file.matches.length > 3) {
            report += `... and ${file.matches.length - 3} more matches\n\n`;
          }
        } else {
          report += '\n';
        }
      }
    }

    // Summary statistics
    report += '## 📊 Summary\n';
    report += `- **Total files**: ${matches.length}\n`;
    report += `- **Languages found**: ${byLanguage.size}\n`;
    
    const totalSize = matches.reduce((sum, match) => sum + match.size, 0);
    report += `- **Total size**: ${this.formatFileSize(totalSize)}\n`;
    
    if (input.content) {
      const totalMatches = matches.reduce((sum, match) => sum + (match.matches?.length || 0), 0);
      report += `- **Content matches**: ${totalMatches}\n`;
    }

    return report;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
  }
}
