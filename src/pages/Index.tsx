import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Papa from 'papaparse';
import { FileUpload } from '@/components/FileUpload';
import { IndiaMap, type IndiaMapRef } from '@/components/IndiaMap';
import { IndiaDistrictsMap, type IndiaDistrictsMapRef } from '@/components/IndiaDistrictsMap';
import { ExportOptions } from '@/components/ExportOptions';
import { ColorMapChooser, type ColorScale, type ColorBarSettings } from '@/components/ColorMapChooser';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DEFAULT_DISTRICT_MAP_TYPE, getDistrictMapConfig, getDistrictMapTypesList } from '@/lib/districtMapConfig';
import { getCityList, getCityDataset, getCityDatasets, getCityCsvUrls, DEFAULT_CITY, DEFAULT_CITY_DATASET } from '@/lib/cityMapConfig';
import { IndiaCityMap, type IndiaCityMapRef, type CityWardData } from '@/components/IndiaCityMap';
import { getUniqueStatesFromGeoJSON } from '@/lib/stateUtils';
import { loadStateGistMapping, getAvailableStates, getStateGeoJSONUrl, type StateGistMapping } from '@/lib/stateGistMapping';
import { fetchWithCorsFallback } from '@/lib/corsProxy';
import showcaseDemoUrls from '@/lib/showcase-demo-urls.json';
import Credits from '@/components/Credits';
import MCPDocs from '@/components/MCPDocs';
import { DistrictStats } from '@/components/DistrictStats';
import { Github, Moon, Sun, Check, ChevronsUpDown } from 'lucide-react';
import { type DataType, type CategoryColorMapping, detectDataType, getUniqueCategories, generateDefaultCategoryColors } from '@/lib/categoricalUtils';
import { STATES_CITATION, NSSO_CITATION, getDistrictsCitationInfo, getCityCitationInfo } from '@/lib/citations';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { buildDynamicContext } from '@/lib/chat/contextBuilder';
import { DATA_FILES, MAP_DIMENSIONS } from '@/lib/constants';
import type { DynamicChatContext, DataPoint } from '@/lib/chat/types';

interface StateMapData {
  state: string;
  value: number | string;
}

interface DistrictMapData {
  state: string;
  district: string;
  value: number | string;
}

interface NAInfo {
  states?: string[];
  districts?: Array<{ state: string; district: string }>;
  count: number;
}

interface WideFormatMeta {
  numericColumns: string[];
  globalMin: number;
  globalMax: number;
}

interface MultiYearSeries {
  key: string;
  title: string;
  data: StateMapData[];
  naInfo?: NAInfo;
}

