import { storage } from '../storage';
import type { BottleneckAnalysis } from '@shared/schema';

export class PerformanceBottleneckAnalyzer {
  private readonly OPTIMAL_PROCESSING_RATE = 10; // domains per minute
  private readonly CRITICAL_SUCCESS_RATE = 5; // percentage
  private readonly HIGH_TIMEOUT_THRESHOLD = 15; // seconds
  private readonly STUCK_DOMAIN_THRESHOLD = 30; // seconds

  async analyzeCurrentPerformance(batchId: string): Promise<BottleneckAnalysis[]> {
    const bottlenecks: BottleneckAnalysis[] = [];
    
    // Get current batch stats
    const stats = await storage.getProcessingStats();
    const recentDomains = await storage.getDomainsByBatch(batchId, 50);
    const processingDomains = recentDomains.filter(d => d.status === 'processing');
    const failedDomains = recentDomains.filter(d => d.status === 'failed');
    
    // Analyze processing rate bottleneck
    if (stats.processingRate < this.OPTIMAL_PROCESSING_RATE) {
      bottlenecks.push(await this.analyzeProcessingRateBottleneck(stats));
    }
    
    // Analyze success rate bottleneck
    if (stats.successRate < this.CRITICAL_SUCCESS_RATE) {
      bottlenecks.push(await this.analyzeSuccessRateBottleneck(stats, failedDomains));
    }
    
    // Analyze stuck domains
    if (processingDomains.length > 0) {
      const stuckAnalysis = await this.analyzeStuckDomains(processingDomains);
      if (stuckAnalysis) bottlenecks.push(stuckAnalysis);
    }
    
    // Analyze timeout patterns
    const timeoutAnalysis = await this.analyzeTimeoutPatterns(failedDomains);
    if (timeoutAnalysis) bottlenecks.push(timeoutAnalysis);
    
    // Analyze anti-bot protection patterns
    const antiBotAnalysis = await this.analyzeAntiBotPatterns(failedDomains);
    if (antiBotAnalysis) bottlenecks.push(antiBotAnalysis);
    
    return bottlenecks;
  }

  private async analyzeProcessingRateBottleneck(stats: any): Promise<BottleneckAnalysis> {
    const severity = stats.processingRate < 2 ? 'critical' : 
                    stats.processingRate < 5 ? 'high' : 'medium';
    
    const recommendations = [
      'Reduce concurrent processing from 3 to 2 domains',
      'Increase individual domain timeout to 30 seconds',
      'Enable early connectivity triage to skip unreachable domains',
      'Implement domain priority queuing (Fortune 500 first)',
      'Monitor memory usage and implement garbage collection'
    ];
    
    if (stats.processingRate < 1) {
      recommendations.unshift('Consider pausing processing to investigate system issues');
      recommendations.push('Check database connection pool and optimize queries');
    }

    return {
      type: 'high_concurrency',
      severity,
      title: 'Low Processing Rate Detected',
      description: `Current rate of ${stats.processingRate} domains/minute is below optimal ${this.OPTIMAL_PROCESSING_RATE} domains/minute`,
      impact: `Processing ${stats.totalDomains - stats.processedDomains} remaining domains will take ${stats.eta}`,
      recommendations,
      metrics: {
        currentRate: stats.processingRate,
        optimalRate: this.OPTIMAL_PROCESSING_RATE,
        efficiency: Math.round((stats.processingRate / this.OPTIMAL_PROCESSING_RATE) * 100)
      }
    };
  }

