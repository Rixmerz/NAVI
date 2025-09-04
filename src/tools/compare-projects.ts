import { BaseNaviTool } from './index.js';
import { z } from 'zod';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';

const CompareProjectsSchema = z.object({
  pathA: z.string().describe('First project path to compare'),
  pathB: z.string().describe('Second project path to compare'),
  maxDepth: z.number().optional().default(5).describe('Maximum depth to compare'),
  includeHidden: z.boolean().optional().default(false).describe('Include hidden files'),
  excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
  compareContent: z.boolean().optional().default(false).describe('Compare file contents (slower)')
});

type CompareProjectsInput = z.infer<typeof CompareProjectsSchema>;

interface FileComparison {
  path: string;
  status: 'same' | 'different' | 'only-in-a' | 'only-in-b' | 'size-diff' | 'type-diff';
  sizeA?: number;
  sizeB?: number;
  languageA?: string | undefined;
  languageB?: string | undefined;
}

interface ProjectComparison {
  summary: {
    totalFilesA: number;
    totalFilesB: number;
    commonFiles: number;
    onlyInA: number;
    onlyInB: number;
    different: number;
    identical: number;
  };
  differences: FileComparison[];
  languageDistribution: {
    onlyInA: Record<string, number>;
    onlyInB: Record<string, number>;
    common: Record<string, number>;
  };
}

/**
 * Tool for comparing two project structures and identifying differences
 */
export class CompareProjectsTool extends BaseNaviTool {
  name = 'compare-projects';
  description = 'Compare two project structures and identify differences in files, sizes, and languages';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<CompareProjectsInput>(args, CompareProjectsSchema);
      
      if (!(await this.fileSystemHelper.exists(input.pathA))) {
        throw new Error(`Path A does not exist: ${input.pathA}`);
      }
      
      if (!(await this.fileSystemHelper.exists(input.pathB))) {
        throw new Error(`Path B does not exist: ${input.pathB}`);
      }

      const comparison = await this.compareProjects(input);
      const report = this.generateReport(comparison, input);
      
