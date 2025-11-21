'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type ProgressProps = React.ComponentPropsWithoutRef<'div'> & {
  value?: number | null;
  max?: number;
};

const clampPercent = (value?: number | null, max: number = 100) => {
  if (value == null || isNaN(value)) return 0;
  const v = Math.max(0, Math.min(value, max));
  return (v / max) * 100;
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percent = clampPercent(value, max);
    return (
      <div
        ref={ref}
        className={cn(
          'relative h-4 w-full overflow-hidden rounded-full bg-secondary',
          className
        )}
        {...props}
      >
        <div
          className="absolute left-0 top-0 h-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