  private async analyzeSuccessRateBottleneck(stats: any, failedDomains: any[]): Promise<BottleneckAnalysis> {
    const severity = stats.successRate < 2 ? 'critical' : 
                    stats.successRate < 5 ? 'high' : 'medium';
    
    // Analyze failure patterns
    const failureCategories = failedDomains.reduce((acc, domain) => {
      const category = domain.failureCategory || 'unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topFailureCategory = Object.entries(failureCategories)
      .sort(([,a], [,b]) => b - a)[0];

    const recommendations = [
      'Review and update Fortune 500 domain mappings',
      'Implement more aggressive footer extraction patterns',
      'Add meta property extraction as fallback method',
      'Increase legal entity suffix validation accuracy',
      'Enable structured data (JSON-LD) extraction'
    ];

    if (topFailureCategory && topFailureCategory[0] === 'Protected - Manual Review') {
      recommendations.unshift('Implement CAPTCHA solving service for protected sites');
      recommendations.push('Add user-agent rotation and request delays');
    }

    return {
      type: 'low_success_rate',
      severity,
      title: 'Critical Success Rate Issue',
      description: `Success rate of ${stats.successRate}% is critically low`,
      impact: `Only ${stats.processedDomains * (stats.successRate/100)} successful extractions from ${stats.processedDomains} processed domains`,
      recommendations,
      metrics: {
        successRate: stats.successRate,
        targetRate: 25,
        topFailureCategory: topFailureCategory?.[0] || 'unknown',
        failureCategoryCount: topFailureCategory?.[1] || 0
      }
    };
  }

  private async analyzeStuckDomains(processingDomains: any[]): Promise<BottleneckAnalysis | null> {
    const now = new Date();
    const stuckDomains = processingDomains.filter(domain => {
      if (!domain.createdAt) return false;
      const createdTime = new Date(domain.createdAt);
      const secondsElapsed = (now.getTime() - createdTime.getTime()) / 1000;
      return secondsElapsed > this.STUCK_DOMAIN_THRESHOLD;
    });

    if (stuckDomains.length === 0) return null;

    const severity = stuckDomains.length > 5 ? 'critical' : 
                    stuckDomains.length > 2 ? 'high' : 'medium';

    return {
      type: 'stuck_domains',
      severity,
      title: 'Stuck Domains Detected',
      description: `${stuckDomains.length} domains stuck in processing state for over ${this.STUCK_DOMAIN_THRESHOLD} seconds`,
      impact: `Blocking processing pipeline and reducing overall throughput`,
      recommendations: [
        'Restart stuck domain monitor service',
        'Reduce individual domain timeout to 25 seconds',
        'Implement circuit breaker pattern for problematic domains',
        'Add domain-specific timeout overrides',
        'Monitor for infinite loops in extraction logic'
      ],
      metrics: {
        stuckCount: stuckDomains.length,
        totalProcessing: processingDomains.length,
        oldestStuckDomain: stuckDomains[0]?.domain || 'unknown'
      }
    };
  }

  private async analyzeTimeoutPatterns(failedDomains: any[]): Promise<BottleneckAnalysis | null> {
    const timeoutFailures = failedDomains.filter(d => 
      d.technicalDetails?.includes('timeout') || 
      d.technicalDetails?.includes('ETIMEDOUT') ||
      d.errorMessage?.includes('timeout')
    );

    if (timeoutFailures.length < 5) return null;

    const timeoutPercentage = (timeoutFailures.length / failedDomains.length) * 100;
    const severity = timeoutPercentage > 50 ? 'critical' : 
                    timeoutPercentage > 30 ? 'high' : 'medium';

    return {
      type: 'network_timeout',
      severity,
      title: 'High Timeout Rate Detected',
      description: `${timeoutFailures.length} domains (${Math.round(timeoutPercentage)}%) failing due to timeouts`,
      impact: 'Network timeouts indicate infrastructure or anti-bot protection issues',
      recommendations: [
        'Increase individual domain timeout from 25s to 35s',
        'Implement exponential backoff for retry attempts',
        'Add proxy rotation for international domains',
        'Enable request caching for repeated domain patterns',
        'Consider geographic processing (US vs EU servers)'
      ],
      metrics: {
        timeoutCount: timeoutFailures.length,
        timeoutPercentage: Math.round(timeoutPercentage),
        totalFailures: failedDomains.length
      }
    };
  }

  private async analyzeAntiBotPatterns(failedDomains: any[]): Promise<BottleneckAnalysis | null> {
    const antiBotFailures = failedDomains.filter(d => 
      d.failureCategory === 'Protected - Manual Review' ||
      d.technicalDetails?.includes('403') ||
      d.technicalDetails?.includes('captcha') ||
      d.technicalDetails?.includes('cloudflare')
    );

    if (antiBotFailures.length < 3) return null;

    const protectionPercentage = (antiBotFailures.length / failedDomains.length) * 100;
    const severity = protectionPercentage > 40 ? 'critical' : 
                    protectionPercentage > 20 ? 'high' : 'medium';

    return {
      type: 'anti_bot_protection',
      severity,
      title: 'Anti-Bot Protection Blocking Access',
      description: `${antiBotFailures.length} domains (${Math.round(protectionPercentage)}%) blocked by anti-bot protection`,
      impact: 'Enterprise domains using Cloudflare and similar services are blocking automated access',
      recommendations: [
        'Implement residential proxy rotation',
        'Add random delays between requests (2-5 seconds)',
        'Rotate user-agent strings more frequently',
        'Implement CAPTCHA solving integration',
        'Consider headless browser with stealth mode',
        'Add manual fallback queue for protected domains'
      ],
      metrics: {
        protectedCount: antiBotFailures.length,
        protectionPercentage: Math.round(protectionPercentage),
        totalFailures: failedDomains.length
      }
    };
  }
}

export const bottleneckAnalyzer = new PerformanceBottleneckAnalyzer();