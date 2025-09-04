import { BaseNaviTool } from './index.js';
import { z } from 'zod';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';

const AnalyzeCodebaseSchema = z.object({
  path: z.string().describe('Root path to analyze'),
  includeHidden: z.boolean().optional().default(false).describe('Include hidden files'),
  excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
  detailed: z.boolean().optional().default(false).describe('Include detailed file analysis')
});

type AnalyzeCodebaseInput = z.infer<typeof AnalyzeCodebaseSchema>;

interface CodebaseStats {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  languageStats: Record<string, { files: number; size: number; percentage: number }>;
  extensionStats: Record<string, { files: number; size: number }>;
  largestFiles: Array<{ path: string; size: number; language?: string }>;
  fileDistribution: {
    small: number; // < 10KB
    medium: number; // 10KB - 100KB
    large: number; // 100KB - 1MB
    huge: number; // > 1MB
  };
  directoryStats: Array<{ path: string; files: number; size: number }>;
}

/**
 * Tool for analyzing codebase statistics and composition
 */
export class AnalyzeCodebaseTool extends BaseNaviTool {
  name = 'analyze-codebase';
  description = 'Analyze codebase statistics, language distribution, and file composition';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<AnalyzeCodebaseInput>(args, AnalyzeCodebaseSchema);
      
      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      const stats = await this.analyzeCodebase(input);
      const report = this.generateReport(stats, input.detailed);
      
