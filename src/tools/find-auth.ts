import { BaseNaviTool } from './index.js';
import { FindAuthSchema } from '../types/index.js';
import type { FindAuthInput } from '../types/index.js';
import { FileSystemHelper } from '../utils/file-system.js';
import { detectLanguage } from '../utils/language-detection.js';
import { promises as fs } from 'fs';
import { relative } from 'path';

interface AuthPattern {
  name: string;
  category: string;
  framework?: string;
  patterns: RegExp[];
  keywords: string[];
  confidence: number;
}

interface AuthMatch {
  file: string;
  line: number;
  content: string;
  pattern: string;
  category: string;
  framework: string | undefined;
  confidence: number;
  language: string;
}

interface AuthResult {
  matches: AuthMatch[];
  summary: {
    totalFiles: number;
    totalMatches: number;
    categories: Record<string, number>;
    frameworks: Record<string, number>;
    avgConfidence: number;
  };
}

/**
 * Tool for discovering authentication logic and security implementations
 */
export class FindAuthTool extends BaseNaviTool {
  name = 'find-auth';
  description = 'Discover authentication logic and security implementations';

  private fileSystemHelper: FileSystemHelper;
  private authPatterns: AuthPattern[];

  constructor(config: any) {
    super(config);
    this.fileSystemHelper = new FileSystemHelper(config.excludePatterns);
    this.authPatterns = this.initializeAuthPatterns();
  }

  async execute(args: unknown): Promise<string> {
    try {
      const input = this.validateArgs<FindAuthInput>(args, FindAuthSchema);

      if (!(await this.fileSystemHelper.exists(input.path))) {
        throw new Error(`Path does not exist: ${input.path}`);
      }

      const result = await this.findAuthentication(input);
      const report = this.generateReport(result, input);

      const metadata = {
        path: input.path,
        totalMatches: result.summary.totalMatches,
        totalFiles: result.summary.totalFiles,
        avgConfidence: result.summary.avgConfidence,
        timestamp: new Date().toISOString()
      };

      return this.formatResult(report, metadata);
    } catch (error) {
      throw new Error(this.formatError(error, 'Authentication discovery failed'));
    }
  }

