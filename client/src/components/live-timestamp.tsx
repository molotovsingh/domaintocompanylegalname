
import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface LiveTimestampProps {
  format?: 'display' | 'short' | 'time-only';
  className?: string;
  showIcon?: boolean;
  updateInterval?: number;
}

export default function LiveTimestamp({ 
  format = 'display', 
  className = '',
  showIcon = true,
  updateInterval = 1000 
}: LiveTimestampProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, updateInterval);

    return () => clearInterval(timer);
  }, [updateInterval]);

  const formatTime = (date: Date) => {
    switch (format) {
      case 'short':
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      case 'time-only':
        return date.toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      case 'display':
      default:
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        });
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {showIcon && <Clock className="h-3 w-3" />}
      <span>{formatTime(currentTime)}</span>
    </div>
  );
}
