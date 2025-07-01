import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface BatchLogEntry {
  timestamp: string;
  batchId: string;
  event: string;
  context: Record<string, any>;
  metadata?: {
    version: string;
    environment: string;
    nodeId?: string;
  };
}

interface DomainProcessingEntry extends BatchLogEntry {
  event: 'domain_start' | 'domain_success' | 'domain_failure' | 'domain_timeout';
  context: {
    domain: string;
    processingTimeMs?: number;
    extractionMethod?: string;
    confidenceScore?: number;
    errorType?: string;
    errorMessage?: string;
    retryCount?: number;
  };
}

interface BatchProgressEntry extends BatchLogEntry {
  event: 'batch_progress' | 'batch_stalled' | 'batch_resumed';
  context: {
    processed: number;
    total: number;
    successCount: number;
    failureCount: number;
    currentRate: number; // domains per minute
    averageRate: number;
    elapsedTimeMs: number;
    estimatedRemainingMs?: number;
    stuckDomains?: string[];
    lastProcessedDomain?: string;
  };
}

export class BatchLogger {
  private logsDir: string;
  private batchLogPath: string;
  private summaryLogPath: string;
  private performanceLogPath: string;

  constructor(private batchId: string) {
    this.logsDir = join(process.cwd(), 'logs');
    this.batchLogPath = join(this.logsDir, `batch-${batchId}.jsonl`);
    this.summaryLogPath = join(this.logsDir, `summary-${new Date().toISOString().split('T')[0]}.json`);
    this.performanceLogPath = join(this.logsDir, 'performance-trends.json');
    
    this.ensureLogsDirectory();
  }