  private initializeAuthPatterns(): AuthPattern[] {
    return [
      // JWT Patterns
      {
        name: 'JWT Token Handling',
        category: 'JWT',
        patterns: [
          /jwt\.sign\s*\(/i,
          /jwt\.verify\s*\(/i,
          /jsonwebtoken/i,
          /Bearer\s+token/i,
          /Authorization.*Bearer/i
        ],
        keywords: ['jwt', 'jsonwebtoken', 'bearer', 'token'],
        confidence: 0.9
      },

      // Session Management
      {
        name: 'Session Management',
        category: 'Session',
        patterns: [
          /express-session/i,
          /session\s*\(/i,
          /req\.session/i,
          /cookie-session/i,
          /session\.destroy/i
        ],
        keywords: ['session', 'cookie', 'sessionStore'],
        confidence: 0.85
      },

      // Password Hashing
      {
        name: 'Password Hashing',
        category: 'Password',
        patterns: [
          /bcrypt/i,
          /scrypt/i,
          /argon2/i,
          /hash.*password/i,
          /compare.*password/i,
          /salt.*password/i
        ],
        keywords: ['bcrypt', 'hash', 'salt', 'password'],
        confidence: 0.95
      },

      // OAuth Patterns
      {
        name: 'OAuth Implementation',
        category: 'OAuth',
        patterns: [
          /passport/i,
          /oauth/i,
          /google.*auth/i,
          /facebook.*auth/i,
          /github.*auth/i,
          /client_id/i,
          /client_secret/i
        ],
        keywords: ['oauth', 'passport', 'client_id', 'redirect_uri'],
        confidence: 0.9
      },

      // Express.js Middleware (Expanded)
      {
        name: 'Express Auth Middleware',
        category: 'Middleware',
        framework: 'express',
        patterns: [
          /app\.use.*auth/i,
          /router\.use.*auth/i,
          /middleware.*auth/i,
          /authenticate.*middleware/i,
          /isAuthenticated/i,
          /requireAuth/i,
          /checkAuth/i,
          /verifyToken/i,
          /ensureAuthenticated/i,
          /protect.*route/i,
          /auth.*guard/i,
          /function.*auth.*\(/i,
          /const.*auth.*=.*\(/i,
          /export.*auth/i
        ],
        keywords: ['middleware', 'authenticate', 'authorize', 'requireAuth', 'checkAuth', 'guard'],
        confidence: 0.8
      },

      // Express-Validator Patterns (Enhanced)
      {
        name: 'Express Validator Auth',
        category: 'Validation',
        framework: 'express',
        patterns: [
          /express-validator/i,
          /require\s*\(\s*['"`]express-validator['"`]/i,
          /import.*express-validator/i,
          /from\s*['"`]express-validator['"`]/i,
          /check\s*\(/i,
          /body\s*\(/i,
          /param\s*\(/i,
          /query\s*\(/i,
          /header\s*\(/i,
          /cookie\s*\(/i,
          /validationResult/i,
          /check.*isEmail/i,
          /check.*isLength/i,
          /check.*isAlphanumeric/i,
          /check.*matches/i,
          /sanitize.*email/i,
          /sanitize.*escape/i,
          /custom.*validator/i,
          /withMessage/i
        ],
        keywords: ['express-validator', 'check', 'body', 'validationResult', 'sanitize'],
        confidence: 0.6
      },

      // Custom Auth Middleware Patterns
      {
        name: 'Custom Auth Middleware',
        category: 'Custom',
        patterns: [
          /function.*\(req,\s*res,\s*next\).*auth/i,
          /\(req,\s*res,\s*next\)\s*=>/i,
          /req\.headers\.authorization/i,
          /req\.header\s*\(\s*['"`]authorization/i,
          /req\.get\s*\(\s*['"`]authorization/i,
          /Bearer\s*\+/i,
          /token\s*=.*req\./i,
          /if\s*\(\s*!.*token/i,
          /return.*res\.status\(401\)/i,
          /return.*res\.status\(403\)/i,
          /next\(\s*new\s*Error/i,
          /throw.*new.*Error.*auth/i
        ],
        keywords: ['req', 'res', 'next', 'authorization', 'Bearer', 'token', '401', '403'],
        confidence: 0.9
      },

      // API Key Authentication
      {
        name: 'API Key Authentication',
        category: 'API Key',
        patterns: [
          /api.*key/i,
          /x-api-key/i,
          /authorization.*api/i,
          /apikey/i,
          /api_key/i
        ],
        keywords: ['apikey', 'api_key', 'x-api-key'],
        confidence: 0.75
      },

      // CORS and Security Headers (Enhanced)
      {
        name: 'CORS and Security',
        category: 'Security',
        patterns: [
          /cors\s*\(/i,
          /helmet\s*\(/i,
          /app\.use\s*\(\s*cors/i,
          /app\.use\s*\(\s*helmet/i,
          /require\s*\(\s*['"`]cors['"`]/i,
          /require\s*\(\s*['"`]helmet['"`]/i,
          /import.*cors/i,
          /import.*helmet/i,
          /from\s*['"`]cors['"`]/i,
          /from\s*['"`]helmet['"`]/i,
          /access-control/i,
          /x-frame-options/i,
          /content-security-policy/i
        ],
        keywords: ['cors', 'helmet', 'csp', 'security'],
        confidence: 0.6
      },

      // Modern Auth Libraries
      {
        name: 'Modern Auth Libraries',
        category: 'Modern',
        patterns: [
          /next-auth/i,
          /auth0/i,
          /firebase.*auth/i,
          /supabase.*auth/i,
          /clerk/i,
          /lucia-auth/i,
          /iron-session/i,
          /jose/i,
          /@auth\/core/i,
          /next.*middleware/i
        ],
        keywords: ['next-auth', 'auth0', 'firebase', 'supabase', 'clerk', 'lucia', 'jose'],
        confidence: 0.95
      },

      // Database Auth Patterns
      {
        name: 'Database Auth Patterns',
        category: 'Database',
        patterns: [
          /User\.findOne/i,
          /User\.findByEmail/i,
          /User\.create/i,
          /findUserBy/i,
          /getUserBy/i,
          /createUser/i,
          /updateUser/i,
          /deleteUser/i,
          /user.*model/i,
          /auth.*schema/i,
          /user.*schema/i
        ],
        keywords: ['User', 'findOne', 'findByEmail', 'createUser', 'schema', 'model'],
        confidence: 0.75
      },

      // Route Protection Patterns
      {
        name: 'Route Protection',
        category: 'Routes',
        patterns: [
          /protected.*route/i,
          /private.*route/i,
          /authenticated.*route/i,
          /withAuth/i,
          /requiresAuth/i,
          /ProtectedRoute/i,
          /AuthGuard/i,
          /canActivate/i,
          /guards.*auth/i,
          /route.*middleware.*auth/i
        ],
        keywords: ['protected', 'private', 'withAuth', 'requiresAuth', 'AuthGuard', 'canActivate'],
        confidence: 0.85
      },

      // Cookie and Storage Auth
      {
        name: 'Cookie and Storage Auth',
        category: 'Storage',
        patterns: [
          /httpOnly.*cookie/i,
          /secure.*cookie/i,
          /sameSite.*cookie/i,
          /localStorage.*token/i,
          /sessionStorage.*token/i,
          /document\.cookie/i,
          /cookie.*parser/i,
          /signed.*cookie/i,
          /refresh.*token/i,
          /access.*token/i
        ],
        keywords: ['httpOnly', 'secure', 'sameSite', 'localStorage', 'sessionStorage', 'refreshToken'],
        confidence: 0.8
      },

      // Two-Factor Authentication
      {
        name: 'Two-Factor Authentication',
        category: '2FA',
        patterns: [
          /two.*factor/i,
          /2fa/i,
          /totp/i,
          /authenticator/i,
          /speakeasy/i,
          /qrcode/i,
          /otpauth/i,
          /google.*authenticator/i,
          /backup.*codes/i,
          /recovery.*codes/i
        ],
        keywords: ['2fa', 'totp', 'authenticator', 'speakeasy', 'qrcode', 'backup'],
        confidence: 0.9
      },

      // Basic Security Imports (High Detection)
      {
        name: 'Security Package Imports',
        category: 'Imports',
        patterns: [
          /require\s*\(\s*['"`](cors|helmet|express-validator|bcrypt|jsonwebtoken|passport)['"`]/i,
          /import.*from\s*['"`](cors|helmet|express-validator|bcrypt|jsonwebtoken|passport)['"`]/i,
          /import\s*\*.*from\s*['"`](cors|helmet|express-validator|bcrypt|jsonwebtoken|passport)['"`]/i,
          /import\s*{.*}\s*from\s*['"`](cors|helmet|express-validator|bcrypt|jsonwebtoken|passport)['"`]/i,
          /const.*=.*require\s*\(\s*['"`](cors|helmet|express-validator|bcrypt|jsonwebtoken|passport)['"`]/i
        ],
        keywords: ['require', 'import', 'cors', 'helmet', 'express-validator', 'bcrypt', 'jsonwebtoken', 'passport'],
        confidence: 0.95
      }
    ];
  }

  private async findAuthentication(input: FindAuthInput): Promise<AuthResult> {
    const result: AuthResult = {
      matches: [],
      summary: {
        totalFiles: 0,
        totalMatches: 0,
        categories: {},
        frameworks: {},
        avgConfidence: 0
      }
    };

    // Get all files to analyze
    const allFiles = await this.fileSystemHelper.getAllFiles(input.path, {
      extensions: ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'cs', 'php', 'rb'],
      excludePatterns: this.config.excludePatterns
    });

    // Filter out test files if not included
    const filesToAnalyze = allFiles.filter(filePath => {
      if (input.includeTests) return true;
      const fileName = filePath.toLowerCase();
      return !fileName.includes('test') &&
             !fileName.includes('spec') &&
             !fileName.includes('__tests__');
    });

    result.summary.totalFiles = filesToAnalyze.length;

    // Analyze each file
    for (const filePath of filesToAnalyze) {
      const matches = await this.analyzeFile(filePath, input);
      result.matches.push(...matches);
    }

    // Calculate summary statistics
    this.calculateSummary(result, input);

    return result;
  }

  private async analyzeFile(filePath: string, input: FindAuthInput): Promise<AuthMatch[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches: AuthMatch[] = [];
      const language = detectLanguage(filePath);

      // Filter patterns by framework if specified
      const patternsToCheck = this.filterPatterns(input);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.trim().length === 0) continue;

        for (const pattern of patternsToCheck) {
          const match = this.checkPattern(line, pattern);
          if (match && match.confidence >= input.minConfidence) {
            matches.push({
              file: relative(input.path, filePath),
              line: i + 1,
              content: line.trim(),
              pattern: pattern.name,
              category: pattern.category,
              framework: pattern.framework || undefined,
              confidence: match.confidence,
              language: language?.name || 'Unknown'
            });
          }
        }
      }

      return matches;
    } catch {
      return [];
    }
  }

  private filterPatterns(input: FindAuthInput): AuthPattern[] {
    let patterns = this.authPatterns;

    // Filter by framework if specified
    if (input.frameworks && input.frameworks.length > 0) {
      patterns = patterns.filter(pattern =>
        !pattern.framework || input.frameworks!.includes(pattern.framework)
      );
    }

    // Filter by categories if specified
    if (input.categories && input.categories.length > 0) {
      patterns = patterns.filter(pattern =>
        input.categories!.includes(pattern.category)
      );
    }

    return patterns;
  }

  private checkPattern(line: string, pattern: AuthPattern): { confidence: number } | null {
    let confidence = 0;
    let matches = 0;

    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(line)) {
        matches++;
        confidence += pattern.confidence;
      }
    }

    // Check keywords
    const lineLower = line.toLowerCase();
    for (const keyword of pattern.keywords) {
      if (lineLower.includes(keyword.toLowerCase())) {
        matches++;
        confidence += pattern.confidence * 0.8; // Keywords have slightly lower weight
      }
    }

    if (matches > 0) {
      // Average confidence, but boost for multiple matches
      const avgConfidence = confidence / matches;
      const boost = Math.min(matches * 0.1, 0.3); // Max 30% boost
      return { confidence: Math.min(avgConfidence + boost, 1.0) };
    }

    return null;
  }

  private calculateSummary(result: AuthResult, _input: FindAuthInput): void {
    result.summary.totalMatches = result.matches.length;

    // Calculate category distribution
    for (const match of result.matches) {
      result.summary.categories[match.category] =
        (result.summary.categories[match.category] || 0) + 1;
    }

    // Calculate framework distribution
    for (const match of result.matches) {
      if (match.framework) {
        result.summary.frameworks[match.framework] =
          (result.summary.frameworks[match.framework] || 0) + 1;
      }
    }

    // Calculate average confidence
    if (result.matches.length > 0) {
      const totalConfidence = result.matches.reduce((sum, match) => sum + match.confidence, 0);
      result.summary.avgConfidence = totalConfidence / result.matches.length;
    }
  }

  private generateReport(result: AuthResult, input: FindAuthInput): string {
    let report = '# 🔐 Authentication & Security Analysis\n\n';

    // Summary
    report += '## 📊 Summary\n';
    report += `- **Files Analyzed**: ${result.summary.totalFiles}\n`;
    report += `- **Security Patterns Found**: ${result.summary.totalMatches}\n`;
    report += `- **Average Confidence**: ${(result.summary.avgConfidence * 100).toFixed(1)}%\n`;
    report += `- **Minimum Confidence Threshold**: ${(input.minConfidence * 100).toFixed(1)}%\n\n`;

    if (result.matches.length === 0) {
      report += '## ❌ No Authentication Patterns Found\n';
      report += 'No authentication or security patterns were detected above the confidence threshold.\n\n';
      return report;
    }

    // Category Distribution
    if (Object.keys(result.summary.categories).length > 0) {
      report += '## 📈 Security Categories Found\n';
      const sortedCategories = Object.entries(result.summary.categories)
        .sort(([,a], [,b]) => b - a);

      for (const [category, count] of sortedCategories) {
        const percentage = ((count / result.summary.totalMatches) * 100).toFixed(1);
        report += `- **${category}**: ${count} patterns (${percentage}%)\n`;
      }
      report += '\n';
    }

    // Framework Distribution
    if (Object.keys(result.summary.frameworks).length > 0) {
      report += '## 🛠️ Frameworks Detected\n';
      const sortedFrameworks = Object.entries(result.summary.frameworks)
        .sort(([,a], [,b]) => b - a);

      for (const [framework, count] of sortedFrameworks) {
        report += `- **${framework}**: ${count} patterns\n`;
      }
      report += '\n';
    }

    // Detailed Findings
    report += '## 🔍 Detailed Findings\n\n';

    // Group matches by category
    const matchesByCategory = new Map<string, AuthMatch[]>();
    for (const match of result.matches) {
      if (!matchesByCategory.has(match.category)) {
        matchesByCategory.set(match.category, []);
      }
      matchesByCategory.get(match.category)!.push(match);
    }

    for (const [category, matches] of matchesByCategory) {
      report += `### 🔒 ${category}\n\n`;

      // Sort matches by confidence (descending)
      const sortedMatches = matches.sort((a, b) => b.confidence - a.confidence);

      for (const match of sortedMatches.slice(0, 5)) { // Show top 5 per category
        const confidencePercent = (match.confidence * 100).toFixed(1);
        report += `**${match.file}:${match.line}** [${match.language}] (${confidencePercent}% confidence)\n`;
        report += `- Pattern: ${match.pattern}\n`;
        if (match.framework) {
          report += `- Framework: ${match.framework}\n`;
        }
        report += '```\n';
        report += `${match.content}\n`;
        report += '```\n\n';
      }

      if (sortedMatches.length > 5) {
        report += `... and ${sortedMatches.length - 5} more ${category.toLowerCase()} patterns\n\n`;
      }
    }

    // Security Recommendations
    report += '## 💡 Security Recommendations\n\n';

    if (result.summary.categories['Password']) {
      report += '- ✅ **Password Security**: Password hashing patterns detected\n';
    } else {
      report += '- ⚠️ **Password Security**: Consider implementing secure password hashing (bcrypt, argon2)\n';
    }

    if (result.summary.categories['JWT']) {
      report += '- ✅ **Token Authentication**: JWT implementation found\n';
    }

    if (result.summary.categories['Session']) {
      report += '- ✅ **Session Management**: Session handling detected\n';
    }

    if (result.summary.categories['Security']) {
      report += '- ✅ **Security Headers**: Security middleware detected\n';
    } else {
      report += '- ⚠️ **Security Headers**: Consider adding security headers (CORS, Helmet)\n';
    }

    if (result.summary.categories['OAuth']) {
      report += '- ✅ **OAuth Integration**: OAuth patterns found\n';
    }

    return report;
  }
}