interface DistrictSeries {
  key: string;
  title: string;
  data: DistrictMapData[];
  naInfo?: NAInfo;
}

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (pathname: string): string => {
    const path = pathname.slice(1);
    const validTabs = ['states', 'districts', 'regions', 'state-districts', 'cities', 'district-stats', 'help', 'credits', 'mcp'];
    return validTabs.includes(path) ? path : 'states';
  };

  const [activeTab, setActiveTab] = useState<string>(getTabFromPath(location.pathname));

  const [stateMapData, setStateMapData] = useState<StateMapData[]>([]);
  const [stateMultiYearSeries, setStateMultiYearSeries] = useState<MultiYearSeries[]>([]);
  const [stateColorScale, setStateColorScale] = useState<ColorScale>('spectral');
  const [stateInvertColors, setStateInvertColors] = useState(false);
  const [stateHideNames, setStateHideNames] = useState(false);
  const [stateHideValues, setStateHideValues] = useState(false);
  const [stateDataTitle, setStateDataTitle] = useState<string>('');
  const [stateMapTitle, setStateMapTitle] = useState<string>('');
  const [stateColorBarSettings, setStateColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false,
    binCount: 5,
    customBoundaries: [],
    useCustomBoundaries: false
  });
  const [stateDataType, setStateDataType] = useState<DataType>('numerical');
  const [stateCategoryColors, setStateCategoryColors] = useState<CategoryColorMapping>({});
  const [stateNAInfo, setStateNAInfo] = useState<NAInfo | undefined>(undefined);
  const [stateWideFormatMeta, setStateWideFormatMeta] = useState<WideFormatMeta | null>(null);
  const [stateWideColorScaleMode, setStateWideColorScaleMode] = useState<'single' | 'independent'>('independent');
  const [stateSelectedWideColumn, setStateSelectedWideColumn] = useState<string | null>(null);

  const [districtMapData, setDistrictMapData] = useState<DistrictMapData[]>([]);
  const [districtColorScale, setDistrictColorScale] = useState<ColorScale>('spectral');
  const [districtInvertColors, setDistrictInvertColors] = useState(false);
  const [districtDataTitle, setDistrictDataTitle] = useState<string>('');
  const [districtMapTitle, setDistrictMapTitle] = useState<string>('');
  const [showStateBoundaries, setShowStateBoundaries] = useState(true);
  const [districtColorBarSettings, setDistrictColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false,
    binCount: 5,
    customBoundaries: [],
    useCustomBoundaries: false
  });
  const [districtDataType, setDistrictDataType] = useState<DataType>('numerical');
  const [districtCategoryColors, setDistrictCategoryColors] = useState<CategoryColorMapping>({});
  const [selectedDistrictMapType, setSelectedDistrictMapType] = useState<string>(DEFAULT_DISTRICT_MAP_TYPE);
  const [districtNAInfo, setDistrictNAInfo] = useState<NAInfo | undefined>(undefined);

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
  const [stateDistrictDataType, setStateDistrictDataType] = useState<DataType>('numerical');
  const [stateDistrictCategoryColors, setStateDistrictCategoryColors] = useState<CategoryColorMapping>({});
  const [selectedStateMapType, setSelectedStateMapType] = useState<string>(DEFAULT_DISTRICT_MAP_TYPE);
  const [selectedStateForMap, setSelectedStateForMap] = useState<string>('Maharashtra');
  const [stateDistrictHideNames, setStateDistrictHideNames] = useState(false);
  const [stateDistrictHideValues, setStateDistrictHideValues] = useState(false);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [stateGistMapping, setStateGistMapping] = useState<StateGistMapping | null>(null);
  const [stateSearchQuery, setStateSearchQuery] = useState<string>('');
  const [stateDistrictNAInfo, setStateDistrictNAInfo] = useState<NAInfo | undefined>(undefined);
  const [stateDistrictMultiSeries, setStateDistrictMultiSeries] = useState<DistrictSeries[]>([]);
  const [stateDistrictWideFormatMeta, setStateDistrictWideFormatMeta] = useState<WideFormatMeta | null>(null);
  const [stateDistrictColorScaleMode, setStateDistrictColorScaleMode] = useState<'single' | 'independent'>('independent');
  const [stateDistrictSelectedColumn, setStateDistrictSelectedColumn] = useState<string | null>(null);

  const [cityMapData, setCityMapData] = useState<CityWardData[]>([]);
  const [cityColorScale, setCityColorScale] = useState<ColorScale>('spectral');
  const [cityInvertColors, setCityInvertColors] = useState(false);
  const [cityDataTitle, setCityDataTitle] = useState<string>('');
  const [cityColorBarSettings, setCityColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false,
    binCount: 5,
    customBoundaries: [],
    useCustomBoundaries: false
  });
  const [cityDataType, setCityDataType] = useState<DataType>('numerical');
  const [cityCategoryColors, setCityCategoryColors] = useState<CategoryColorMapping>({});
  const [cityNAInfo, setCityNAInfo] = useState<NAInfo | undefined>(undefined);
  const [selectedCity, setSelectedCity] = useState<string>(DEFAULT_CITY);
  const [selectedCityDataset, setSelectedCityDataset] = useState<string>(DEFAULT_CITY_DATASET);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [cityHideNames, setCityHideNames] = useState(false);
  const [cityHideValues, setCityHideValues] = useState(false);

  const [darkMode, setDarkMode] = useState(() => new URLSearchParams(window.location.search).get('darkMode') === 'true');

  const [chatContext, setChatContext] = useState<DynamicChatContext | null>(null);
  const prevContextRef = useRef<{
    tab: string;
    mapType: string;
    selectedState?: string;
  } | null>(null);

  const stateMapRef = useRef<IndiaMapRef>(null);
  const stateMultiYearMapRefs = useRef<Map<string, IndiaMapRef>>(new Map());
  const districtMapRef = useRef<IndiaDistrictsMapRef>(null);
  const stateDistrictMapRef = useRef<IndiaDistrictsMapRef>(null);
  const stateDistrictMapRefs = useRef<Map<string, IndiaDistrictsMapRef>>(new Map());
  const cityMapRef = useRef<IndiaCityMapRef>(null);

  const hasReadInitialUrl = useRef<Set<string>>(new Set());
  const skipDataUrlLoad = useRef(false);
  const selectedStateRef = useRef(selectedStateForMap);
  useEffect(() => { selectedStateRef.current = selectedStateForMap; }, [selectedStateForMap]);

  const cityList = useMemo(() => getCityList(), []);
  const currentCityDataset = useMemo(() => getCityDataset(selectedCityDataset), [selectedCityDataset]);
  const currentCityDatasets = useMemo(() => getCityDatasets(selectedCity), [selectedCity]);

  useEffect(() => {
    const tabFromPath = getTabFromPath(location.pathname);
    if (tabFromPath !== activeTab) {
      setActiveTab(tabFromPath);
    }
  }, [location.pathname, activeTab]);

  useEffect(() => {
    if (hasReadInitialUrl.current.has('states')) return;
    if (activeTab !== 'states') return;

    const params = new URLSearchParams(location.search);

    const colorScale = params.get('colorScale') as ColorScale;
    if (colorScale) setStateColorScale(colorScale);

    const invertColors = params.get('invertColors');
    if (invertColors) setStateInvertColors(invertColors === 'true');

    const hideNames = params.get('hideNames');
    if (hideNames) setStateHideNames(hideNames === 'true');

    const hideValues = params.get('hideValues');
    if (hideValues) setStateHideValues(hideValues === 'true');

    hasReadInitialUrl.current.add('states');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const buildUrl = useCallback((params: URLSearchParams) => {
    if (darkMode) params.set('darkMode', 'true'); else params.delete('darkMode');
    const search = params.toString();
    const currentPath = location.pathname === '/' ? '' : location.pathname;
    return `${currentPath}${search ? '?' + search : ''}`;
  }, [darkMode, location.pathname]);

  useEffect(() => {
    if (!hasReadInitialUrl.current.has('states')) return;
    if (activeTab !== 'states') return;

    const buildUrlLocal = (params: URLSearchParams) => {
      if (darkMode) params.set('darkMode', 'true'); else params.delete('darkMode');
      const search = params.toString();
      const currentPath = location.pathname === '/' ? '' : location.pathname;
      return `${currentPath}${search ? '?' + search : ''}`;
    };

    const params = new URLSearchParams(location.search);

    params.set('colorScale', stateColorScale);

    if (stateInvertColors) {
      params.set('invertColors', 'true');
    } else {
      params.delete('invertColors');
    }

    if (stateHideNames) {
      params.set('hideNames', 'true');
    } else {
      params.delete('hideNames');
    }

    if (stateHideValues) {
      params.set('hideValues', 'true');
    } else {
      params.delete('hideValues');
    }

    const newUrl = buildUrlLocal(params);

    if (location.pathname + location.search !== newUrl) {
      navigate(newUrl, { replace: true });
    }
  }, [activeTab, stateColorScale, stateInvertColors, stateHideNames, stateHideValues, darkMode, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (hasReadInitialUrl.current.has('districts')) return;
    if (activeTab !== 'districts') return;

    const params = new URLSearchParams(location.search);

    const colorScale = params.get('colorScale') as ColorScale;
    if (colorScale) setDistrictColorScale(colorScale);

    const invertColors = params.get('invertColors');
    if (invertColors) setDistrictInvertColors(invertColors === 'true');

    const mapType = params.get('mapType');
    if (mapType) {
      const config = getDistrictMapConfig(mapType);
      if (config) {
        setSelectedDistrictMapType(mapType);
      }
    }

    const showBoundaries = params.get('showStateBoundaries');
    if (showBoundaries !== null) setShowStateBoundaries(showBoundaries !== 'false');

    hasReadInitialUrl.current.add('districts');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!hasReadInitialUrl.current.has('districts')) return;
    if (activeTab !== 'districts') return;

    const params = new URLSearchParams(location.search);

    params.set('colorScale', districtColorScale);
    params.set('mapType', selectedDistrictMapType);

    if (districtInvertColors) {
      params.set('invertColors', 'true');
    } else {
      params.delete('invertColors');
    }

    if (!showStateBoundaries) {
      params.set('showStateBoundaries', 'false');
    } else {
      params.delete('showStateBoundaries');
    }

    const newUrl = buildUrl(params);

    if (location.pathname + location.search !== newUrl) {
      navigate(newUrl, { replace: true });
    }
  }, [activeTab, districtColorScale, districtInvertColors, selectedDistrictMapType, showStateBoundaries, darkMode, location.pathname, location.search, navigate, buildUrl]);

  useEffect(() => {
    if (hasReadInitialUrl.current.has('regions')) return;
    if (activeTab !== 'regions') return;

    const params = new URLSearchParams(location.search);

    const colorScale = params.get('colorScale') as ColorScale;
    if (colorScale) setDistrictColorScale(colorScale);

    const invertColors = params.get('invertColors');
    if (invertColors) setDistrictInvertColors(invertColors === 'true');

    hasReadInitialUrl.current.add('regions');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!hasReadInitialUrl.current.has('regions')) return;
    if (activeTab !== 'regions') return;

    const params = new URLSearchParams(location.search);

    params.set('colorScale', districtColorScale);

    if (districtInvertColors) {
      params.set('invertColors', 'true');
    } else {
      params.delete('invertColors');
    }

    const newUrl = buildUrl(params);

    if (location.pathname + location.search !== newUrl) {
      navigate(newUrl, { replace: true });
    }
  }, [activeTab, districtColorScale, districtInvertColors, selectedDistrictMapType, showStateBoundaries, darkMode, location.pathname, location.search, navigate, buildUrl]);

  useEffect(() => {
    if (hasReadInitialUrl.current.has('state-districts')) return;
    if (activeTab !== 'state-districts') return;

    const params = new URLSearchParams(location.search);

    const colorScale = params.get('colorScale') as ColorScale;
    if (colorScale) setStateDistrictColorScale(colorScale);

    const invertColors = params.get('invertColors');
    if (invertColors) setStateDistrictInvertColors(invertColors === 'true');

    const hideNames = params.get('hideNames');
    if (hideNames) setStateDistrictHideNames(hideNames === 'true');

    const hideValues = params.get('hideValues');
    if (hideValues) setStateDistrictHideValues(hideValues === 'true');

    const selectedState = params.get('selectedState');
    if (selectedState) setSelectedStateForMap(selectedState);

    const mapType = params.get('mapType');
    if (mapType) setSelectedStateMapType(mapType);

    hasReadInitialUrl.current.add('state-districts');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!hasReadInitialUrl.current.has('state-districts')) return;
    if (activeTab !== 'state-districts') return;

    const params = new URLSearchParams(location.search);

    params.set('colorScale', stateDistrictColorScale);
    params.set('mapType', selectedStateMapType);
    params.set('selectedState', selectedStateForMap);

    if (stateDistrictInvertColors) {
      params.set('invertColors', 'true');
    } else {
      params.delete('invertColors');
    }

    if (stateDistrictHideNames) {
      params.set('hideNames', 'true');
    } else {
      params.delete('hideNames');
    }

    if (stateDistrictHideValues) {
      params.set('hideValues', 'true');
    } else {
      params.delete('hideValues');
    }

    const newUrl = buildUrl(params);

    if (location.pathname + location.search !== newUrl) {
      navigate(newUrl, { replace: true });
    }
  }, [activeTab, stateDistrictColorScale, stateDistrictInvertColors, stateDistrictHideNames, stateDistrictHideValues, selectedStateForMap, selectedStateMapType, darkMode, location.pathname, location.search, navigate, buildUrl]);

  useEffect(() => {
    if (hasReadInitialUrl.current.has('cities')) return;
    if (activeTab !== 'cities') return;

    const params = new URLSearchParams(location.search);

    const city = params.get('city');
    if (city) {
      const cityEntry = cityList.find(c => c.displayName === city);
      if (cityEntry) {
        setSelectedCity(city);
        const datasetParam = params.get('dataset');
        if (datasetParam) {
          const ds = getCityDataset(datasetParam);
          if (ds && ds.displayName === city) {
            setSelectedCityDataset(datasetParam);
          }
        } else {
          const wardDs = cityEntry.datasets.find(d => d.type === 'wards') || cityEntry.datasets[0];
          setSelectedCityDataset(wardDs.id);
        }
      }
    }

    const colorScale = params.get('colorScale') as ColorScale;
    if (colorScale) setCityColorScale(colorScale);

    const invertColors = params.get('invertColors');
    if (invertColors) setCityInvertColors(invertColors === 'true');

    const hideNames = params.get('hideNames');
    if (hideNames) setCityHideNames(hideNames === 'true');

    const hideValues = params.get('hideValues');
    if (hideValues) setCityHideValues(hideValues === 'true');

    hasReadInitialUrl.current.add('cities');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!hasReadInitialUrl.current.has('cities')) return;
    if (activeTab !== 'cities') return;

    const params = new URLSearchParams();

    params.set('city', selectedCity);
    params.set('dataset', selectedCityDataset);
    params.set('colorScale', cityColorScale);
    if (cityInvertColors) params.set('invertColors', 'true');
    if (cityHideNames) params.set('hideNames', 'true');
    if (cityHideValues) params.set('hideValues', 'true');

    const newUrl = buildUrl(params);

    if (location.pathname + location.search !== newUrl) {
      navigate(newUrl, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedCity, selectedCityDataset, cityColorScale, cityInvertColors, cityHideNames, cityHideValues, darkMode, location.pathname, navigate]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const basePath = value === 'states' ? '' : value;
    const globalParams = new URLSearchParams();
    if (darkMode) globalParams.set('darkMode', 'true');
    const search = globalParams.toString();
    navigate(`/${basePath}${search ? '?' + search : ''}`);
  };

  useEffect(() => {
    const nonMapTabs = ['district-stats', 'help', 'credits', 'mcp'];
    if (!nonMapTabs.includes(activeTab)) return;

    const params = new URLSearchParams(location.search);
    const hasDarkParam = params.get('darkMode') === 'true';
    if (darkMode === hasDarkParam) return;

    const newUrl = buildUrl(params);
    if (location.pathname + location.search !== newUrl) {
      navigate(newUrl, { replace: true });
    }
  }, [activeTab, darkMode, location.pathname, location.search, navigate, buildUrl]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    let dataUrl = searchParams.get('dataUrl');
    let titleFromParams = searchParams.get('title') || '';

    // Support ?demo=N — resolve to the Nth demo for the current tab level
    const demoParam = searchParams.get('demo');
    if (demoParam && !dataUrl) {
      const demoIndex = parseInt(demoParam, 10);
      if (!isNaN(demoIndex) && demoIndex >= 1) {
        const tabFromPath = getTabFromPath(location.pathname);
        const level = tabFromPath === 'districts' ? 'districts' : 'states';
        const demos = Object.entries(showcaseDemoUrls as Record<string, { url: string; title: string }>)
          .filter(([key]) => key.startsWith(level + '_'));
        if (demoIndex <= demos.length) {
          const [, demo] = demos[demoIndex - 1];
          dataUrl = demo.url;
          titleFromParams = demo.title;
        }
      }
    }

    if (dataUrl) {
      if (skipDataUrlLoad.current) {
        skipDataUrlLoad.current = false;
        return;
      }
      const loadDataFromUrl = async () => {
        try {
          const response = await fetchWithCorsFallback(dataUrl);
          const csvText = await response.text();

          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const data = results.data as Record<string, string>[];
              const headers = results.meta.fields || [];

              const hasDistrict = data[0] && ('district_name' in data[0] || 'district' in data[0]);
              const colorScale = searchParams.get('colorScale') as ColorScale || 'spectral';
              const title = titleFromParams || searchParams.get('title') || '';
              const boundary = searchParams.get('boundary') || 'LGD';
              const showStateBoundaries = searchParams.get('showStateBoundaries') === 'true';
              const invertColors = searchParams.get('invertColors') === 'true';

              // Use last column as value (matches processUploadedData behavior),
              // but fall back to explicit 'value' column if present
              const valueColumns = hasDistrict ? headers.slice(2) : headers.slice(1);
              const valueCol = valueColumns.includes('value') ? 'value' : valueColumns[valueColumns.length - 1];
              const legendTitle = searchParams.get('legendTitle') || valueCol || 'Values';

              const parseVal = (v: string): number | string => {
                const trimmed = (v || '').trim();
                if (trimmed === '' || trimmed.toLowerCase() === 'na' || trimmed.toLowerCase() === 'n/a') return NaN;
                const num = Number(trimmed);
                return isNaN(num) ? trimmed : num;
              };

              if (hasDistrict) {
                // Multi-column support for districts
                if (valueColumns.length > 1) {
                  const allSeries = valueColumns.map(col => ({
                    key: col,
                    title: col,
                    data: data.filter(row => (row.state_name || row.state) && (row.district_name || row.district)).map(row => ({
                      state: row.state_name || row.state || '',
                      district: row.district_name || row.district || '',
                      value: parseVal(row[col]),
                    })),
                  }));
                  // Use the first series for initial display
                  setDistrictMapData(allSeries[0].data);
                  setDistrictDataTitle(allSeries[0].title);
                } else {
                  const districtData = data.map((row) => ({
                    state: row.state_name || row.state || '',
                    district: row.district_name || row.district || '',
                    value: parseVal(row[valueCol]),
                  }));
                  setDistrictMapData(districtData);
                  setDistrictDataTitle(legendTitle);
                }

                setDistrictColorScale(colorScale);
                setDistrictInvertColors(invertColors);
                setShowStateBoundaries(showStateBoundaries);
                setSelectedDistrictMapType(boundary);

                const values = (hasDistrict ? data : []).map(d => parseVal(d[valueCol]));
                const dataType = detectDataType(values);
                setDistrictDataType(dataType);

                if (dataType === 'categorical') {
                  const categories = getUniqueCategories(values);
                  const categoryColors = generateDefaultCategoryColors(categories);
                  setDistrictCategoryColors(categoryColors);
                  setDistrictColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
                }

                if (title) setDistrictMapTitle(title);
                setActiveTab('districts');
              } else {
                // Multi-column support for states
                if (valueColumns.length > 1) {
                  const allSeries = valueColumns.map(col => ({
                    key: col,
                    title: col,
                    data: data.filter(row => row.state_name || row.state).map(row => ({
                      state: row.state_name || row.state || '',
                      value: parseVal(row[col]),
                    })),
                  }));
                  handleStateMultiYearDataLoad(allSeries);
                } else {
                  const stateData = data.map((row) => ({
                    state: row.state_name || row.state || '',
                    value: parseVal(row[valueCol]),
                  }));
                  setStateMapData(stateData);
                  setStateDataTitle(legendTitle);

                  const values = stateData.map(d => d.value);
                  const dataType = detectDataType(values);
                  setStateDataType(dataType);

                  if (dataType === 'categorical') {
                    const categories = getUniqueCategories(values);
                    const categoryColors = generateDefaultCategoryColors(categories);
                    setStateCategoryColors(categoryColors);
                    setStateColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
                  }
                }

                setStateColorScale(colorScale);
                setStateInvertColors(invertColors);
                if (title) setStateMapTitle(title);
                setActiveTab('states');
              }
            },
            error: (error) => {
              console.error('CSV parsing error:', error);
            }
          });
        } catch (error) {
          console.error('Error loading data from URL:', error);
        }
      };

      loadDataFromUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);


  useEffect(() => {
    if (activeTab === 'state-districts') {
      const fuzzyMatchState = (current: string, stateList: string[]): string | undefined => {
        const normalized = current.toLowerCase().replace(/[^a-z]/g, '');
        return stateList.find(s => {
          const n = s.toLowerCase().replace(/[^a-z]/g, '');
          return n.includes(normalized) || normalized.includes(n);
        });
      };

      const reconcileSelectedState = (states: string[]) => {
        const current = selectedStateRef.current;
        if (!states.includes(current)) {
          setSelectedStateForMap(fuzzyMatchState(current, states) || states[0]);
        }
      };

      const fetchStates = async () => {
        try {
          const mapping = await loadStateGistMapping();
          setStateGistMapping(mapping);
          const states = getAvailableStates(mapping, selectedStateMapType);

          if (states.length === 0) {
            throw new Error('No states found in gist mapping');
          }

          setAvailableStates(states);
          reconcileSelectedState(states);
        } catch (error) {
          console.error('Failed to fetch states from gist mapping:', error);
          const geojsonPath = getDistrictMapConfig(selectedStateMapType).geojsonPath;
          const states = await getUniqueStatesFromGeoJSON(geojsonPath);
          setAvailableStates(states);
          setStateGistMapping(null);
          reconcileSelectedState(states);
        }
      };

      fetchStates();
    }
  }, [activeTab, selectedStateMapType]);

  useEffect(() => {
    async function updateChatContext() {
      try {
        let geoJsonPath = '';
        let data: DataPoint[] = [];
        let currentMapType = '';
        let currentSelectedState: string | undefined = undefined;
        let metricName: string | undefined = undefined;

        const normalizeValue = (v: number | string | null | undefined): number | null => {
          if (v === null || v === undefined) return null;
          if (typeof v === 'number') return Number.isFinite(v) ? v : null;
          const cleaned = String(v).trim();
          if (!cleaned) return null;
          const num = Number(cleaned);
          return Number.isFinite(num) ? num : null;
        };

        if (activeTab === 'states') {
          geoJsonPath = DATA_FILES.STATES_GEOJSON;
          currentMapType = 'states';
          // Use multi-year data if available, otherwise single-year
          if (stateMultiYearSeries.length > 0) {
            metricName = stateMultiYearSeries[0].title || undefined;
            data = stateMultiYearSeries[0].data.map(d => ({
              name: d.state,
              value: normalizeValue(d.value),
            }));
          } else {
            metricName = stateDataTitle || undefined;
            data = stateMapData.map(d => ({
              name: d.state,
              value: normalizeValue(d.value),
            }));
          }
        } else if (activeTab === 'districts') {
          const config = getDistrictMapConfig(selectedDistrictMapType);
          geoJsonPath = config.geojsonPath;
          currentMapType = selectedDistrictMapType;
          metricName = districtDataTitle || undefined;
          data = districtMapData.map(d => ({
            name: d.district,
            state: d.state,
            value: normalizeValue(d.value),
          }));
        } else if (activeTab === 'state-districts' && selectedStateForMap) {
          const config = getDistrictMapConfig(selectedStateMapType);
          geoJsonPath = config.geojsonPath;
          currentMapType = selectedStateMapType;
          currentSelectedState = selectedStateForMap;
          metricName = stateDistrictDataTitle || undefined;
          data = stateDistrictMapData.map(d => ({
            name: d.district,
            state: d.state,
            value: normalizeValue(d.value),
          }));
        } else if (activeTab === 'regions') {
          const config = getDistrictMapConfig('NSSO');
          geoJsonPath = config.geojsonPath;
          currentMapType = 'NSSO';
          metricName = districtDataTitle || undefined;
          data = districtMapData.map(d => ({
            name: d.district,
            state: d.state,
            value: normalizeValue(d.value),
          }));
        } else if (activeTab === 'cities' && cityMapData.length > 0) {
          const dataset = getCityDataset(selectedCityDataset);
          if (dataset) {
            geoJsonPath = dataset.geojsonPath;
            currentMapType = `${dataset.displayName} (${dataset.label})`;
            metricName = cityDataTitle || undefined;
            data = cityMapData.map(d => ({
              name: d.ward,
              value: normalizeValue(d.value),
            }));
          }
        }

        const prevContext = prevContextRef.current;
        const contextChanged =
          !prevContext ||
          prevContext.tab !== activeTab ||
          prevContext.mapType !== currentMapType ||
          prevContext.selectedState !== currentSelectedState;

        prevContextRef.current = {
          tab: activeTab,
          mapType: currentMapType,
          selectedState: currentSelectedState,
        };

        if (geoJsonPath && data.length > 0) {
          try {
            const context = await buildDynamicContext({
              activeTab: activeTab as 'states' | 'districts' | 'state-districts' | 'regions' | 'cities',
              selectedState: activeTab === 'state-districts' ? selectedStateForMap : undefined,
              mapType: currentMapType,
              data,
              geoJsonPath,
              metricName,
              conversationHistory: contextChanged ? [] : (chatContext?.conversationHistory || []),
            });

            setChatContext(context);
          } catch (contextError) {
            console.error('Failed to build chat context:', contextError, {
              error: contextError,
              stack: contextError instanceof Error ? contextError.stack : undefined
            });
            setChatContext(null);
          }
        } else {
          setChatContext(null);
        }
      } catch (error) {
        console.error('Chat context error:', error);
        setChatContext(null);
      }
    }

    updateChatContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    selectedStateForMap,
    selectedDistrictMapType,
    selectedStateMapType,
    stateMapData,
    stateMultiYearSeries,
    districtMapData,
    stateDistrictMapData,
    stateDataTitle,
    districtDataTitle,
    stateDistrictDataTitle,
    cityMapData,
    cityDataTitle,
    selectedCity,
    selectedCityDataset,
  ]);

  const handleStateDataLoad = (data: StateMapData[], title?: string, naInfo?: NAInfo) => {
    // Clear multi-year and wide-format state when single-year data is loaded
    setStateMultiYearSeries([]);
    setStateWideFormatMeta(null);
    setStateSelectedWideColumn(null);
    setStateMapData(data);
    setStateDataTitle(title || '');
    setStateNAInfo(naInfo);

    const values = data.map(d => d.value);
    const dataType = detectDataType(values);
    setStateDataType(dataType);

    if (dataType === 'categorical') {
      const categories = getUniqueCategories(values);
      const categoryColors = generateDefaultCategoryColors(categories);
      setStateCategoryColors(categoryColors);
      setStateColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

  
  const handleDemoUrlChange = (dataUrl: string, title: string) => {
    skipDataUrlLoad.current = true;
    const params = new URLSearchParams();
    params.set('dataUrl', dataUrl);
    if (title) params.set('title', title);
    navigate(buildUrl(params), { replace: true });
  };

  const handleStateMultiYearDataLoad = (series: MultiYearSeries[], wideFormat?: WideFormatMeta | null) => {
    // Clear single-year data when multi-year data is loaded
    setStateMapData([]);
    setStateDataTitle('');
    setStateNAInfo(undefined);
    setStateWideFormatMeta(wideFormat ?? null);
    setStateSelectedWideColumn(null);
    setStateMultiYearSeries(series);
    
    // Determine data type from all series
    const allValues = series.flatMap(s => s.data.map(d => d.value));
    const dataType = detectDataType(allValues);
    setStateDataType(dataType);

    if (dataType === 'categorical') {
      const categories = getUniqueCategories(allValues);
      const categoryColors = generateDefaultCategoryColors(categories);
      setStateCategoryColors(categoryColors);
      setStateColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

  const handleDistrictDataLoad = (rawData: Array<{ state?: string; state_name?: string; district?: string; district_name?: string; value: number | string }>, title?: string, naInfo?: NAInfo) => {
    const data: DistrictMapData[] = rawData.map(row => ({
      state: row.state || row.state_name || '',
      district: row.district || row.district_name || '',
      value: row.value === '' || row.value === 'NA' ? null : row.value
    }));

    setDistrictMapData(data);
    setDistrictDataTitle(title || '');
    setDistrictNAInfo(naInfo);

    const values = data.map(d => d.value);
    const dataType = detectDataType(values);
    setDistrictDataType(dataType);

    if (dataType === 'categorical') {
      const categories = getUniqueCategories(values);
      setDistrictCategoryColors(generateDefaultCategoryColors(categories));
      setDistrictColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

  const handleStateDistrictDataLoad = (rawData: Array<{ state?: string; state_name?: string; district?: string; district_name?: string; value: number | string }>, title?: string, naInfo?: NAInfo) => {
    setStateDistrictMultiSeries([]);
    setStateDistrictWideFormatMeta(null);
    setStateDistrictSelectedColumn(null);
    const data: DistrictMapData[] = rawData.map(row => ({
      state: row.state || row.state_name || '',
      district: row.district || row.district_name || '',
      value: row.value === '' || row.value === 'NA' ? null : row.value
    }));

    setStateDistrictMapData(data);
    setStateDistrictDataTitle(title || '');
    setStateDistrictNAInfo(naInfo);

    const values = data.map(d => d.value);
    const dataType = detectDataType(values);
    setStateDistrictDataType(dataType);

    if (dataType === 'categorical') {
      const categories = getUniqueCategories(values);
      setStateDistrictCategoryColors(generateDefaultCategoryColors(categories));
      setStateDistrictColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

  const handleStateDistrictMultiDataLoad = (series: DistrictSeries[], wideFormat?: WideFormatMeta | null) => {
    setStateDistrictMapData([]);
    setStateDistrictDataTitle('');
    setStateDistrictNAInfo(undefined);
    setStateDistrictWideFormatMeta(wideFormat ?? null);
    setStateDistrictSelectedColumn(null);
    setStateDistrictMultiSeries(series);
    const allValues = series.flatMap(s => s.data.map(d => d.value));
    const dataType = detectDataType(allValues);
    setStateDistrictDataType(dataType);
    if (dataType === 'categorical') {
      const categories = getUniqueCategories(allValues);
      setStateDistrictCategoryColors(generateDefaultCategoryColors(categories));
      setStateDistrictColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

  const handleCityDataLoad = (rawData: Array<{ ward?: string; ward_name?: string; state?: string; value: number | string }>, title?: string, naInfo?: NAInfo) => {
    const data: CityWardData[] = rawData
      .filter(row => row.value !== '' && row.value !== 'NA')
      .map(row => ({
        ward: row.ward || row.ward_name || row.state || '',
        value: row.value
      }));

    setCityMapData(data);
    setCityDataTitle(title || '');
    setCityNAInfo(naInfo ? { states: naInfo.states, count: naInfo.count } : undefined);

    const values = data.map(d => d.value);
    const dataType = detectDataType(values);
    setCityDataType(dataType);

    if (dataType === 'categorical') {
      const categories = getUniqueCategories(values);
      setCityCategoryColors(generateDefaultCategoryColors(categories));
      setCityColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

  const getActiveMapRef = () => {
    if (activeTab === 'states') return stateMapRef.current;
    if (activeTab === 'districts' || activeTab === 'regions') return districtMapRef.current;
    if (activeTab === 'cities') return cityMapRef.current;
    return stateDistrictMapRef.current;
  };

  const handleExportPNG = () => {
    if (activeTab === 'states') {
      if (stateMultiYearSeries.length > 0) {
        // Export all multi-year state maps as a single combined PNG
        exportMultiYearStatesAsPNG();
      } else {
        stateMapRef.current?.exportPNG();
      }
    } else if (activeTab === 'districts' || activeTab === 'regions') {
      districtMapRef.current?.exportPNG();
    } else if (activeTab === 'state-districts' && stateDistrictMultiSeries.length > 0) {
      const refs = displayedStateDistrictSeries.map(s => stateDistrictMapRefs.current.get(s.key)).filter(Boolean) as IndiaDistrictsMapRef[];
      if (refs.length > 0) refs[0].exportPNG();
    } else {
      stateDistrictMapRef.current?.exportPNG();
    }
  };

  const handleExportSVG = () => {
    if (activeTab === 'states') {
      if (stateMultiYearSeries.length > 0) {
        // Export all multi-year state maps as a single combined SVG
        exportMultiYearStatesAsSVG();
      } else {
        stateMapRef.current?.exportSVG();
      }
    } else if (activeTab === 'districts' || activeTab === 'regions') {
      districtMapRef.current?.exportSVG();
    } else if (activeTab === 'state-districts' && stateDistrictMultiSeries.length > 0) {
      const refs = displayedStateDistrictSeries.map(s => stateDistrictMapRefs.current.get(s.key)).filter(Boolean) as IndiaDistrictsMapRef[];
      if (refs.length > 0) refs[0].exportSVG();
    } else {
      stateDistrictMapRef.current?.exportSVG();
    }
  };

  const handleExportPDF = () => {
    if (activeTab === 'states') {
      if (stateMultiYearSeries.length > 0) {
        // Export all multi-year state maps as a single combined PDF
        exportMultiYearStatesAsPDF();
      } else {
        stateMapRef.current?.exportPDF();
      }
    } else if (activeTab === 'districts' || activeTab === 'regions') {
      districtMapRef.current?.exportPDF();
    } else if (activeTab === 'state-districts' && stateDistrictMultiSeries.length > 0) {
      const refs = displayedStateDistrictSeries.map(s => stateDistrictMapRefs.current.get(s.key)).filter(Boolean) as IndiaDistrictsMapRef[];
      if (refs.length > 0) refs[0].exportPDF();
    } else {
      stateDistrictMapRef.current?.exportPDF();
    }
  };

  const handleCopyToClipboard = () => {
    getActiveMapRef()?.copyToClipboard();
  };

  const handleDownloadCSVTemplate = () => {
    getActiveMapRef()?.downloadCSVTemplate();
  };

  /**
   * Multi-year states export helpers
   * For multi-year state maps we want a single combined image/PDF/SVG
   * instead of one file per map.
   */

  const displayedStateSeries = stateSelectedWideColumn
    ? stateMultiYearSeries.filter(s => s.key === stateSelectedWideColumn)
    : stateMultiYearSeries;

  const displayedStateDistrictSeries = stateDistrictSelectedColumn
    ? stateDistrictMultiSeries.filter(s => s.key === stateDistrictSelectedColumn)
    : stateDistrictMultiSeries;

  const getOrderedMultiYearMapRefs = () => {
    return displayedStateSeries
      .map(series => stateMultiYearMapRefs.current.get(series.key))
      .filter((ref): ref is IndiaMapRef => Boolean(ref));
  };

  const exportMultiYearStatesAsPNG = async () => {
    const mapRefs = getOrderedMultiYearMapRefs();
    if (mapRefs.length === 0) return;

    const svgElements = mapRefs
      .map(ref => ref.getSVGElement())
      .filter((el): el is SVGSVGElement => Boolean(el));

    if (svgElements.length === 0) return;

    const singleWidth = MAP_DIMENSIONS.STATES.width;
    const singleHeight = MAP_DIMENSIONS.STATES.height;
    const count = svgElements.length;
    const cols = count === 1 ? 1 : 2;
    const rows = Math.ceil(count / cols);

    const canvas = document.createElement('canvas');
    const dpiScale = 300 / 96;
    const totalWidth = singleWidth * cols;
    const totalHeight = singleHeight * rows;
    canvas.width = totalWidth * dpiScale;
    canvas.height = totalHeight * dpiScale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpiScale, dpiScale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    const drawSvgAt = (svg: SVGSVGElement, x: number, y: number) =>
      new Promise<void>((resolve, reject) => {
        const serializer = new XMLSerializer();
        const svgData = serializer.serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          try {
            ctx.drawImage(img, x, y, singleWidth, singleHeight);
            URL.revokeObjectURL(url);
            resolve();
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      });

    for (let i = 0; i < svgElements.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = col * singleWidth;
      const y = row * singleHeight;
      await drawSvgAt(svgElements[i], x, y);
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bharatviz-states-multi-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const exportMultiYearStatesAsSVG = () => {
    const mapRefs = getOrderedMultiYearMapRefs();
    if (mapRefs.length === 0) return;

    const svgElements = mapRefs
      .map(ref => ref.getSVGElement())
      .filter((el): el is SVGSVGElement => Boolean(el));

    if (svgElements.length === 0) return;

    const singleWidth = MAP_DIMENSIONS.STATES.width;
    const singleHeight = MAP_DIMENSIONS.STATES.height;
    const count = svgElements.length;
    const cols = count === 1 ? 1 : 2;
    const rows = Math.ceil(count / cols);

    const totalWidth = singleWidth * cols;
    const totalHeight = singleHeight * rows;

    const serializer = new XMLSerializer();
    let combined = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`;

    svgElements.forEach((svg, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = col * singleWidth;
      const y = row * singleHeight;
      const svgData = serializer.serializeToString(svg);
      const inner = svgData
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>\s*$/, '');
      combined += `<g transform="translate(${x},${y})">${inner}</g>`;
    });

    combined += '</svg>';

    const blob = new Blob([combined], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bharatviz-states-multi-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMultiYearStatesAsPDF = async () => {
    const mapRefs = getOrderedMultiYearMapRefs();
    if (mapRefs.length === 0) return;

    const svgElements = mapRefs
      .map(ref => ref.getSVGElement())
      .filter((el): el is SVGSVGElement => Boolean(el));

    if (svgElements.length === 0) return;

    const singleWidth = MAP_DIMENSIONS.STATES.width;
    const singleHeight = MAP_DIMENSIONS.STATES.height;
    const count = svgElements.length;
    const cols = count === 1 ? 1 : 2;
    const rows = Math.ceil(count / cols);

    const canvas = document.createElement('canvas');
    const totalWidth = singleWidth * cols;
    const totalHeight = singleHeight * rows;
    const dpiScale = 300 / 96;
    canvas.width = totalWidth * dpiScale;
    canvas.height = totalHeight * dpiScale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpiScale, dpiScale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    const drawSvgAt = (svg: SVGSVGElement, x: number, y: number) =>
      new Promise<void>((resolve, reject) => {
        const serializer = new XMLSerializer();
        const svgData = serializer.serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          try {
            ctx.drawImage(img, x, y, singleWidth, singleHeight);
            URL.revokeObjectURL(url);
            resolve();
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      });

    for (let i = 0; i < svgElements.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = col * singleWidth;
      const y = row * singleHeight;
      await drawSvgAt(svgElements[i], x, y);
    }

    const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
    const imgData = canvas.toDataURL('image/png', 1.0);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const availableWidth = pdfWidth - 2 * margin;
    const availableHeight = pdfHeight - 2 * margin;

    const imageAspect = totalWidth / totalHeight;
    const pageAspect = availableWidth / availableHeight;

    let renderWidth = availableWidth;
    let renderHeight = availableWidth / imageAspect;
    if (renderHeight > availableHeight) {
      renderHeight = availableHeight;
      renderWidth = availableHeight * imageAspect;
    }

    const x = (pdfWidth - renderWidth) / 2;
    const y = (pdfHeight - renderHeight) / 2;

    pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
    pdf.save(`bharatviz-states-multi-${Date.now()}.pdf`);
  };

  const createGistUrlProvider = () => {
    return (stateName: string) => {
      if (!stateGistMapping) return null;
      return getStateGeoJSONUrl(stateGistMapping, selectedStateMapType, stateName);
    };
  };

  const getSEOContent = () => {
    const baseUrl = 'https://bharatviz.saketlab.org';

    const seoConfigs = {
      states: {
        title: 'BharatViz - Fast Choropleth Maps for India | 36 States & UTs',
        description: 'Create publication-ready choropleth maps of India\'s 36 states and union territories. 27 boundary sets spanning Census 1941-2011, LGD, NFHS. 17 color scales, dark mode, export to PNG/SVG/PDF. Free and open source.',
        keywords: 'India maps, choropleth, state maps, data visualization, India states, Census India maps, LGD boundaries, research visualization, map maker',
        canonical: baseUrl,
        ogTitle: 'BharatViz - Fast Choropleth Maps for India',
        ogDescription: 'Create publication-ready choropleth maps of India\'s 36 states. 27 boundary sets, 17 color scales, export to PNG/SVG/PDF. Free and open source.'
      },
      districts: {
        title: 'Explore India\'s 750+ Districts | BharatViz District Choropleth Maps',
        description: 'Explore India\'s 750+ districts with choropleth maps. Support for LGD, NFHS-5, NFHS-4, Census 2011-1941, Survey of India, and ISRO Bhuvan boundaries. Export to PNG, SVG, PDF. Free tool for district-level data analysis.',
        keywords: 'India district maps, district choropleth, LGD districts, NFHS-5, NFHS-4, Census 2011, district data visualization, India geography, district boundaries',
        canonical: `${baseUrl}/districts`,
        ogTitle: 'Explore India\'s 750+ Districts | BharatViz',
        ogDescription: 'Explore India\'s 750+ districts with customizable choropleth maps. LGD, NFHS-5, NFHS-4, Census, and more boundary sets.'
      },
      regions: {
        title: 'NSSO Regions Maps | BharatViz India Regional Visualization',
        description: 'Create choropleth maps of NSSO (National Sample Survey Organization) regions in India. Ideal for survey analysis and regional statistical visualization. Free online mapping tool.',
        keywords: 'NSSO regions, India regions, survey regions, NSSO maps, regional analysis, statistical regions, sample survey, India geography',
        canonical: `${baseUrl}/regions`,
        ogTitle: 'NSSO Regions Maps | BharatViz',
        ogDescription: 'Visualize NSSO (National Sample Survey Organization) regions with customizable choropleth maps. Perfect for survey and statistical analysis.'
      },
      'state-districts': {
        title: 'Individual State District Maps | BharatViz State-Wise Visualization',
        description: 'Create detailed district-level maps for individual Indian states. High-resolution visualization with support for all major states. Export to PNG, SVG, PDF for presentations and publications.',
        keywords: 'state district maps, Maharashtra districts, Karnataka districts, Tamil Nadu districts, state-wise maps, detailed district maps, India state geography',
        canonical: `${baseUrl}/state-districts`,
        ogTitle: 'Individual State District Maps | BharatViz',
        ogDescription: 'Create detailed district-level maps for individual Indian states with customizable visualization options.'
      },
      cities: {
        title: 'City Ward Maps | BharatViz - 130+ Indian Cities',
        description: 'Explore ward-level choropleth maps for 130+ Indian cities including Mumbai, Delhi, Bangalore, Chennai, and more. Data from DataMeet, SBM, and AMRUT sources. Free and open source.',
        keywords: 'India city ward maps, municipal ward boundaries, city choropleth, Mumbai wards, Delhi wards, Bangalore wards, SBM ward data, AMRUT boundaries',
        canonical: `${baseUrl}/cities`,
        ogTitle: 'City Ward Maps | BharatViz - 130+ Indian Cities',
        ogDescription: 'Explore ward-level choropleth maps for 130+ Indian cities. Data from DataMeet, SBM, and AMRUT sources.'
      },
      'district-stats': {
        title: 'District Statistics & Boundary Comparison | BharatViz India Maps',
        description: 'Compare district counts and boundary definitions across LGD, NFHS-5, NFHS-4, Census 2011, and more. Explore how India\'s 750+ districts are defined across 27 administrative boundary sets spanning 1941 to present.',
        keywords: 'India district statistics, district count, LGD districts, NFHS districts, Census districts, boundary comparison, administrative divisions, India geography data',
        canonical: `${baseUrl}/district-stats`,
        ogTitle: 'District Statistics & Boundary Comparison | BharatViz',
        ogDescription: 'Compare district counts and boundaries across LGD, NFHS, Census, and other sources. Explore India\'s 750+ districts.'
      },
      help: {
        title: 'Help & API Documentation | BharatViz India Maps',
        description: 'Complete guide to using BharatViz: web interface, Python/R API, embedding maps, and programmatic access. Learn how to create choropleth maps of India with our comprehensive documentation.',
        keywords: 'BharatViz help, map API, Python India maps, R India maps, API documentation, embed maps, India map tutorial, choropleth API',
        canonical: `${baseUrl}/help`,
        ogTitle: 'BharatViz Help & API Documentation',
        ogDescription: 'Complete guide to using BharatViz for web, Python, R, and embedding maps. API documentation and examples included.'
      },
      credits: {
        title: 'Credits & Acknowledgments | BharatViz',
        description: 'Acknowledgments and credits for BharatViz - data sources, open source libraries, and contributors. Built with open data from Government of India sources.',
        keywords: 'BharatViz credits, data sources, acknowledgments, open source, India government data, LGD, NFHS',
        canonical: `${baseUrl}/credits`,
        ogTitle: 'Credits & Acknowledgments | BharatViz',
        ogDescription: 'Acknowledgments for BharatViz - data sources, libraries, and contributors.'
      },
      mcp: {
        title: 'MCP Server for AI Assistants | BharatViz India Maps',
        description: 'Connect BharatViz to Claude, Codex, or any MCP-compatible AI assistant. Generate India choropleth maps through natural language with 27 boundary sets, 17 color scales, and 300 DPI PNG output.',
        keywords: 'MCP server, Model Context Protocol, Claude AI maps, AI map generation, India maps API, LLM tools, bharatviz MCP, choropleth AI',
        canonical: `${baseUrl}/mcp`,
        ogTitle: 'BharatViz MCP Server for AI Assistants',
        ogDescription: 'Generate India choropleth maps through AI assistants. MCP server with 27 boundary sets and 17 color scales.'
      }
    };

    return seoConfigs[activeTab as keyof typeof seoConfigs] || seoConfigs.states;
  };

  const seoContent = getSEOContent();

  const tabTriggerClass = `rounded-lg border px-1.5 py-1 sm:border-2 sm:px-4 sm:py-3 font-semibold text-xs sm:text-base transition-all duration-200 ${
    darkMode
      ? 'border-gray-600 bg-gray-800 text-gray-300 hover:border-blue-500 hover:text-blue-400 data-[state=active]:border-blue-500 data-[state=active]:text-blue-300 data-[state=active]:bg-blue-900'
      : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-700 data-[state=active]:border-blue-600 data-[state=active]:text-blue-900 data-[state=active]:bg-blue-50'
  }`;

  return (
    <div className="min-h-screen p-3 sm:p-6" style={{ backgroundColor: darkMode ? '#000000' : undefined }}>
      <Helmet>
        <title>{seoContent.title}</title>
        <meta name="title" content={seoContent.title} />
        <meta name="description" content={seoContent.description} />
        <meta name="keywords" content={seoContent.keywords} />

        <link rel="canonical" href={seoContent.canonical} />

        <meta property="og:type" content="website" />
        <meta property="og:url" content={seoContent.canonical} />
        <meta property="og:title" content={seoContent.ogTitle} />
        <meta property="og:description" content={seoContent.ogDescription} />
        <meta property="og:image" content="https://bharatviz.saketlab.org/bharatviz_favicon.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="BharatViz - Interactive India Maps" />
        <meta property="og:site_name" content="BharatViz" />
        <meta property="og:locale" content="en_US" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={seoContent.canonical} />
        <meta name="twitter:title" content={seoContent.ogTitle} />
        <meta name="twitter:description" content={seoContent.ogDescription} />
        <meta name="twitter:image" content="https://bharatviz.saketlab.org/bharatviz_favicon.png" />
        <meta name="twitter:image:alt" content="BharatViz - Interactive India Maps" />
        <meta name="twitter:site" content="@saketkc" />
        <meta name="twitter:creator" content="@saketkc" />

        <meta name="author" content="Saket Choudhary" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="geo.region" content="IN" />
        <meta name="geo.placename" content="India" />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "BharatViz",
            "description": "Fast choropleth maps for India - visualize state and district level data",
            "url": "https://bharatviz.saketlab.org",
            "applicationCategory": "DataVisualization",
            "operatingSystem": "Web Browser",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "author": {
              "@type": "Person",
              "name": "Saket Choudhary"
            },
            "provider": {
              "@type": "Organization",
              "name": "Saket Lab",
              "url": "http://saketlab.in"
            }
          })}
        </script>
      </Helmet>

      {/* Dark Mode Toggle Button */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-background border-2 border-primary hover:bg-accent transition-colors"
        title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-3 sm:mb-8">
          <h1 className={`text-lg sm:text-4xl font-bold mb-1 sm:mb-4 flex items-center justify-center gap-2 sm:gap-3 ${darkMode ? 'text-white' : ''}`}>
            <img src="/bharatviz_favicon.png" alt="BharatViz Logo" className="h-6 sm:h-12 w-auto" />
            <span>BharatViz</span>
            <span className="hidden sm:inline">- Fast choropleths for India</span>
          </h1>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="mb-4 sm:mb-8">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-3 lg:grid-cols-9 gap-1 sm:gap-2 bg-transparent p-0 h-auto">
              <TabsTrigger
                value="states"
                className={tabTriggerClass}
              >
                States
              </TabsTrigger>
              <TabsTrigger
                value="districts"
                className={tabTriggerClass}
              >
                Districts
              </TabsTrigger>
              <TabsTrigger
                value="regions"
                className={tabTriggerClass}
              >
                Regions
              </TabsTrigger>
              <TabsTrigger
                value="state-districts"
                className={tabTriggerClass}
              >
                State-District
              </TabsTrigger>
              <TabsTrigger
                value="cities"
                className={tabTriggerClass}
              >
                Cities
              </TabsTrigger>
              <TabsTrigger
                value="district-stats"
                className={tabTriggerClass}
              >
                District Stats
              </TabsTrigger>
              <TabsTrigger
                value="help"
                className={tabTriggerClass}
              >
                Help
              </TabsTrigger>
              <TabsTrigger
                value="credits"
                className={tabTriggerClass}
              >
                Credits
              </TabsTrigger>
              <TabsTrigger
                value="mcp"
                className={tabTriggerClass}
              >
                MCP
              </TabsTrigger>
            </TabsList>
          </div>

          <div className={`space-y-6 ${activeTab === 'states' ? 'block' : 'hidden'}`}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                {stateMultiYearSeries.length > 0 ? (
                  <div className="space-y-4">
                    {stateWideFormatMeta && (
                      <div className={`flex flex-wrap items-center gap-4 p-3 rounded-lg border ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-muted/40 border-border'}`}>
                        <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>Color scale:</span>
                        <label className={`flex items-center gap-2 cursor-pointer ${darkMode ? 'text-gray-300' : ''}`}>
                          <input
                            type="radio"
                            name="wideScaleMode"
                            checked={stateWideColorScaleMode === 'single'}
                            onChange={() => setStateWideColorScaleMode('single')}
                            className="rounded-full"
                          />
                          <span className="text-sm">Single scale for all maps</span>
                        </label>
                        <label className={`flex items-center gap-2 cursor-pointer ${darkMode ? 'text-gray-300' : ''}`}>
                          <input
                            type="radio"
                            name="wideScaleMode"
                            checked={stateWideColorScaleMode === 'independent'}
                            onChange={() => setStateWideColorScaleMode('independent')}
                            className="rounded-full"
                          />
                          <span className="text-sm">Independent per column</span>
                        </label>
                        <div className="flex items-center gap-2 ml-auto">
                          <Label htmlFor="wide-column-select" className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-300' : ''}`}>Show:</Label>
                          <Select
                            value={stateSelectedWideColumn ?? '__all__'}
                            onValueChange={(v) => setStateSelectedWideColumn(v === '__all__' ? null : v)}
                          >
                            <SelectTrigger id="wide-column-select" className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">All columns</SelectItem>
                              {stateWideFormatMeta.numericColumns.map((col) => (
                                <SelectItem key={col} value={col}>{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {/* Multi-year / multi-column grid layout */}
                    {displayedStateSeries.length === 2 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {displayedStateSeries.map((series) => (
                          <div key={series.key} className="flex flex-col items-center">
                            <div className={`text-sm font-semibold mb-2 text-center ${darkMode ? 'text-white' : 'text-gray-700'}`}>{series.title}</div>
                            <div className="w-full overflow-hidden" style={{ height: '85%' }}>
                              <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '100%' }}>
                                <IndiaMap
                                  ref={(el) => {
                                    if (el) {
                                      stateMultiYearMapRefs.current.set(series.key, el);
                                    } else {
                                      stateMultiYearMapRefs.current.delete(series.key);
                                    }
                                  }}
                                  data={series.data}
                                  colorScale={stateColorScale}
                                  invertColors={stateInvertColors}
                                  hideStateNames={stateHideNames}
                                  hideValues={stateHideValues}
                                  dataTitle={series.title}
                                  colorBarSettings={stateColorBarSettings}
                                  dataType={stateDataType}
                                  categoryColors={stateCategoryColors}
                                  naInfo={series.naInfo}
                                  darkMode={darkMode}
                                  valueDomain={stateWideFormatMeta && stateWideColorScaleMode === 'single' ? [stateWideFormatMeta.globalMin, stateWideFormatMeta.globalMax] : undefined}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : displayedStateSeries.length === 3 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {displayedStateSeries.map((series, idx) => (
                          <div key={series.key} className={`flex flex-col items-center ${idx === 2 ? 'col-span-2' : ''}`}>
                            <div className={`text-sm font-semibold mb-2 text-center ${darkMode ? 'text-white' : 'text-gray-700'}`}>{series.title}</div>
                            <div className="w-full overflow-hidden" style={{ height: idx === 2 ? '70%' : '85%' }}>
                              <div
                                style={{
                                  transform: idx === 2 ? 'scale(0.7)' : 'scale(0.85)',
                                  transformOrigin: 'top left',
                                  width: '100%',
                                }}
                              >
                                <IndiaMap
                                  ref={(el) => {
                                    if (el) {
                                      stateMultiYearMapRefs.current.set(series.key, el);
                                    } else {
                                      stateMultiYearMapRefs.current.delete(series.key);
                                    }
                                  }}
                                  data={series.data}
                                  colorScale={stateColorScale}
                                  invertColors={stateInvertColors}
                                  hideStateNames={stateHideNames}
                                  hideValues={stateHideValues}
                                  dataTitle={series.title}
                                  colorBarSettings={stateColorBarSettings}
                                  dataType={stateDataType}
                                  categoryColors={stateCategoryColors}
                                  naInfo={series.naInfo}
                                  darkMode={darkMode}
                                  valueDomain={stateWideFormatMeta && stateWideColorScaleMode === 'single' ? [stateWideFormatMeta.globalMin, stateWideFormatMeta.globalMax] : undefined}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : displayedStateSeries.length >= 4 ? (
                      <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[1400px]">
                        {displayedStateSeries.map((series) => (
                            <div key={series.key} className="flex flex-col items-center gap-2">
                              <div className={`text-sm font-semibold mb-2 text-center ${darkMode ? 'text-white' : 'text-gray-700'}`}>{series.title}</div>
                              <div className="w-full overflow-hidden" style={{ height: '90%' }}>
                                <div
                                  style={{
                                    transform: 'scale(0.9)',
                                  transformOrigin: 'top left',
                                  width: '100%',
                                }}
                              >
                                <IndiaMap
                                  ref={(el) => {
                                    if (el) {
                                      stateMultiYearMapRefs.current.set(series.key, el);
                                    } else {
                                      stateMultiYearMapRefs.current.delete(series.key);
                                    }
                                  }}
                                  data={series.data}
                                  colorScale={stateColorScale}
                                  invertColors={stateInvertColors}
                                  hideStateNames={stateHideNames}
                                  hideValues={stateHideValues}
                                  dataTitle={series.title}
                                  colorBarSettings={stateColorBarSettings}
                                  dataType={stateDataType}
                                  categoryColors={stateCategoryColors}
                                  naInfo={series.naInfo}
                                  darkMode={darkMode}
                                  valueDomain={stateWideFormatMeta && stateWideColorScaleMode === 'single' ? [stateWideFormatMeta.globalMin, stateWideFormatMeta.globalMax] : undefined}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : displayedStateSeries.length === 1 ? (
                      <div className="flex flex-col items-center">
                        <div className={`text-sm font-semibold mb-2 text-center ${darkMode ? 'text-white' : 'text-gray-700'}`}>{displayedStateSeries[0].title}</div>
                        <IndiaMap
                          ref={(el) => {
                            if (el) stateMultiYearMapRefs.current.set(displayedStateSeries[0].key, el);
                            else stateMultiYearMapRefs.current.delete(displayedStateSeries[0].key);
                          }}
                          data={displayedStateSeries[0].data}
                          colorScale={stateColorScale}
                          invertColors={stateInvertColors}
                          hideStateNames={stateHideNames}
                          hideValues={stateHideValues}
                          dataTitle={displayedStateSeries[0].title}
                          colorBarSettings={stateColorBarSettings}
                          dataType={stateDataType}
                          categoryColors={stateCategoryColors}
                          naInfo={displayedStateSeries[0].naInfo}
                          darkMode={darkMode}
                          valueDomain={stateWideFormatMeta && stateWideColorScaleMode === 'single' ? [stateWideFormatMeta.globalMin, stateWideFormatMeta.globalMax] : undefined}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <IndiaMap ref={stateMapRef} data={stateMapData} colorScale={stateColorScale}
                    invertColors={stateInvertColors}
                    hideStateNames={stateHideNames}
                    hideValues={stateHideValues}
                    dataTitle={stateDataTitle}
                    mapTitle={stateMapTitle}
                    colorBarSettings={stateColorBarSettings}
                    dataType={stateDataType}
                    categoryColors={stateCategoryColors}
                    naInfo={stateNAInfo}
                    darkMode={darkMode}
                  />
                )}
                <div className="mt-6 flex justify-center">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    darkMode={darkMode}
                    geojsonDownloadUrl="/India_LGD_states.geojson"
                    geojsonDownloadName="India_LGD_states.geojson"
                    citationInfo={STATES_CITATION}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1">
                <FileUpload
                  onDataLoad={handleStateDataLoad}
                  onMultiDataLoad={(payload) => {
                    if (payload.kind === 'states') {
                      handleStateMultiYearDataLoad(payload.series, payload.wideFormat ?? null);
                    }
                  }}
                  mode="states"
                  geojsonPath="/India_LGD_states.geojson"
                  onMapTitleChange={setStateMapTitle}
                  onDemoUrlChange={handleDemoUrlChange}
                  darkMode={darkMode}
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
                    darkMode={darkMode}
                    dataType={stateDataType}
                    categories={getUniqueCategories(stateMapData.map(d => d.value))}
                    categoryColors={stateCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setStateCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-6 ${activeTab === 'districts' ? 'block' : 'hidden'}`}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                <IndiaDistrictsMap
                  ref={districtMapRef}
                  data={districtMapData}
                  colorScale={districtColorScale}
                  invertColors={districtInvertColors}
                  dataTitle={districtDataTitle}
                  mapTitle={districtMapTitle}
                  showStateBoundaries={showStateBoundaries}
                  colorBarSettings={districtColorBarSettings}
                  geojsonPath={getDistrictMapConfig(selectedDistrictMapType)?.geojsonPath}
                  statesGeojsonPath={getDistrictMapConfig(selectedDistrictMapType)?.states}
                  dataType={districtDataType}
                  categoryColors={districtCategoryColors}
                  naInfo={districtNAInfo}
                  darkMode={darkMode}
                />
                <div className="mt-6 flex justify-center">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    darkMode={darkMode}
                    geojsonDownloadUrl={getDistrictMapConfig(selectedDistrictMapType)?.geojsonPath}
                    geojsonDownloadName={`India_${selectedDistrictMapType}_districts.geojson`}
                    citationInfo={getDistrictsCitationInfo(selectedDistrictMapType, getDistrictMapConfig(selectedDistrictMapType)?.displayName)}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1">
                <div className={`mb-4 p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-card'}`}>
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
                  googleSheetLink={getDistrictMapConfig(selectedDistrictMapType).googleSheetLink}
                  geojsonPath={getDistrictMapConfig(selectedDistrictMapType).geojsonPath}
                  onMapTitleChange={setDistrictMapTitle}
                  onDemoUrlChange={handleDemoUrlChange}
                  darkMode={darkMode}
                />
                <div className="space-y-4 mt-6">
                  <ColorMapChooser
                    selectedScale={districtColorScale}
                    darkMode={darkMode}
                    onScaleChange={setDistrictColorScale}
                    invertColors={districtInvertColors}
                    onInvertColorsChange={setDistrictInvertColors}
                    showStateBoundaries={showStateBoundaries}
                    onShowStateBoundariesChange={setShowStateBoundaries}
                    colorBarSettings={districtColorBarSettings}
                    onColorBarSettingsChange={setDistrictColorBarSettings}
                    dataType={districtDataType}
                    categories={getUniqueCategories(districtMapData.map(d => d.value))}
                    categoryColors={districtCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setDistrictCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-6 ${activeTab === 'regions' ? 'block' : 'hidden'}`}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                <IndiaDistrictsMap
                  ref={districtMapRef}
                  data={districtMapData}
                  colorScale={districtColorScale}
                  invertColors={districtInvertColors}
                  dataTitle={districtDataTitle}
                  mapTitle={districtMapTitle}
                  showStateBoundaries={showStateBoundaries}
                  colorBarSettings={districtColorBarSettings}
                  geojsonPath={getDistrictMapConfig('NSSO').geojsonPath}
                  statesGeojsonPath={getDistrictMapConfig('NSSO').states}
                  dataType={districtDataType}
                  categoryColors={districtCategoryColors}
                  naInfo={districtNAInfo}
                  darkMode={darkMode}
                />
                <div className="mt-6 flex justify-center">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    darkMode={darkMode}
                    geojsonDownloadUrl={getDistrictMapConfig('NSSO')?.geojsonPath}
                    geojsonDownloadName="India_NSSO_regions.geojson"
                    citationInfo={NSSO_CITATION}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1">
                <div className={`mb-4 p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'}`}>
                  <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-black'}`}>NSSO Regions</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-black'}`}>
                    National Sample Survey Organization (NSSO) regions are geographical divisions used for survey sampling and statistical analysis across India.
                  </p>
                </div>

                <FileUpload
                  onDataLoad={handleDistrictDataLoad}
                  mode="districts"
                  templateCsvPath={getDistrictMapConfig('NSSO').templateCsvPath}
                  demoDataPath={getDistrictMapConfig('NSSO').demoDataPath}
                  googleSheetLink={getDistrictMapConfig('NSSO').googleSheetLink}
                  geojsonPath={getDistrictMapConfig('NSSO').geojsonPath}
                  darkMode={darkMode}
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
                    dataType={districtDataType}
                    categories={getUniqueCategories(districtMapData.map(d => d.value))}
                    categoryColors={districtCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setDistrictCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                    darkMode={darkMode}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-6 ${activeTab === 'state-districts' ? 'block' : 'hidden'}`}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 order-2 lg:order-2">
                {stateDistrictMultiSeries.length > 0 ? (
                  <div className="space-y-4">
                    {stateDistrictWideFormatMeta && (
                      <div className={`flex flex-wrap items-center gap-4 p-3 rounded-lg border ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-muted/40 border-border'}`}>
                        <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>Color scale:</span>
                        <label className={`flex items-center gap-2 cursor-pointer ${darkMode ? 'text-gray-300' : ''}`}>
                          <input type="radio" name="stateDistrictScaleMode" checked={stateDistrictColorScaleMode === 'single'} onChange={() => setStateDistrictColorScaleMode('single')} className="rounded-full" />
                          <span className="text-sm">Single scale for all maps</span>
                        </label>
                        <label className={`flex items-center gap-2 cursor-pointer ${darkMode ? 'text-gray-300' : ''}`}>
                          <input type="radio" name="stateDistrictScaleMode" checked={stateDistrictColorScaleMode === 'independent'} onChange={() => setStateDistrictColorScaleMode('independent')} className="rounded-full" />
                          <span className="text-sm">Independent per column</span>
                        </label>
                        <div className="flex items-center gap-2 ml-auto">
                          <Label htmlFor="state-district-column-select" className={`text-sm whitespace-nowrap ${darkMode ? 'text-gray-300' : ''}`}>Show:</Label>
                          <Select value={stateDistrictSelectedColumn ?? '__all__'} onValueChange={(v) => setStateDistrictSelectedColumn(v === '__all__' ? null : v)}>
                            <SelectTrigger id="state-district-column-select" className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">All</SelectItem>
                              {stateDistrictWideFormatMeta.numericColumns.map((col) => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {displayedStateDistrictSeries.length === 1 ? (
                      <div className="flex flex-col items-center">
                        <div className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>{displayedStateDistrictSeries[0].title}</div>
                        <IndiaDistrictsMap
                          ref={(el) => { if (el) stateDistrictMapRefs.current.set(displayedStateDistrictSeries[0].key, el); else stateDistrictMapRefs.current.delete(displayedStateDistrictSeries[0].key); }}
                          data={displayedStateDistrictSeries[0].data.filter(d => !selectedStateForMap || d.state === selectedStateForMap)}
                          colorScale={stateDistrictColorScale} invertColors={stateDistrictInvertColors} dataTitle={displayedStateDistrictSeries[0].title} showStateBoundaries={true}
                          colorBarSettings={stateDistrictColorBarSettings} geojsonPath={getDistrictMapConfig(selectedStateMapType).geojsonPath} statesGeojsonPath={getDistrictMapConfig(selectedStateMapType).states}
                          selectedState={selectedStateForMap} gistUrlProvider={createGistUrlProvider()}
                          hideDistrictNames={stateDistrictHideNames} hideDistrictValues={stateDistrictHideValues}
                          onHideDistrictNamesChange={setStateDistrictHideNames} onHideDistrictValuesChange={setStateDistrictHideValues}
                          dataType={stateDistrictDataType} categoryColors={stateDistrictCategoryColors}                           naInfo={displayedStateDistrictSeries[0].naInfo} darkMode={darkMode}
                          valueDomain={stateDistrictWideFormatMeta && stateDistrictColorScaleMode === 'single' ? [stateDistrictWideFormatMeta.globalMin, stateDistrictWideFormatMeta.globalMax] : undefined}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[1400px]">
                        {displayedStateDistrictSeries.map((series) => (
                          <div key={series.key} className="flex flex-col items-center gap-2">
                            <div className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>{series.title}</div>
                            <div className="w-full overflow-hidden" style={{ minHeight: 320 }}>
                              <IndiaDistrictsMap
                                ref={(el) => { if (el) stateDistrictMapRefs.current.set(series.key, el); else stateDistrictMapRefs.current.delete(series.key); }}
                                data={series.data.filter(d => !selectedStateForMap || d.state === selectedStateForMap)}
                                colorScale={stateDistrictColorScale} invertColors={stateDistrictInvertColors} dataTitle={series.title} showStateBoundaries={true}
                                colorBarSettings={stateDistrictColorBarSettings} geojsonPath={getDistrictMapConfig(selectedStateMapType).geojsonPath} statesGeojsonPath={getDistrictMapConfig(selectedStateMapType).states}
                                selectedState={selectedStateForMap} gistUrlProvider={createGistUrlProvider()}
                                hideDistrictNames={stateDistrictHideNames} hideDistrictValues={stateDistrictHideValues}
                                dataType={stateDistrictDataType} categoryColors={stateDistrictCategoryColors}                                 naInfo={series.naInfo} darkMode={darkMode}
                                valueDomain={stateDistrictWideFormatMeta && stateDistrictColorScaleMode === 'single' ? [stateDistrictWideFormatMeta.globalMin, stateDistrictWideFormatMeta.globalMax] : undefined}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
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
                  dataType={stateDistrictDataType}
                  categoryColors={stateDistrictCategoryColors}
                  naInfo={stateDistrictNAInfo}
                  darkMode={darkMode}
                />
                )}
                <div className="mt-6 flex justify-center">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    darkMode={darkMode}
                    geojsonDownloadUrl={getStateGeoJSONUrl(stateGistMapping, selectedStateMapType, selectedStateForMap)}
                    geojsonDownloadName={`${selectedStateForMap}-${selectedStateMapType}-districts.geojson`}
                    citationInfo={getDistrictsCitationInfo(selectedStateMapType, `${selectedStateForMap} Districts (${getDistrictMapConfig(selectedStateMapType)?.displayName})`)}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1">
                <div className={`mb-4 p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-card'}`}>
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

                <div className={`mb-4 p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-card'}`}>
                  <Label htmlFor="state-selector" className="text-sm font-medium mb-2 block">
                    Select State
                  </Label>
                  <input
                    type="text"
                    placeholder="Search state..."
                    value={stateSearchQuery}
                    onChange={(e) => setStateSearchQuery(e.target.value)}
                    className={`w-full mb-2 px-3 py-2 border rounded-md text-sm ${darkMode ? 'bg-[#222] border-[#444] text-white placeholder-gray-500' : 'border-input bg-background'}`}
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
                        <div className={`px-2 py-1.5 text-sm ${darkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>
                          No states found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <FileUpload
                  onDataLoad={handleStateDistrictDataLoad}
                  onMultiDataLoad={(payload) => {
                    if (payload.kind === 'districts') {
                      handleStateDistrictMultiDataLoad(payload.series, payload.wideFormat ?? null);
                    }
                  }}
                  mode="districts"
                  templateCsvPath={getDistrictMapConfig(selectedStateMapType).templateCsvPath}
                  demoDataPath={getDistrictMapConfig(selectedStateMapType).demoDataPath}
                  googleSheetLink={getDistrictMapConfig(selectedStateMapType).googleSheetLink}
                  geojsonPath={getDistrictMapConfig(selectedStateMapType).geojsonPath}
                  selectedState={selectedStateForMap}
                  darkMode={darkMode}
                />
                <div className="space-y-4 mt-6">
                  <ColorMapChooser
                    selectedScale={stateDistrictColorScale}
                    onScaleChange={setStateDistrictColorScale}
                    invertColors={stateDistrictInvertColors}
                    onInvertColorsChange={setStateDistrictInvertColors}
                    showStateBoundaries={true}
                    hideDistrictNames={stateDistrictHideNames}
                    darkMode={darkMode}
                    hideValues={stateDistrictHideValues}
                    onHideDistrictNamesChange={setStateDistrictHideNames}
                    onHideDistrictValuesChange={setStateDistrictHideValues}
                    colorBarSettings={stateDistrictColorBarSettings}
                    onColorBarSettingsChange={setStateDistrictColorBarSettings}
                    dataType={stateDistrictDataType}
                    categories={getUniqueCategories(stateDistrictMapData.map(d => d.value))}
                    categoryColors={stateDistrictCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setStateDistrictCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-6 ${activeTab === 'help' ? 'block' : 'hidden'}`}>
            <div className="max-w-4xl mx-auto p-6 space-y-8">
              <div className="p-4 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-950">
                <h2 className="text-xl font-bold mb-2 text-green-800 dark:text-green-200">Privacy & data security</h2>
                <p className="text-green-700 dark:text-green-300">
                  <strong>Your data is never stored.</strong> All processing happens in your browser or transiently on our servers.
                  We do not collect, store, or share any of your uploaded data.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>Web interface</h2>
                  <p className={`${darkMode ? 'text-gray-300' : 'text-muted-foreground'} mb-4`}>
                    BharatViz helps you create publication-ready choropleth maps of India at state and district levels with just a few clicks.
                  </p>
                  <div className="space-y-4">
                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>1. Upload your data</h3>
                      <p className={`${darkMode ? 'text-gray-300' : 'text-muted-foreground'} mb-2`}>Upload a CSV file with your data. Required columns:</p>
                      <ul className={`list-disc list-inside space-y-1 text-sm ${darkMode ? 'text-gray-300' : ''}`}>
                        <li><strong>States:</strong> <code>state</code> and <code>value</code></li>
                        <li><strong>Districts:</strong> <code>state_name</code>, <code>district_name</code>, and <code>value</code></li>
                      </ul>
                      <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>
                        Download the CSV template or load demo data to get started quickly.
                      </p>
                    </div>

                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>2. Customize your map</h3>
                      <ul className={`list-disc list-inside space-y-1 text-sm ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
                        <li><strong>Color Scale:</strong> Choose from sequential (blues, greens, viridis) or diverging (spectral, rdylbu) scales</li>
                        <li><strong>Invert Colors:</strong> Flip the color mapping (useful when lower values are better)</li>
                        <li><strong>Discrete vs Continuous:</strong> Use discrete bins or smooth gradients</li>
                        <li><strong>Labels:</strong> Toggle state names and values on/off</li>
                        <li><strong>District Maps:</strong> Choose between LGD, NFHS-5, or NFHS-4 boundaries</li>
                      </ul>
                    </div>

                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>3. Export your map</h3>
                      <p className={`${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>Export in multiple formats:</p>
                      <ul className={`list-disc list-inside space-y-1 text-sm ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
                        <li><strong>PNG:</strong> High-resolution raster image (300 DPI)</li>
                        <li><strong>SVG:</strong> Vector format for editing in Adobe Illustrator, Inkscape, etc.</li>
                        <li><strong>PDF:</strong> Publication-ready format</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>Programmatic access (API)</h2>
                  <p className={`${darkMode ? 'text-gray-300' : 'text-muted-foreground'} mb-4`}>
                    The API supports state and district-level maps (LGD, NFHS-5, NFHS-4), all color scales, and exports to PNG, SVG, and PDF formats from Python or R.
                  </p>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                      <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">Documentation & examples</h3>
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

                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>Python</h3>
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
  
                      <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                        <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>R</h3>
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
  
                      <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                        <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>R: Side-by-side maps (high resolution)</h3>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
  {`library(R6)
  library(grid)
  library(gridExtra)
  
  source("https://raw.githubusercontent.com/saketlab/bharatviz/refs/heads/main/server/examples/bharatviz.R")
  
  bv <- BharatViz$new()
  
  # Generate two maps
  data1 <- data.frame(state = c("Maharashtra", "Kerala"), value = c(75.8, 85.5))
  data2 <- data.frame(state = c("Maharashtra", "Kerala"), value = c(45.2, 62.1))
  
  map1 <- bv$generate_map(data1, title = "Metric A", color_scale = "blues")
  map2 <- bv$generate_map(data2, title = "Metric B", color_scale = "reds")
  
  # Get raster grobs (preserves resolution)
  grob1 <- bv$get_grob(map1)
  grob2 <- bv$get_grob(map2)
  
  # Display side by side
  grid.arrange(grob1, grob2, ncol = 2)
  
  # Save as high-res PNG (300 DPI)
  png("comparison.png", width = 16, height = 8, units = "in", res = 300)
  grid.arrange(grob1, grob2, ncol = 2)
  dev.off()
  
  # Save as PDF
  pdf("comparison.pdf", width = 16, height = 8)
  grid.arrange(grob1, grob2, ncol = 2)
  dev.off()`}
                        </pre>
                      </div>

                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>Direct API reference</h3>
                      <p className={`text-sm mb-3 ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
                        For custom implementations without the client libraries:
                      </p>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`# States Map Endpoint
POST /api/v1/states/map
{
  "data": [{"state": "Maharashtra", "value": 75.8}],
  "colorScale": "spectral",    // Optional: spectral, viridis, blues, etc.
  "invertColors": false,       // Optional: invert color scale
  "mainTitle": "My Map Title", // Optional: map title (default: "BharatViz")
  "legendTitle": "Values",     // Optional: legend label
  "hideStateNames": false,     // Optional: hide state labels
  "hideValues": false,         // Optional: hide value labels
  "darkMode": false,           // Optional: dark background
  "formats": ["png"]           // Optional: png, svg, pdf
}

# Districts Map Endpoint
POST /api/v1/districts/map
{
  "data": [{"state_name": "Telangana", "district_name": "Adilabad", "value": 45.2}],
  "mapType": "LGD",            // Required: LGD, NFHS5, NFHS4, SOI2011, SOI2001
  "colorScale": "spectral",
  "mainTitle": "District Map",
  "legendTitle": "Values",
  "formats": ["png"]
}`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-white' : ''}`}>Embedding maps</h2>
                  <p className={`${darkMode ? 'text-gray-300' : 'text-muted-foreground'} mb-4`}>
                    Embed interactive BharatViz maps directly into your website, blog, or GitHub Pages without downloading files.
                  </p>
                  <div className="space-y-4">
                    <div className="p-4 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-950">
                      <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">Live demo & interactive examples</h3>
                      <p className="text-blue-700 dark:text-blue-300 mb-3">
                        See both embedding methods in action with live, working examples.
                      </p>
                      <a
                        href="/embed-demo"
                        className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        View Embed Demo →
                      </a>
                    </div>

                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>iframe embed</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`<iframe
  src="https://bharatviz.saketlab.org/api/v1/embed?dataUrl=https://yoursite.com/data.csv&colorScale=viridis&title=My%20Map"
  width="800"
  height="600"
  frameborder="0">
</iframe>`}
                      </pre>
                    </div>

                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>JavaScript widget</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`<div id="my-map"></div>
<script src="https://bharatviz.saketlab.org/api/embed.js"></script>
<script>
  BharatViz.embed({
    container: '#my-map',
    dataUrl: 'https://yoursite.com/data.csv',
    colorScale: 'viridis',
    title: 'My Map'
  });
</script>`}
                      </pre>
                    </div>

                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>Direct SVG</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`<img src="https://bharatviz.saketlab.org/api/v1/embed/svg?dataUrl=https://yoursite.com/data.csv&colorScale=viridis" />`}
                      </pre>
                    </div>

                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>GitHub Pages example</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`# 1. Create data.csv in your GitHub repo
# 2. Enable GitHub Pages in repo settings
# 3. Embed using your GitHub Pages URL:
<iframe src="https://bharatviz.saketlab.org/api/v1/embed?dataUrl=https://USERNAME.github.io/REPO/data.csv&colorScale=viridis"></iframe>`}
                      </pre>
                    </div>

                    <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
                      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>Available parameters</h3>
                      <div className={`text-sm space-y-1 ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
                        <p><code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-[#333] text-gray-200' : 'bg-muted'}`}>dataUrl</code> - URL to your CSV file (required)</p>
                        <p><code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-[#333] text-gray-200' : 'bg-muted'}`}>mapType</code> - 'states', 'districts', or 'state-districts' (default: 'states')</p>
                        <p><code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-[#333] text-gray-200' : 'bg-muted'}`}>colorScale</code> - 'viridis', 'spectral', 'blues', 'greens', etc. (default: 'spectral')</p>
                        <p><code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-[#333] text-gray-200' : 'bg-muted'}`}>mainTitle</code> - Map title (default: 'BharatViz')</p>
                        <p><code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-[#333] text-gray-200' : 'bg-muted'}`}>legendTitle</code> - Legend label (default: 'Values')</p>
                        <p><code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-[#333] text-gray-200' : 'bg-muted'}`}>invertColors</code> - true/false to reverse color scale</p>
                        <p><code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-[#333] text-gray-200' : 'bg-muted'}`}>darkMode</code> - true/false for dark background with white boundaries and text</p>
                        <p><code className={`px-1 py-0.5 rounded ${darkMode ? 'bg-[#333] text-gray-200' : 'bg-muted'}`}>districtBoundary</code> - 'LGD', 'NFHS4', 'NFHS5', 'SOI2011', or 'SOI2001' for district maps</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <div className={`p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-muted/50'}`}>
                    <h2 className={`text-xl font-bold mb-2 flex items-center gap-2 ${darkMode ? 'text-white' : ''}`}>
                      <Github className="h-5 w-5" />
                      Open source
                    </h2>
                    <p className={`${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
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

          <div className={`space-y-6 ${activeTab === 'cities' ? 'block' : 'hidden'}`}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                <IndiaCityMap
                  ref={cityMapRef}
                  data={cityMapData}
                  colorScale={cityColorScale}
                  invertColors={cityInvertColors}
                  dataTitle={cityDataTitle}
                  colorBarSettings={cityColorBarSettings}
                  geojsonPath={currentCityDataset?.geojsonPath || '/cities/mumbai.geojson'}
                  hideWardNames={cityHideNames}
                  hideWardValues={cityHideValues}
                  onHideWardNamesChange={setCityHideNames}
                  onHideWardValuesChange={setCityHideValues}
                  dataType={cityDataType}
                  categoryColors={cityCategoryColors}
                  naInfo={cityNAInfo}
                  darkMode={darkMode}
                  cityName={currentCityDataset?.displayName || selectedCity}
                />
                <div className="mt-6 flex justify-center">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    darkMode={darkMode}
                    geojsonDownloadUrl={currentCityDataset?.geojsonPath}
                    geojsonDownloadName={`${selectedCityDataset}.geojson`}
                    citationInfo={currentCityDataset ? getCityCitationInfo(currentCityDataset) : undefined}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1">
                <div className={`mb-4 p-4 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-card'}`}>
                  <Label htmlFor="city-select" className="text-sm font-medium mb-2 block">
                    City
                  </Label>
                  <Popover open={cityPickerOpen} onOpenChange={setCityPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        id="city-select"
                        role="combobox"
                        aria-expanded={cityPickerOpen}
                        className={cn(
                          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                          !selectedCity && "text-muted-foreground"
                        )}
                      >
                        {selectedCity || "Select a city"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder="Search cities..." />
                        <CommandList>
                          <CommandEmpty>No city found.</CommandEmpty>
                          <CommandGroup>
                            {cityList.map((city) => (
                              <CommandItem
                                key={city.displayName}
                                value={`${city.displayName} ${city.state}`}
                                onSelect={() => {
                                  setSelectedCity(city.displayName);
                                  const datasets = getCityDatasets(city.displayName);
                                  if (datasets.length > 0) {
                                    const wardDataset = datasets.find(d => d.type === 'wards') || datasets[0];
                                    setSelectedCityDataset(wardDataset.id);
                                  }
                                  setCityMapData([]);
                                  setCityDataTitle('');
                                  setCityPickerOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedCity === city.displayName ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span>{city.displayName}</span>
                                  <span className="text-xs text-muted-foreground">{city.state} &middot; {city.datasets.length} dataset{city.datasets.length !== 1 ? 's' : ''}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {currentCityDatasets.length > 1 && (
                    <div className="mt-3">
                      <Label htmlFor="city-dataset-select" className="text-sm font-medium mb-2 block">
                        Dataset
                      </Label>
                      <Select
                        value={selectedCityDataset}
                        onValueChange={(datasetId) => {
                          setSelectedCityDataset(datasetId);
                          setCityMapData([]);
                          setCityDataTitle('');
                        }}
                      >
                        <SelectTrigger id="city-dataset-select" className="w-full">
                          <SelectValue placeholder="Select a dataset" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentCityDatasets.map((ds) => (
                            <SelectItem key={ds.id} value={ds.id}>
                              <div className="flex flex-col">
                                <span>{ds.label || ds.type}</span>
                                <span className="text-xs text-muted-foreground">{ds.featureCount} features &middot; {ds.source}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className={`mt-3 text-xs ${darkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>
                    {(() => {
                      if (!currentCityDataset) return null;
                      return (
                        <>
                          <span className="font-medium">{currentCityDataset.featureCount}</span> {currentCityDataset.type === 'wards' ? 'wards' : 'features'} &middot; Source: {currentCityDataset.source}
                          {currentCityDataset.label && currentCityDataset.label !== 'Wards' && <> &middot; {currentCityDataset.label}</>}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <FileUpload
                  onDataLoad={handleCityDataLoad}
                  mode="states"
                  demoDataPath={getCityCsvUrls(selectedCityDataset).demo}
                  templateCsvPath={getCityCsvUrls(selectedCityDataset).template}
                  googleSheetLink={getCityCsvUrls(selectedCityDataset).template}
                  darkMode={darkMode}
                />
                <div className="space-y-4 mt-6">
                  <ColorMapChooser
                    selectedScale={cityColorScale}
                    onScaleChange={setCityColorScale}
                    invertColors={cityInvertColors}
                    onInvertColorsChange={setCityInvertColors}
                    hideStateNames={cityHideNames}
                    hideValues={cityHideValues}
                    onHideStateNamesChange={setCityHideNames}
                    onHideValuesChange={setCityHideValues}
                    namesLabel="Hide ward names"
                    colorBarSettings={cityColorBarSettings}
                    onColorBarSettingsChange={setCityColorBarSettings}
                    darkMode={darkMode}
                    dataType={cityDataType}
                    categories={getUniqueCategories(cityMapData.map(d => d.value))}
                    categoryColors={cityCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setCityCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={`space-y-6 ${activeTab === 'district-stats' ? 'block' : 'hidden'}`}>
            <DistrictStats darkMode={darkMode} />
          </div>

          <div className={`space-y-6 ${activeTab === 'credits' ? 'block' : 'hidden'}`}>
            <Credits darkMode={darkMode} />
          </div>

          <div className={`space-y-6 ${activeTab === 'mcp' ? 'block' : 'hidden'}`}>
            <MCPDocs darkMode={darkMode} />
          </div>
        </Tabs>
      </div>
      <footer className={`w-full text-center text-xs mt-8 mb-2 ${darkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>
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

      <ChatPanel
        key={`${activeTab}-${activeTab === 'districts' ? selectedDistrictMapType : selectedStateMapType}-${selectedStateForMap || ''}`}
        context={chatContext}
      />
    </div>
  );
};
export default Index;
