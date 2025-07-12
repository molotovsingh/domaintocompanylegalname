
/**
 * Example Usage of Timestamp Utilities
 * Demonstrates how to use the timestamp functions across the platform
 */

import timestamp, { 
  getCurrentTimestamp, 
  formatTimestamp, 
  getRelativeTime,
  today 
} from './timestamp';

// Example usage demonstrations
console.log('=== Timestamp Utility Examples ===\n');

// 1. Current timestamp for database records
const currentTime = getCurrentTimestamp();
console.log('1. Current ISO timestamp:', currentTime);

// 2. README-style timestamp for documentation
const readmeTime = today.readme();
console.log('2. README timestamp:', readmeTime);

// 3. Filename-safe timestamp for logs
const filenameTime = today.filename();
console.log('3. Filename timestamp:', filenameTime);

// 4. Display-friendly timestamp
const displayTime = today.display();
console.log('4. Display timestamp:', displayTime);

// 5. Relative time calculation
const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
const relativeTime = getRelativeTime(pastTime);
console.log('5. Relative time (2h ago):', relativeTime);

// 6. Format existing timestamp for different purposes
const existingTimestamp = '2025-01-11T02:44:22.123Z';
console.log('\n=== Formatting Existing Timestamp ===');
console.log('Original:', existingTimestamp);
console.log('Display:', formatTimestamp(existingTimestamp, { format: 'display' }));
console.log('Filename:', formatTimestamp(existingTimestamp, { format: 'filename' }));
console.log('README:', formatTimestamp(existingTimestamp, { format: 'readme' }));

// 7. Usage in real scenarios
console.log('\n=== Real Usage Scenarios ===');

// For README files
console.log(`**Created:** ${today.readme()}`);
console.log(`**Last Updated:** ${today.readme()}`);

// For log files
console.log(`Log file: batch-${filenameTime}.jsonl`);

// For user interfaces
console.log(`Processing started: ${displayTime}`);

// For database records
const batchRecord = {
  id: 'example-batch',
  created_at: currentTime,
  status: 'processing'
};
console.log('Database record:', batchRecord);
