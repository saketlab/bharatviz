/**
 * BharatViz Embed Widget
 * Easy embedding of BharatViz maps into any website
 *
 * Usage:
 * <div id="bharatviz-map"></div>
 * <script src="https://bharatviz.saketlab.in/embed.js"></script>
 * <script>
 *   BharatViz.embed({
 *     container: '#bharatviz-map',
 *     dataUrl: 'https://yoursite.com/data.csv',
 *     colorScale: 'viridis',
 *     title: 'My Map'
 *   });
 * </script>
 */

(function(window) {
  'use strict';

  const currentScript = document.currentScript || document.querySelector('script[src*="embed.js"]');
  let API_BASE = 'https://bharatviz.saketlab.in/api/v1';

  if (currentScript) {
    const scriptSrc = currentScript.src;
    const match = scriptSrc.match(/^(https?:\/\/[^\/]+)/);
    if (match) {
      API_BASE = `${match[1]}/api/v1`;
    }
  }

  const BharatViz = {
    embed: async function(options) {
      const container = document.querySelector(options.container);
      if (!container) {
        console.error('BharatViz: Container not found:', options.container);
        return;
      }

      const method = options.method || 'inline';

      if (method === 'iframe') {
        this._embedIframe(container, options);
      } else {
        await this._embedInline(container, options);
      }
    },

    _embedIframe: function(container, options) {
      const params = new URLSearchParams();

      if (options.dataUrl) params.append('dataUrl', options.dataUrl);
      if (options.mapType) params.append('mapType', options.mapType);
      if (options.state) params.append('state', options.state);
      if (options.boundary) {
        params.append('boundary', options.boundary);
      } else if (options.districtBoundary) {
        params.append('boundary', options.districtBoundary);
      }
      if (options.colorScale) params.append('colorScale', options.colorScale);
      if (options.title) params.append('title', options.title);
      if (options.legendTitle) params.append('legendTitle', options.legendTitle);
      if (options.invertColors) params.append('invertColors', 'true');
      if (options.hideValues) params.append('hideValues', 'true');
      if (options.hideStateNames) params.append('hideStateNames', 'true');
      if (options.hideDistrictNames) params.append('hideDistrictNames', 'true');
      if (options.showStateBoundaries !== undefined) {
        params.append('showStateBoundaries', options.showStateBoundaries ? 'true' : 'false');
      }

      const iframe = document.createElement('iframe');
      iframe.src = `${API_BASE}/embed?${params.toString()}`;
      iframe.width = options.width || '100%';
      iframe.height = options.height || '600';
      iframe.frameBorder = '0';
      iframe.style.border = 'none';
      iframe.style.maxWidth = '100%';

      container.appendChild(iframe);
    },

    _embedInline: async function(container, options) {
      try {
        container.innerHTML = '<div style="text-align: center; padding: 40px;">Loading map...</div>';

        let svgContent;

        if (options.dataUrl) {
          const params = new URLSearchParams();
          params.append('dataUrl', options.dataUrl);
          params.append('colorScale', options.colorScale || 'spectral');
          params.append('legendTitle', options.legendTitle || 'Values');

          if (options.mapType) params.append('mapType', options.mapType);
          if (options.state) params.append('state', options.state);

          const boundary = options.boundary || options.districtBoundary || 'LGD';
          params.append('boundary', boundary);

          if (options.invertColors) params.append('invertColors', 'true');
          if (options.hideValues) params.append('hideValues', 'true');
          if (options.hideStateNames) params.append('hideStateNames', 'true');
          if (options.hideDistrictNames) params.append('hideDistrictNames', 'true');
          if (options.showStateBoundaries !== undefined) {
            params.append('showStateBoundaries', options.showStateBoundaries ? 'true' : 'false');
          }

          const url = `${API_BASE}/embed/svg?${params.toString()}`;
          const response = await fetch(url);

          if (!response.ok) {
            let errorMessage = 'Failed to fetch map';
            try {
              const error = await response.json();
              errorMessage = error.error?.message || errorMessage;
            } catch (e) {
              errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
          }

          svgContent = await response.text();

        } else if (options.data) {
          const requestBody = {
            data: options.data,
            colorScale: options.colorScale || 'spectral',
            title: options.title || 'BharatViz',
            legendTitle: options.legendTitle || 'Values',
            format: 'svg'
          };

          if (options.mapType) requestBody.mapType = options.mapType;
          if (options.state) requestBody.state = options.state;

          requestBody.boundary = options.boundary || options.districtBoundary || 'LGD';
          requestBody.invertColors = options.invertColors || false;
          requestBody.hideValues = options.hideValues || false;
          requestBody.hideStateNames = options.hideStateNames || false;
          requestBody.hideDistrictNames = options.hideDistrictNames || false;
          requestBody.showStateBoundaries = options.showStateBoundaries !== undefined ? options.showStateBoundaries : true;

          const response = await fetch(`${API_BASE}/embed/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error?.message || 'Failed to generate map');
          }

          svgContent = result.svg;

        } else {
          throw new Error('Either dataUrl or data must be provided');
        }

        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';
        wrapper.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';

        if (options.title) {
          const titleEl = document.createElement('h2');
          titleEl.textContent = options.title;
          titleEl.style.marginBottom = '20px';
          titleEl.style.color = '#333';
          wrapper.appendChild(titleEl);
        }

        const mapDiv = document.createElement('div');
        mapDiv.innerHTML = svgContent;
        mapDiv.style.maxWidth = '100%';

        const svgEl = mapDiv.querySelector('svg');
        if (svgEl) {
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
        }

        wrapper.appendChild(mapDiv);

        const credits = document.createElement('div');
        credits.style.marginTop = '20px';
        credits.style.fontSize = '12px';
        credits.style.color = '#666';
        credits.innerHTML = 'Created with <a href="https://bharatviz.saketlab.in" target="_blank" style="color: #0066cc; text-decoration: none;">BharatViz</a>';
        wrapper.appendChild(credits);

        container.innerHTML = '';
        container.appendChild(wrapper);

      } catch (error) {
        console.error('BharatViz embed error:', error);
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #dc3545;">
          <strong>Error loading map:</strong> ${error.message}
          <br><small style="color: #666;">Check console for details</small>
        </div>`;
      }
    },

    getEmbedUrl: function(options) {
      const params = new URLSearchParams();

      if (options.dataUrl) params.append('dataUrl', options.dataUrl);
      if (options.mapType) params.append('mapType', options.mapType);
      if (options.state) params.append('state', options.state);
      if (options.boundary) params.append('boundary', options.boundary);
      else if (options.districtBoundary) params.append('boundary', options.districtBoundary);
      if (options.colorScale) params.append('colorScale', options.colorScale);
      if (options.title) params.append('title', options.title);
      if (options.legendTitle) params.append('legendTitle', options.legendTitle);
      if (options.invertColors) params.append('invertColors', 'true');
      if (options.hideValues) params.append('hideValues', 'true');
      if (options.hideStateNames) params.append('hideStateNames', 'true');
      if (options.hideDistrictNames) params.append('hideDistrictNames', 'true');
      if (options.showStateBoundaries !== undefined) {
        params.append('showStateBoundaries', options.showStateBoundaries ? 'true' : 'false');
      }

      return `${API_BASE}/embed?${params.toString()}`;
    },

    getEmbedCode: function(options) {
      const url = this.getEmbedUrl(options);
      const width = options.width || 800;
      const height = options.height || 600;

      return `<iframe src="${url}" width="${width}" height="${height}" frameborder="0" style="border: none; max-width: 100%;"></iframe>`;
    }
  };

  window.BharatViz = BharatViz;

})(window);
