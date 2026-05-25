import React, { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Helmet } from 'react-helmet-async';
import Papa from 'papaparse';
import { FileUpload } from '@/components/FileUpload';
import type { IndiaMapRef } from '@/components/IndiaMap';
import type { IndiaDistrictsMapRef } from '@/components/IndiaDistrictsMap';
import { ExportOptions } from '@/components/ExportOptions';
import { ColorMapChooser, type ColorScale, type ColorBarSettings } from '@/components/ColorMapChooser';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DEFAULT_DISTRICT_MAP_TYPE, getDistrictMapConfig, getDistrictMapTypesList } from '@/lib/districtMapConfig';
import { SUB_ADMIN_LAYERS, DEFAULT_SUB_ADMIN_LAYER, getSubAdminLayer, ELECTORAL_LAYERS, DEFAULT_ELECTORAL_LAYER, getElectoralLayer, ENVIRONMENT_LAYERS, DEFAULT_ENVIRONMENT_LAYER, getEnvironmentLayer, URBAN_LAYERS, DEFAULT_URBAN_LAYER, getUrbanLayer } from '@/lib/geodataLayerConfig';
import { getCityList, getCityDataset, getCityDatasets, getCityCsvUrls, DEFAULT_CITY, DEFAULT_CITY_DATASET } from '@/lib/cityMapConfig';
import type { IndiaCityMapRef, CityWardData } from '@/components/IndiaCityMap';
import type { IndiaPincodesMapRef, PincodeMapData } from '@/components/IndiaPincodesMap';
import { getUniqueStatesFromGeoJSON, reconcileSelectedState } from '@/lib/stateUtils';
import { loadStateGistMapping, getAvailableStates, getStateGeoJSONUrl, type StateGistMapping } from '@/lib/stateGistMapping';
import { getPincodeGeoJSONUrl, getPincodeGistStates, hasPincodeGists } from '@/lib/pincodeGistMapping';
import { fetchWithCorsFallback } from '@/lib/corsProxy';
import showcaseDemoUrls from '@/lib/showcase-demo-urls.json';
import { Github, Moon, Sun, Check, ChevronsUpDown } from 'lucide-react';
import { type DataType, type CategoryColorMapping, detectDataType, getUniqueCategories, generateDefaultCategoryColors } from '@/lib/categoricalUtils';
import { type BoundaryColor } from '@/lib/colorUtils';
import { STATES_CITATION, NSSO_CITATION, getDistrictsCitationInfo, getCityCitationInfo } from '@/lib/citations';
const ChatPanel = lazy(() => import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel })));
const buildDynamicContext = (...args: Parameters<typeof import('@/lib/chat/contextBuilder').buildDynamicContext>) =>
  import('@/lib/chat/contextBuilder').then(m => m.buildDynamicContext(...args));
import { DATA_FILES, MAP_DIMENSIONS, DEFAULT_FALLBACK_STATE, ALL_INDIA_STATE } from '@/lib/constants';
import type { DynamicChatContext, DataPoint } from '@/lib/chat/types';

const IndiaMap = lazy(() => import('@/components/IndiaMap').then(m => ({ default: m.IndiaMap })));
const IndiaDistrictsMap = lazy(() => import('@/components/IndiaDistrictsMap').then(m => ({ default: m.IndiaDistrictsMap })));
const IndiaCityMap = lazy(() => import('@/components/IndiaCityMap').then(m => ({ default: m.IndiaCityMap })));
const IndiaPincodesMap = lazy(() => import('@/components/IndiaPincodesMap').then(m => ({ default: m.IndiaPincodesMap })));
const DistrictStats = lazy(() => import('@/components/DistrictStats').then(m => ({ default: m.DistrictStats })));
const CityStats = lazy(() => import('@/components/CityStats').then(m => ({ default: m.CityStats })));
const HistoricalEvolution = lazy(() => import('@/components/HistoricalEvolution').then(m => ({ default: m.HistoricalEvolution })));
const Credits = lazy(() => import('@/components/Credits'));
const MCPDocs = lazy(() => import('@/components/MCPDocs'));

const TabPanel = ({ active, children }: { active: boolean; children: React.ReactNode }) => {
  if (!active) return null;
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-96 rounded border border-border bg-background animate-pulse" />}>
        {children}
      </Suspense>
    </div>
  );
};

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

