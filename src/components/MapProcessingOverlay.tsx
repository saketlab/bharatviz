import React from 'react';

interface MapProcessingOverlayProps {
  active: boolean;
  message?: string;
}

export const MapProcessingOverlay: React.FC<MapProcessingOverlayProps> = ({ active, message }) => {
  if (!active) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-lg backdrop-blur-[1px] bg-[hsl(38,30%,98%)]/55 dark:bg-[hsl(25,8%,9%)]/55 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl border border-[hsl(35,18%,84%)] bg-[hsl(38,24%,99%)]/90 shadow-sm dark:border-[hsl(25,8%,16%)] dark:bg-[hsl(25,8%,11%)]/90">
        <span
          className="h-7 w-7 rounded-full border-2 border-[hsl(28,40%,86%)] border-t-[hsl(28,62%,48%)] motion-safe:animate-spin dark:border-[hsl(28,18%,28%)] dark:border-t-[hsl(28,55%,52%)]"
          style={{ animationDuration: '0.7s' }}
        />
        <p className="text-sm font-medium text-[hsl(28,24%,24%)] dark:text-[hsl(35,12%,88%)]">
          {message || 'Matching your data to boundaries...'}
        </p>
      </div>
    </div>
  );
};
