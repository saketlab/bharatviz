import React from 'react';
import { ExternalLink, Download } from 'lucide-react';

interface CreditSource {
  title: string;
  description: string;
  url: string;
  usedFor: string[];
  geojsonFiles?: { name: string; path: string }[];
}

interface CreditsProps {
  darkMode?: boolean;
}

const Credits: React.FC<CreditsProps> = ({ darkMode = false }) => {
  const sources: CreditSource[] = [
    {
      title: 'BharatMap service - state boundaries',
      description: 'Government of India mapping service providing official administrative boundaries',
      url: 'https://mapservice.gov.in/gismapservice/rest/services/BharatMapService/Admin_Boundary_GramPanchayat/MapServer/0',
      usedFor: ['States map boundaries'],
      geojsonFiles: [
        { name: 'States (2011)', path: '/India-2011-states.geojson' }
      ]
    },
    {
      title: 'BharatMap service - district boundaries',
      description: 'Government of India mapping service with detailed administrative boundaries',
      url: 'https://mapservice.gov.in/gismapservice/rest/login?redirect=https%3A//mapservice.gov.in/gismapservice/rest/services/BharatMapService/Admin_Boundary_Village/MapServer/1',
      usedFor: ['LGD district boundaries'],
      geojsonFiles: [
        { name: 'LGD Districts', path: '/India_LGD_districts.geojson' },
        { name: 'LGD States', path: '/India_LGD_states.geojson' }
      ]
    },
    {
      title: 'Bhuvan - NRSC',
      description: 'National Remote Sensing Centre (NRSC) geoportal providing spatial data and mapping services for India',
      url: 'https://bhuvan.nrsc.gov.in/ngmaps',
      usedFor: ['Bhuvan district boundaries'],
      geojsonFiles: [
        { name: 'Bhuvan Districts', path: '/India-bhuvan-districts.geojson' },
        { name: 'Bhuvan States', path: '/India-bhuvan-states.geojson' }
      ]
    },
    {
      title: 'Survey of India',
      description: 'Survey of India - National survey and mapping organization providing official administrative boundaries and topographic data',
      url: 'https://www.surveyofindia.gov.in/',
      usedFor: ['Survey of India district boundaries'],
      geojsonFiles: [
        { name: 'SOI Districts', path: '/India-soi-districts.geojson' },
        { name: 'SOI States', path: '/India-soi-states.geojson' }
      ]
    },
    {
      title: 'India State Stories',
      description: 'Historical census district data for India across multiple years (1941-2011)',
      url: 'https://www.indiastatestory.in/datadownloads',
      usedFor: ['Census 1941', 'Census 1951', 'Census 1961', 'Census 1971', 'Census 1981', 'Census 1991', 'Census 2001', 'Census 2011'],
      geojsonFiles: [
        { name: '1941 Districts', path: '/India-1941-districts.geojson' },
        { name: '1941 States', path: '/India-1941-states.geojson' },
        { name: '1951 Districts', path: '/India-1951-districts.geojson' },
        { name: '1951 States', path: '/India-1951-states.geojson' },
        { name: '1961 Districts', path: '/India-1961-districts.geojson' },
        { name: '1961 States', path: '/India-1961-states.geojson' },
        { name: '1971 Districts', path: '/India-1971-districts.geojson' },
        { name: '1971 States', path: '/India-1971-states.geojson' },
        { name: '1981 Districts', path: '/India-1981-districts.geojson' },
        { name: '1981 States', path: '/India-1981-states.geojson' },
        { name: '1991 Districts', path: '/India-1991-districts.geojson' },
        { name: '1991 States', path: '/India-1991-states.geojson' },
        { name: '2001 Districts', path: '/India-2001-districts.geojson' },
        { name: '2001 States', path: '/India-2001-states.geojson' },
        { name: '2011 Districts', path: '/India-2011-districts.geojson' },
        { name: '2011 States', path: '/India-2011-states.geojson' }
      ]
    },
    {
      title: 'Spatial data repository - DHS program',
      description: 'Demographic and Health Surveys spatial data repository with health survey district boundaries',
      url: 'https://spatialdata.dhsprogram.com/home/',
      usedFor: ['NFHS-4 district boundaries', 'NFHS-5 district boundaries', 'NSSO regions'],
      geojsonFiles: [
        { name: 'NFHS-4 Districts', path: '/India_NFHS4_districts_simplified.geojson' },
        { name: 'NFHS-4 States', path: '/India_NFHS4_states_simplified.geojson' },
        { name: 'NFHS-5 Districts', path: '/India_NFHS5_districts_simplified.geojson' },
        { name: 'NFHS-5 States', path: '/India_NFHS5_states_simplified.geojson' },
        { name: 'NSSO Regions', path: '/India_NFHS5_NSSO_regions_boundaries.geojson' }
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
    }
  ];

  return (
    <div className="space-y-6">
      <div className={`border rounded-lg p-6 ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-muted/50'}`}>
        <h2 className={`text-xl font-bold mb-3 ${darkMode ? 'text-white' : ''}`}>About BharatViz</h2>
        <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
          BharatViz is an open-source tool for creating fast, interactive choropleths (thematic maps) of India at state, district, and city ward levels.
        </p>
      </div>

      <div className={`border rounded-lg p-6 ${darkMode ? 'bg-[#1a1a1a] border-[#444]' : 'bg-primary/5 border-primary/20'}`}>
        <h2 className={`text-lg font-bold mb-3 ${darkMode ? 'text-white' : ''}`}>Special Thanks</h2>
        <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>
          BharatViz is made possible by the community efforts of collating shapefiles (geojsons) for India across the years.
          Sources and contributors are mentioned below. We thank all the contributors for generating and sharing the shape files!
          In particular, we would like to thank{' '}
          <a
            href="https://github.com/ramSeraph/"
            target="_blank"
            rel="noopener noreferrer"
            className={`underline transition-colors ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-primary hover:text-primary/80'}`}
          >
            Sreeram Kandimalla
          </a>
          {' '}and{' '}
          <a
            href="https://www.flame.edu.in/faculty/shivakumar-jolad"
            target="_blank"
            rel="noopener noreferrer"
            className={`underline transition-colors ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-primary hover:text-primary/80'}`}
          >
            Shivakumar Jolad's group
          </a>
          {' '}for their fantastic projects on Indian administrative boundaries (
          <a
            href="http://github.com/ramSeraph/indian_admin_boundaries/"
            target="_blank"
            rel="noopener noreferrer"
            className={`underline transition-colors ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-primary hover:text-primary/80'}`}
          >
            indian_admin_boundaries
          </a>
          ) and{' '}
          <a
            href="https://www.indiastatestory.in/datadownloads"
            target="_blank"
            rel="noopener noreferrer"
            className={`underline transition-colors ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-primary hover:text-primary/80'}`}
          >
            India State Stories
          </a>
          .
        </p>
        <p className={darkMode ? 'text-gray-300' : 'text-muted-foreground'}>
          This project was initially prototyped using{' '}
          <a
            href="https://lovable.dev"
            target="_blank"
            rel="noopener noreferrer"
            className={`underline transition-colors ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-primary hover:text-primary/80'}`}
          >
            Lovable.dev
          </a>
          {' '}and{' '}
          <a
            href="https://claude.ai"
            target="_blank"
            rel="noopener noreferrer"
            className={`underline transition-colors ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-primary hover:text-primary/80'}`}
          >
            Claude.ai
          </a>
          .
        </p>
      </div>

      <div className="grid gap-4">
        {sources.map((source, index) => (
          <div key={index} className={`border rounded-lg p-6 hover:shadow-md transition-shadow ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : ''}`}>{source.title}</h3>
                <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-muted-foreground'}`}>{source.description}</p>

                <div className="mb-4">
                  <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>Used for:</p>
                  <div className="flex flex-wrap gap-2">
                    {source.usedFor.map((use, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-primary/10 text-primary'}`}
                      >
                        {use}
                      </span>
                    ))}
                  </div>
                </div>

                {source.geojsonFiles && source.geojsonFiles.length > 0 && (
                  <div className="mb-4">
                    <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>Download GeoJSON:</p>
                    <div className="flex flex-wrap gap-2">
                      {source.geojsonFiles.map((file, i) => (
                        <a
                          key={i}
                          href={file.path}
                          download
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${darkMode ? 'bg-[#333] hover:bg-[#444] text-gray-200' : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'}`}
                        >
                          <Download className="h-3 w-3" />
                          {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 transition-colors underline text-sm ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-primary hover:text-primary/80'}`}
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
