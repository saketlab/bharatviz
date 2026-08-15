import React from 'react';
import { ExternalLink, Download } from 'lucide-react';
import { SUB_ADMIN_LAYERS, ELECTORAL_LAYERS, ENVIRONMENT_LAYERS, URBAN_LAYERS } from '@/lib/geodataLayerConfig';

interface CreditSource {
  title: string;
  description: string;
  url: string;
  usedFor: string[];
  geojsonFiles?: { name: string; path: string }[];
}

// Mirrors the geojsons/ -> geoparquet/ layout produced by scripts/19 and 20.
const parquetUrl = (geojsonUrl: string): string =>
  geojsonUrl.replace('/geojsons/', '/geoparquet/').replace(/\.geojson$/, '.parquet');

const Credits: React.FC<{ darkMode?: boolean }> = () => {
  const sources: CreditSource[] = [
    {
      title: 'BharatMap service - state boundaries',
      description: 'Government of India mapping service providing official administrative boundaries',
      url: 'https://mapservice.gov.in/gismapservice/rest/services/BharatMapService/Admin_Boundary_GramPanchayat/MapServer/0',
      usedFor: ['States map boundaries'],
      geojsonFiles: [
        { name: 'States (2011)', path: 'https://geo.bharatviz.org/geojsons/census/India-2011-states.geojson' }
      ]
    },
    {
      title: 'BharatMap service - district boundaries',
      description: 'Government of India mapping service with detailed administrative boundaries',
      url: 'https://mapservice.gov.in/gismapservice/rest/login?redirect=https%3A//mapservice.gov.in/gismapservice/rest/services/BharatMapService/Admin_Boundary_Village/MapServer/1',
      usedFor: ['LGD district boundaries'],
      geojsonFiles: [
        { name: 'LGD Districts', path: 'https://geo.bharatviz.org/geojsons/districts/India_LGD_districts.geojson' },
        { name: 'LGD States', path: 'https://geo.bharatviz.org/geojsons/districts/India_LGD_states.geojson' }
      ]
    },
    {
      title: 'Bhuvan - NRSC',
      description: 'National Remote Sensing Centre (NRSC) geoportal providing spatial data and mapping services for India',
      url: 'https://bhuvan.nrsc.gov.in/ngmaps',
      usedFor: ['Bhuvan district boundaries'],
      geojsonFiles: [
        { name: 'Bhuvan Districts', path: 'https://geo.bharatviz.org/geojsons/districts/India-bhuvan-districts.geojson' },
        { name: 'Bhuvan States', path: 'https://geo.bharatviz.org/geojsons/districts/India-bhuvan-states.geojson' }
      ]
    },
    {
      title: 'Survey of India',
      description: 'Survey of India - National survey and mapping organization providing official administrative boundaries and topographic data',
      url: 'https://www.surveyofindia.gov.in/',
      usedFor: ['Survey of India district boundaries'],
      geojsonFiles: [
        { name: 'SOI Districts', path: 'https://geo.bharatviz.org/geojsons/districts/India-soi-districts.geojson' },
        { name: 'SOI States', path: 'https://geo.bharatviz.org/geojsons/districts/India-soi-states.geojson' }
      ]
    },
    {
      title: 'India State Stories',
      description: 'Historical census district data for India across multiple years (1941-2011)',
      url: 'https://www.indiastatestory.in/datadownloads',
      usedFor: ['Census 1941', 'Census 1951', 'Census 1961', 'Census 1971', 'Census 1981', 'Census 1991', 'Census 2001', 'Census 2011'],
      geojsonFiles: [
        { name: '1941 Districts', path: 'https://geo.bharatviz.org/geojsons/census/India-1941-districts.geojson' },
        { name: '1941 States', path: 'https://geo.bharatviz.org/geojsons/census/India-1941-states.geojson' },
        { name: '1951 Districts', path: 'https://geo.bharatviz.org/geojsons/census/India-1951-districts.geojson' },
        { name: '1951 States', path: 'https://geo.bharatviz.org/geojsons/census/India-1951-states.geojson' },
        { name: '1961 Districts', path: 'https://geo.bharatviz.org/geojsons/census/India-1961-districts.geojson' },
        { name: '1961 States', path: 'https://geo.bharatviz.org/geojsons/census/India-1961-states.geojson' },
        { name: '1971 Districts', path: 'https://geo.bharatviz.org/geojsons/census/India-1971-districts.geojson' },
        { name: '1971 States', path: 'https://geo.bharatviz.org/geojsons/census/India-1971-states.geojson' },
        { name: '1981 Districts', path: 'https://geo.bharatviz.org/geojsons/census/India-1981-districts.geojson' },
        { name: '1981 States', path: 'https://geo.bharatviz.org/geojsons/census/India-1981-states.geojson' },
        { name: '1991 Districts', path: 'https://geo.bharatviz.org/geojsons/census/India-1991-districts.geojson' },
        { name: '1991 States', path: 'https://geo.bharatviz.org/geojsons/census/India-1991-states.geojson' },
        { name: '2001 Districts', path: 'https://geo.bharatviz.org/geojsons/census/India-2001-districts.geojson' },
        { name: '2001 States', path: 'https://geo.bharatviz.org/geojsons/census/India-2001-states.geojson' },
        { name: '2011 Districts', path: 'https://geo.bharatviz.org/geojsons/census/India-2011-districts.geojson' },
        { name: '2011 States', path: 'https://geo.bharatviz.org/geojsons/census/India-2011-states.geojson' }
      ]
    },
    {
      title: 'Spatial data repository - DHS program',
      description: 'Demographic and Health Surveys spatial data repository with health survey district boundaries',
      url: 'https://spatialdata.dhsprogram.com/home/',
      usedFor: ['NFHS-4 district boundaries', 'NFHS-5 district boundaries', 'NSSO regions'],
      geojsonFiles: [
        { name: 'NFHS-4 Districts', path: 'https://geo.bharatviz.org/geojsons/districts/India_NFHS4_districts_simplified.geojson' },
        { name: 'NFHS-4 States', path: 'https://geo.bharatviz.org/geojsons/districts/India_NFHS4_states_simplified.geojson' },
        { name: 'NFHS-5 Districts', path: 'https://geo.bharatviz.org/geojsons/districts/India_NFHS5_districts_simplified.geojson' },
        { name: 'NFHS-5 States', path: 'https://geo.bharatviz.org/geojsons/districts/India_NFHS5_states_simplified.geojson' },
        { name: 'NSSO Regions', path: 'https://geo.bharatviz.org/geojsons/districts/India_NFHS5_NSSO_regions_boundaries.geojson' }
      ]
    },
    {
      title: 'ramSeraph/indian_admin_boundaries',
      description: 'Comprehensive collection of Indian administrative boundaries including ward-level data from SBM (Swachh Bharat Mission) covering 3700+ ULBs',
      url: 'https://github.com/ramSeraph/indian_admin_boundaries',
      usedFor: ['Ward boundaries for 90+ additional cities via SBM/AMRUT data'],
    },
    {
      title: 'DataMeet',
      description: 'Community-curated open data for Indian cities including municipal ward boundaries',
      url: 'https://github.com/datameet/Municipal_Spatial_Data',
      usedFor: ['City ward boundaries for 30+ cities'],
    },
    {
      title: 'SBM/AMRUT',
      description: 'Ward boundaries from the Swachh Bharat Mission and AMRUT government portals',
      url: 'https://sbm.gov.in/',
      usedFor: ['City ward boundaries (Indore, Nagpur, Patna, Surat, Thane, Visakhapatnam)'],
    },
    {
      title: 'MCGM / MPCB',
      description: 'Municipal Corporation of Greater Mumbai and Maharashtra Pollution Control Board ward and locality boundaries',
      url: 'https://portal.mcgm.gov.in/',
      usedFor: ['Mumbai wards + localities (227 features)'],
    },
    {
      title: 'Sub-Admin boundaries (LGD, SOI, Bhuvan, PMGSY, SHRUG)',
      description: 'Subdistrict and block-level administrative boundaries used in the Sub-Admin tab',
      url: 'https://lgdirectory.gov.in/',
      usedFor: SUB_ADMIN_LAYERS.map(l => l.displayName),
      geojsonFiles: SUB_ADMIN_LAYERS.map(l => ({ name: l.displayName, path: l.url })),
    },
    {
      title: 'Electoral constituencies (LGD, Susewind)',
      description: 'Parliamentary and assembly constituency boundaries used in the Electoral tab',
      url: 'https://lgdirectory.gov.in/',
      usedFor: ELECTORAL_LAYERS.map(l => l.displayName),
      geojsonFiles: ELECTORAL_LAYERS.map(l => ({ name: l.displayName, path: l.url })),
    },
    {
      title: 'Environment layers (GatiShakti, FSI)',
      description: 'Wildlife sanctuaries, eco-sensitive zones, and Forest Survey of India administrative units used in the Environment tab',
      url: 'https://fsi.nic.in/',
      usedFor: ENVIRONMENT_LAYERS.map(l => l.displayName),
      geojsonFiles: ENVIRONMENT_LAYERS.map(l => ({ name: l.displayName, path: l.url })),
    },
    {
      title: 'Urban Local Bodies (SBM)',
      description: 'ULB boundaries from the Swachh Bharat Mission used in the Urban tab',
      url: 'https://sbm.gov.in/',
      usedFor: URBAN_LAYERS.map(l => l.displayName),
      geojsonFiles: URBAN_LAYERS.map(l => ({ name: l.displayName, path: l.url })),
    }
  ];

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-6 bg-muted/50 dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
        <h2 className="text-xl font-bold mb-3 dark:text-[hsl(35,12%,93%)]">About BharatViz</h2>
        <p className="mb-4 text-muted-foreground dark:text-[hsl(30,8%,65%)]">
          BharatViz is an open-source tool for creating fast, interactive choropleths (thematic maps) of India at state, district, and city ward levels.
        </p>
      </div>

      <div className="border rounded-lg p-6 bg-primary/5 border-primary/20 dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,16%)]">
        <h2 className="text-lg font-bold mb-3 dark:text-[hsl(35,12%,93%)]">Special Thanks</h2>
        <p className="mb-4 text-muted-foreground dark:text-[hsl(30,8%,65%)]">
			  BharatViz is made possible by the community efforts of collating shapefiles (geojsons) for India across the years.
			  Sources and contributors are mentioned below. We thank all the contributors for generating and sharing the shape files!
          In particular, we would like to thank{' '}
          <a
            href="https://github.com/ramSeraph/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors text-primary hover:text-primary/80 dark:text-[hsl(28,55%,58%)] dark:hover:text-[hsl(28,55%,68%)]"
          >
            Sreeram Kandimalla
          </a>
          {' '}and{' '}
          <a
            href="https://www.flame.edu.in/faculty/shivakumar-jolad"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors text-primary hover:text-primary/80 dark:text-[hsl(28,55%,58%)] dark:hover:text-[hsl(28,55%,68%)]"
          >
            Shivakumar Jolad's group
          </a>
          {' '}for their fantastic projects on Indian administrative boundaries (
          <a
            href="http://github.com/ramSeraph/indian_admin_boundaries/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors text-primary hover:text-primary/80 dark:text-[hsl(28,55%,58%)] dark:hover:text-[hsl(28,55%,68%)]"
          >
            indian_admin_boundaries
          </a>
          ) and{' '}
          <a
            href="https://www.indiastatestory.in/datadownloads"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors text-primary hover:text-primary/80 dark:text-[hsl(28,55%,58%)] dark:hover:text-[hsl(28,55%,68%)]"
          >
            India State Stories
          </a>
          .
        </p>
        <p className={'text-muted-foreground dark:text-[hsl(30,8%,65%)]'}>
          This project was initially prototyped using{' '}
          <a
            href="https://lovable.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors text-primary hover:text-primary/80 dark:text-[hsl(28,55%,58%)] dark:hover:text-[hsl(28,55%,68%)]"
          >
            Lovable.dev
          </a>
          {' '}and{' '}
          <a
            href="https://claude.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors text-primary hover:text-primary/80 dark:text-[hsl(28,55%,58%)] dark:hover:text-[hsl(28,55%,68%)]"
          >
            Claude.ai
          </a>
          .
        </p>
      </div>

      <div className="border rounded-lg p-6 bg-muted/50 dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
        <h2 className="text-lg font-bold mb-2 dark:text-[hsl(35,12%,93%)]">Per-city, per-state &amp; per-year datasets</h2>
        <p className="text-muted-foreground dark:text-[hsl(30,8%,65%)]">
          City ward boundaries (Cities tab, 3000+ files), village polygons (Villages tab), pincode boundaries
          (Pincodes tab, per state), and historical district evolution (Districts tab, 1872–2011 per state)
          are too numerous to list individually here. Each has its own GeoJSON and GeoParquet download button
          in the export panel of its tab once you've selected a dataset.
        </p>
      </div>

      <div className="grid gap-4">
        {sources.map((source, index) => (
          <div key={index} className="border rounded-lg p-6 hover:shadow-md transition-shadow dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2 dark:text-[hsl(35,12%,93%)]">{source.title}</h3>
                <p className="mb-4 text-muted-foreground dark:text-[hsl(30,8%,65%)]">{source.description}</p>

                <div className="mb-4">
                  <p className="text-sm font-medium mb-2 text-muted-foreground dark:text-[hsl(30,8%,55%)]">Used for:</p>
                  <div className="flex flex-wrap gap-2">
                    {source.usedFor.map((use, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary dark:bg-[hsl(28,30%,20%)] dark:text-[hsl(28,55%,60%)]"
                      >
                        {use}
                      </span>
                    ))}
                  </div>
                </div>

                {source.geojsonFiles && source.geojsonFiles.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2 text-muted-foreground dark:text-[hsl(30,8%,55%)]">Download:</p>
                    <div className="flex flex-col gap-1.5">
                      {source.geojsonFiles.map((file, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-muted-foreground dark:text-[hsl(30,8%,60%)] min-w-[9rem]">{file.name}</span>
                          <a
                            href={file.path}
                            download
                            className="inline-flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground dark:bg-[hsl(25,8%,14%)] dark:hover:bg-[hsl(25,10%,25%)] dark:text-[hsl(35,10%,80%)]"
                          >
                            <Download className="h-3 w-3" />
                            GeoJSON
                          </a>
                          <a
                            href={parquetUrl(file.path)}
                            download
                            className="inline-flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors bg-secondary hover:bg-secondary/80 text-secondary-foreground dark:bg-[hsl(25,8%,14%)] dark:hover:bg-[hsl(25,10%,25%)] dark:text-[hsl(35,10%,80%)]"
                          >
                            <Download className="h-3 w-3" />
                            GeoParquet
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition-colors underline text-sm text-primary hover:text-primary/80 dark:text-[hsl(28,55%,58%)] dark:hover:text-[hsl(28,55%,68%)]"
                >
                  Visit source
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Credits;