interface MultiYearSeries {
  key: string;
  title: string;
  data: StateMapData[];
  naInfo?: NAInfo;
}

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (pathname: string): string => {
    const path = pathname.replace(/^\/|\/$/g, '');
    const validTabs = ['states', 'districts', 'regions', 'state-districts', 'sub-admin', 'electoral', 'environment', 'urban', 'cities', 'pincodes', 'district-stats', 'city-stats', 'evolution', 'help', 'credits', 'mcp'];
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

  const [districtMapData, setDistrictMapData] = useState<DistrictMapData[]>([]);
  const [districtColorScale, setDistrictColorScale] = useState<ColorScale>('spectral');
  const [districtInvertColors, setDistrictInvertColors] = useState(false);
  const [districtDataTitle, setDistrictDataTitle] = useState<string>('');
  const [districtMapTitle, setDistrictMapTitle] = useState<string>('');
  const [showStateBoundaries, setShowStateBoundaries] = useState(true);
  const [boundaryColor, setBoundaryColor] = useState<BoundaryColor>('auto');
  const [boundaryWidth, setBoundaryWidth] = useState(0.3);
  const [districtColorBarSettings, setDistrictColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false,
    binCount: 5,
    customBoundaries: [],
    useCustomBoundaries: false
  });
  const [districtDataType, setDistrictDataType] = useState<DataType>('numerical');
  const [districtCategoryColors, setDistrictCategoryColors] = useState<CategoryColorMapping>({});
  const [selectedDistrictMapType, setSelectedDistrictMapType] = useState<string>(DEFAULT_DISTRICT_MAP_TYPE);
  const [districtMapTypeOpen, setDistrictMapTypeOpen] = useState(false);
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
  const [stateMapTypeOpen, setStateMapTypeOpen] = useState(false);
  const [selectedStateForMap, setSelectedStateForMap] = useState<string>('Maharashtra');
  const [stateDistrictHideNames, setStateDistrictHideNames] = useState(false);
  const [stateDistrictHideValues, setStateDistrictHideValues] = useState(false);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [stateGistMapping, setStateGistMapping] = useState<StateGistMapping | null>(null);
  const [stateSearchQuery, setStateSearchQuery] = useState<string>('');
  const [stateDistrictNAInfo, setStateDistrictNAInfo] = useState<NAInfo | undefined>(undefined);

  const [subAdminLayerId, setSubAdminLayerId] = useState<string>(DEFAULT_SUB_ADMIN_LAYER);
  const [subAdminLayerOpen, setSubAdminLayerOpen] = useState(false);
  const [subAdminSelectedState, setSubAdminSelectedState] = useState<string>('Maharashtra');
  const [subAdminStateOpen, setSubAdminStateOpen] = useState(false);
  const [subAdminStates, setSubAdminStates] = useState<string[]>([]);
  const [subAdminStatesLoading, setSubAdminStatesLoading] = useState(false);
  const [subAdminMapData, setSubAdminMapData] = useState<DistrictMapData[]>([]);
  const [subAdminColorScale, setSubAdminColorScale] = useState<ColorScale>('spectral');
  const [subAdminInvertColors, setSubAdminInvertColors] = useState(false);
  const [subAdminDataTitle, setSubAdminDataTitle] = useState<string>('');
  const [subAdminColorBarSettings, setSubAdminColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false,
    binCount: 5,
    customBoundaries: [],
    useCustomBoundaries: false,
  });
  const [subAdminDataType, setSubAdminDataType] = useState<DataType>('numerical');
  const [subAdminCategoryColors, setSubAdminCategoryColors] = useState<CategoryColorMapping>({});
  const [subAdminNAInfo, setSubAdminNAInfo] = useState<NAInfo | undefined>(undefined);
  const [subAdminHideNames, setSubAdminHideNames] = useState(false);

  const [electoralLayerId, setElectoralLayerId] = useState<string>(DEFAULT_ELECTORAL_LAYER);
  const [electoralLayerOpen, setElectoralLayerOpen] = useState(false);
  const [electoralSelectedState, setElectoralSelectedState] = useState<string>('Maharashtra');
  const [electoralStateOpen, setElectoralStateOpen] = useState(false);
  const [electoralStates, setElectoralStates] = useState<string[]>([]);
  const [electoralStatesLoading, setElectoralStatesLoading] = useState(false);
  const [electoralMapData, setElectoralMapData] = useState<DistrictMapData[]>([]);
  const [electoralColorScale, setElectoralColorScale] = useState<ColorScale>('spectral');
  const [electoralInvertColors, setElectoralInvertColors] = useState(false);
  const [electoralDataTitle, setElectoralDataTitle] = useState<string>('');
  const [electoralColorBarSettings, setElectoralColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false, binCount: 5, customBoundaries: [], useCustomBoundaries: false,
  });
  const [electoralDataType, setElectoralDataType] = useState<DataType>('numerical');
  const [electoralCategoryColors, setElectoralCategoryColors] = useState<CategoryColorMapping>({});
  const [electoralNAInfo, setElectoralNAInfo] = useState<NAInfo | undefined>(undefined);
  const [electoralHideNames, setElectoralHideNames] = useState(false);

  const [environmentLayerId, setEnvironmentLayerId] = useState<string>(DEFAULT_ENVIRONMENT_LAYER);
  const [environmentLayerOpen, setEnvironmentLayerOpen] = useState(false);

  const [urbanLayerId, setUrbanLayerId] = useState<string>(DEFAULT_URBAN_LAYER);
  const [urbanLayerOpen, setUrbanLayerOpen] = useState(false);

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

  const [pincodeMapData, setPincodeMapData] = useState<PincodeMapData[]>([]);
  const [pincodeColorScale, setPincodeColorScale] = useState<ColorScale>('spectral');
  const [pincodeInvertColors, setPincodeInvertColors] = useState(false);
  const [pincodeDataTitle, setPincodeDataTitle] = useState<string>('');
  const [pincodeMapTitle, setPincodeMapTitle] = useState<string>('');
  const [pincodeColorBarSettings, setPincodeColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false,
    binCount: 5,
    customBoundaries: [],
    useCustomBoundaries: false
  });
  const [pincodeDataType, setPincodeDataType] = useState<DataType>('numerical');
  const [pincodeCategoryColors, setPincodeCategoryColors] = useState<CategoryColorMapping>({});
  const [pincodeNAInfo, setPincodeNAInfo] = useState<NAInfo | undefined>(undefined);
  const [selectedPincodeState, setSelectedPincodeState] = useState<string>(ALL_INDIA_STATE);
  const [pincodeStateSearchQuery, setPincodeStateSearchQuery] = useState<string>('');
  const [pincodeAvailableStates, setPincodeAvailableStates] = useState<string[]>([]);

  const { dark: darkMode, toggle: toggleDarkMode, setDark: setDarkMode } = useDarkMode();

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
  const cityMapRef = useRef<IndiaCityMapRef>(null);
  const pincodeMapRef = useRef<IndiaPincodesMapRef>(null);

  const hasReadInitialUrl = useRef<Set<string>>(new Set());
  const skipDataUrlLoad = useRef(false);
  const selectedStateRef = useRef(selectedStateForMap);
  useEffect(() => { selectedStateRef.current = selectedStateForMap; }, [selectedStateForMap]);

  // Disable state boundaries by default for pre-1947 maps (enclave geometry causes spikes)
  useEffect(() => {
    const year = parseInt(selectedDistrictMapType, 10);
    if (!isNaN(year) && year < 1947) setShowStateBoundaries(false);
  }, [selectedDistrictMapType]);

  const cityList = useMemo(() => getCityList(), []);
  const currentCityDataset = useMemo(() => getCityDataset(selectedCityDataset), [selectedCityDataset]);
  const currentCityDatasets = useMemo(() => getCityDatasets(selectedCity), [selectedCity]);

  useEffect(() => {
    const tabFromPath = getTabFromPath(location.pathname);
    if (tabFromPath !== activeTab) {
      setActiveTab(tabFromPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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

  const buildUrl = (params: URLSearchParams) => {
    if (darkMode) params.set('darkMode', 'true'); else params.delete('darkMode');
    const search = params.toString();
    const currentPath = location.pathname === '/' ? '/' : location.pathname;
    return `${currentPath}${search ? '?' + search : ''}`;
  };

  useEffect(() => {
    if (!hasReadInitialUrl.current.has('states')) return;
    if (activeTab !== 'states') return;

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

    const newUrl = buildUrl(params);

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
  }, [activeTab, districtColorScale, districtInvertColors, selectedDistrictMapType, showStateBoundaries, darkMode, location.pathname, location.search, navigate]);

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
  }, [activeTab, districtColorScale, districtInvertColors, darkMode, location.pathname, location.search, navigate]);

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
  }, [activeTab, stateDistrictColorScale, stateDistrictInvertColors, stateDistrictHideNames, stateDistrictHideValues, selectedStateForMap, selectedStateMapType, darkMode, location.pathname, location.search, navigate]);

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

  // Pincodes tab: read initial URL state
  useEffect(() => {
    if (hasReadInitialUrl.current.has('pincodes')) return;
    if (activeTab !== 'pincodes') return;

    const params = new URLSearchParams(location.search);

    const colorScale = params.get('colorScale') as ColorScale;
    if (colorScale) setPincodeColorScale(colorScale);

    const invertColors = params.get('invertColors');
    if (invertColors) setPincodeInvertColors(invertColors === 'true');

    const state = params.get('selectedState');
    if (state) setSelectedPincodeState(state);

    hasReadInitialUrl.current.add('pincodes');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Pincodes tab: persist URL state
  useEffect(() => {
    if (!hasReadInitialUrl.current.has('pincodes')) return;
    if (activeTab !== 'pincodes') return;

    const params = new URLSearchParams(location.search);
    params.set('colorScale', pincodeColorScale);
    params.set('selectedState', selectedPincodeState);
    if (pincodeInvertColors) params.set('invertColors', 'true');
    else params.delete('invertColors');

    const newUrl = buildUrl(params);
    if (location.pathname + location.search !== newUrl) {
      navigate(newUrl, { replace: true });
    }
  }, [activeTab, pincodeColorScale, pincodeInvertColors, selectedPincodeState, darkMode, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (activeTab !== 'pincodes') return;
    const reconcile = (states: string[]) => {
      setPincodeAvailableStates(states);
      setSelectedPincodeState(current =>
        states.includes(current) ? current : states[0] || DEFAULT_FALLBACK_STATE
      );
    };
    if (hasPincodeGists()) {
      reconcile(getPincodeGistStates());
    } else {
      getUniqueStatesFromGeoJSON(DATA_FILES.PINCODES_GEOJSON).then(reconcile);
    }
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const basePath = value === 'states' ? '' : value;
    const globalParams = new URLSearchParams();
    if (darkMode) globalParams.set('darkMode', 'true');
    const search = globalParams.toString();
    navigate(`/${basePath}${search ? '?' + search : ''}`);
  };

  useEffect(() => {
    const nonMapTabs = ['district-stats', 'city-stats', 'evolution', 'help', 'credits', 'mcp', 'sub-admin', 'electoral', 'environment', 'urban'];
    if (!nonMapTabs.includes(activeTab)) return;

    const params = new URLSearchParams(location.search);
    const hasDarkParam = params.get('darkMode') === 'true';
    if (darkMode === hasDarkParam) return;

    const newUrl = buildUrl(params);
    if (location.pathname + location.search !== newUrl) {
      navigate(newUrl, { replace: true });
    }
  }, [activeTab, darkMode, location.pathname, location.search, navigate]);

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
              const boundary = searchParams.get('boundary');
              const showStateBoundaries = searchParams.get('showStateBoundaries') === 'true';
              const invertColors = searchParams.get('invertColors') === 'true';

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
                if (boundary) setSelectedDistrictMapType(boundary);

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
    if (activeTab !== 'sub-admin') return;
    if (subAdminStates.length > 0) return;
    const layer = getSubAdminLayer(subAdminLayerId);
    setSubAdminStatesLoading(true);
    getUniqueStatesFromGeoJSON(layer.url).then(states => {
      setSubAdminStates(states);
      setSubAdminStatesLoading(false);
      setSubAdminSelectedState(current => reconcileSelectedState(current, states));
    }).catch(() => setSubAdminStatesLoading(false));
  }, [activeTab, subAdminLayerId]);

  useEffect(() => {
    setSubAdminSelectedState('Maharashtra');
    setSubAdminStates([]);
  }, [subAdminLayerId]);

  const subAdminMapRef = useRef<IndiaDistrictsMapRef>(null);

  useEffect(() => {
    if (activeTab !== 'electoral') return;
    if (electoralStates.length > 0) return;
    const layer = getElectoralLayer(electoralLayerId);
    setElectoralStatesLoading(true);
    getUniqueStatesFromGeoJSON(layer.url).then(states => {
      setElectoralStates(states);
      setElectoralStatesLoading(false);
      setElectoralSelectedState(current => reconcileSelectedState(current, states));
    }).catch(() => setElectoralStatesLoading(false));
  }, [activeTab, electoralLayerId]);

  useEffect(() => {
    setElectoralSelectedState('Maharashtra');
    setElectoralStates([]);
  }, [electoralLayerId]);

  const electoralMapRef = useRef<IndiaDistrictsMapRef>(null);

  const handleElectoralDataLoad = (rawData: Array<{ state: string; district: string; value: number | string }>, title?: string, naInfo?: NAInfo) => {
    const featureKey = getElectoralLayer(electoralLayerId).featureNameProp;
    const data: DistrictMapData[] = (rawData as Array<Record<string, string | number>>).map(row => ({
      state: String(row.state || row.state_name || ''),
      district: String(row[featureKey] || row.district || row.district_name || ''),
      value: row.value === '' || row.value === 'NA' ? null : row.value,
    }));
    setElectoralMapData(data);
    setElectoralDataTitle(title || '');
    setElectoralNAInfo(naInfo);
    const values = data.map(d => d.value);
    const dataType = detectDataType(values);
    setElectoralDataType(dataType);
    if (dataType === 'categorical') {
      setElectoralCategoryColors(generateDefaultCategoryColors(getUniqueCategories(values)));
      setElectoralColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

  const environmentMapRef = useRef<IndiaDistrictsMapRef>(null);
  const urbanMapRef = useRef<IndiaDistrictsMapRef>(null);

  const handleSubAdminDataLoad = (rawData: Array<{ state: string; district: string; value: number | string }>, title?: string, naInfo?: NAInfo) => {
    const featureKey = getSubAdminLayer(subAdminLayerId).featureNameProp;
    const data: DistrictMapData[] = (rawData as Array<Record<string, string | number>>).map(row => ({
      state: String(row.state || row.state_name || ''),
      district: String(row[featureKey] || row.district || row.district_name || ''),
      value: row.value === '' || row.value === 'NA' ? null : row.value,
    }));
    setSubAdminMapData(data);
    setSubAdminDataTitle(title || '');
    setSubAdminNAInfo(naInfo);
    const values = data.map(d => d.value);
    const dataType = detectDataType(values);
    setSubAdminDataType(dataType);
    if (dataType === 'categorical') {
      setSubAdminCategoryColors(generateDefaultCategoryColors(getUniqueCategories(values)));
      setSubAdminColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

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
    setStateMultiYearSeries([]);
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

  const handleStateMultiYearDataLoad = (series: MultiYearSeries[]) => {
    setStateMapData([]);
    setStateDataTitle('');
    setStateNAInfo(undefined);

    setStateMultiYearSeries(series);

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

  const handleCityDataLoad = (rawData: Array<{ ward?: string; ward_name?: string; state?: string; value: number | string }>, title?: string, naInfo?: NAInfo) => {
    const data: CityWardData[] = rawData
      .filter(row => row.value !== '' && row.value !== 'NA')
      .map(row => ({
        ward: row.ward || row.ward_name || row.state || '',
        value: row.value
      }));

    setCityMapData(data);
    setCityDataTitle(title || '');
    setCityNAInfo(naInfo ? { wards: naInfo.states, count: naInfo.count } : undefined);

    const values = data.map(d => d.value);
    const dataType = detectDataType(values);
    setCityDataType(dataType);

    if (dataType === 'categorical') {
      const categories = getUniqueCategories(values);
      setCityCategoryColors(generateDefaultCategoryColors(categories));
      setCityColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

  const handlePincodeDataLoad = (rawData: Array<{ pincode?: string; pin?: string; value: number | string }>, title?: string, naInfo?: NAInfo) => {
    const data: PincodeMapData[] = rawData
      .filter(row => row.value !== '' && row.value !== 'NA')
      .map(row => ({
        pincode: row.pincode || row.pin || '',
        value: row.value
      }));

    setPincodeMapData(data);
    setPincodeDataTitle(title || '');
    setPincodeNAInfo(naInfo ? { pincodes: naInfo.states, count: naInfo.count } : undefined);

    const values = data.map(d => d.value);
    const dataType = detectDataType(values);
    setPincodeDataType(dataType);

    if (dataType === 'categorical') {
      const categories = getUniqueCategories(values);
      setPincodeCategoryColors(generateDefaultCategoryColors(categories));
      setPincodeColorBarSettings(prev => ({ ...prev, isDiscrete: true }));
    }
  };

  const getActiveMapRef = () => {
    if (activeTab === 'states') return stateMapRef.current;
    if (activeTab === 'districts' || activeTab === 'regions') return districtMapRef.current;
    if (activeTab === 'cities') return cityMapRef.current;
    if (activeTab === 'pincodes') return pincodeMapRef.current;
    if (activeTab === 'sub-admin') return subAdminMapRef.current;
    if (activeTab === 'electoral') return electoralMapRef.current;
    if (activeTab === 'environment') return environmentMapRef.current;
    if (activeTab === 'urban') return urbanMapRef.current;
    return stateDistrictMapRef.current;
  };

  const handleExportPNG = () => {
    if (activeTab === 'states' && stateMultiYearSeries.length > 0) {
      exportMultiYearStatesAsPNG();
    } else {
      getActiveMapRef()?.exportPNG();
    }
  };

  const handleExportSVG = () => {
    if (activeTab === 'states' && stateMultiYearSeries.length > 0) {
      exportMultiYearStatesAsSVG();
    } else {
      getActiveMapRef()?.exportSVG();
    }
  };

  const handleExportPDF = () => {
    if (activeTab === 'states' && stateMultiYearSeries.length > 0) {
      exportMultiYearStatesAsPDF();
    } else {
      getActiveMapRef()?.exportPDF();
    }
  };

  const handleCopyToClipboard = () => {
    getActiveMapRef()?.copyToClipboard();
  };

  const handleDownloadCSVTemplate = () => {
    getActiveMapRef()?.downloadCSVTemplate();
  };

  const getOrderedMultiYearMapRefs = () => {
    return stateMultiYearSeries
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
      // eslint-disable-next-line no-await-in-loop
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
    const baseUrl = 'https://bharatviz.org';

    const seoConfigs = {
      states: {
        title: 'BharatViz: Mapping India',
        description: 'Create India choropleth maps without writing code. Upload a CSV, get a publication-ready state map in seconds. 36 states and UTs, 27 boundary sets, 17 color scales, export to PNG/SVG/PDF.',
        keywords: 'no code India maps, free India map maker, India choropleth map, state maps India, India data visualization, LGD, NFHS, Census India, map maker free',
        canonical: baseUrl,
        ogTitle: 'BharatViz: Mapping India',
        ogDescription: 'Create India maps without writing code. Upload a CSV, get a publication-ready choropleth map. 36 states, 27 boundary sets. Free.'
      },
      districts: {
        title: 'Free No-Code India District Map Maker | BharatViz',
        description: 'Create India district choropleth maps without writing code. Upload a CSV to visualize 750+ districts across LGD, NFHS-5, NFHS-4, Census 2011-1941, Survey of India, and ISRO Bhuvan. Export to PNG, SVG, PDF.',
        keywords: 'no code India district maps, India district map maker, free district choropleth, LGD districts, NFHS-5, NFHS-4, Census 2011, district data visualization, India geography',
        canonical: `${baseUrl}/districts`,
        ogTitle: 'Free No-Code India District Map Maker | BharatViz',
        ogDescription: 'Create India district maps without writing code. 750+ districts, LGD, NFHS-5, NFHS-4, Census boundaries. Upload CSV, export PNG/SVG/PDF.'
      },
      regions: {
        title: 'Mapping India by NSSO Regions | BharatViz',
        description: 'Mapping India by NSSO (National Sample Survey Organization) regions. Ideal for survey analysis and regional statistical visualization. Free online mapping tool.',
        keywords: 'NSSO regions, India regions, survey regions, NSSO maps, regional analysis, statistical regions, sample survey, India geography',
        canonical: `${baseUrl}/regions`,
        ogTitle: 'Mapping India by NSSO Regions | BharatViz',
        ogDescription: 'Visualize NSSO (National Sample Survey Organization) regions with customizable choropleth maps. Perfect for survey and statistical analysis.'
      },
      'state-districts': {
        title: 'State Detail Maps | BharatViz District Maps by State',
        description: 'Zoom into any Indian state with district-level choropleth maps. All 36 states and UTs supported across LGD, NFHS, Census, and colonial boundary sets. Export to PNG, SVG, PDF.',
        keywords: 'state district maps, Maharashtra districts, Karnataka districts, Tamil Nadu districts, state-wise maps, detailed district maps, India state geography',
        canonical: `${baseUrl}/state-districts`,
        ogTitle: 'State Detail Maps | BharatViz',
        ogDescription: 'District-level choropleth maps for any Indian state. 36 states and UTs, multiple boundary sets, export to PNG/SVG/PDF.'
      },
      cities: {
        title: 'Mapping India\'s Cities | BharatViz Ward Maps for 130+ Cities',
        description: 'Mapping India\'s cities at ward level. 130+ cities including Mumbai, Delhi, Bangalore, Chennai, and more. Data from DataMeet, SBM, and AMRUT sources. Free and open source.',
        keywords: 'India city ward maps, municipal ward boundaries, city choropleth, Mumbai wards, Delhi wards, Bangalore wards, SBM ward data, AMRUT boundaries',
        canonical: `${baseUrl}/cities`,
        ogTitle: 'Mapping India\'s Cities | BharatViz',
        ogDescription: 'Ward-level choropleth maps for 130+ Indian cities. Data from DataMeet, SBM, and AMRUT sources.'
      },
      pincodes: {
        title: 'India Pincode Maps | BharatViz',
        description: 'Visualize India at pincode level with choropleth maps. 19,000+ pincodes across all states and UTs. Upload a CSV with pincode and value to create publication-ready maps.',
        keywords: 'India pincode maps, pincode choropleth, ZIP code India map, postal code visualization, India postal boundaries, pincode data visualization',
        canonical: `${baseUrl}/pincodes`,
        ogTitle: 'India Pincode Maps | BharatViz',
        ogDescription: 'Pincode-level choropleth maps for all Indian states. 19,000+ pincodes. Upload CSV, export to PNG/SVG/PDF.'
      },
      evolution: {
        title: 'Administrative Evolution of India | BharatViz',
        description: 'Trace how India\'s district boundaries changed across eight census decades from 1872 to 2024. Explore splits, merges, and renames across all-India and Bombay Presidency maps with colour-coded lineage chains.',
        keywords: 'India district evolution, administrative history, district boundaries history, census decades, Bombay Presidency, India 1872, British India districts, colonial boundaries',
        canonical: `${baseUrl}/evolution`,
        ogTitle: 'Administrative Evolution of India | BharatViz',
        ogDescription: 'Trace India\'s district boundary changes from 1872 to 2024 across eight census decades. Colour-coded lineage chains show splits, merges, and renames.'
      },
      'district-stats': {
        title: 'India District Statistics | BharatViz',
        description: 'Compare district counts and boundary definitions across LGD, NFHS-5, NFHS-4, Census 2011, and more. Explore how India\'s 750+ districts are defined across 27 administrative boundary sets spanning 1941 to present.',
        keywords: 'India district statistics, district count, LGD districts, NFHS districts, Census districts, boundary comparison, administrative divisions, India geography data',
        canonical: `${baseUrl}/district-stats`,
        ogTitle: 'India District Statistics | BharatViz',
        ogDescription: 'Compare district counts and boundaries across LGD, NFHS, Census, and other sources. Explore India\'s 750+ districts.'
      },
      'city-stats': {
        title: 'India City Ward Statistics | BharatViz',
        description: 'Browse all city ward boundary datasets available in BharatViz. Covers 2,900+ datasets across 1,000+ Indian cities from DataMeet, SBM, AMRUT, and other sources.',
        keywords: 'India city statistics, city wards, ward boundaries, Indian cities, DataMeet, SBM, AMRUT, urban India data',
        canonical: `${baseUrl}/city-stats`,
        ogTitle: 'India City Ward Statistics | BharatViz',
        ogDescription: 'Browse 2,900+ city ward boundary datasets across Indian cities from DataMeet, SBM, AMRUT, and other sources.'
      },
      help: {
        title: 'Help and API Documentation | BharatViz',
        description: 'Complete guide to using BharatViz: web interface, Python/R API, embedding maps, and programmatic access. Learn how to map India with our comprehensive documentation.',
        keywords: 'BharatViz help, map API, Python India maps, R India maps, API documentation, embed maps, India map tutorial, choropleth API',
        canonical: `${baseUrl}/help`,
        ogTitle: 'BharatViz Help and API Documentation',
        ogDescription: 'Complete guide to using BharatViz for web, Python, R, and embedding maps. API documentation and examples included.'
      },
      credits: {
        title: 'Credits and Acknowledgments | BharatViz',
        description: 'Acknowledgments and credits for BharatViz. Data sources, open source libraries, and contributors. Built with open data from Government of India sources.',
        keywords: 'BharatViz credits, data sources, acknowledgments, open source, India government data, LGD, NFHS',
        canonical: `${baseUrl}/credits`,
        ogTitle: 'Credits and Acknowledgments | BharatViz',
        ogDescription: 'Acknowledgments for BharatViz. Data sources, libraries, and contributors.'
      },
      mcp: {
        title: 'BharatViz API & MCP Server',
        description: 'Programmatic access to BharatViz via REST API, Python, R, and MCP server. Connect to Claude or any MCP-compatible AI assistant. 27 boundary sets, 17 color scales, 300 DPI PNG export.',
        keywords: 'BharatViz API, MCP server, Model Context Protocol, Claude AI maps, AI map generation, India maps API, Python India maps, R India maps, LLM tools, bharatviz MCP',
        canonical: `${baseUrl}/mcp`,
        ogTitle: 'BharatViz API & MCP Server',
        ogDescription: 'REST API, Python, R, and MCP server access to BharatViz. 27 boundary sets, 17 color scales, 300 DPI PNG. Works with Claude and other AI assistants.'
      }
    };

    return seoConfigs[activeTab as keyof typeof seoConfigs] || seoConfigs.states;
  };

  const seoContent = getSEOContent();

  const primaryTabClass = 'primary-tab flex-1 rounded-none px-3 py-2.5 sm:px-5 sm:py-3 font-semibold text-sm sm:text-base transition-all duration-150 border-b-2 border-transparent bg-transparent text-[hsl(28,10%,45%)] hover:text-[hsl(28,20%,22%)] hover:border-[hsl(28,30%,68%)] data-[state=active]:border-[hsl(28,55%,42%)] data-[state=active]:text-[hsl(28,38%,22%)] data-[state=active]:bg-[hsl(35,28%,93%)] dark:text-[hsl(30,8%,55%)] dark:hover:text-[hsl(35,10%,82%)] dark:hover:border-[hsl(28,30%,40%)] dark:data-[state=active]:border-[hsl(28,55%,52%)] dark:data-[state=active]:text-[hsl(35,10%,88%)] dark:data-[state=active]:bg-[hsl(25,8%,12%)]';
  const secondaryTabClass = 'shrink-0 rounded px-2.5 py-1.5 sm:px-4 sm:py-2 font-medium text-xs sm:text-sm transition-all duration-150 border border-[hsl(35,16%,87%)] bg-transparent text-[hsl(28,8%,50%)] hover:border-[hsl(28,25%,72%)] hover:text-[hsl(28,18%,30%)] data-[state=active]:border-[hsl(28,42%,52%)] data-[state=active]:text-[hsl(28,38%,24%)] data-[state=active]:bg-[hsl(35,28%,92%)] dark:border-[hsl(25,8%,14%)] dark:bg-[hsl(25,8%,9%)] dark:text-[hsl(30,8%,50%)] dark:hover:border-[hsl(28,30%,40%)] dark:hover:text-[hsl(30,8%,68%)] dark:data-[state=active]:border-[hsl(28,45%,42%)] dark:data-[state=active]:text-[hsl(35,10%,82%)] dark:data-[state=active]:bg-[hsl(28,14%,20%)]';

  return (
    <div className="min-h-screen p-3 sm:p-6 bg-[hsl(38,30%,97%)] dark:bg-[hsl(25,8%,6%)]">
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
        <meta property="og:image" content="https://bharatviz.org/bharatviz_favicon.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="BharatViz: Mapping India" />
        <meta property="og:site_name" content="BharatViz" />
        <meta property="og:locale" content="en_US" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={seoContent.canonical} />
        <meta name="twitter:title" content={seoContent.ogTitle} />
        <meta name="twitter:description" content={seoContent.ogDescription} />
        <meta name="twitter:image" content="https://bharatviz.org/bharatviz_favicon.png" />
        <meta name="twitter:image:alt" content="BharatViz: Mapping India" />
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
            "url": "https://bharatviz.org",
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

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-5 sm:mb-7">
          <div className="flex items-center gap-3 sm:gap-4">
            <img src="/bharatviz_favicon.png" alt="BharatViz Logo" className="h-8 sm:h-11 w-auto" />
            <div>
              <h1 className="font-sans font-bold tracking-tight leading-none text-xl sm:text-3xl text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
                BharatViz
              </h1>
              <p className="font-sans font-normal text-xs sm:text-sm mt-0.5 text-[hsl(28,38%,46%)] dark:text-[hsl(28,40%,52%)] tracking-wide">
                Mapping India
              </p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full text-[hsl(28,20%,40%)] hover:text-[hsl(28,20%,14%)] hover:bg-[hsl(35,20%,92%)] dark:text-[hsl(30,8%,55%)] dark:hover:text-[hsl(35,12%,90%)] dark:hover:bg-[hsl(25,8%,12%)] transition-colors"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="mb-6 sm:mb-10">
            <div className="mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(28,10%,56%)] dark:text-[hsl(30,6%,38%)] select-none">Maps</span>
            </div>
            <TabsList className="flex w-full gap-0 bg-transparent p-0 h-auto border-b border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
              <TabsTrigger value="states" className={primaryTabClass}>States</TabsTrigger>
              <TabsTrigger value="districts" className={primaryTabClass}>Districts</TabsTrigger>
              <TabsTrigger value="regions" className={primaryTabClass}>Regions</TabsTrigger>
              <TabsTrigger value="state-districts" className={primaryTabClass}>State Detail</TabsTrigger>
              <TabsTrigger value="sub-admin" className={primaryTabClass}>Sub-Admin</TabsTrigger>
              <TabsTrigger value="electoral" className={primaryTabClass}>Electoral</TabsTrigger>
              <TabsTrigger value="environment" className={primaryTabClass}>Environment</TabsTrigger>
              <TabsTrigger value="urban" className={primaryTabClass}>Urban</TabsTrigger>
              <TabsTrigger value="cities" className={primaryTabClass}>Cities</TabsTrigger>
              <TabsTrigger value="pincodes" className={primaryTabClass}>Pincodes</TabsTrigger>
            </TabsList>
            <div className="mt-5 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(28,10%,56%)] dark:text-[hsl(30,6%,38%)] select-none">Data & Tools</span>
            </div>
            <TabsList className="flex flex-nowrap overflow-x-auto gap-1 sm:gap-1.5 bg-transparent p-0 h-auto scrollbar-none">
              <TabsTrigger value="district-stats" className={secondaryTabClass}>District Stats</TabsTrigger>
              <TabsTrigger value="city-stats" className={secondaryTabClass}>City Stats</TabsTrigger>
              <TabsTrigger value="evolution" className={secondaryTabClass}>Evolution</TabsTrigger>
              <TabsTrigger value="help" className={secondaryTabClass}>Help</TabsTrigger>
              <TabsTrigger value="credits" className={secondaryTabClass}>Credits</TabsTrigger>
              <TabsTrigger value="mcp" className={secondaryTabClass}>API</TabsTrigger>
            </TabsList>
          </div>

          <TabPanel active={activeTab === 'states'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                {stateMultiYearSeries.length > 0 ? (
                  <div className="space-y-4">
                    {stateMultiYearSeries.length === 2 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {stateMultiYearSeries.map((series) => (
                          <div key={series.key} className="flex flex-col items-center">
                            <div className="text-sm font-semibold mb-2 text-center text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,90%)]">{series.title}</div>
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
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : stateMultiYearSeries.length === 3 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {stateMultiYearSeries.map((series, idx) => (
                          <div key={series.key} className={`flex flex-col items-center ${idx === 2 ? 'col-span-2' : ''}`}>
                            <div className="text-sm font-semibold mb-2 text-center text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,90%)]">{series.title}</div>
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
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : stateMultiYearSeries.length >= 4 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {stateMultiYearSeries.slice(0, 4).map((series) => (
                            <div key={series.key} className="flex flex-col items-center gap-2">
                              <div className="text-sm font-semibold mb-2 text-center text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,90%)]">{series.title}</div>
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
                                />
                              </div>
                            </div>
                          </div>
                        ))}
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
                    boundaryColor={boundaryColor}
                    boundaryWidth={boundaryWidth}
                  />
                )}
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={stateMapData.length === 0 && stateMultiYearSeries.length === 0}
                    geojsonDownloadUrl="/India_LGD_states.geojson"
                    geojsonDownloadName="India_LGD_states.geojson"
                    citationInfo={STATES_CITATION}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <FileUpload
                  onDataLoad={handleStateDataLoad}
                  onMultiDataLoad={(payload) => {
                    if (payload.kind === 'states') {
                      handleStateMultiYearDataLoad(payload.series);
                    }
                  }}
                  mode="states"
                  geojsonPath="/India_LGD_states.geojson"
                  onMapTitleChange={setStateMapTitle}
                  onDemoUrlChange={handleDemoUrlChange}
                />
                <div className="mt-6">
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
                    dataType={stateDataType}
                    categories={getUniqueCategories(stateMapData.map(d => d.value))}
                    categoryColors={stateCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setStateCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                    boundaryColor={boundaryColor}
                    onBoundaryColorChange={setBoundaryColor}
                    boundaryWidth={boundaryWidth}
                    onBoundaryWidthChange={setBoundaryWidth}
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'districts'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
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
                  boundaryColor={boundaryColor}
                  boundaryWidth={boundaryWidth}
                />
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={districtMapData.length === 0}
                    geojsonDownloadUrl={getDistrictMapConfig(selectedDistrictMapType)?.geojsonPath}
                    geojsonDownloadName={`India_${selectedDistrictMapType}_districts.geojson`}
                    citationInfo={getDistrictsCitationInfo(selectedDistrictMapType, getDistrictMapConfig(selectedDistrictMapType)?.displayName)}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <div className="mb-5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    Boundary Type
                  </Label>
                  <Popover open={districtMapTypeOpen} onOpenChange={setDistrictMapTypeOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={districtMapTypeOpen}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-background border-input hover:bg-accent transition-colors"
                      >
                        <span className="truncate text-left">
                          {getDistrictMapConfig(selectedDistrictMapType)?.displayName ?? 'Select boundary type'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search boundary type…" className="h-9" />
                        <CommandList className="max-h-60">
                          <CommandEmpty>No boundary type found.</CommandEmpty>
                          <CommandGroup>
                            {getDistrictMapTypesList().map((mapType) => (
                              <CommandItem
                                key={mapType.id}
                                value={`${mapType.displayName} ${mapType.description ?? ''}`}
                                onSelect={() => {
                                  setSelectedDistrictMapType(mapType.id);
                                  setDistrictMapTypeOpen(false);
                                }}
                                className="flex items-start gap-2"
                              >
                                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', selectedDistrictMapType === mapType.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex flex-col min-w-0">
                                  <span>{mapType.displayName}</span>
                                  {mapType.description && (
                                    <span className="text-xs text-muted-foreground truncate">{mapType.description}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <FileUpload
                  onDataLoad={handleDistrictDataLoad}
                  mode="districts"
                  templateCsvPath={getDistrictMapConfig(selectedDistrictMapType).templateCsvPath}
                  googleSheetLink={getDistrictMapConfig(selectedDistrictMapType).googleSheetLink}
                  geojsonPath={getDistrictMapConfig(selectedDistrictMapType).geojsonPath}
                  onMapTitleChange={setDistrictMapTitle}
                  onDemoUrlChange={handleDemoUrlChange}
                />
                <div className="mt-6">
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
                    boundaryColor={boundaryColor}
                    onBoundaryColorChange={setBoundaryColor}
                    boundaryWidth={boundaryWidth}
                    onBoundaryWidthChange={setBoundaryWidth}
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'regions'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
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
                  boundaryColor={boundaryColor}
                  boundaryWidth={boundaryWidth}
                />
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={districtMapData.length === 0}
                    geojsonDownloadUrl={getDistrictMapConfig('NSSO')?.geojsonPath}
                    geojsonDownloadName="India_NSSO_regions.geojson"
                    citationInfo={NSSO_CITATION}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <div className="mb-5 pl-3 border-l-2 border-[hsl(28,42%,52%)] dark:border-[hsl(28,35%,38%)]">
                  <h3 className="text-sm font-semibold mb-1 text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,90%)]">NSSO Regions</h3>
                  <p className="text-xs text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
                    National Sample Survey Organization regions used for survey sampling and statistical analysis across India.
                  </p>
                </div>

                <FileUpload
                  onDataLoad={handleDistrictDataLoad}
                  mode="districts"
                  templateCsvPath={getDistrictMapConfig('NSSO').templateCsvPath}
                  demoDataPath={getDistrictMapConfig('NSSO').demoDataPath}
                  googleSheetLink={getDistrictMapConfig('NSSO').googleSheetLink}
                  geojsonPath={getDistrictMapConfig('NSSO').geojsonPath}
                />
                <div className="mt-6">
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
                    boundaryColor={boundaryColor}
                    onBoundaryColorChange={setBoundaryColor}
                    boundaryWidth={boundaryWidth}
                    onBoundaryWidthChange={setBoundaryWidth}
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'state-districts'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
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
                  boundaryColor={boundaryColor}
                  boundaryWidth={boundaryWidth}
                />
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={stateDistrictMapData.length === 0}
                    geojsonDownloadUrl={getStateGeoJSONUrl(stateGistMapping, selectedStateMapType, selectedStateForMap)}
                    geojsonDownloadName={`${selectedStateForMap}-${selectedStateMapType}-districts.geojson`}
                    citationInfo={getDistrictsCitationInfo(selectedStateMapType, `${selectedStateForMap} Districts (${getDistrictMapConfig(selectedStateMapType)?.displayName})`)}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <div className="mb-5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    Boundary Type
                  </Label>
                  <Popover open={stateMapTypeOpen} onOpenChange={setStateMapTypeOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={stateMapTypeOpen}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-background border-input hover:bg-accent transition-colors"
                      >
                        <span className="truncate text-left">
                          {getDistrictMapConfig(selectedStateMapType)?.displayName ?? 'Select boundary type'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search boundary type…" className="h-9" />
                        <CommandList className="max-h-60">
                          <CommandEmpty>No boundary type found.</CommandEmpty>
                          <CommandGroup>
                            {getDistrictMapTypesList().map((mapType) => (
                              <CommandItem
                                key={mapType.id}
                                value={`${mapType.displayName} ${mapType.description ?? ''}`}
                                onSelect={() => {
                                  setSelectedStateMapType(mapType.id);
                                  setStateMapTypeOpen(false);
                                }}
                                className="flex items-start gap-2"
                              >
                                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', selectedStateMapType === mapType.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex flex-col min-w-0">
                                  <span>{mapType.displayName}</span>
                                  {mapType.description && (
                                    <span className="text-xs text-muted-foreground truncate">{mapType.description}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="mb-5">
                  <Label htmlFor="state-selector" className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    State
                  </Label>
                  <input
                    type="text"
                    placeholder="Search state..."
                    value={stateSearchQuery}
                    onChange={(e) => setStateSearchQuery(e.target.value)}
                    className="w-full mb-2 px-3 py-2 border rounded-md text-sm border-input bg-background dark:bg-[hsl(25,10%,16%)] dark:border-[hsl(25,8%,16%)] dark:text-[hsl(35,12%,90%)]"
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
                        <div className="px-2 py-1.5 text-sm text-muted-foreground dark:text-[hsl(30,8%,55%)]">
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
                  selectedState={selectedStateForMap}
                />
                <div className="mt-6">
                  <ColorMapChooser
                    selectedScale={stateDistrictColorScale}
                    onScaleChange={setStateDistrictColorScale}
                    invertColors={stateDistrictInvertColors}
                    onInvertColorsChange={setStateDistrictInvertColors}
                    showStateBoundaries={true}
                    hideDistrictNames={stateDistrictHideNames}
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
                    boundaryColor={boundaryColor}
                    onBoundaryColorChange={setBoundaryColor}
                    boundaryWidth={boundaryWidth}
                    onBoundaryWidthChange={setBoundaryWidth}
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'sub-admin'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                <IndiaDistrictsMap
                  ref={subAdminMapRef}
                  data={subAdminMapData}
                  colorScale={subAdminColorScale}
                  invertColors={subAdminInvertColors}
                  dataTitle={subAdminDataTitle}
                  showStateBoundaries={subAdminSelectedState === ALL_INDIA_STATE}
                  colorBarSettings={subAdminColorBarSettings}
                  geojsonPath={getSubAdminLayer(subAdminLayerId).url}
                  statesGeojsonPath={getSubAdminLayer(subAdminLayerId).statesUrl}
                  selectedState={subAdminSelectedState === ALL_INDIA_STATE ? undefined : subAdminSelectedState}
                  hideDistrictNames={subAdminHideNames}
                  labelScale={0.7}
                  dataType={subAdminDataType}
                  categoryColors={subAdminCategoryColors}
                  naInfo={subAdminNAInfo}
                  darkMode={darkMode}
                  boundaryColor={boundaryColor}
                  boundaryWidth={boundaryWidth}
                  featureNameProp={getSubAdminLayer(subAdminLayerId).featureNameProp}
                  csvTemplateHeader={getSubAdminLayer(subAdminLayerId).featureNameProp}
                />
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={subAdminMapData.length === 0}
                    geojsonDownloadUrl={getSubAdminLayer(subAdminLayerId).url}
                    geojsonDownloadName={`India-${subAdminLayerId}${subAdminSelectedState !== 'All India' ? '-' + subAdminSelectedState : ''}.geojson`}
                    citationInfo={{ source: getSubAdminLayer(subAdminLayerId).source, mapLabel: getSubAdminLayer(subAdminLayerId).displayName }}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <div className="mb-5 pl-3 border-l-2 border-[hsl(28,42%,52%)] dark:border-[hsl(28,35%,38%)]">
                  <h3 className="text-sm font-semibold mb-1 text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,90%)]">Sub-district & Block Boundaries</h3>
                  <p className="text-xs text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
                    Fine-grained administrative boundaries below district level. Select a layer, then optionally zoom into a single state.
                  </p>
                </div>

                <div className="mb-5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    Layer
                  </Label>
                  <Popover open={subAdminLayerOpen} onOpenChange={setSubAdminLayerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={subAdminLayerOpen}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-background border-input hover:bg-accent transition-colors"
                      >
                        <span className="truncate text-left">
                          {getSubAdminLayer(subAdminLayerId).displayName}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search layer…" className="h-9" />
                        <CommandList className="max-h-60">
                          <CommandEmpty>No layer found.</CommandEmpty>
                          <CommandGroup>
                            {SUB_ADMIN_LAYERS.map(layer => (
                              <CommandItem
                                key={layer.id}
                                value={`${layer.displayName} ${layer.description}`}
                                onSelect={() => {
                                  setSubAdminLayerId(layer.id);
                                  setSubAdminLayerOpen(false);
                                }}
                                className="flex items-start gap-2"
                              >
                                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', subAdminLayerId === layer.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex flex-col min-w-0">
                                  <span>{layer.displayName}</span>
                                  <span className="text-xs text-muted-foreground truncate">{layer.description}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="mb-5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    State
                  </Label>
                  <Popover open={subAdminStateOpen} onOpenChange={setSubAdminStateOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={subAdminStateOpen}
                        disabled={subAdminStatesLoading}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-background border-input hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        <span className="truncate text-left">
                          {subAdminStatesLoading ? 'Loading states…' : subAdminSelectedState}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search state…" className="h-9" />
                        <CommandList className="max-h-72">
                          <CommandEmpty>No state found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="All India"
                              onSelect={() => {
                                setSubAdminSelectedState('All India');
                                setSubAdminStateOpen(false);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Check className={cn('h-4 w-4 shrink-0', subAdminSelectedState === 'All India' ? 'opacity-100' : 'opacity-0')} />
                              All India
                            </CommandItem>
                            {subAdminStates.map(state => (
                              <CommandItem
                                key={state}
                                value={state}
                                onSelect={() => {
                                  setSubAdminSelectedState(state);
                                  setSubAdminStateOpen(false);
                                }}
                                className="flex items-center gap-2"
                              >
                                <Check className={cn('h-4 w-4 shrink-0', subAdminSelectedState === state ? 'opacity-100' : 'opacity-0')} />
                                {state}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <FileUpload
                  onDataLoad={handleSubAdminDataLoad}
                  mode="districts"
                  templateCsvPath={undefined}
                  googleSheetLink={undefined}
                  geojsonPath={getSubAdminLayer(subAdminLayerId).url}
                  selectedState={subAdminSelectedState !== 'All India' ? subAdminSelectedState : undefined}
                />
                <div className="mt-6">
                  <ColorMapChooser
                    selectedScale={subAdminColorScale}
                    onScaleChange={setSubAdminColorScale}
                    invertColors={subAdminInvertColors}
                    onInvertColorsChange={setSubAdminInvertColors}
                    hideDistrictNames={subAdminHideNames}
                    onHideDistrictNamesChange={setSubAdminHideNames}
                    districtNamesLabel="Hide names"
                    showStateBoundaries={subAdminSelectedState === 'All India'}
                    colorBarSettings={subAdminColorBarSettings}
                    onColorBarSettingsChange={setSubAdminColorBarSettings}
                    dataType={subAdminDataType}
                    categories={getUniqueCategories(subAdminMapData.map(d => d.value))}
                    categoryColors={subAdminCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setSubAdminCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                    boundaryColor={boundaryColor}
                    onBoundaryColorChange={setBoundaryColor}
                    boundaryWidth={boundaryWidth}
                    onBoundaryWidthChange={setBoundaryWidth}
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'electoral'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                <IndiaDistrictsMap
                  ref={electoralMapRef}
                  data={electoralMapData}
                  colorScale={electoralColorScale}
                  invertColors={electoralInvertColors}
                  dataTitle={electoralDataTitle}
                  showStateBoundaries={electoralSelectedState === ALL_INDIA_STATE}
                  colorBarSettings={electoralColorBarSettings}
                  geojsonPath={getElectoralLayer(electoralLayerId).url}
                  statesGeojsonPath={getElectoralLayer(electoralLayerId).statesUrl}
                  selectedState={electoralSelectedState === ALL_INDIA_STATE ? undefined : electoralSelectedState}
                  hideDistrictNames={electoralHideNames}
                  labelScale={0.7}
                  dataType={electoralDataType}
                  categoryColors={electoralCategoryColors}
                  naInfo={electoralNAInfo}
                  darkMode={darkMode}
                  boundaryColor={boundaryColor}
                  boundaryWidth={boundaryWidth}
                  featureNameProp={getElectoralLayer(electoralLayerId).featureNameProp}
                  csvTemplateHeader={getElectoralLayer(electoralLayerId).featureNameProp}
                />
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={electoralMapData.length === 0}
                    geojsonDownloadUrl={getElectoralLayer(electoralLayerId).url}
                    geojsonDownloadName={`India-${electoralLayerId}${electoralSelectedState !== 'All India' ? '-' + electoralSelectedState : ''}.geojson`}
                    citationInfo={{ source: getElectoralLayer(electoralLayerId).source, mapLabel: getElectoralLayer(electoralLayerId).displayName }}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <div className="mb-5 pl-3 border-l-2 border-[hsl(28,42%,52%)] dark:border-[hsl(28,35%,38%)]">
                  <h3 className="text-sm font-semibold mb-1 text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,90%)]">Electoral Boundaries</h3>
                  <p className="text-xs text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
                    Parliamentary and assembly constituency boundaries from the Local Government Directory.
                  </p>
                </div>

                <div className="mb-5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    Layer
                  </Label>
                  <Popover open={electoralLayerOpen} onOpenChange={setElectoralLayerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={electoralLayerOpen}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-background border-input hover:bg-accent transition-colors"
                      >
                        <span className="truncate text-left">
                          {getElectoralLayer(electoralLayerId).displayName}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandList className="max-h-60">
                          <CommandGroup>
                            {ELECTORAL_LAYERS.map(layer => (
                              <CommandItem
                                key={layer.id}
                                value={layer.displayName}
                                onSelect={() => {
                                  setElectoralLayerId(layer.id);
                                  setElectoralLayerOpen(false);
                                }}
                                className="flex items-start gap-2"
                              >
                                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', electoralLayerId === layer.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex flex-col min-w-0">
                                  <span>{layer.displayName}</span>
                                  <span className="text-xs text-muted-foreground truncate">{layer.description}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="mb-5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    State
                  </Label>
                  <Popover open={electoralStateOpen} onOpenChange={setElectoralStateOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={electoralStateOpen}
                        disabled={electoralStatesLoading}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-background border-input hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        <span className="truncate text-left">
                          {electoralStatesLoading ? 'Loading states…' : electoralSelectedState}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search state…" className="h-9" />
                        <CommandList className="max-h-72">
                          <CommandEmpty>No state found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="All India"
                              onSelect={() => { setElectoralSelectedState('All India'); setElectoralStateOpen(false); }}
                              className="flex items-center gap-2"
                            >
                              <Check className={cn('h-4 w-4 shrink-0', electoralSelectedState === 'All India' ? 'opacity-100' : 'opacity-0')} />
                              All India
                            </CommandItem>
                            {electoralStates.map(state => (
                              <CommandItem
                                key={state}
                                value={state}
                                onSelect={() => { setElectoralSelectedState(state); setElectoralStateOpen(false); }}
                                className="flex items-center gap-2"
                              >
                                <Check className={cn('h-4 w-4 shrink-0', electoralSelectedState === state ? 'opacity-100' : 'opacity-0')} />
                                {state}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <FileUpload
                  onDataLoad={handleElectoralDataLoad}
                  mode="districts"
                  geojsonPath={getElectoralLayer(electoralLayerId).url}
                  selectedState={electoralSelectedState !== 'All India' ? electoralSelectedState : undefined}
                />
                <div className="mt-6">
                  <ColorMapChooser
                    selectedScale={electoralColorScale}
                    onScaleChange={setElectoralColorScale}
                    invertColors={electoralInvertColors}
                    onInvertColorsChange={setElectoralInvertColors}
                    hideDistrictNames={electoralHideNames}
                    onHideDistrictNamesChange={setElectoralHideNames}
                    districtNamesLabel="Hide names"
                    showStateBoundaries={electoralSelectedState === 'All India'}
                    colorBarSettings={electoralColorBarSettings}
                    onColorBarSettingsChange={setElectoralColorBarSettings}
                    dataType={electoralDataType}
                    categories={getUniqueCategories(electoralMapData.map(d => d.value))}
                    categoryColors={electoralCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setElectoralCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                    boundaryColor={boundaryColor}
                    onBoundaryColorChange={setBoundaryColor}
                    boundaryWidth={boundaryWidth}
                    onBoundaryWidthChange={setBoundaryWidth}
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'environment'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                <IndiaDistrictsMap
                  ref={environmentMapRef}
                  data={[]}
                  colorScale="spectral"
                  invertColors={false}
                  dataTitle=""
                  showStateBoundaries={true}
                  geojsonPath={getEnvironmentLayer(environmentLayerId).url}
                  statesGeojsonPath={getEnvironmentLayer(environmentLayerId).statesUrl}
                  darkMode={darkMode}
                  boundaryColor={boundaryColor}
                  boundaryWidth={boundaryWidth}
                />
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={false}
                    geojsonDownloadUrl={getEnvironmentLayer(environmentLayerId).url}
                    geojsonDownloadName={`India-${environmentLayerId}.geojson`}
                    citationInfo={{ source: getEnvironmentLayer(environmentLayerId).source, mapLabel: getEnvironmentLayer(environmentLayerId).displayName }}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <div className="mb-5 pl-3 border-l-2 border-[hsl(28,42%,52%)] dark:border-[hsl(28,35%,38%)]">
                  <h3 className="text-sm font-semibold mb-1 text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,90%)]">Environment Boundaries</h3>
                  <p className="text-xs text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
                    Reference boundaries for wildlife sanctuaries and eco-sensitive zones. Download the GeoJSON to use in your own analysis.
                  </p>
                </div>

                <div className="mb-5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    Layer
                  </Label>
                  <Popover open={environmentLayerOpen} onOpenChange={setEnvironmentLayerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={environmentLayerOpen}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-background border-input hover:bg-accent transition-colors"
                      >
                        <span className="truncate text-left">
                          {getEnvironmentLayer(environmentLayerId).displayName}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandList className="max-h-60">
                          <CommandGroup>
                            {ENVIRONMENT_LAYERS.map(layer => (
                              <CommandItem
                                key={layer.id}
                                value={layer.displayName}
                                onSelect={() => {
                                  setEnvironmentLayerId(layer.id);
                                  setEnvironmentLayerOpen(false);
                                }}
                                className="flex items-start gap-2"
                              >
                                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', environmentLayerId === layer.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex flex-col min-w-0">
                                  <span>{layer.displayName}</span>
                                  <span className="text-xs text-muted-foreground truncate">{layer.description}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="p-3 rounded-md bg-[hsl(38,30%,96%)] dark:bg-[hsl(25,8%,10%)] border border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)] text-xs text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
                  These are reference-only layers. The map renders boundaries without choropleth colouring. Use the Export button to download the GeoJSON for your own analysis.
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'urban'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                <IndiaDistrictsMap
                  ref={urbanMapRef}
                  data={[]}
                  colorScale="spectral"
                  invertColors={false}
                  dataTitle=""
                  showStateBoundaries={true}
                  geojsonPath={getUrbanLayer(urbanLayerId).url}
                  statesGeojsonPath={getUrbanLayer(urbanLayerId).statesUrl}
                  darkMode={darkMode}
                  boundaryColor={boundaryColor}
                  boundaryWidth={boundaryWidth}
                />
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={false}
                    geojsonDownloadUrl={getUrbanLayer(urbanLayerId).url}
                    geojsonDownloadName={`India-${urbanLayerId}.geojson`}
                    citationInfo={{ source: getUrbanLayer(urbanLayerId).source, mapLabel: getUrbanLayer(urbanLayerId).displayName }}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <div className="mb-5 pl-3 border-l-2 border-[hsl(28,42%,52%)] dark:border-[hsl(28,35%,38%)]">
                  <h3 className="text-sm font-semibold mb-1 text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,90%)]">Urban Boundaries</h3>
                  <p className="text-xs text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
                    Municipal body boundaries at the Urban Local Body (ULB) level. Distinct from ward-level city maps. Download the GeoJSON for your own analysis.
                  </p>
                </div>

                <div className="mb-5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    Layer
                  </Label>
                  <Popover open={urbanLayerOpen} onOpenChange={setUrbanLayerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={urbanLayerOpen}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-md bg-background border-input hover:bg-accent transition-colors"
                      >
                        <span className="truncate text-left">
                          {getUrbanLayer(urbanLayerId).displayName}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandList className="max-h-60">
                          <CommandGroup>
                            {URBAN_LAYERS.map(layer => (
                              <CommandItem
                                key={layer.id}
                                value={layer.displayName}
                                onSelect={() => {
                                  setUrbanLayerId(layer.id);
                                  setUrbanLayerOpen(false);
                                }}
                                className="flex items-start gap-2"
                              >
                                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', urbanLayerId === layer.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex flex-col min-w-0">
                                  <span>{layer.displayName}</span>
                                  <span className="text-xs text-muted-foreground truncate">{layer.description}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="p-3 rounded-md bg-[hsl(38,30%,96%)] dark:bg-[hsl(25,8%,10%)] border border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)] text-xs text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
                  Reference-only layer. SBM coverage is national but excludes Tripura, Mizoram, and Manipur. Use the Export button to download the GeoJSON for your own analysis.
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'help'}>
            <div className="max-w-4xl mx-auto p-6 space-y-10">
              <div className="pl-4 border-l-2 border-[hsl(28,42%,52%)] dark:border-[hsl(28,35%,38%)] py-1">
                <h2 className="text-sm font-semibold text-[hsl(28,20%,30%)] dark:text-[hsl(35,10%,80%)] mb-1">Privacy & data security</h2>
                <p className="text-sm text-[hsl(28,8%,46%)] dark:text-[hsl(30,8%,58%)]">
                  <strong className="text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,88%)]">Your data is never stored.</strong> All processing happens in your browser or transiently on our servers. We do not collect, store, or share any of your uploaded data.
                </p>
              </div>

              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">Web interface</h2>
                  <p className="text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,65%)] mb-6">
                    BharatViz is a free, no-code tool for mapping India. Upload a CSV and get a publication-ready choropleth map in seconds, at state, district, or city level.
                  </p>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[hsl(28,42%,52%)] dark:bg-[hsl(28,35%,38%)] flex items-center justify-center text-white text-xs font-bold mt-0.5">1</div>
                      <div className="flex-1 pt-0.5">
                        <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">Upload your data</h3>
                        <p className="text-sm text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,65%)] mb-2">Upload a CSV file with your data. Required columns:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,65%)]">
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">States:</strong> <code>state</code> and <code>value</code></li>
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">Districts:</strong> <code>state_name</code>, <code>district_name</code>, and <code>value</code></li>
                        </ul>
                        <p className="text-sm mt-2 text-[hsl(28,8%,52%)] dark:text-[hsl(30,8%,55%)]">
                          Download the CSV template or load demo data to get started quickly.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[hsl(28,42%,52%)] dark:bg-[hsl(28,35%,38%)] flex items-center justify-center text-white text-xs font-bold mt-0.5">2</div>
                      <div className="flex-1 pt-0.5">
                        <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">Customize your map</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,65%)]">
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">Color Scale:</strong> Choose from sequential (blues, greens, viridis) or diverging (spectral, rdylbu) scales</li>
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">Invert Colors:</strong> Flip the color mapping (useful when lower values are better)</li>
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">Discrete vs Continuous:</strong> Use discrete bins or smooth gradients</li>
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">Labels:</strong> Toggle state names and values on/off</li>
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">District Maps:</strong> Choose between LGD, NFHS-5, or NFHS-4 boundaries</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[hsl(28,42%,52%)] dark:bg-[hsl(28,35%,38%)] flex items-center justify-center text-white text-xs font-bold mt-0.5">3</div>
                      <div className="flex-1 pt-0.5">
                        <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">Export your map</h3>
                        <p className="text-sm text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,65%)] mb-2">Export in multiple formats:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,65%)]">
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">PNG:</strong> High-resolution raster image (300 DPI)</li>
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">SVG:</strong> Vector format for editing in Adobe Illustrator, Inkscape, etc.</li>
                          <li><strong className="text-[hsl(28,15%,28%)] dark:text-[hsl(35,10%,80%)]">PDF:</strong> Publication-ready format</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-[hsl(35,16%,88%)] dark:border-[hsl(25,8%,14%)]">
                  <h2 className="text-2xl font-bold mb-4 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">Programmatic access (API)</h2>
                  <p className="text-muted-foreground dark:text-[hsl(30,8%,65%)] mb-4">
                    The API supports state and district-level maps (LGD, NFHS-5, NFHS-4), all color scales, and exports to PNG, SVG, and PDF formats from Python or R.
                  </p>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-[hsl(38,30%,97%)] border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-lg font-semibold mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,93%)]">Documentation & examples</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-[hsl(28,10%,42%)] dark:text-[hsl(30,8%,65%)]">
                        <li>
                          <a
                            href="https://colab.research.google.com/github/saketlab/bharatviz/blob/main/server/examples/BharatViz_demo.ipynb"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-[hsl(28,45%,38%)] hover:text-[hsl(28,50%,28%)] dark:text-[hsl(28,55%,52%)] dark:hover:text-[hsl(28,48%,62%)]"
                          >
                            Try Python notebook in Google Colab
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://rpubs.com/saketkc/bharatviz"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-[hsl(28,45%,38%)] hover:text-[hsl(28,50%,28%)] dark:text-[hsl(28,55%,52%)] dark:hover:text-[hsl(28,48%,62%)]"
                          >
                            View R notebook on RPubs
                          </a>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 border rounded-lg dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">Python</h3>
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

                    <div className="p-4 border rounded-lg dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">R</h3>
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

                    <div className="p-4 border rounded-lg dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">R: Side-by-side maps (high resolution)</h3>
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

                    <div className="p-4 border rounded-lg dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">Direct API reference</h3>
                      <p className="text-sm mb-3 text-muted-foreground dark:text-[hsl(30,8%,65%)]">
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

                <div className="pt-8 border-t border-[hsl(35,16%,88%)] dark:border-[hsl(25,8%,14%)]">
                  <h2 className="text-2xl font-bold mb-4 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">Embedding maps</h2>
                  <p className="text-muted-foreground dark:text-[hsl(30,8%,65%)] mb-4">
                    Embed interactive BharatViz maps directly into your website, blog, or GitHub Pages without downloading files.
                  </p>
                  <div className="space-y-4">
                    <div className="p-4 border-2 border-[hsl(28,42%,52%)] rounded-lg bg-[hsl(38,30%,97%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(28,35%,38%)]">
                      <h3 className="text-lg font-semibold mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,93%)]">Live demo & interactive examples</h3>
                      <p className="text-[hsl(28,10%,42%)] dark:text-[hsl(30,8%,65%)] mb-3">
                        See both embedding methods in action with live, working examples.
                      </p>
                      <a
                        href="/embed-demo"
                        className="inline-block px-4 py-2 bg-[hsl(28,62%,48%)] hover:bg-[hsl(28,55%,42%)] text-white font-semibold rounded-lg transition-colors"
                      >
                        View Embed Demo →
                      </a>
                    </div>

                    <div className="p-4 border rounded-lg dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">iframe embed</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`<iframe
  src="https://bharatviz.org/api/v1/embed?dataUrl=https://yoursite.com/data.csv&colorScale=viridis&title=My%20Map"
  width="800"
  height="600"
  frameborder="0">
</iframe>`}
                      </pre>
                    </div>

                    <div className="p-4 border rounded-lg dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">JavaScript widget</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`<div id="my-map"></div>
<script src="https://bharatviz.org/api/embed.js"></script>
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

                    <div className="p-4 border rounded-lg dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">Direct SVG</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`<img src="https://bharatviz.org/api/v1/embed/svg?dataUrl=https://yoursite.com/data.csv&colorScale=viridis" />`}
                      </pre>
                    </div>

                    <div className="p-4 border rounded-lg dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">GitHub Pages example</h3>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`# 1. Create data.csv in your GitHub repo
# 2. Enable GitHub Pages in repo settings
# 3. Embed using your GitHub Pages URL:
<iframe src="https://bharatviz.org/api/v1/embed?dataUrl=https://USERNAME.github.io/REPO/data.csv&colorScale=viridis"></iframe>`}
                      </pre>
                    </div>

                    <div className="p-4 border rounded-lg dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                      <h3 className="text-base font-semibold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,90%)]">Available parameters</h3>
                      <div className="text-sm space-y-1 text-muted-foreground dark:text-[hsl(30,8%,65%)]">
                        <p><code className="px-1 py-0.5 rounded bg-muted dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(35,10%,80%)]">dataUrl</code> - URL to your CSV file (required)</p>
                        <p><code className="px-1 py-0.5 rounded bg-muted dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(35,10%,80%)]">mapType</code> - 'states', 'districts', or 'state-districts' (default: 'states')</p>
                        <p><code className="px-1 py-0.5 rounded bg-muted dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(35,10%,80%)]">colorScale</code> - 'viridis', 'spectral', 'blues', 'greens', etc. (default: 'spectral')</p>
                        <p><code className="px-1 py-0.5 rounded bg-muted dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(35,10%,80%)]">mainTitle</code> - Map title (default: 'BharatViz')</p>
                        <p><code className="px-1 py-0.5 rounded bg-muted dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(35,10%,80%)]">legendTitle</code> - Legend label (default: 'Values')</p>
                        <p><code className="px-1 py-0.5 rounded bg-muted dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(35,10%,80%)]">invertColors</code> - true/false to reverse color scale</p>
                        <p><code className="px-1 py-0.5 rounded bg-muted dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(35,10%,80%)]">darkMode</code> - true/false for dark background with white boundaries and text</p>
                        <p><code className="px-1 py-0.5 rounded bg-muted dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(35,10%,80%)]">districtBoundary</code> - 'LGD', 'NFHS4', 'NFHS5', 'SOI2011', or 'SOI2001' for district maps</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-[hsl(35,16%,88%)] dark:border-[hsl(25,8%,14%)]">
                  <div className="p-4 border rounded-lg bg-muted/50 dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
                      <Github className="h-5 w-5" />
                      Open source
                    </h2>
                    <p className="text-muted-foreground dark:text-[hsl(30,8%,65%)]">
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
          </TabPanel>

          <TabPanel active={activeTab === 'cities'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
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
                  boundaryColor={boundaryColor}
                  boundaryWidth={boundaryWidth}
                />
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={cityMapData.length === 0}
                    geojsonDownloadUrl={currentCityDataset?.geojsonPath}
                    geojsonDownloadName={`${selectedCityDataset}.geojson`}
                    citationInfo={currentCityDataset ? getCityCitationInfo(currentCityDataset) : undefined}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <div className="mb-5">
                  <Label htmlFor="city-select" className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
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
                  {currentCityDataset && (
                    <p className="mt-1.5 text-xs text-[hsl(28,8%,52%)] dark:text-[hsl(30,8%,45%)]">
                      <span className="font-medium">{currentCityDataset.featureCount}</span> {currentCityDataset.type === 'wards' ? 'wards' : 'features'} &middot; {currentCityDataset.source}
                      {currentCityDataset.label && currentCityDataset.label !== 'Wards' && <> &middot; {currentCityDataset.label}</>}
                    </p>
                  )}
                </div>

                {currentCityDatasets.length > 1 && (
                  <div className="mb-5">
                    <Label htmlFor="city-dataset-select" className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
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

                <FileUpload
                  onDataLoad={handleCityDataLoad}
                  mode="states"
                  demoDataPath={getCityCsvUrls(selectedCityDataset).demo}
                  templateCsvPath={getCityCsvUrls(selectedCityDataset).template}
                  googleSheetLink={getCityCsvUrls(selectedCityDataset).template}
                />
                <div className="mt-6">
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
                    dataType={cityDataType}
                    categories={getUniqueCategories(cityMapData.map(d => d.value))}
                    categoryColors={cityCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setCityCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                    boundaryColor={boundaryColor}
                    onBoundaryColorChange={setBoundaryColor}
                    boundaryWidth={boundaryWidth}
                    onBoundaryWidthChange={setBoundaryWidth}
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'pincodes'}>
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="lg:col-span-2 order-1 lg:order-2">
                <IndiaPincodesMap
                  ref={pincodeMapRef}
                  data={pincodeMapData}
                  colorScale={pincodeColorScale}
                  invertColors={pincodeInvertColors}
                  dataTitle={pincodeDataTitle}
                  selectedState={selectedPincodeState}
                  colorBarSettings={pincodeColorBarSettings}
                  geojsonPath={getPincodeGeoJSONUrl(selectedPincodeState) || DATA_FILES.PINCODES_GEOJSON}
                  preFiltered={!!getPincodeGeoJSONUrl(selectedPincodeState)}
                  dataType={pincodeDataType}
                  categoryColors={pincodeCategoryColors}
                  naInfo={pincodeNAInfo}
                  mapTitle={pincodeMapTitle}
                  darkMode={darkMode}
                  boundaryColor={boundaryColor}
                  boundaryWidth={boundaryWidth}
                />
                <div className="mt-4">
                  <ExportOptions
                    onExportPNG={handleExportPNG}
                    onExportSVG={handleExportSVG}
                    onExportPDF={handleExportPDF}
                    onCopyToClipboard={handleCopyToClipboard}
                    disabled={pincodeMapData.length === 0}
                    geojsonDownloadUrl={getPincodeGeoJSONUrl(selectedPincodeState) || DATA_FILES.PINCODES_GEOJSON}
                    geojsonDownloadName={`pincodes_${selectedPincodeState.replace(/\s+/g, '_')}.geojson`}
                  />
                </div>
              </div>

              <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
                <div className="mb-5">
                  <Label htmlFor="pincode-state-selector" className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
                    State
                  </Label>
                  <input
                    type="text"
                    placeholder="Search state..."
                    value={pincodeStateSearchQuery}
                    onChange={(e) => setPincodeStateSearchQuery(e.target.value)}
                    className="w-full mb-2 px-3 py-2 border rounded-md text-sm border-input bg-background dark:bg-[hsl(25,10%,16%)] dark:border-[hsl(25,8%,16%)] dark:text-[hsl(35,12%,90%)]"
                  />
                  <Select value={selectedPincodeState} onValueChange={(value) => {
                    setSelectedPincodeState(value);
                    setPincodeStateSearchQuery('');
                  }}>
                    <SelectTrigger id="pincode-state-selector" className="w-full">
                      <SelectValue placeholder="Select a state">
                        {selectedPincodeState}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {pincodeAvailableStates
                        .filter((state) =>
                          state.toLowerCase().includes(pincodeStateSearchQuery.toLowerCase())
                        )
                        .map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      {pincodeStateSearchQuery.length > 0 && pincodeAvailableStates.filter((state) =>
                        state.toLowerCase().includes(pincodeStateSearchQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground dark:text-[hsl(30,8%,55%)]">
                          No states found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <FileUpload
                  onDataLoad={handlePincodeDataLoad}
                  mode="states"
                  onMapTitleChange={setPincodeMapTitle}
                />
                <div className="mt-6">
                  <ColorMapChooser
                    selectedScale={pincodeColorScale}
                    onScaleChange={setPincodeColorScale}
                    invertColors={pincodeInvertColors}
                    onInvertColorsChange={setPincodeInvertColors}
                    colorBarSettings={pincodeColorBarSettings}
                    onColorBarSettingsChange={setPincodeColorBarSettings}
                    dataType={pincodeDataType}
                    categories={getUniqueCategories(pincodeMapData.map(d => d.value))}
                    categoryColors={pincodeCategoryColors}
                    onCategoryColorChange={(category, color) => {
                      setPincodeCategoryColors(prev => ({ ...prev, [category]: color }));
                    }}
                    boundaryColor={boundaryColor}
                    onBoundaryColorChange={setBoundaryColor}
                    boundaryWidth={boundaryWidth}
                    onBoundaryWidthChange={setBoundaryWidth}
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel active={activeTab === 'district-stats'}>
            <DistrictStats />
          </TabPanel>

          <TabPanel active={activeTab === 'city-stats'}>
            <CityStats />
          </TabPanel>

          <TabPanel active={activeTab === 'evolution'}>
            <HistoricalEvolution />
          </TabPanel>

          <TabPanel active={activeTab === 'credits'}>
            <Credits />
          </TabPanel>

          <TabPanel active={activeTab === 'mcp'}>
            <MCPDocs />
          </TabPanel>
        </Tabs>
      </div>
      <footer className="w-full text-center text-xs mt-8 mb-2 text-muted-foreground dark:text-[hsl(30,8%,55%)]">
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

      <Suspense fallback={null}>
        <ChatPanel
          key={`${activeTab}-${activeTab === 'districts' ? selectedDistrictMapType : selectedStateMapType}-${selectedStateForMap || ''}`}
          context={chatContext}
        />
      </Suspense>
    </div>
  );
};

export default Index;