      const metadata = {
        analyzedPath: input.path,
        timestamp: new Date().toISOString(),
        totalFiles: stats.totalFiles,
        totalSize: this.formatFileSize(stats.totalSize),
        languages: Object.keys(stats.languageStats).length
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Codebase analysis failed'));
    }
  }

  private async analyzeCodebase(input: AnalyzeCodebaseInput): Promise<CodebaseStats> {
    const stats: CodebaseStats = {
      totalFiles: 0,
      totalDirectories: 0,
      totalSize: 0,
      languageStats: {},
      extensionStats: {},
      largestFiles: [],
      fileDistribution: { small: 0, medium: 0, large: 0, huge: 0 },
      directoryStats: []
    };

    await this.traverseDirectory(input.path, input, stats);
    
    // Calculate percentages for languages
    for (const lang in stats.languageStats) {
      const langStats = stats.languageStats[lang];
      if (langStats) {
        langStats.percentage = (langStats.size / stats.totalSize) * 100;
      }
    }

    // Sort largest files
    stats.largestFiles.sort((a, b) => b.size - a.size);
    stats.largestFiles = stats.largestFiles.slice(0, 10);

    // Sort directory stats
    stats.directoryStats.sort((a, b) => b.size - a.size);
    stats.directoryStats = stats.directoryStats.slice(0, 10);

    return stats;
  }

  private async traverseDirectory(
    dirPath: string, 
    input: AnalyzeCodebaseInput, 
    stats: CodebaseStats,
    currentDepth: number = 0
  ): Promise<void> {
    const options: Parameters<typeof this.fileSystemHelper.listDirectory>[1] = {
      includeHidden: input.includeHidden
    };

    if (input.excludePatterns) {
      options.excludePatterns = input.excludePatterns;
    }

    const entries = await this.fileSystemHelper.listDirectory(dirPath, options);

    let dirSize = 0;
    let dirFiles = 0;

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry}`;
      const fileStats = await this.fileSystemHelper.getStats(fullPath);
      
      if (!fileStats) continue;

      if (fileStats.isDirectory) {
        stats.totalDirectories++;
        await this.traverseDirectory(fullPath, input, stats, currentDepth + 1);
      } else {
        stats.totalFiles++;
        stats.totalSize += fileStats.size;
        dirSize += fileStats.size;
        dirFiles++;

        // Language analysis
        const language = detectLanguage(fullPath);
        const langName = language?.name || 'Unknown';
        
        if (!stats.languageStats[langName]) {
          stats.languageStats[langName] = { files: 0, size: 0, percentage: 0 };
        }
        stats.languageStats[langName].files++;
        stats.languageStats[langName].size += fileStats.size;

        // Extension analysis
        const ext = this.fileSystemHelper.getExtension(fullPath) || 'no-extension';
        if (!stats.extensionStats[ext]) {
          stats.extensionStats[ext] = { files: 0, size: 0 };
        }
        stats.extensionStats[ext].files++;
        stats.extensionStats[ext].size += fileStats.size;

        // File size distribution
        if (fileStats.size < 10 * 1024) stats.fileDistribution.small++;
        else if (fileStats.size < 100 * 1024) stats.fileDistribution.medium++;
        else if (fileStats.size < 1024 * 1024) stats.fileDistribution.large++;
        else stats.fileDistribution.huge++;

        // Track largest files
        const fileMatch: { path: string; size: number; language?: string } = {
          path: this.fileSystemHelper.getRelativePath(fullPath, input.path),
          size: fileStats.size
        };

        if (language?.name) {
          fileMatch.language = language.name;
        }

        stats.largestFiles.push(fileMatch);
      }
    }

    // Track directory stats
    if (dirFiles > 0) {
      stats.directoryStats.push({
        path: this.fileSystemHelper.getRelativePath(dirPath, input.path) || '.',
        files: dirFiles,
        size: dirSize
      });
    }
  }

  private generateReport(stats: CodebaseStats, detailed: boolean): string {
    let report = '# 📊 Codebase Analysis Report\n\n';

    // Overview
    report += '## 📈 Overview\n';
    report += `- **Total Files**: ${stats.totalFiles.toLocaleString()}\n`;
    report += `- **Total Directories**: ${stats.totalDirectories.toLocaleString()}\n`;
    report += `- **Total Size**: ${this.formatFileSize(stats.totalSize)}\n\n`;

    // Language Distribution
    report += '## 🌐 Language Distribution\n';
    const sortedLangs = Object.entries(stats.languageStats)
      .sort(([,a], [,b]) => b.size - a.size)
      .slice(0, 10);

    for (const [lang, data] of sortedLangs) {
      const bar = this.createProgressBar(data.percentage, 20);
      report += `- **${lang}**: ${data.files} files, ${this.formatFileSize(data.size)} (${data.percentage.toFixed(1)}%)\n`;
      report += `  ${bar}\n`;
    }
    report += '\n';

    // File Size Distribution
    report += '## 📏 File Size Distribution\n';
    const total = stats.totalFiles;
    report += `- **Small** (< 10KB): ${stats.fileDistribution.small} (${((stats.fileDistribution.small/total)*100).toFixed(1)}%)\n`;
    report += `- **Medium** (10KB-100KB): ${stats.fileDistribution.medium} (${((stats.fileDistribution.medium/total)*100).toFixed(1)}%)\n`;
    report += `- **Large** (100KB-1MB): ${stats.fileDistribution.large} (${((stats.fileDistribution.large/total)*100).toFixed(1)}%)\n`;
    report += `- **Huge** (> 1MB): ${stats.fileDistribution.huge} (${((stats.fileDistribution.huge/total)*100).toFixed(1)}%)\n\n`;

    // Largest Files
    report += '## 🔍 Largest Files\n';
    for (const file of stats.largestFiles.slice(0, 5)) {
      const langInfo = file.language ? ` [${file.language}]` : '';
      report += `- **${file.path}**${langInfo}: ${this.formatFileSize(file.size)}\n`;
    }
    report += '\n';

    if (detailed) {
      // Extension Statistics
      report += '## 📁 Extension Statistics\n';
      const sortedExts = Object.entries(stats.extensionStats)
        .sort(([,a], [,b]) => b.files - a.files)
        .slice(0, 10);

      for (const [ext, data] of sortedExts) {
        report += `- **.${ext}**: ${data.files} files, ${this.formatFileSize(data.size)}\n`;
      }
      report += '\n';

      // Directory Statistics
      report += '## 📂 Largest Directories\n';
      for (const dir of stats.directoryStats.slice(0, 5)) {
        report += `- **${dir.path}**: ${dir.files} files, ${this.formatFileSize(dir.size)}\n`;
      }
    }

    return report;
  }

  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage.toFixed(1)}%`;
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
