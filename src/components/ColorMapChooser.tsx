import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ChevronDown } from 'lucide-react';
import { type DataType, type CategoryColorMapping } from '@/lib/categoricalUtils';
import { type BoundaryColor } from '@/lib/colorUtils';
import { CategoryColorPicker } from './CategoryColorPicker';

export type ColorScale = 'aqi' | 'blues' | 'greens' | 'reds' | 'oranges' | 'purples' | 'pinks' | 'viridis' | 'plasma' | 'inferno' | 'magma' | 'rdylbu' | 'rdylgn' | 'spectral' | 'brbg' | 'piyg' | 'puor';

export interface ColorBarSettings {
  isDiscrete: boolean;
  binCount: number;
  customBoundaries: number[];
  useCustomBoundaries: boolean;
}

interface ColorMapChooserProps {
  selectedScale: ColorScale;
  onScaleChange: (scale: ColorScale) => void;
  invertColors: boolean;
  onInvertColorsChange: (invert: boolean) => void;
  hideStateNames?: boolean;
  hideValues?: boolean;
  onHideStateNamesChange?: (hide: boolean) => void;
  onHideValuesChange?: (hide: boolean) => void;
  namesLabel?: string;
  showStateBoundaries?: boolean;
  onShowStateBoundariesChange?: (show: boolean) => void;
  boundaryColor?: BoundaryColor;
  onBoundaryColorChange?: (color: BoundaryColor) => void;
  hideDistrictNames?: boolean;
  onHideDistrictNamesChange?: (hide: boolean) => void;
  hideDistrictValues?: boolean;
  onHideDistrictValuesChange?: (hide: boolean) => void;
  colorBarSettings?: ColorBarSettings;
  onColorBarSettingsChange?: (settings: ColorBarSettings) => void;
  dataType?: DataType;
  categories?: string[];
  categoryColors?: CategoryColorMapping;
  onCategoryColorChange?: (category: string, color: string) => void;
  darkMode?: boolean;
}

const colorScales: { [key: string]: { name: string; type: 'sequential' | 'diverging' } } = {
  aqi: { name: 'AQI (Air Quality Index)', type: 'sequential' },
  blues: { name: 'Blues', type: 'sequential' },
  greens: { name: 'Greens', type: 'sequential' },
  reds: { name: 'Reds', type: 'sequential' },
  oranges: { name: 'Oranges', type: 'sequential' },
  purples: { name: 'Purples', type: 'sequential' },
  pinks: { name: 'Pinks', type: 'sequential' },
  viridis: { name: 'Viridis', type: 'sequential' },
  plasma: { name: 'Plasma', type: 'sequential' },
  inferno: { name: 'Inferno', type: 'sequential' },
  magma: { name: 'Magma', type: 'sequential' },
  rdylbu: { name: 'Red-Yellow-Blue', type: 'diverging' },
  rdylgn: { name: 'Red-Yellow-Green', type: 'diverging' },
  spectral: { name: 'Spectral', type: 'diverging' },
  brbg: { name: 'Brown-Blue-Green', type: 'diverging' },
  piyg: { name: 'Pink-Yellow-Green', type: 'diverging' },
  puor: { name: 'Purple-Orange', type: 'diverging' },
};

