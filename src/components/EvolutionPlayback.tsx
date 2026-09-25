import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import GIF from 'gif.js';
import { svgToCanvas } from '@/lib/exportUtils';

const FRAME_MS = 900;

interface UseEvolutionPlaybackArgs {
  yearsLength: number;
  setYearIdx: (updater: (i: number) => number) => void;
}

export function useEvolutionPlayback({ yearsLength, setYearIdx }: UseEvolutionPlaybackArgs) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setYearIdx(i => (i + 1) % yearsLength);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [playing, yearsLength, setYearIdx]);

  const toggle = useCallback(() => setPlaying(p => !p), []);
  const stop = useCallback(() => setPlaying(false), []);

  return { playing, toggle, stop };
}

function waitForPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

interface PlaybackControlsProps {
  playing: boolean;
  onToggle: () => void;
  onStop: () => void;
  darkMode: boolean;
  years: number[];
  yearIdx: number;
  setYearIdx: (i: number) => void;
  getFrameSvg: (yearIndex: number) => Promise<SVGSVGElement | null>;
  filenamePrefix: string;
}

export function PlaybackControls({
  playing, onToggle, onStop, darkMode, years, yearIdx, setYearIdx, getFrameSvg, filenamePrefix,
}: PlaybackControlsProps) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const exportGif = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setExportProgress(0);
    onStop();
    const bgColor = darkMode ? '#0d0b09' : '#fdfaf5';

    try {
      const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: '/gif.worker.js',
        background: bgColor,
      });

      const wasIdx = yearIdx;
      for (let i = 0; i < years.length; i++) {
        setYearIdx(i);
        await waitForPaint();
        const svg = await getFrameSvg(i);
        if (!svg) continue;
        const w = svg.clientWidth || svg.viewBox.baseVal.width || 400;
        const h = svg.clientHeight || svg.viewBox.baseVal.height || 300;
        const canvas = await svgToCanvas(svg, { width: w, height: h, dpi: 300, backgroundColor: bgColor });
        gif.addFrame(canvas, { delay: FRAME_MS, copy: true });
        setExportProgress(Math.round(((i + 1) / years.length) * 60));
      }
      setYearIdx(wasIdx);

      gif.on('progress', (p: number) => {
        setExportProgress(60 + Math.round(p * 40));
      });

      gif.on('finished', (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filenamePrefix}.gif`;
        a.click();
        URL.revokeObjectURL(url);
        setExporting(false);
        setExportProgress(0);
      });

      gif.render();
    } catch (err) {
      console.error('GIF export failed:', err);
      setExporting(false);
      setExportProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exporting, years, yearIdx, darkMode, filenamePrefix]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        disabled={exporting}
        aria-label={playing ? 'Pause animation' : 'Play animation'}
        className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
          darkMode ? 'bg-[hsl(25,8%,18%)] text-amber-400 hover:bg-[hsl(25,8%,22%)]' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
        }`}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <button
        onClick={exportGif}
        disabled={exporting}
        aria-label="Export as GIF"
        className={`flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-medium transition-colors disabled:opacity-60 ${
          darkMode ? 'bg-[hsl(25,8%,18%)] text-[hsl(35,10%,82%)] hover:bg-[hsl(25,8%,22%)]' : 'bg-[hsl(35,20%,93%)] text-[hsl(28,20%,22%)] hover:bg-[hsl(35,20%,88%)]'
        }`}
      >
        <Download className="w-3 h-3" />
        {exporting ? `Exporting... ${exportProgress}%` : 'Export GIF'}
      </button>
    </div>
  );
}