  private ensureLogsDirectory(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private writeLogEntry(entry: BatchLogEntry): void {
    const logLine = JSON.stringify({
      ...entry,
      metadata: {
        version: '1.0',
        environment: process.env.NODE_ENV || 'development',
        nodeId: process.env.REPL_ID || 'local',
        ...entry.metadata
      }
    }) + '\n';
    
    appendFileSync(this.batchLogPath, logLine, 'utf8');
  }

  // Batch lifecycle events
  logBatchStart(context: { fileName: string; totalDomains: number; uploadedAt: string }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'batch_start',
      context: {
        ...context,
        processingStarted: new Date().toISOString(),
        configuration: {
          concurrency: 3,
          timeoutMs: 25000,
          retryAttempts: 0
        }
      }
    });
  }

  logBatchComplete(context: { 
    processed: number; 
    successful: number; 
    failed: number; 
    totalTimeMs: number;
    averageTimePerDomain: number;
    successRate: number;
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'batch_complete',
      context: {
        ...context,
        completedAt: new Date().toISOString()
      }
    });
    
    this.updatePerformanceTrends(context);
  }

  // Domain processing events
  logDomainStart(domain: string, queuePosition: number): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'domain_start',
      context: {
        domain,
        queuePosition,
        startTime: Date.now()
      }
    } as DomainProcessingEntry);
  }

  logDomainSuccess(context: {
    domain: string;
    processingTimeMs: number;
    extractionMethod: string;
    companyName: string;
    confidenceScore: number;
    level2Attempted?: boolean;
    gleifCandidates?: number;
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'domain_success',
      context
    } as DomainProcessingEntry);
  }

  logDomainFailure(context: {
    domain: string;
    processingTimeMs: number;
    errorType: string;
    errorMessage: string;
    failureCategory: string;
    retryCount: number;
    extractionAttempts?: string[];
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'domain_failure',
      context
    } as DomainProcessingEntry);
  }

  logDomainTimeout(context: {
    domain: string;
    timeoutAfterMs: number;
    lastResponse?: string;
    extractionMethod?: string;
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'domain_timeout',
      context
    } as DomainProcessingEntry);
  }

  // Progress and performance tracking
  logBatchProgress(context: {
    processed: number;
    total: number;
    successCount: number;
    failureCount: number;
    currentRate: number;
    averageRate: number;
    elapsedTimeMs: number;
    estimatedRemainingMs?: number;
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'batch_progress',
      context
    } as BatchProgressEntry);
  }

  logBatchStalled(context: {
    stalledAt: number;
    totalDomains: number;
    stuckDomains: string[];
    lastProgressTime: string;
    possibleCauses: string[];
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'batch_stalled',
      context
    } as BatchProgressEntry);
  }

  logBatchResumed(context: {
    resumedAt: number;
    clearedDomains: string[];
    newRate: number;
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'batch_resumed',
      context
    } as BatchProgressEntry);
  }

  // Performance pattern detection
  logPerformanceAnomaly(context: {
    anomalyType: 'rate_drop' | 'success_rate_drop' | 'timeout_spike' | 'memory_pressure';
    severity: 'low' | 'medium' | 'high' | 'critical';
    metrics: Record<string, number>;
    recommendedActions: string[];
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'performance_anomaly',
      context
    });
  }

  // Network and infrastructure events
  logNetworkEvent(context: {
    eventType: 'connectivity_check' | 'dns_resolution' | 'ssl_handshake' | 'http_request';
    domain: string;
    success: boolean;
    responseTimeMs?: number;
    errorCode?: string;
    userAgent?: string;
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'network_event',
      context
    });
  }

  // GLEIF integration events
  logGleifIntegration(context: {
    domain: string;
    companyName: string;
    searchQuery: string;
    candidatesFound: number;
    primarySelection?: {
      leiCode: string;
      legalName: string;
      jurisdiction: string;
      confidence: number;
    };
    processingTimeMs: number;
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'gleif_integration',
      context
    });
  }

  // System resource monitoring
  logSystemMetrics(context: {
    memoryUsageMB: number;
    cpuPercent: number;
    activeConnections: number;
    queueSize: number;
    processingThreads: number;
  }): void {
    this.writeLogEntry({
      timestamp: new Date().toISOString(),
      batchId: this.batchId,
      event: 'system_metrics',
      context
    });
  }

  // Update daily summary for AI analysis
  private updateDailySummary(): void {
    // Implementation for daily aggregation
    // This would analyze all batch logs for the day and create summary patterns
  }

  // Update performance trends for historical analysis
  private updatePerformanceTrends(batchMetrics: any): void {
    let trends = [];
    
    if (existsSync(this.performanceLogPath)) {
      try {
        const content = require(this.performanceLogPath);
        trends = content.batches || [];
      } catch (error) {
        console.warn('Failed to read performance trends, creating new file');
      }
    }

    trends.push({
      batchId: this.batchId,
      completedAt: new Date().toISOString(),
      metrics: batchMetrics,
      dailySequence: trends.filter(t => 
        new Date(t.completedAt).toDateString() === new Date().toDateString()
      ).length + 1
    });

    // Keep only last 100 batches to prevent file growth
    if (trends.length > 100) {
      trends = trends.slice(-100);
    }

    writeFileSync(this.performanceLogPath, JSON.stringify({
      lastUpdated: new Date().toISOString(),
      totalBatches: trends.length,
      batches: trends
    }, null, 2));
  }

  // Generate AI-ready summary for the completed batch
  generateAIAnalysisSummary(): void {
    // Read all log entries for this batch
    const entries = this.readBatchLog();
    
    const summary = {
      batchId: this.batchId,
      analysisGeneratedAt: new Date().toISOString(),
      overview: this.extractBatchOverview(entries),
      timeline: this.extractKeyTimeline(entries),
      performance: this.extractPerformanceMetrics(entries),
      anomalies: this.extractAnomalies(entries),
      recommendations: this.generateInitialRecommendations(entries)
    };

    const summaryPath = join(this.logsDir, `analysis-${this.batchId}.json`);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  }

  private readBatchLog(): BatchLogEntry[] {
    if (!existsSync(this.batchLogPath)) return [];
    
    try {
      const content = require('fs').readFileSync(this.batchLogPath, 'utf8');
      return content.trim().split('\n').map((line: string) => JSON.parse(line));
    } catch (error) {
      console.error('Failed to read batch log:', error);
      return [];
    }
  }

  private extractBatchOverview(entries: BatchLogEntry[]): any {
    const start = entries.find(e => e.event === 'batch_start');
    const complete = entries.find(e => e.event === 'batch_complete');
    const progress = entries.filter(e => e.event === 'batch_progress');
    
    return {
      duration: complete && start ? 
        new Date(complete.timestamp).getTime() - new Date(start.timestamp).getTime() : null,
      finalStatus: complete?.context || 'incomplete',
      progressCheckpoints: progress.length,
      totalEvents: entries.length
    };
  }

  private extractKeyTimeline(entries: BatchLogEntry[]): any[] {
    const keyEvents = entries.filter(e => 
      ['batch_start', 'batch_stalled', 'batch_resumed', 'batch_complete', 'performance_anomaly'].includes(e.event)
    );
    
    return keyEvents.map(entry => ({
      timestamp: entry.timestamp,
      event: entry.event,
      context: entry.context
    }));
  }

  private extractPerformanceMetrics(entries: BatchLogEntry[]): any {
    const successEntries = entries.filter(e => e.event === 'domain_success');
    const failureEntries = entries.filter(e => e.event === 'domain_failure');
    const timeoutEntries = entries.filter(e => e.event === 'domain_timeout');
    
    return {
      totalProcessed: successEntries.length + failureEntries.length + timeoutEntries.length,
      successCount: successEntries.length,
      failureCount: failureEntries.length,
      timeoutCount: timeoutEntries.length,
      averageProcessingTime: this.calculateAverageProcessingTime(successEntries),
      commonFailureReasons: this.extractFailurePatterns(failureEntries),
      performanceByTimeOfDay: this.analyzePerformanceByTime(entries)
    };
  }

  private extractAnomalies(entries: BatchLogEntry[]): any[] {
    return entries
      .filter(e => e.event === 'performance_anomaly')
      .map(e => e.context);
  }

  private generateInitialRecommendations(entries: BatchLogEntry[]): string[] {
    const recommendations = [];
    const failureRate = this.calculateFailureRate(entries);
    const avgProcessingTime = this.calculateAverageProcessingTime(entries);
    
    if (failureRate > 0.7) {
      recommendations.push('High failure rate detected - consider reducing concurrency and increasing timeouts');
    }
    
    if (avgProcessingTime > 10000) {
      recommendations.push('Slow processing detected - enable early connectivity triage and optimize extraction methods');
    }
    
    return recommendations;
  }

  private calculateAverageProcessingTime(entries: BatchLogEntry[]): number {
    const times = entries
      .filter(e => e.context.processingTimeMs)
      .map(e => e.context.processingTimeMs as number);
    
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  private calculateFailureRate(entries: BatchLogEntry[]): number {
    const processed = entries.filter(e => 
      ['domain_success', 'domain_failure', 'domain_timeout'].includes(e.event)
    ).length;
    
    const failed = entries.filter(e => 
      ['domain_failure', 'domain_timeout'].includes(e.event)
    ).length;
    
    return processed > 0 ? failed / processed : 0;
  }

  private extractFailurePatterns(failureEntries: BatchLogEntry[]): Record<string, number> {
    const patterns: Record<string, number> = {};
    
    failureEntries.forEach(entry => {
      const errorType = entry.context.errorType as string || 'unknown';
      patterns[errorType] = (patterns[errorType] || 0) + 1;
    });
    
    return patterns;
  }

  private analyzePerformanceByTime(entries: BatchLogEntry[]): any {
    // Group entries by hour to identify time-based patterns
    const hourlyStats: Record<string, { count: number; avgTime: number }> = {};
    
    entries.filter(e => e.event === 'domain_success' || e.event === 'domain_failure').forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      const key = hour.toString().padStart(2, '0');
      
      if (!hourlyStats[key]) {
        hourlyStats[key] = { count: 0, avgTime: 0 };
      }
      
      hourlyStats[key].count++;
      if (entry.context.processingTimeMs) {
        hourlyStats[key].avgTime = (hourlyStats[key].avgTime + (entry.context.processingTimeMs as number)) / 2;
      }
    });
    
    return hourlyStats;
  }
}

// Singleton factory for batch loggers
class BatchLoggerFactory {
  private static loggers: Map<string, BatchLogger> = new Map();
  
  static getLogger(batchId: string): BatchLogger {
    if (!this.loggers.has(batchId)) {
      this.loggers.set(batchId, new BatchLogger(batchId));
    }
    return this.loggers.get(batchId)!;
  }
  
  static removeLogger(batchId: string): void {
    this.loggers.delete(batchId);
  }
}

export { BatchLoggerFactory };