export const ColorMapChooser: React.FC<ColorMapChooserProps> = ({
  selectedScale, onScaleChange, invertColors, onInvertColorsChange,
  hideStateNames, hideValues, onHideStateNamesChange, onHideValuesChange,
  showStateBoundaries, onShowStateBoundariesChange,
  boundaryColor, onBoundaryColorChange,
  hideDistrictNames, onHideDistrictNamesChange,
  hideDistrictValues, onHideDistrictValuesChange,
  colorBarSettings, onColorBarSettingsChange,
  dataType = 'numerical', categories = [], categoryColors = {}, onCategoryColorChange,
  darkMode: _darkMode, namesLabel,
}) => {
  const sequentialScales = Object.entries(colorScales).filter(([, s]) => s.type === 'sequential');
  const divergingScales = Object.entries(colorScales).filter(([, s]) => s.type === 'diverging');

  const [open, setOpen] = useState(false);
  const [boundariesInput, setBoundariesInput] = useState<string>('');
  const [boundariesError, setBoundariesError] = useState<string>('');

  useEffect(() => {
    if (colorBarSettings?.customBoundaries) {
      setBoundariesInput(colorBarSettings.customBoundaries.join(','));
    }
  }, [colorBarSettings?.customBoundaries]);

  const applyCustomBoundaries = (inputValue: string) => {
    setBoundariesError('');
    const boundaries = inputValue.split(',').map(b => parseFloat(b.trim())).filter(b => !isNaN(b));
    if (boundaries.length < 2) { setBoundariesError('Please enter at least 2 breakpoints'); return; }
    const sorted = [...boundaries].sort((a, b) => a - b);
    if (sorted.some((val, idx) => idx > 0 && val === sorted[idx - 1])) {
      setBoundariesError('Breakpoints must be unique'); return;
    }
    if (colorBarSettings && onColorBarSettingsChange) {
      onColorBarSettingsChange({ ...colorBarSettings, customBoundaries: sorted });
    }
  };

  const handleBoundariesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); applyCustomBoundaries(boundariesInput); (e.target as HTMLInputElement).blur(); }
  };

  const checkboxClass = 'flex items-center gap-2 text-sm cursor-pointer text-foreground/80 dark:text-[hsl(30,6%,68%)]';
  const previewColors = getPreviewColors(selectedScale, invertColors, colorBarSettings);

  return (
    <div className="rounded-lg border text-sm bg-card border-border dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors hover:bg-accent dark:hover:bg-[hsl(25,8%,12%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(28,62%,48%)] focus-visible:ring-inset"
      >
        {dataType === 'categorical' ? (
          <span className="text-xs font-medium flex-1 text-left text-[hsl(28,45%,36%)] dark:text-[hsl(28,45%,52%)]">
            Categorical — customize colors below
          </span>
        ) : (
          <>
            <div className="flex-1 h-3 rounded overflow-hidden flex">
              {previewColors.map((color, i) => (
                <div key={i} className="flex-1" style={{ backgroundColor: color }} />
              ))}
            </div>
            <span className="text-xs whitespace-nowrap text-muted-foreground dark:text-[hsl(30,8%,50%)]">
              {colorScales[selectedScale]?.name ?? selectedScale}
            </span>
          </>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} text-muted-foreground dark:text-[hsl(30,8%,50%)]`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <Separator className="dark:bg-[hsl(25,8%,16%)]" />

          {dataType === 'categorical' ? (
            onCategoryColorChange && (
              <CategoryColorPicker
                categories={categories}
                colorMapping={categoryColors}
                onColorChange={onCategoryColorChange}
              />
            )
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="colorScale" className="text-xs font-medium text-muted-foreground dark:text-[hsl(35,10%,72%)]">
                  Color scale
                </Label>
                <Select value={selectedScale} onValueChange={onScaleChange}>
                  <SelectTrigger id="colorScale" className="w-full h-9 text-sm">
                    <SelectValue placeholder="Select a color scale" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">Sequential</div>
                    {sequentialScales.map(([key, scale]) => (
                      <SelectItem key={key} value={key}>{scale.name}</SelectItem>
                    ))}
                    <div className="px-2 py-1 text-xs font-semibold uppercase mt-1 text-muted-foreground">Diverging</div>
                    {divergingScales.map(([key, scale]) => (
                      <SelectItem key={key} value={key}>{scale.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {colorBarSettings && onColorBarSettingsChange && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground dark:text-[hsl(35,10%,72%)]">Color bar</Label>
                  <div className="flex items-center gap-4">
                    <label className={checkboxClass}>
                      <input type="radio" name="colorBarType" checked={!colorBarSettings.isDiscrete}
                        onChange={() => onColorBarSettingsChange({ ...colorBarSettings, isDiscrete: false })}
                        className="w-3.5 h-3.5 accent-[hsl(28,62%,48%)]" />
                      Continuous
                    </label>
                    <label className={checkboxClass}>
                      <input type="radio" name="colorBarType" checked={colorBarSettings.isDiscrete}
                        onChange={() => onColorBarSettingsChange({ ...colorBarSettings, isDiscrete: true })}
                        className="w-3.5 h-3.5 accent-[hsl(28,62%,48%)]" />
                      Discrete
                    </label>
                  </div>

                  {colorBarSettings.isDiscrete && (
                    <div className="space-y-2 pl-3 border-l-2 border-muted dark:border-[hsl(25,8%,16%)]">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="colorBarBins" className="text-xs text-muted-foreground dark:text-[hsl(30,8%,50%)]">Bins</Label>
                        <Input
                          id="colorBarBins"
                          type="number" min="2" max="20"
                          value={colorBarSettings.binCount}
                          onChange={(e) => {
                            const count = parseInt(e.target.value) || 5;
                            onColorBarSettingsChange({ ...colorBarSettings, binCount: Math.max(2, Math.min(20, count)) });
                          }}
                          className="w-16 h-7 text-xs"
                          disabled={colorBarSettings.useCustomBoundaries}
                        />
                      </div>
                      <label className={`${checkboxClass} text-xs`}>
                        <input type="checkbox" checked={colorBarSettings.useCustomBoundaries}
                          onChange={(e) => onColorBarSettingsChange({
                            ...colorBarSettings,
                            useCustomBoundaries: e.target.checked,
                            customBoundaries: e.target.checked && colorBarSettings.customBoundaries.length === 0
                              ? [0, 25, 50, 75, 100] : colorBarSettings.customBoundaries
                          })}
                          className="w-3 h-3 accent-[hsl(28,62%,48%)]" />
                        Custom boundaries
                      </label>
                      {colorBarSettings.useCustomBoundaries && (
                        <div className="space-y-1">
                          <Input
                            placeholder="e.g., 0,25,50,75,100"
                            value={boundariesInput}
                            onChange={(e) => setBoundariesInput(e.target.value)}
                            onBlur={() => applyCustomBoundaries(boundariesInput)}
                            onKeyDown={handleBoundariesKeyDown}
                            className={`text-xs h-7 ${boundariesError ? 'border-red-500' : ''}`}
                          />
                          {boundariesError
                            ? <p className="text-xs text-[hsl(0,55%,40%)] dark:text-[hsl(0,52%,50%)]">{boundariesError}</p>
                            : <p className="text-xs text-muted-foreground dark:text-[hsl(30,8%,50%)]">Comma-separated breakpoints, press Enter to apply</p>
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {(invertColors !== undefined || hideStateNames !== undefined || hideValues !== undefined ||
            showStateBoundaries !== undefined || boundaryColor !== undefined || hideDistrictNames !== undefined || hideDistrictValues !== undefined) && (
            <>
              <Separator className="dark:bg-[hsl(25,8%,16%)]" />
              <div className="space-y-2">
                <label className={checkboxClass}>
                  <input type="checkbox" checked={invertColors} onChange={e => onInvertColorsChange(e.target.checked)} className="accent-[hsl(28,62%,48%)]" />
                  Invert colors
                </label>
                {hideStateNames !== undefined && onHideStateNamesChange && (
                  <label className={checkboxClass}>
                    <input type="checkbox" checked={hideStateNames} onChange={e => onHideStateNamesChange(e.target.checked)} className="accent-[hsl(28,62%,48%)]" />
                    {namesLabel || 'Hide state names'}
                  </label>
                )}
                {hideValues !== undefined && onHideValuesChange && (
                  <label className={checkboxClass}>
                    <input type="checkbox" checked={hideValues} onChange={e => onHideValuesChange(e.target.checked)} className="accent-[hsl(28,62%,48%)]" />
                    Hide values
                  </label>
                )}
                {showStateBoundaries !== undefined && onShowStateBoundariesChange && (
                  <label className={checkboxClass}>
                    <input type="checkbox" checked={showStateBoundaries} onChange={e => onShowStateBoundariesChange(e.target.checked)} className="accent-[hsl(28,62%,48%)]" />
                    Show state boundaries
                  </label>
                )}
                {boundaryColor !== undefined && onBoundaryColorChange && (
                  <div className="flex items-center gap-2 text-sm text-foreground/80 dark:text-[hsl(30,6%,68%)]">
                    <span>Boundaries</span>
                    <div className="flex rounded overflow-hidden border border-input text-xs">
                      {(['auto', 'white', 'dark'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => onBoundaryColorChange(opt)}
                          className={`px-2 py-0.5 capitalize transition-colors ${boundaryColor === opt ? 'bg-[hsl(28,62%,48%)] text-white' : 'hover:bg-accent'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {hideDistrictNames !== undefined && onHideDistrictNamesChange && (
                  <label className={checkboxClass}>
                    <input type="checkbox" checked={hideDistrictNames} onChange={e => onHideDistrictNamesChange(e.target.checked)} className="accent-[hsl(28,62%,48%)]" />
                    Hide district names
                  </label>
                )}
                {hideDistrictValues !== undefined && onHideDistrictValuesChange && (
                  <label className={checkboxClass}>
                    <input type="checkbox" checked={hideDistrictValues} onChange={e => onHideDistrictValuesChange(e.target.checked)} className="accent-[hsl(28,62%,48%)]" />
                    Hide district values
                  </label>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

function getAQIColor(value: number): string {
  if (value <= 50) return '#10b981';
  if (value <= 100) return '#84cc16';
  if (value <= 200) return '#eab308';
  if (value <= 300) return '#f97316';
  if (value <= 400) return '#ef4444';
  return '#991b1b';
}

function getPreviewColor(scale: ColorScale, t: number): string {
  if (scale === 'aqi') return getAQIColor(t * 500);
  const colors: { [key in ColorScale]: string[] } = {
    aqi: ['#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444', '#991b1b'],
    blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
    greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
    reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
    oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
    purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
    pinks: ['#f7f4f9', '#e7dae7', '#d5bad6', '#cf92c6', '#dd63ae', '#e22f88', '#c9135c', '#990340', '#67001f'],
    viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'],
    plasma: ['#0d0887', '#4b0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d03c', '#fcffa4'],
    inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#fcffa4'],
    magma: ['#000004', '#1c1044', '#4f127b', '#812581', '#b5367a', '#e55964', '#fb8861', '#fec287', '#fcfdbf'],
    rdylbu: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee090', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4'],
    rdylgn: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'],
    spectral: ['#5e4fa2', '#66c2a5', '#abdda4', '#e6f598', '#fee08b', '#fdae61', '#f46d43', '#d53e4f', '#9e0142'],
    brbg: ['#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e'],
    piyg: ['#8e0152', '#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221'],
    puor: ['#7f3b08', '#b35806', '#e08214', '#fdb863', '#fee0b6', '#d8daeb', '#b2abd2', '#8073ac', '#542788'],
  };
  const colorArray = colors[scale];
  return colorArray[Math.floor(t * (colorArray.length - 1))] || colorArray[0];
}

function getPreviewColors(scale: ColorScale, invertColors: boolean, colorBarSettings?: ColorBarSettings): string[] {
  const n = 10;
  if (!colorBarSettings?.isDiscrete) {
    return Array.from({ length: n }, (_, i) => {
      const t = invertColors ? 1 - i / (n - 1) : i / (n - 1);
      return getPreviewColor(scale, t);
    });
  }
  let binCount = colorBarSettings.binCount;
  if (colorBarSettings.useCustomBoundaries && colorBarSettings.customBoundaries.length >= 2) {
    binCount = colorBarSettings.customBoundaries.length - 1;
  }
  const colors: string[] = [];
  for (let bin = 0; bin < binCount; bin++) {
    const t = invertColors ? 1 - (bin + 0.5) / binCount : (bin + 0.5) / binCount;
    const segs = Math.ceil(n / binCount);
    for (let j = 0; j < segs && colors.length < n; j++) colors.push(getPreviewColor(scale, t));
  }
  while (colors.length < n) colors.push(colors[colors.length - 1]);
  return colors.slice(0, n);
}
