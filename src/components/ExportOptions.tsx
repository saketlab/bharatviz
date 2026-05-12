import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, FileImage, FileText, FileSpreadsheet, MapIcon, ClipboardCopy, Check, Quote, X, ChevronDown, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type CitationInfo, getCitation, getCitationStructured } from '@/lib/citations';

function useCopyFeedback(duration = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const trigger = useCallback(() => {
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), duration);
  }, [duration]);

  return { copied, trigger };
}

interface ExportOptionsProps {
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
  onCopyToClipboard?: () => void;
  disabled?: boolean;
  darkMode?: boolean;
  geojsonDownloadUrl?: string | null;
  geojsonDownloadName?: string;
  citationInfo?: CitationInfo;
  defaultOpen?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const fb = useCopyFeedback(1500);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); fb.trigger(); }}
      className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
        fb.copied
          ? 'border-green-500 text-green-600'
          : 'border-[hsl(35,18%,78%)] text-[hsl(28,10%,46%)] hover:border-[hsl(28,42%,52%)] hover:text-[hsl(28,38%,32%)] dark:border-[hsl(25,8%,22%)] dark:text-[hsl(30,8%,52%)] dark:hover:border-[hsl(28,30%,44%)] dark:hover:text-[hsl(35,10%,72%)]'
      }`}
    >
      {fb.copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
      {fb.copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CitationBlock({ label, apa, bibtex }: {
  label: string; apa: string; bibtex: string;
}) {
  const mono = 'bg-[hsl(35,14%,95%)] text-[hsl(25,8%,16%)] border-[hsl(35,18%,84%)] dark:bg-[hsl(25,12%,8%)] dark:text-[hsl(30,6%,62%)] dark:border-[hsl(25,8%,14%)]';
  const labelCls = 'text-[hsl(28,8%,46%)] dark:text-[hsl(30,8%,50%)]';
  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>{label}</p>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${labelCls}`}>APA</span>
          <CopyButton text={apa} />
        </div>
        <pre className={`text-xs p-2 rounded border whitespace-pre-wrap break-words font-sans ${mono}`}>{apa}</pre>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${labelCls}`}>BibTeX</span>
          <CopyButton text={bibtex} />
        </div>
        <pre className={`text-xs p-2 rounded border whitespace-pre-wrap break-all font-mono ${mono}`}>{bibtex}</pre>
      </div>
    </div>
  );
}

export const ExportOptions: React.FC<ExportOptionsProps> = ({
  onExportPNG,
  onExportSVG,
  onExportPDF,
  onCopyToClipboard,
  disabled = false,
  darkMode: _darkMode,
  geojsonDownloadUrl,
  geojsonDownloadName,
  citationInfo,
  defaultOpen = false,
}) => {
  const copyFeedback = useCopyFeedback();
  const geojsonUrlCopyFeedback = useCopyFeedback(1500);
  const [open, setOpen] = useState(defaultOpen);
  const [showCitation, setShowCitation] = useState(false);

  const prevDisabled = useRef(disabled);
  useEffect(() => {
    if (prevDisabled.current && !disabled) setOpen(true);
    prevDisabled.current = disabled;
  }, [disabled]);

  const handleDownloadGeoJSON = () => {
    if (!geojsonDownloadUrl) return;
    const link = document.createElement('a');
    link.href = geojsonDownloadUrl;
    link.download = geojsonDownloadName || 'districts.geojson';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = () => {
    if (!onCopyToClipboard) return;
    onCopyToClipboard();
    copyFeedback.trigger();
  };

  const handleCopyGeoJSONUrl = () => {
    if (!geojsonDownloadUrl) return;
    const absoluteUrl = geojsonDownloadUrl.startsWith('http')
      ? geojsonDownloadUrl
      : `${window.location.origin}${geojsonDownloadUrl}`;
    navigator.clipboard.writeText(absoluteUrl);
    geojsonUrlCopyFeedback.trigger();
  };

  const structured = citationInfo ? getCitationStructured(citationInfo) : null;
  const allText = citationInfo ? getCitation(citationInfo) : '';

  return (
    <div className="rounded-lg border text-sm bg-card border-border dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors hover:bg-accent dark:hover:bg-[hsl(25,8%,12%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(28,62%,48%)] focus-visible:ring-inset"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground dark:text-[hsl(35,12%,93%)]">
          <Download className="h-4 w-4 text-[hsl(28,48%,42%)] dark:text-[hsl(28,55%,52%)]" />
          Export
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} text-muted-foreground dark:text-[hsl(30,8%,50%)]`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="h-px bg-border dark:bg-[hsl(25,8%,14%)]" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={onExportPNG} disabled={disabled} variant="outline" size="sm" className="flex items-center gap-2">
              <FileImage className="h-4 w-4" />PNG
            </Button>
            <Button onClick={onExportSVG} disabled={disabled} variant="outline" size="sm" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />SVG
            </Button>
            <Button onClick={onExportPDF} disabled={disabled} variant="outline" size="sm" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />PDF
            </Button>
            {onCopyToClipboard && (
              <Button
                onClick={handleCopy}
                disabled={disabled}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {copyFeedback.copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                {copyFeedback.copied ? 'Copied!' : 'Copy'}
              </Button>
            )}
            {geojsonDownloadUrl && (
              <>
                <Button onClick={handleDownloadGeoJSON} variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />GeoJSON
                </Button>
                <Button
                  onClick={handleCopyGeoJSONUrl}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {geojsonUrlCopyFeedback.copied ? <Check className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                  {geojsonUrlCopyFeedback.copied ? 'Copied!' : 'Copy URL'}
                </Button>
              </>
            )}
            {citationInfo && (
              <Button
                onClick={() => setShowCitation(v => !v)}
                variant={showCitation ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
              >
                <Quote className="h-4 w-4" />
                Cite
              </Button>
            )}
          </div>

          {showCitation && structured && (
            <div className="rounded-lg border border-[hsl(35,18%,84%)] bg-[hsl(38,22%,99%)] dark:border-[hsl(25,8%,14%)] dark:bg-[hsl(25,8%,9%)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(35,16%,90%)] dark:border-[hsl(25,8%,12%)]">
                <span className="text-xs font-semibold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">{citationInfo!.mapLabel}</span>
                <div className="flex items-center gap-2">
                  <CopyButton text={allText} />
                  <button onClick={() => setShowCitation(false)} aria-label="Close citation" className="text-[hsl(28,8%,46%)] dark:text-[hsl(30,8%,50%)] hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(28,62%,48%)] rounded">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-5">
                {structured.source && (
                  <CitationBlock
                    label="Boundary data source"
                    apa={structured.source.apa}
                    bibtex={structured.source.bibtex}
                  />
                )}
                {structured.source && <hr className="border-t border-[hsl(35,16%,90%)] dark:border-[hsl(25,8%,12%)]" />}
                <CitationBlock
                  label="Visualization tool"
                  apa={structured.tool.apa}
                  bibtex={structured.tool.bibtex}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