      const metadata = {
        pathA: input.pathA,
        pathB: input.pathB,
        totalDifferences: comparison.differences.length,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Project comparison failed'));
    }
  }

  private async compareProjects(input: CompareProjectsInput): Promise<ProjectComparison> {
    // Get all files from both projects
    const filesA = await this.getProjectFiles(input.pathA, input);
    const filesB = await this.getProjectFiles(input.pathB, input);

    const comparison: ProjectComparison = {
      summary: {
        totalFilesA: filesA.size,
        totalFilesB: filesB.size,
        commonFiles: 0,
        onlyInA: 0,
        onlyInB: 0,
        different: 0,
        identical: 0
      },
      differences: [],
      languageDistribution: {
        onlyInA: {},
        onlyInB: {},
        common: {}
      }
    };

    // Get all unique paths
    const allPaths = new Set([...filesA.keys(), ...filesB.keys()]);

    for (const path of allPaths) {
      const fileA = filesA.get(path);
      const fileB = filesB.get(path);

      if (fileA && fileB) {
        comparison.summary.commonFiles++;
        
        // Compare files
        const fileComparison = await this.compareFiles(path, fileA, fileB, input);
        if (fileComparison.status !== 'same') {
          comparison.differences.push(fileComparison);
          comparison.summary.different++;
        } else {
          comparison.summary.identical++;
        }

        // Track common languages
        if (fileA.language) {
          comparison.languageDistribution.common[fileA.language] = 
            (comparison.languageDistribution.common[fileA.language] || 0) + 1;
        }
      } else if (fileA) {
        comparison.summary.onlyInA++;
        comparison.differences.push({
          path,
          status: 'only-in-a',
          sizeA: fileA.size,
          languageA: fileA.language
        });

        if (fileA.language) {
          comparison.languageDistribution.onlyInA[fileA.language] = 
            (comparison.languageDistribution.onlyInA[fileA.language] || 0) + 1;
        }
      } else if (fileB) {
        comparison.summary.onlyInB++;
        comparison.differences.push({
          path,
          status: 'only-in-b',
          sizeB: fileB.size,
          languageB: fileB.language
        });

        if (fileB.language) {
          comparison.languageDistribution.onlyInB[fileB.language] = 
            (comparison.languageDistribution.onlyInB[fileB.language] || 0) + 1;
        }
      }
    }

    return comparison;
  }

  private async getProjectFiles(
    projectPath: string, 
    input: CompareProjectsInput
  ): Promise<Map<string, { size: number; language?: string; fullPath: string }>> {
    const files = new Map();
    
    const options: Parameters<typeof this.fileSystemHelper.getAllFiles>[1] = {};
    if (input.excludePatterns) {
      options.excludePatterns = input.excludePatterns;
    }

    const allFiles = await this.fileSystemHelper.getAllFiles(projectPath, options);

    for (const filePath of allFiles) {
      const stats = await this.fileSystemHelper.getStats(filePath);
      if (!stats || !stats.isFile) continue;

      const relativePath = this.fileSystemHelper.getRelativePath(filePath, projectPath);
      const language = detectLanguage(filePath);

      files.set(relativePath, {
        size: stats.size,
        language: language?.name,
        fullPath: filePath
      });
    }

    return files;
  }

  private async compareFiles(
    path: string,
    fileA: { size: number; language?: string; fullPath: string },
    fileB: { size: number; language?: string; fullPath: string },
    input: CompareProjectsInput
  ): Promise<FileComparison> {
    // Size comparison
    if (fileA.size !== fileB.size) {
      return {
        path,
        status: 'size-diff',
        sizeA: fileA.size,
        sizeB: fileB.size,
        languageA: fileA.language,
        languageB: fileB.language
      };
    }

    // Language comparison
    if (fileA.language !== fileB.language) {
      return {
        path,
        status: 'type-diff',
        sizeA: fileA.size,
        sizeB: fileB.size,
        languageA: fileA.language,
        languageB: fileB.language
      };
    }

    // Content comparison (if requested)
    if (input.compareContent) {
      const contentA = await this.fileSystemHelper.readFile(fileA.fullPath);
      const contentB = await this.fileSystemHelper.readFile(fileB.fullPath);
      
      if (contentA !== contentB) {
        return {
          path,
          status: 'different',
          sizeA: fileA.size,
          sizeB: fileB.size,
          languageA: fileA.language,
          languageB: fileB.language
        };
      }
    }

    return {
      path,
      status: 'same',
      sizeA: fileA.size,
      sizeB: fileB.size,
      languageA: fileA.language,
      languageB: fileB.language
    };
  }

  private generateReport(comparison: ProjectComparison, input: CompareProjectsInput): string {
    let report = '# 🔄 Project Comparison Report\n\n';

    // Summary
    report += '## 📊 Summary\n';
    report += `- **Project A**: ${input.pathA} (${comparison.summary.totalFilesA} files)\n`;
    report += `- **Project B**: ${input.pathB} (${comparison.summary.totalFilesB} files)\n`;
    report += `- **Common files**: ${comparison.summary.commonFiles}\n`;
    report += `- **Only in A**: ${comparison.summary.onlyInA}\n`;
    report += `- **Only in B**: ${comparison.summary.onlyInB}\n`;
    report += `- **Different**: ${comparison.summary.different}\n`;
    report += `- **Identical**: ${comparison.summary.identical}\n\n`;

    // Differences
    if (comparison.differences.length > 0) {
      report += '## 🔍 Differences\n\n';
      
      const byStatus = new Map<string, FileComparison[]>();
      for (const diff of comparison.differences) {
        if (!byStatus.has(diff.status)) byStatus.set(diff.status, []);
        byStatus.get(diff.status)!.push(diff);
      }

      for (const [status, files] of byStatus) {
        const emoji = this.getStatusEmoji(status);
        report += `### ${emoji} ${this.getStatusLabel(status)} (${files.length})\n\n`;
        
        for (const file of files.slice(0, 10)) { // Show first 10
          report += `- **${file.path}**`;
          if (file.sizeA !== undefined && file.sizeB !== undefined) {
            report += ` (${this.formatFileSize(file.sizeA)} → ${this.formatFileSize(file.sizeB)})`;
          } else if (file.sizeA !== undefined) {
            report += ` (${this.formatFileSize(file.sizeA)})`;
          } else if (file.sizeB !== undefined) {
            report += ` (${this.formatFileSize(file.sizeB)})`;
          }
          
          if (file.languageA && file.languageB && file.languageA !== file.languageB) {
            report += ` [${file.languageA} → ${file.languageB}]`;
          } else if (file.languageA || file.languageB) {
            report += ` [${file.languageA || file.languageB}]`;
          }
          report += '\n';
        }
        
        if (files.length > 10) {
          report += `... and ${files.length - 10} more\n`;
        }
        report += '\n';
      }
    }

    return report;
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'only-in-a': return '➖';
      case 'only-in-b': return '➕';
      case 'different': return '🔄';
      case 'size-diff': return '📏';
      case 'type-diff': return '🔀';
      default: return '❓';
    }
  }

  private getStatusLabel(status: string): string {
    switch (status) {
      case 'only-in-a': return 'Only in Project A';
      case 'only-in-b': return 'Only in Project B';
      case 'different': return 'Content Different';
      case 'size-diff': return 'Size Different';
      case 'type-diff': return 'Type Different';
      default: return 'Unknown';
    }
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
