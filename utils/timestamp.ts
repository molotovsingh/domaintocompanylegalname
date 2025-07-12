
/**
 * Timestamp Utility Functions
 * Provides consistent timestamp generation and formatting across the platform
 */

export interface TimestampOptions {
  format?: 'iso' | 'display' | 'filename' | 'readme';
  includeTime?: boolean;
  timezone?: string;
}

/**
 * Gets the current timestamp in ISO format (UTC)
 * @returns Current timestamp as ISO string
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Formats a timestamp for various display purposes
 * @param timestamp - ISO timestamp string or Date object
 * @param options - Formatting options
 * @returns Formatted timestamp string
 */
export function formatTimestamp(
  timestamp: string | Date, 
  options: TimestampOptions = {}
): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const { format = 'display', includeTime = true } = options;

  switch (format) {
    case 'iso':
      return date.toISOString();
      
    case 'display':
      if (includeTime) {
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        });
      } else {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
    case 'filename':
      // File-safe format: YYYY-MM-DD_HH-mm-ss
      return date.toISOString()
        .replace(/:/g, '-')
        .replace(/\./g, '-')
        .replace('T', '_')
        .slice(0, 19);
        
    case 'readme':
      // README format: January 11, 2025, 2:44 AM UTC
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short'
      });
      
    default:
      return date.toISOString();
  }
}

/**
 * Gets current date in various formats for different use cases
 * @param format - The desired format
 * @returns Formatted date string
 */
export function getFormattedDate(format: TimestampOptions['format'] = 'display'): string {
  return formatTimestamp(new Date(), { format });
}

/**
 * Creates a timestamp suitable for README files and documentation
 * @returns Human-readable timestamp for documentation
 */
export function createReadmeTimestamp(): string {
  return getFormattedDate('readme');
}

/**
 * Creates a timestamp suitable for filenames and logs
 * @returns Filesystem-safe timestamp
 */
export function createFilenameTimestamp(): string {
  return getFormattedDate('filename');
}

/**
 * Calculates relative time (e.g., "2 minutes ago", "1 hour ago")
 * @param timestamp - ISO timestamp string or Date object
 * @returns Relative time string
 */
export function getRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return formatTimestamp(date, { format: 'display', includeTime: false });
  }
}

/**
 * Validates if a string is a valid ISO timestamp
 * @param timestamp - String to validate
 * @returns True if valid ISO timestamp
 */
export function isValidTimestamp(timestamp: string): boolean {
  try {
    const date = new Date(timestamp);
    return date instanceof Date && !isNaN(date.getTime()) && timestamp.includes('T');
  } catch {
    return false;
  }
}

/**
 * Converts timestamp to different timezone
 * @param timestamp - ISO timestamp string
 * @param timezone - Target timezone (e.g., 'America/New_York')
 * @returns Formatted timestamp in target timezone
 */
export function convertTimezone(timestamp: string, timezone: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Export commonly used timestamp generators
export const today = {
  iso: () => getCurrentTimestamp(),
  display: () => getFormattedDate('display'),
  filename: () => getFormattedDate('filename'),
  readme: () => getFormattedDate('readme')
};

// Default export for convenience
export default {
  getCurrentTimestamp,
  formatTimestamp,
  getFormattedDate,
  createReadmeTimestamp,
  createFilenameTimestamp,
  getRelativeTime,
  isValidTimestamp,
  convertTimezone,
  today
};
