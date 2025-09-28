import { BaseNaviTool } from './index.js';
import { AnalyzeImportsSchema } from '../types/index.js';
import type { AnalyzeImportsInput, ImportAnalysis } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';
import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Tool for analyzing import dependencies for a specific file
 */
export class AnalyzeImportsTool extends BaseNaviTool {
  name = 'analyze-imports';
  description = 'Analyze import dependencies for a specific file';

  private fileSystemHelper: FileSystemHelper;

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<AnalyzeImportsInput>(args, AnalyzeImportsSchema);
      
      if (!(await this.fileSystemHelper.exists(input.filePath))) {
        throw new Error(`File does not exist: ${input.filePath}`);
      }

      const analysis = await this.analyzeImports(input);
      const report = this.generateReport(analysis, input);
      
      const metadata = {
        filePath: input.filePath,
        language: analysis.language,
        totalImports: analysis.imports.length,
        totalExports: analysis.exports.length,
        internalDependencies: analysis.dependencies.internal.length,
        externalDependencies: analysis.dependencies.external.length,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Import analysis failed'));
    }
  }

  private async analyzeImports(input: AnalyzeImportsInput): Promise<ImportAnalysis> {
    const content = await fs.readFile(input.filePath, 'utf-8');
    const lines = content.split('\n');
    const language = detectLanguage(input.filePath);
    const languageName = language?.name || 'Unknown';

    const analysis: ImportAnalysis = {
      filePath: input.filePath,
      language: languageName,
      imports: [],
      exports: [],
      dependencies: {
        internal: [],
        external: []
      }
    };

    // Analyze imports
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      const importInfo = this.parseImportStatement(line, languageName, i + 1);
      if (importInfo) {
        // Determine if it's internal or external
        const isInternal = await this.isInternalImport(importInfo.source, input.filePath);
        importInfo.type = isInternal ? 'internal' : 'external';

        // Check if import is used (simplified check)
        if (input.showUnused) {
          importInfo.used = this.isImportUsed(content, importInfo.items);
        } else {
          importInfo.used = true; // Assume used if not checking
        }

        analysis.imports.push(importInfo);

        // Add to dependencies
        if (isInternal && input.includeInternal) {
          if (!analysis.dependencies.internal.includes(importInfo.source)) {
            analysis.dependencies.internal.push(importInfo.source);
          }
        } else if (!isInternal && input.includeExternal) {
          if (!analysis.dependencies.external.includes(importInfo.source)) {
            analysis.dependencies.external.push(importInfo.source);
          }
        }
      }

      // Analyze exports
      const exportInfo = this.parseExportStatement(line, languageName, i + 1);
      if (exportInfo) {
        analysis.exports.push(exportInfo);
      }
    }

    return analysis;
  }

  private parseImportStatement(line: string, language: string, lineNumber: number): ImportAnalysis['imports'][0] | null {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        return this.parseJSImport(line, lineNumber);
        
      case 'python':
        return this.parsePythonImport(line, lineNumber);
        
      case 'java':
        return this.parseJavaImport(line, lineNumber);
        
      case 'go':
        return this.parseGoImport(line, lineNumber);
        
      case 'rust':
        return this.parseRustImport(line, lineNumber);
        
      default:
        return null;
    }
  }

  private parseJSImport(line: string, lineNumber: number): ImportAnalysis['imports'][0] | null {
    // ES6 import statements
    const importMatch = line.match(/import\s+(.*?)\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch && importMatch[1] && importMatch[2]) {
      const importClause = importMatch[1].trim();
      const source = importMatch[2];
      const items = this.parseJSImportClause(importClause);

      return {
        source,
        type: 'external', // Will be determined later
        items,
        line: lineNumber,
        used: true // Will be determined later
      };
    }

    // CommonJS require
    const requireMatch = line.match(/(?:const|let|var)\s+(.+?)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (requireMatch && requireMatch[1] && requireMatch[2]) {
      const importClause = requireMatch[1].trim();
      const source = requireMatch[2];
      const items = this.parseJSRequireClause(importClause);

      return {
        source,
        type: 'external',
        items,
        line: lineNumber,
        used: true
      };
    }

    return null;
  }

  private parseJSImportClause(clause: string): ImportAnalysis['imports'][0]['items'] {
    const items: ImportAnalysis['imports'][0]['items'] = [];

    // Default import
    if (!clause.includes('{') && !clause.includes('*')) {
      items.push({
        name: clause.trim(),
        isDefault: true
      });
      return items;
    }

    // Namespace import
    const namespaceMatch = clause.match(/\*\s+as\s+(\w+)/);
    if (namespaceMatch && namespaceMatch[1]) {
      items.push({
        name: namespaceMatch[1],
        isNamespace: true
      });
      return items;
    }

    // Named imports
    const namedMatch = clause.match(/{([^}]+)}/);
    if (namedMatch && namedMatch[1]) {
      const namedImports = namedMatch[1].split(',').map(item => item.trim());
      for (const namedImport of namedImports) {
        const aliasMatch = namedImport.match(/(\w+)\s+as\s+(\w+)/);
        if (aliasMatch && aliasMatch[1] && aliasMatch[2]) {
          items.push({
            name: aliasMatch[1],
            alias: aliasMatch[2]
          });
        } else {
          items.push({
            name: namedImport.trim()
          });
        }
      }
    }

    return items;
  }

  private parseJSRequireClause(clause: string): ImportAnalysis['imports'][0]['items'] {
    const items: ImportAnalysis['imports'][0]['items'] = [];

    // Destructuring
    if (clause.includes('{') && clause.includes('}')) {
      const destructureMatch = clause.match(/{([^}]+)}/);
      if (destructureMatch && destructureMatch[1]) {
        const destructuredItems = destructureMatch[1].split(',').map(item => item.trim());
        for (const item of destructuredItems) {
          items.push({ name: item });
        }
      }
    } else {
      // Simple assignment
      items.push({
        name: clause.trim(),
        isDefault: true
      });
    }

    return items;
  }

  private parsePythonImport(line: string, lineNumber: number): ImportAnalysis['imports'][0] | null {
    // from ... import ...
    const fromImportMatch = line.match(/from\s+([^\s]+)\s+import\s+(.+)/);
    if (fromImportMatch && fromImportMatch[1] && fromImportMatch[2]) {
      const source = fromImportMatch[1];
      const importClause = fromImportMatch[2].trim();
      const items = this.parsePythonImportClause(importClause);

      return {
        source,
        type: 'external',
        items,
        line: lineNumber,
        used: true
      };
    }

    // import ...
    const importMatch = line.match(/import\s+(.+)/);
    if (importMatch && importMatch[1]) {
      const modules = importMatch[1].split(',').map(m => m.trim());
      const items = modules.map(module => {
        const aliasMatch = module.match(/(\S+)\s+as\s+(\w+)/);
        if (aliasMatch && aliasMatch[1] && aliasMatch[2]) {
          return { name: aliasMatch[1], alias: aliasMatch[2] };
        }
        return { name: module };
      });

      const firstModule = modules[0];
      if (firstModule) {
        const sourcePart = firstModule.split(' ')[0];
        return {
          source: sourcePart || firstModule,
          type: 'external',
          items,
          line: lineNumber,
          used: true
        };
      }
    }

    return null;
  }

  private parsePythonImportClause(clause: string): ImportAnalysis['imports'][0]['items'] {
    const items: ImportAnalysis['imports'][0]['items'] = [];

    if (clause === '*') {
      items.push({ name: '*', isNamespace: true });
    } else {
      const importItems = clause.split(',').map(item => item.trim());
      for (const item of importItems) {
        const aliasMatch = item.match(/(\w+)\s+as\s+(\w+)/);
        if (aliasMatch && aliasMatch[1] && aliasMatch[2]) {
          items.push({
            name: aliasMatch[1],
            alias: aliasMatch[2]
          });
        } else {
          items.push({ name: item });
        }
      }
    }

    return items;
  }

  private parseJavaImport(line: string, lineNumber: number): ImportAnalysis['imports'][0] | null {
    const importMatch = line.match(/import\s+(?:static\s+)?([^;]+);/);
    if (importMatch && importMatch[1]) {
      const source = importMatch[1].trim();
      const lastPart = source.split('.').pop();

      return {
        source,
        type: 'external',
        items: [{ name: lastPart || source }],
        line: lineNumber,
        used: true
      };
    }

    return null;
  }

  private parseGoImport(line: string, lineNumber: number): ImportAnalysis['imports'][0] | null {
    // Single import
    const singleImportMatch = line.match(/import\s+"([^"]+)"/);
    if (singleImportMatch && singleImportMatch[1]) {
      const source = singleImportMatch[1];
      const lastPart = source.split('/').pop();
      return {
        source,
        type: 'external',
        items: [{ name: lastPart || source }],
        line: lineNumber,
        used: true
      };
    }

    // Aliased import
    const aliasImportMatch = line.match(/import\s+(\w+)\s+"([^"]+)"/);
    if (aliasImportMatch && aliasImportMatch[1] && aliasImportMatch[2]) {
      const alias = aliasImportMatch[1];
      const source = aliasImportMatch[2];
      const lastPart = source.split('/').pop();
      return {
        source,
        type: 'external',
        items: [{ name: lastPart || source, alias }],
        line: lineNumber,
        used: true
      };
    }

    return null;
  }

  private parseRustImport(line: string, lineNumber: number): ImportAnalysis['imports'][0] | null {
    const useMatch = line.match(/use\s+([^;]+);/);
    if (useMatch && useMatch[1]) {
      const source = useMatch[1].trim();
      const items = this.parseRustUseClause(source);
      const firstPart = source.split('::')[0];

      return {
        source: firstPart || source,
        type: 'external',
        items,
        line: lineNumber,
        used: true
      };
    }

    return null;
  }

  private parseRustUseClause(clause: string): ImportAnalysis['imports'][0]['items'] {
    const items: ImportAnalysis['imports'][0]['items'] = [];

    if (clause.includes('{') && clause.includes('}')) {
      // Multiple imports: use std::{io, fs};
      const multipleMatch = clause.match(/{([^}]+)}/);
      if (multipleMatch && multipleMatch[1]) {
        const imports = multipleMatch[1].split(',').map(item => item.trim());
        for (const imp of imports) {
          items.push({ name: imp });
        }
      }
    } else {
      // Single import
      const name = clause.split('::').pop() || clause;
      items.push({ name });
    }

    return items;
  }

  private parseExportStatement(line: string, language: string, lineNumber: number): ImportAnalysis['exports'][0] | null {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        // Named export
        const namedExportMatch = line.match(/export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/);
        if (namedExportMatch && namedExportMatch[1]) {
          return {
            name: namedExportMatch[1],
            type: 'named',
            line: lineNumber
          };
        }

        // Default export
        if (line.match(/export\s+default/)) {
          return {
            name: 'default',
            type: 'default',
            line: lineNumber
          };
        }

        // Export statement
        const exportStatementMatch = line.match(/export\s*{\s*([^}]+)\s*}/);
        if (exportStatementMatch && exportStatementMatch[1]) {
          return {
            name: exportStatementMatch[1].trim(),
            type: 'named',
            line: lineNumber
          };
        }
        break;

      case 'python':
        // Python doesn't have explicit exports, but we can look for __all__
        const allMatch = line.match(/__all__\s*=\s*\[([^\]]+)\]/);
        if (allMatch && allMatch[1]) {
          return {
            name: '__all__',
            type: 'named',
            line: lineNumber
          };
        }
        break;
    }

    return null;
  }

  private async isInternalImport(source: string, currentFilePath: string): Promise<boolean> {
    // Relative imports are always internal
    if (source.startsWith('./') || source.startsWith('../')) {
      return true;
    }

    // Check if it's a local module
    const currentDir = dirname(currentFilePath);
    const possiblePaths = [
      resolve(currentDir, source),
      resolve(currentDir, `${source}.js`),
      resolve(currentDir, `${source}.ts`),
      resolve(currentDir, `${source}/index.js`),
      resolve(currentDir, `${source}/index.ts`)
    ];

    for (const path of possiblePaths) {
      if (await this.fileSystemHelper.exists(path)) {
        return true;
      }
    }

    // Check if it starts with a known internal pattern
    const internalPatterns = ['@/', 'src/', '~/'];
    return internalPatterns.some(pattern => source.startsWith(pattern));
  }

  private isImportUsed(content: string, items: ImportAnalysis['imports'][0]['items']): boolean {
    // Simplified usage check - look for the imported names in the content
    for (const item of items) {
      const nameToCheck = item.alias || item.name;
      if (nameToCheck === '*' || nameToCheck === 'default') continue;
      
      // Create a regex to find usage of the imported name
      const usageRegex = new RegExp(`\\b${nameToCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      const matches = content.match(usageRegex);
      
      // If found more than once (import + usage), it's used
      if (matches && matches.length > 1) {
        return true;
      }
    }
    
    return false;
  }

  private generateReport(analysis: ImportAnalysis, input: AnalyzeImportsInput): string {
    let report = `# 📦 Import Analysis\n\n`;
    report += `**File:** \`${analysis.filePath}\`\n`;
    report += `**Language:** ${analysis.language}\n`;
    report += `**Total Imports:** ${analysis.imports.length}\n`;
    report += `**Total Exports:** ${analysis.exports.length}\n\n`;

    // Imports section
    if (analysis.imports.length > 0) {
      report += `## 📥 Imports\n\n`;
      
      // Group by type
      const internalImports = analysis.imports.filter(imp => imp.type === 'internal');
      const externalImports = analysis.imports.filter(imp => imp.type === 'external');
      
      if (input.includeInternal && internalImports.length > 0) {
        report += `### 🏠 Internal Imports (${internalImports.length})\n\n`;
        for (const imp of internalImports) {
          report += `**Line ${imp.line}:** \`${imp.source}\`\n`;
          if (imp.items.length > 0) {
            const itemNames = imp.items.map(item => {
              let name = item.name;
              if (item.alias) name += ` as ${item.alias}`;
              if (item.isDefault) name += ' (default)';
              if (item.isNamespace) name += ' (namespace)';
              return name;
            }).join(', ');
            report += `  - Items: ${itemNames}\n`;
          }
          if (input.showUnused && !imp.used) {
            report += `  - ⚠️ **Potentially unused**\n`;
          }
          report += `\n`;
        }
      }
      
      if (input.includeExternal && externalImports.length > 0) {
        report += `### 🌐 External Imports (${externalImports.length})\n\n`;
        for (const imp of externalImports) {
          report += `**Line ${imp.line}:** \`${imp.source}\`\n`;
          if (imp.items.length > 0) {
            const itemNames = imp.items.map(item => {
              let name = item.name;
              if (item.alias) name += ` as ${item.alias}`;
              if (item.isDefault) name += ' (default)';
              if (item.isNamespace) name += ' (namespace)';
              return name;
            }).join(', ');
            report += `  - Items: ${itemNames}\n`;
          }
          if (input.showUnused && !imp.used) {
            report += `  - ⚠️ **Potentially unused**\n`;
          }
          report += `\n`;
        }
      }
    } else {
      report += `## 📥 No Imports Found\n\n`;
    }

    // Exports section
    if (analysis.exports.length > 0) {
      report += `## 📤 Exports\n\n`;
      for (const exp of analysis.exports) {
        report += `**Line ${exp.line}:** \`${exp.name}\` (${exp.type})\n`;
      }
      report += `\n`;
    } else {
      report += `## 📤 No Exports Found\n\n`;
    }

    // Dependencies summary
    report += `## 🔗 Dependencies Summary\n\n`;
    if (analysis.dependencies.internal.length > 0) {
      report += `**Internal Dependencies (${analysis.dependencies.internal.length}):**\n`;
      for (const dep of analysis.dependencies.internal) {
        report += `- \`${dep}\`\n`;
      }
      report += `\n`;
    }
    
    if (analysis.dependencies.external.length > 0) {
      report += `**External Dependencies (${analysis.dependencies.external.length}):**\n`;
      for (const dep of analysis.dependencies.external) {
        report += `- \`${dep}\`\n`;
      }
      report += `\n`;
    }

    // Statistics
    report += `## 📊 Statistics\n\n`;
    const unusedImports = analysis.imports.filter(imp => !imp.used);
    report += `- **Total Import Statements:** ${analysis.imports.length}\n`;
    report += `- **Internal Dependencies:** ${analysis.dependencies.internal.length}\n`;
    report += `- **External Dependencies:** ${analysis.dependencies.external.length}\n`;
    report += `- **Export Statements:** ${analysis.exports.length}\n`;
    if (input.showUnused) {
      report += `- **Potentially Unused Imports:** ${unusedImports.length}\n`;
    }

    return report;
  }

  protected override formatResult(report: string, metadata: Record<string, any>): string {
    return `${report}\n---\n\n**Metadata:**\n${JSON.stringify(metadata, null, 2)}`;
  }

  protected override formatError(error: unknown, context: string): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `${context}: ${message}`;
  }
}
