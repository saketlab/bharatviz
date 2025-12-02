import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { IndiaMap, type IndiaMapRef } from '@/components/IndiaMap';
import { IndiaDistrictsMap, type IndiaDistrictsMapRef } from '@/components/IndiaDistrictsMap';
import { ExportOptions } from '@/components/ExportOptions';
import { ColorMapChooser, type ColorScale, type ColorBarSettings } from '@/components/ColorMapChooser';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DISTRICT_MAP_TYPES, DEFAULT_DISTRICT_MAP_TYPE, getDistrictMapConfig, getDistrictMapTypesList } from '@/lib/districtMapConfig';
import { getUniqueStatesFromGeoJSON } from '@/lib/stateUtils';
import { loadStateGistMapping, getAvailableStates, getStateGeoJSONUrl, type StateGistMapping } from '@/lib/stateGistMapping';
import Credits from '@/components/Credits';
import { Github } from 'lucide-react';

interface StateMapData {
  state: string;
  value: number;
}

interface DistrictMapData {
  state: string;
  district: string;
  value: number;
}

const Index = () => {
  const [activeTab, setActiveTab] = useState<string>('states');

  const [stateMapData, setStateMapData] = useState<StateMapData[]>([]);
  const [stateColorScale, setStateColorScale] = useState<ColorScale>('spectral');
  const [stateInvertColors, setStateInvertColors] = useState(false);
  const [stateHideNames, setStateHideNames] = useState(false);
  const [stateHideValues, setStateHideValues] = useState(false);
  const [stateDataTitle, setStateDataTitle] = useState<string>('');
  const [stateColorBarSettings, setStateColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false,
    binCount: 5,
    customBoundaries: [],
    useCustomBoundaries: false
  });

  const [districtMapData, setDistrictMapData] = useState<DistrictMapData[]>([]);
  const [districtColorScale, setDistrictColorScale] = useState<ColorScale>('spectral');
  const [districtInvertColors, setDistrictInvertColors] = useState(false);
  const [districtDataTitle, setDistrictDataTitle] = useState<string>('');
  const [showStateBoundaries, setShowStateBoundaries] = useState(true);
  const [districtColorBarSettings, setDistrictColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false,
    binCount: 5,
    customBoundaries: [],
    useCustomBoundaries: false
  });
  const [selectedDistrictMapType, setSelectedDistrictMapType] = useState<string>(DEFAULT_DISTRICT_MAP_TYPE);

  const [stateDistrictMapData, setStateDistrictMapData] = useState<DistrictMapData[]>([]);
  const [stateDistrictColorScale, setStateDistrictColorScale] = useState<ColorScale>('spectral');
  const [stateDistrictInvertColors, setStateDistrictInvertColors] = useState(false);
  const [stateDistrictDataTitle, setStateDistrictDataTitle] = useState<string>('');
  const [stateDistrictColorBarSettings, setStateDistrictColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false,
    binCount: 5,
    customBoundaries: [],
    useCustomBoundaries: false
  });
  const [selectedStateMapType, setSelectedStateMapType] = useState<string>(DEFAULT_DISTRICT_MAP_TYPE);
  const [selectedStateForMap, setSelectedStateForMap] = useState<string>('Maharashtra');
  const [stateDistrictHideNames, setStateDistrictHideNames] = useState(false);
  const [stateDistrictHideValues, setStateDistrictHideValues] = useState(false);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [stateGistMapping, setStateGistMapping] = useState<StateGistMapping | null>(null);
  const [stateSearchQuery, setStateSearchQuery] = useState<string>('');

  const stateMapRef = useRef<IndiaMapRef>(null);
  const districtMapRef = useRef<IndiaDistrictsMapRef>(null);
  const stateDistrictMapRef = useRef<IndiaDistrictsMapRef>(null);

  useEffect(() => {
    if (activeTab === 'state-districts') {
      const fetchStates = async () => {
        try {
          const mapping = await loadStateGistMapping();
          setStateGistMapping(mapping);
          const states = getAvailableStates(mapping, selectedStateMapType);

          if (states.length === 0) {
            throw new Error('No states found in gist mapping');
          }

          setAvailableStates(states);
        } catch (error) {
          console.error('Failed to fetch states from gist mapping:', error);
          const geojsonPath = getDistrictMapConfig(selectedStateMapType).geojsonPath;
          const states = await getUniqueStatesFromGeoJSON(geojsonPath);
          setAvailableStates(states);
          setStateGistMapping(null);
        }
      };

      fetchStates();
    }
  }, [activeTab, selectedStateMapType]);

  const handleStateDataLoad = (data: StateMapData[], title?: string) => {
    setStateMapData(data);
    setStateDataTitle(title || '');
  };

  const handleDistrictDataLoad = (data: DistrictMapData[], title?: string) => {
    setDistrictMapData(data);
    setDistrictDataTitle(title || '');
  };

  const handleStateDistrictDataLoad = (data: DistrictMapData[], title?: string) => {
    setStateDistrictMapData(data);
    setStateDistrictDataTitle(title || '');
  };

  const handleExportPNG = () => {
    if (activeTab === 'states') {
      stateMapRef.current?.exportPNG();
    } else if (activeTab === 'districts') {
      districtMapRef.current?.exportPNG();
    } else {
      stateDistrictMapRef.current?.exportPNG();
    }
  };

  const handleExportSVG = () => {
    if (activeTab === 'states') {
      stateMapRef.current?.exportSVG();
    } else if (activeTab === 'districts') {
      districtMapRef.current?.exportSVG();
    } else {
      stateDistrictMapRef.current?.exportSVG();
    }
  };

  const handleExportPDF = () => {
    if (activeTab === 'states') {
      stateMapRef.current?.exportPDF();
    } else if (activeTab === 'districts') {
      districtMapRef.current?.exportPDF();
    } else {
      stateDistrictMapRef.current?.exportPDF();
    }
  };

  const handleDownloadCSVTemplate = () => {
    if (activeTab === 'states') {
      stateMapRef.current?.downloadCSVTemplate();
    } else if (activeTab === 'districts') {
      districtMapRef.current?.downloadCSVTemplate();
    } else {
      stateDistrictMapRef.current?.downloadCSVTemplate();
    }
  };

  // Create gist URL provider for the selected map type
  const createGistUrlProvider = () => {
    return (stateName: string) => {
      if (!stateGistMapping) return null;
      return getStateGeoJSONUrl(stateGistMapping, selectedStateMapType, stateName);
    };
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-4 flex items-center justify-center gap-3">
            <img src="/bharatviz_favicon.png" alt="BharatViz Logo" className="h-8 sm:h-12 w-auto" />
            <span>BharatViz - Fast choropleths for India</span>
          </h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="states">States</TabsTrigger>
            <TabsTrigger value="districts">Districts</TabsTrigger>
            <TabsTrigger value="state-districts">State-District</TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
          </TabsList>
          
          <div className={`space-y-6 ${activeTab === 'states' ? 'block' : 'hidden'}`}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 order-2 lg:order-2">
                <IndiaMap ref={stateMapRef} data={stateMapData} colorScale={stateColorScale} 
                  invertColors={stateInvertColors}
                  hideStateNames={stateHideNames}
                  hideValues={stateHideValues}
                  dataTitle={stateDataTitle}
                  colorBarSettings={stateColorBarSettings}
                />
                <div className="mt-6 flex justify-center">
                  <ExportOptions 
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    disabled={stateMapData.length === 0}
                  />
                </div>
              </div>
              
              <div className="lg:col-span-1 order-1 lg:order-1">
                <FileUpload
                  onDataLoad={handleStateDataLoad}
                  mode="states"
                  geojsonPath="/India_LGD_states.geojson"
                />
                <div className="space-y-4 mt-6">
                  <ColorMapChooser 
                    selectedScale={stateColorScale}
                    onScaleChange={setStateColorScale}
                    invertColors={stateInvertColors}
                    onInvertColorsChange={setStateInvertColors}
                    hideStateNames={stateHideNames}
                    hideValues={stateHideValues}
                    onHideStateNamesChange={setStateHideNames}
                    onHideValuesChange={setStateHideValues}
                    colorBarSettings={stateColorBarSettings}
                    onColorBarSettingsChange={setStateColorBarSettings}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-6 ${activeTab === 'districts' ? 'block' : 'hidden'}`}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 order-2 lg:order-2">
                <IndiaDistrictsMap
                  ref={districtMapRef}
                  data={districtMapData}
                  colorScale={districtColorScale}
                  invertColors={districtInvertColors}
                  dataTitle={districtDataTitle}
                  showStateBoundaries={showStateBoundaries}
                  colorBarSettings={districtColorBarSettings}
                  geojsonPath={getDistrictMapConfig(selectedDistrictMapType).geojsonPath}
                  statesGeojsonPath={getDistrictMapConfig(selectedDistrictMapType).states}
                />
                <div className="mt-6 flex justify-center">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    disabled={districtMapData.length === 0}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-1 lg:order-1">
                {/* District Map Type Selector */}
                <div className="mb-4 p-4 border rounded-lg bg-card">
                  <Label htmlFor="district-map-type" className="text-sm font-medium mb-2 block">
                    District Map Type
                  </Label>
                  <Select value={selectedDistrictMapType} onValueChange={setSelectedDistrictMapType}>
                    <SelectTrigger id="district-map-type" className="w-full">
                      <SelectValue placeholder="Select district map type" />
                    </SelectTrigger>
                    <SelectContent>
                      {getDistrictMapTypesList().map((mapType) => (
                        <SelectItem key={mapType.id} value={mapType.id}>
                          <div className="flex flex-col">
                            <span>{mapType.displayName}</span>
                            {mapType.description && (
                              <span className="text-xs text-muted-foreground">{mapType.description}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FileUpload
  onDataLoad={handleDistrictDataLoad}
  mode="districts"
  templateCsvPath={getDistrictMapConfig(selectedDistrictMapType).templateCsvPath}
  demoDataPath={getDistrictMapConfig(selectedDistrictMapType).demoDataPath}
  googleSheetLink={getDistrictMapConfig(selectedDistrictMapType).googleSheetLink}
  geojsonPath={getDistrictMapConfig(selectedDistrictMapType).geojsonPath}
  selectedDistrictMapType={selectedDistrictMapType}   // ⭐ ADDED
/>

                <div className="space-y-4 mt-6">
                  <ColorMapChooser
                    selectedScale={districtColorScale}
                    onScaleChange={setDistrictColorScale}
                    invertColors={districtInvertColors}
                    onInvertColorsChange={setDistrictInvertColors}
                    showStateBoundaries={showStateBoundaries}
                    onShowStateBoundariesChange={setShowStateBoundaries}
                    colorBarSettings={districtColorBarSettings}
                    onColorBarSettingsChange={setDistrictColorBarSettings}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-6 ${activeTab === 'state-districts' ? 'block' : 'hidden'}`}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 order-2 lg:order-2">
                <IndiaDistrictsMap
                  ref={stateDistrictMapRef}
                  data={stateDistrictMapData}
                  colorScale={stateDistrictColorScale}
                  invertColors={stateDistrictInvertColors}
                  dataTitle={stateDistrictDataTitle}
                  showStateBoundaries={true}
                  colorBarSettings={stateDistrictColorBarSettings}
                  geojsonPath={getDistrictMapConfig(selectedStateMapType).geojsonPath}
                  statesGeojsonPath={getDistrictMapConfig(selectedStateMapType).states}
                  selectedState={selectedStateForMap}
                  gistUrlProvider={createGistUrlProvider()}
                  hideDistrictNames={stateDistrictHideNames}
                  hideDistrictValues={stateDistrictHideValues}
                  onHideDistrictNamesChange={setStateDistrictHideNames}
                  onHideDistrictValuesChange={setStateDistrictHideValues}
                />
                <div className="mt-6 flex justify-center">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    disabled={stateDistrictMapData.length === 0 || !selectedStateForMap}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-1 lg:order-1">
                {/* District Map Type Selector */}
                <div className="mb-4 p-4 border rounded-lg bg-card">
                  <Label htmlFor="state-district-map-type" className="text-sm font-medium mb-2 block">
                    District Map Type
                  </Label>
                  <Select value={selectedStateMapType} onValueChange={setSelectedStateMapType}>
                    <SelectTrigger id="state-district-map-type" className="w-full">
                      <SelectValue placeholder="Select district map type" />
                    </SelectTrigger>
                    <SelectContent>
                      {getDistrictMapTypesList().map((mapType) => (
                        <SelectItem key={mapType.id} value={mapType.id}>
                          <div className="flex flex-col">
                            <span>{mapType.displayName}</span>
                            {mapType.description && (
                              <span className="text-xs text-muted-foreground">{mapType.description}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* State Selector with Search */}
                <div className="mb-4 p-4 border rounded-lg bg-card">
                  <Label htmlFor="state-selector" className="text-sm font-medium mb-2 block">
                    Select State
                  </Label>
                  <input
                    type="text"
                    placeholder="Search state..."
                    value={stateSearchQuery}
                    onChange={(e) => setStateSearchQuery(e.target.value)}
                    className="w-full mb-2 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  />
                  <Select value={selectedStateForMap} onValueChange={(value) => {
                    setSelectedStateForMap(value);
                    setStateSearchQuery('');
                  }}>
                    <SelectTrigger id="state-selector" className="w-full">
                      <SelectValue placeholder="Select a state">
                        {selectedStateForMap}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {availableStates
                        .filter((state) =>
                          state.toLowerCase().includes(stateSearchQuery.toLowerCase())
                        )
                        .map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      {stateSearchQuery.length > 0 && availableStates.filter((state) =>
                        state.toLowerCase().includes(stateSearchQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No states found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <FileUpload
  onDataLoad={handleStateDistrictDataLoad}
  mode="districts"
  templateCsvPath={getDistrictMapConfig(selectedStateMapType).templateCsvPath}
  demoDataPath={getDistrictMapConfig(selectedStateMapType).demoDataPath}
  googleSheetLink={getDistrictMapConfig(selectedStateMapType).googleSheetLink}
  geojsonPath={getDistrictMapConfig(selectedStateMapType).geojsonPath}
  selectedDistrictMapType={selectedStateMapType}   // ⭐ ADDED
/>

                <div className="space-y-4 mt-6">
<ColorMapChooser
                     selectedScale={stateDistrictColorScale}
                     onScaleChange={setStateDistrictColorScale}
                     invertColors={stateDistrictInvertColors}
                     onInvertColorsChange={setStateDistrictInvertColors}
                     showStateBoundaries={true}
                     hideDistrictNames={stateDistrictHideNames}
                     onHideDistrictNamesChange={setStateDistrictHideNames}
                     hideDistrictValues={stateDistrictHideValues}
                     onHideDistrictValuesChange={setStateDistrictHideValues}
                     colorBarSettings={stateDistrictColorBarSettings}
                     onColorBarSettingsChange={setStateDistrictColorBarSettings}
                   />
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-6 ${activeTab === 'help' ? 'block' : 'hidden'}`}>
            <div className="max-w-4xl mx-auto p-6 space-y-8">
              <div className="p-4 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-950">
                <h2 className="text-xl font-bold mb-2 text-green-800 dark:text-green-200">Privacy & Data Security</h2>
                <p className="text-green-700 dark:text-green-300">
                  <strong>Your data is never stored.</strong> All processing happens in your browser or transiently on our servers.
                  We do not collect, store, or share any of your uploaded data.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-4">Web Interface</h2>
                  <p className="text-muted-foreground mb-4">
                    BharatViz helps you create publication-ready choropleth maps of India at state and district levels with just a few clicks.
                  </p>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="text-lg font-semibold mb-2">1. Upload Your Data</h3>
                      <p className="text-muted-foreground mb-2">Upload a CSV file with your data. Required columns:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li><strong>States:</strong> <code>state</code> and <code>value</code></li>
                        <li><strong>Districts:</strong> <code>state_name</code>, <code>district_name</code>, and <code>value</code></li>
                      </ul>
                      <p className="text-sm text-muted-foreground mt-2">
                        Download the CSV template or load demo data to get started quickly.
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="text-lg font-semibold mb-2">2. Customize Your Map</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        <li><strong>Color Scale:</strong> Choose from sequential (blues, greens, viridis) or diverging (spectral, rdylbu) scales</li>
                        <li><strong>Invert Colors:</strong> Flip the color mapping (useful when lower values are better)</li>
                        <li><strong>Discrete vs Continuous:</strong> Use discrete bins or smooth gradients</li>
                        <li><strong>Labels:</strong> Toggle state names and values on/off</li>
                        <li><strong>District Maps:</strong> Choose between LGD, NFHS-5, or NFHS-4 boundaries</li>
                      </ul>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="text-lg font-semibold mb-2">3. Export Your Map</h3>
                      <p className="text-muted-foreground">Export in multiple formats:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        <li><strong>PNG:</strong> High-resolution raster image (300 DPI)</li>
                        <li><strong>SVG:</strong> Vector format for editing in Adobe Illustrator, Inkscape, etc.</li>
                        <li><strong>PDF:</strong> Publication-ready format</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h2 className="text-2xl font-bold mb-4">Programmatic Access (API)</h2>
                  <p className="text-muted-foreground mb-4">
                    The API supports state and district-level maps (LGD, NFHS-5, NFHS-4), all color scales, and exports to PNG, SVG, and PDF formats from Python or R.
                  </p>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                      <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">Documentation & Examples</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 dark:text-blue-300">
                        <li>
                          <a
                            href="https://colab.research.google.com/github/saketlab/bharatviz/blob/main/server/examples/BharatViz_demo.ipynb"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-blue-900 dark:hover:text-blue-100"
                          >
                            Try Python notebook in Google Colab
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://rpubs.com/saketkc/bharatviz"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-blue-900 dark:hover:text-blue-100"
                          >
                            View R notebook on RPubs
                          </a>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="text-lg font-semibold mb-2">Python</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`# Install dependencies
pip install requests pillow pandas

# Download client
wget -q https://raw.githubusercontent.com/saketlab/bharatviz/refs/heads/main/server/examples/bharatviz.py

# Use in your code
from bharatviz import BharatViz

bv = BharatViz()
# States map
data = [{"state": "Maharashtra", "value": 75.8}]
bv.generate_map(data, title="My Map", show=True)

# Districts map (LGD)
dist_data = [{"state_name": "Telangana", "district_name": "Adilabad", "value": 45.2}]
bv.generate_districts_map(dist_data, map_type="LGD", show=True)

# Districts map (NFHS5)
bv.generate_districts_map(dist_data, map_type="NFHS5", show=True)`}
                      </pre>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="text-lg font-semibold mb-2">R</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`# Install dependencies
install.packages(c("R6", "httr", "jsonlite", "base64enc", "png"))

# Source client
source("https://raw.githubusercontent.com/saketlab/bharatviz/refs/heads/main/server/examples/bharatviz.R")

# Use in your code
library(R6)
bv <- BharatViz$new()
# States map
data <- data.frame(state = c("Maharashtra", "Kerala"), value = c(75.8, 85.5))
result <- bv$generate_map(data, title = "My Map")
bv$show_map(result)

# Districts map (LGD)
dist_data <- data.frame(state_name = "Telangana", district_name = "Adilabad", value = 45.2)
result_lgd <- bv$generate_districts_map(dist_data, map_type = "LGD")
bv$show_map(result_lgd)

# Districts map (NFHS5)
result_nfhs5 <- bv$generate_districts_map(dist_data, map_type = "NFHS5")
bv$show_map(result_nfhs5)`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                      <Github className="h-5 w-5" />
                      Open Source
                    </h2>
                    <p className="text-muted-foreground">
                      BharatViz is open source and available on GitHub. Contributions, issues, and feedback are welcome!
                    </p>
                    <a
                      href="https://github.com/saketlab/bharatviz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-primary underline hover:text-primary/80"
                    >
                      https://github.com/saketlab/bharatviz
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-6 ${activeTab === 'credits' ? 'block' : 'hidden'}`}>
            <Credits />
          </div>
        </Tabs>
      </div>
      <footer className="w-full text-center text-xs text-muted-foreground mt-8 mb-2">
        <div className="flex flex-col items-center gap-2">
          <div>
            © 2025 Saket Choudhary | <a href="http://saketlab.in/" target="_blank" rel="noopener noreferrer" className="underline">Saket Lab</a>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/saketlab/bharatviz"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>saketlab/bharatviz</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
