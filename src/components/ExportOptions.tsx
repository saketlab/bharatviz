import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, FileImage, FileText, FileSpreadsheet, MapIcon, ClipboardCopy, Check, Quote, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
}

function CopyButton({ text, darkMode }: { text: string; darkMode: boolean }) {
  const fb = useCopyFeedback(1500);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); fb.trigger(); }}
      className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
        fb.copied
          ? 'border-green-500 text-green-600'
          : darkMode
          ? 'border-[#444] text-gray-400 hover:border-gray-500 hover:text-gray-300'
          : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'
      }`}
    >
      {fb.copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
      {fb.copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CitationBlock({ label, apa, bibtex, darkMode }: {
  label: string; apa: string; bibtex: string; darkMode: boolean;
}) {
  const mono = darkMode ? 'bg-[#111] text-gray-300 border-[#333]' : 'bg-gray-50 text-gray-800 border-gray-200';
  const labelCls = darkMode ? 'text-gray-400' : 'text-gray-500';
  return (
    <div className="space-y-2">
      <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>{label}</p>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${labelCls}`}>APA</span>
          <CopyButton text={apa} darkMode={darkMode} />
        </div>
        <pre className={`text-xs p-2 rounded border whitespace-pre-wrap break-words font-sans ${mono}`}>{apa}</pre>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs ${labelCls}`}>BibTeX</span>
          <CopyButton text={bibtex} darkMode={darkMode} />
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
  darkMode = false,
  geojsonDownloadUrl,
  geojsonDownloadName,
  citationInfo,
}) => {
  const copyFeedback = useCopyFeedback();
  const [showCitation, setShowCitation] = useState(false);

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

  const structured = citationInfo ? getCitationStructured(citationInfo) : null;
  const allText = citationInfo ? getCitation(citationInfo) : '';

  const border = darkMode ? 'border-[#333]' : 'border-gray-200';
  const bg = darkMode ? 'bg-[#1a1a1a]' : 'bg-white';
  const text = darkMode ? 'text-white' : 'text-gray-900';
  const subtext = darkMode ? 'text-gray-400' : 'text-gray-500';
  const divider = darkMode ? 'border-[#2a2a2a]' : 'border-gray-100';

  return (
    <Card className={`p-4 ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
      <h3 className={`text-sm font-medium mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : ''}`}>
        <Download className={`h-4 w-4 ${darkMode ? 'text-gray-400' : ''}`} />
        Export
      </h3>
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
            variant={copyFeedback.copied ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            {copyFeedback.copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
            {copyFeedback.copied ? 'Copied!' : 'Copy'}
          </Button>
        )}
        {geojsonDownloadUrl && (
          <Button onClick={handleDownloadGeoJSON} variant="outline" size="sm" className="flex items-center gap-2">
            <MapIcon className="h-4 w-4" />GeoJSON
          </Button>
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
        <div className={`mt-4 rounded-lg border ${border} ${bg} overflow-hidden`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-2 border-b ${divider}`}>
            <span className={`text-xs font-semibold ${text}`}>{citationInfo!.mapLabel}</span>
            <div className="flex items-center gap-2">
              <CopyButton text={allText} darkMode={darkMode} />
              <button onClick={() => setShowCitation(false)} className={`${subtext} hover:opacity-70`}>
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
                darkMode={darkMode}
              />
            )}
            {structured.source && <hr className={`border-t ${divider}`} />}
            <CitationBlock
              label="Visualization tool"
              apa={structured.tool.apa}
              bibtex={structured.tool.bibtex}
              darkMode={darkMode}
            />
          </div>
        </div>
      )}
    </Card>
  );
};
