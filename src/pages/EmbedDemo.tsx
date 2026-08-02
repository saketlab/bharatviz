import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Copy } from 'lucide-react';

const EmbedDemo = () => {
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [copiedJS, setCopiedJS] = useState(false);
  const [copiedDistrictIframe, setCopiedDistrictIframe] = useState(false);
  const [copiedDistrictJS, setCopiedDistrictJS] = useState(false);
  const [copiedAQIIframe, setCopiedAQIIframe] = useState(false);
  const [copiedAQIJS, setCopiedAQIJS] = useState(false);
  const [copiedDarkIframe, setCopiedDarkIframe] = useState(false);
  const [copiedDarkJS, setCopiedDarkJS] = useState(false);

  const baseUrl = window.location.origin;
  const apiUrl = baseUrl.includes('localhost') ? 'http://localhost:3001' : baseUrl;
  const dataUrl = `${baseUrl}/nfhs5_protein_consumption_eggs.csv`;
  const districtDataUrl = 'https://saketkc.github.io/vayuayan-archive/daily_average_district/20251219_daily_AQI_mean.csv.gz';
  const aqiDataUrl = 'https://saketkc.github.io/vayuayan-archive/daily_average_district/20251227_daily_AQI_mean.csv.gz';

  const iframeCode = `<iframe
  src="${apiUrl}/api/v1/embed?dataUrl=${encodeURIComponent(dataUrl)}&colorScale=viridis&title=Protein%20consumption%20in%20India"
  width="800"
  height="600"
  frameborder="0"
  sandbox="allow-scripts allow-same-origin"
  style="border: none; max-width: 100%;">
</iframe>`;

  const jsCode = `<!-- Container for the map -->
<div id="bharatviz-map"></div>

<!-- Load BharatViz embed script -->
<script src="${apiUrl}/embed.js"></script>

<!-- Initialize the map -->
<script>
  BharatViz.embed({
    container: '#bharatviz-map',
    dataUrl: '${dataUrl}',
    colorScale: 'viridis',
    title: 'Protein consumption in India'
  });
</script>`;

  const districtIframeCode = `<iframe
  src="${apiUrl}/api/v1/embed?dataUrl=${encodeURIComponent(districtDataUrl)}&colorScale=aqi&title=AQI%20-%20Mean%20(2025-12-19)&hideDistrictNames=true&hideValues=true"
  width="800"
  height="800"
  frameborder="0"
  sandbox="allow-scripts allow-same-origin"
  style="border: none; max-width: 100%;">
</iframe>`;

  const districtJsCode = `<!-- Container for the map -->
<div id="bharatviz-district-map"></div>

<!-- Load BharatViz embed script -->
<script src="${apiUrl}/embed.js"></script>

<!-- Initialize the map -->
<script>
  BharatViz.embed({
    container: '#bharatviz-district-map',
    dataUrl: '${districtDataUrl}',
    colorScale: 'aqi',
    title: 'AQI - Mean (2025-12-19)',
    hideDistrictNames: true,
    hideValues: true
  });
</script>`;

  const aqiIframeCode = `<iframe
  src="${apiUrl}/api/v1/embed?dataUrl=${encodeURIComponent(aqiDataUrl)}&colorScale=aqi&title=AQI%20-%20Mean%20(2025-12-27)&legendTitle=AQI&boundary=LGD&showStateBoundaries=true"
  width="800"
  height="800"
  frameborder="0"
  sandbox="allow-scripts allow-same-origin"
  style="border: none; max-width: 100%;">
</iframe>`;

  const aqiJsCode = `<!-- Container for the map -->
<div id="bharatviz-aqi-map"></div>

<!-- Load BharatViz embed script -->
<script src="${apiUrl}/embed.js"></script>

<!-- Initialize the map -->
<script>
  BharatViz.embed({
    container: '#bharatviz-aqi-map',
    dataUrl: '${aqiDataUrl}',
    colorScale: 'aqi',
    title: 'AQI - Mean (2025-12-27)',
    legendTitle: 'AQI',
    boundary: 'LGD',
    showStateBoundaries: true
  });
</script>`;

  const darkIframeCode = `<iframe
  src="${apiUrl}/api/v1/embed?dataUrl=${encodeURIComponent(aqiDataUrl)}&colorScale=aqi&title=AQI%20-%20Mean%20(2025-12-27)&legendTitle=AQI&boundary=LGD&showStateBoundaries=true&darkMode=true"
  width="800"
  height="800"
  frameborder="0"
  sandbox="allow-scripts allow-same-origin"
  style="border: none; max-width: 100%; background: #000;">
</iframe>`;

  const darkJsCode = `<!-- Container for the map -->
<div id="bharatviz-dark-map"></div>

<!-- Load BharatViz embed script -->
<script src="${apiUrl}/embed.js"></script>

<!-- Initialize the map -->
<script>
  BharatViz.embed({
    container: '#bharatviz-dark-map',
    dataUrl: '${aqiDataUrl}',
    colorScale: 'aqi',
    title: 'AQI - Mean (2025-12-27)',
    legendTitle: 'AQI',
    boundary: 'LGD',
    showStateBoundaries: true,
    darkMode: true
  });
</script>`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  useEffect(() => {
    const baseUrl = window.location.origin;
    const apiUrl = baseUrl.includes('localhost') ? 'http://localhost:3001' : baseUrl;
    const dataUrl = `${baseUrl}/nfhs5_protein_consumption_eggs.csv`;
    const districtDataUrl = 'https://saketkc.github.io/vayuayan-archive/daily_average_district/20251219_daily_AQI_mean.csv.gz';
    const aqiDataUrl = 'https://saketkc.github.io/vayuayan-archive/daily_average_district/20251227_daily_AQI_mean.csv.gz';

    const script = document.createElement('script');
    script.src = `${apiUrl}/embed.js`;
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.BharatViz) {
        window.BharatViz.embed({
          container: '#js-embed-demo',
          dataUrl: dataUrl,
          colorScale: 'viridis',
          title: 'Protein consumption in India'
        });

        window.BharatViz.embed({
          container: '#js-district-embed-demo',
          dataUrl: districtDataUrl,
          colorScale: 'aqi',
          title: 'AQI - Mean (2025-12-19)',
          hideDistrictNames: true,
          hideValues: true
        });

        window.BharatViz.embed({
          container: '#js-aqi-embed-demo',
          dataUrl: aqiDataUrl,
          colorScale: 'aqi',
          title: 'AQI - Mean (2025-12-27)',
          legendTitle: 'AQI',
          boundary: 'LGD',
          showStateBoundaries: true
        });

        window.BharatViz.embed({
          container: '#js-dark-embed-demo',
          dataUrl: aqiDataUrl,
          colorScale: 'aqi',
          title: 'AQI - Mean (2025-12-27)',
          legendTitle: 'AQI',
          boundary: 'LGD',
          showStateBoundaries: true,
          darkMode: true
        });
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(38,22%,99%)] dark:bg-[hsl(25,8%,9%)]">
      <Helmet>
        <title>Embed Interactive India Maps on Your Website | BharatViz</title>
        <meta name="title" content="Embed Interactive India Maps on Your Website | BharatViz" />
        <meta name="description" content="Easily embed beautiful, interactive choropleth maps of India on your website. State-level and district-level data visualization with simple iframe or JavaScript integration. Free to use." />
        <meta name="keywords" content="embed India maps, interactive maps, choropleth embed, India data visualization, map widget, iframe maps, district maps embed, state maps widget, REST API maps, data journalism India" />

        <link rel="canonical" href="https://bharatviz.org/embed-demo" />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://bharatviz.org/embed-demo" />
        <meta property="og:title" content="Embed Interactive India Maps on Your Website | BharatViz" />
        <meta property="og:description" content="Easily embed beautiful, interactive choropleth maps of India on your website. State-level and district-level data visualization with simple iframe or JavaScript integration. Free to use." />
        <meta property="og:image" content="https://bharatviz.org/bharatviz_favicon.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="BharatViz - Interactive India Maps Embed Demo" />
        <meta property="og:site_name" content="BharatViz" />
        <meta property="og:locale" content="en_US" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://bharatviz.org/embed-demo" />
        <meta name="twitter:title" content="Embed Interactive India Maps on Your Website | BharatViz" />
        <meta name="twitter:description" content="Easily embed beautiful, interactive choropleth maps of India. State-level and district-level data visualization with simple iframe or JavaScript integration." />
        <meta name="twitter:image" content="https://bharatviz.org/bharatviz_favicon.png" />
        <meta name="twitter:image:alt" content="BharatViz - Interactive India Maps" />
        <meta name="twitter:site" content="@saketkc" />
        <meta name="twitter:creator" content="@saketkc" />

        <meta name="author" content="Saket Choudhary" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": "How to Embed Interactive India Maps",
            "description": "Learn how to embed beautiful, interactive choropleth maps of India on your website using BharatViz",
            "image": "https://bharatviz.org/bharatviz_favicon.png",
            "step": [
              {
                "@type": "HowToStep",
                "name": "Choose your method",
                "text": "Select between iframe embed or JavaScript widget integration"
              },
              {
                "@type": "HowToStep",
                "name": "Copy the code",
                "text": "Copy the provided embed code for your chosen method"
              },
              {
                "@type": "HowToStep",
                "name": "Paste on your website",
                "text": "Add the code to your HTML where you want the map to appear"
              }
            ],
            "tool": {
              "@type": "HowToTool",
              "name": "BharatViz"
            }
          })}
        </script>
      </Helmet>

      <div className="bg-white dark:bg-[hsl(25,8%,12%)] border-b border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,18%)]">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <a href="/" className="text-[hsl(28,55%,42%)] hover:text-[hsl(28,48%,32%)] dark:text-[hsl(35,55%,60%)] dark:hover:text-[hsl(35,48%,72%)] text-xs sm:text-sm mb-2 inline-block">
            {'<-'} Back to BharatViz
          </a>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">Embed BharatViz Maps</h1>
          <p className="text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)] mt-2 text-sm sm:text-base md:text-lg">
            Add live, interactive India maps to your website with just a few lines of code
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-6xl">
        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)] mb-4 sm:mb-6">Method 1: iframe Embed</h2>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(iframeCode, setCopiedIframe)}
                >
                  {copiedIframe ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy code
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                Copy and paste this HTML into your website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)] p-4 rounded-lg overflow-x-auto text-sm">
                <code>{iframeCode}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live demo</CardTitle>
              <CardDescription>This is how the iframe embed looks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={`${apiUrl}/api/v1/embed?dataUrl=${encodeURIComponent(dataUrl)}&colorScale=viridis&title=Protein%20consumption%20in%20India`}
                  width="100%"
                  height="800"
                  style={{ border: 'none' }}
                  sandbox="allow-scripts allow-same-origin"
                  title="BharatViz iframe embed demo"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)] mb-4 sm:mb-6">Method 2: JavaScript widget</h2>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(jsCode, setCopiedJS)}
                >
                  {copiedJS ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy code
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                Add this HTML to your page for a more integrated experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)] p-4 rounded-lg overflow-x-auto text-sm">
                <code>{jsCode}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live demo</CardTitle>
              <CardDescription>This is how the JavaScript widget looks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4">
                <div id="js-embed-demo" className="min-h-[500px]">
                  <div className="text-center py-20 text-[hsl(28,8%,44%)] dark:text-[hsl(30,8%,45%)]">
                    Loading map...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)] mb-4 sm:mb-6">District-level maps</h2>
          <p className="text-sm sm:text-base text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)] mb-6 sm:mb-8">
            BharatViz also supports district-level choropleth maps across India. Hover over districts to see their names and values.
          </p>

          <h3 className="text-xl sm:text-2xl font-semibold text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)] mb-3 sm:mb-4">iframe embed (district-level)</h3>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(districtIframeCode, setCopiedDistrictIframe)}
                >
                  {copiedDistrictIframe ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy code
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                District-level map showing AQI data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)] p-4 rounded-lg overflow-x-auto text-sm">
                <code>{districtIframeCode}</code>
              </pre>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Live demo</CardTitle>
              <CardDescription>District-level map with hover tooltips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={`${apiUrl}/api/v1/embed?dataUrl=${encodeURIComponent(districtDataUrl)}&colorScale=aqi&title=AQI%20-%20Mean%20(2025-12-19)&hideDistrictNames=true&hideValues=true`}
                  width="100%"
                  height="800"
                  style={{ border: 'none' }}
                  sandbox="allow-scripts allow-same-origin"
                  title="BharatViz district iframe embed demo"
                />
              </div>
            </CardContent>
          </Card>

          <h3 className="text-xl sm:text-2xl font-semibold text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)] mb-3 sm:mb-4">JavaScript widget (district-level)</h3>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(districtJsCode, setCopiedDistrictJS)}
                >
                  {copiedDistrictJS ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy code
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                JavaScript widget for district-level maps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)] p-4 rounded-lg overflow-x-auto text-sm">
                <code>{districtJsCode}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live demo</CardTitle>
              <CardDescription>District-level JavaScript widget with hover tooltips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4">
                <div id="js-district-embed-demo" className="min-h-[700px]">
                  <div className="text-center py-20 text-[hsl(28,8%,44%)] dark:text-[hsl(30,8%,45%)]">
                    Loading district map...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)] mb-4 sm:mb-6">AQI Color Scale Demo</h2>
          <p className="text-sm sm:text-base text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)] mb-6 sm:mb-8">
            Demonstrate AQI (Air Quality Index) data with the specialized AQI color scale. This scale uses absolute thresholds:
            0-50 (Good), 51-100 (Satisfactory), 101-200 (Moderate), 201-300 (Poor), 301-400 (Very Poor), 401-500 (Severe).
          </p>

          <h3 className="text-xl sm:text-2xl font-semibold text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)] mb-3 sm:mb-4">iframe embed with AQI scale</h3>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(aqiIframeCode, setCopiedAQIIframe)}
                >
                  {copiedAQIIframe ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy code
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                AQI map with specialized color scale
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)] p-4 rounded-lg overflow-x-auto text-sm">
                <code>{aqiIframeCode}</code>
              </pre>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Live demo</CardTitle>
              <CardDescription>AQI map showing data from 2025-12-27</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={`${apiUrl}/api/v1/embed?dataUrl=${encodeURIComponent(aqiDataUrl)}&colorScale=aqi&title=AQI%20-%20Mean%20(2025-12-27)&legendTitle=AQI&boundary=LGD&showStateBoundaries=true`}
                  width="100%"
                  height="800"
                  style={{ border: 'none' }}
                  sandbox="allow-scripts allow-same-origin"
                  title="BharatViz AQI iframe embed demo"
                />
              </div>
            </CardContent>
          </Card>

          <h3 className="text-xl sm:text-2xl font-semibold text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)] mb-3 sm:mb-4">JavaScript widget with AQI scale</h3>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(aqiJsCode, setCopiedAQIJS)}
                >
                  {copiedAQIJS ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy code
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                JavaScript widget for AQI maps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)] p-4 rounded-lg overflow-x-auto text-sm">
                <code>{aqiJsCode}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live demo</CardTitle>
              <CardDescription>JavaScript widget with AQI color scale</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4">
                <div id="js-aqi-embed-demo" className="min-h-[700px]">
                  <div className="text-center py-20 text-[hsl(28,8%,44%)] dark:text-[hsl(30,8%,45%)]">
                    Loading AQI map...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)] mb-4 sm:mb-6">Dark Mode Demo - Districts AQI</h2>
          <p className="text-sm sm:text-base text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)] mb-6 sm:mb-8">
            Enable dark mode for maps with black backgrounds and white text/boundaries. This example shows district-level AQI data with the AQI color scale. Perfect for dark-themed websites or nighttime viewing.
          </p>

          <h3 className="text-xl sm:text-2xl font-semibold text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)] mb-3 sm:mb-4">iframe embed with dark mode</h3>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(darkIframeCode, setCopiedDarkIframe)}
                >
                  {copiedDarkIframe ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy code
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                District AQI map with darkMode=true parameter and AQI color scale
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)] p-4 rounded-lg overflow-x-auto text-sm">
                <code>{darkIframeCode}</code>
              </pre>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Live demo</CardTitle>
              <CardDescription>District AQI map with dark background and white boundaries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-black">
                <iframe
                  src={`${apiUrl}/api/v1/embed?dataUrl=${encodeURIComponent(aqiDataUrl)}&colorScale=aqi&title=AQI%20-%20Mean%20(2025-12-27)&legendTitle=AQI&boundary=LGD&showStateBoundaries=true&darkMode=true`}
                  width="100%"
                  height="800"
                  style={{ border: 'none', background: '#000' }}
                  sandbox="allow-scripts allow-same-origin"
                  title="BharatViz dark mode district AQI iframe embed demo"
                />
              </div>
            </CardContent>
          </Card>

          <h3 className="text-xl sm:text-2xl font-semibold text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)] mb-3 sm:mb-4">JavaScript widget with dark mode</h3>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(darkJsCode, setCopiedDarkJS)}
                >
                  {copiedDarkJS ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy code
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                District AQI JavaScript widget with darkMode: true and AQI color scale
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)] p-4 rounded-lg overflow-x-auto text-sm">
                <code>{darkJsCode}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live demo</CardTitle>
              <CardDescription>District AQI JavaScript widget in dark mode</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-black">
                <div id="js-dark-embed-demo" className="min-h-[500px]">
                  <div className="text-center py-20 text-[hsl(30,8%,45%)]">
                    Loading dark mode AQI map...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)] mb-4 sm:mb-6">Configuration options</h2>

          <Card>
            <CardHeader>
              <CardTitle>Available parameters</CardTitle>
              <CardDescription>
                Customize your embedded maps with these options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-xs sm:text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pl-4 sm:pl-0 pr-4">Parameter</th>
                      <th className="text-left py-2 pr-4">Type</th>
                      <th className="text-left py-2 pr-4 sm:pr-0">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">
                    <tr className="border-b">
                      <td className="py-2 pl-4 sm:pl-0 pr-4 font-mono">dataUrl</td>
                      <td className="py-2 pr-4">string</td>
                      <td className="py-2 pr-4 sm:pr-0">URL to your CSV data file (required)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono">colorScale</td>
                      <td className="py-2 pr-4">string</td>
                      <td className="py-2">Color scheme: viridis, blues, greens, spectral, aqi (for Air Quality Index), etc.</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono">title</td>
                      <td className="py-2 pr-4">string</td>
                      <td className="py-2">Map title</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono">legendTitle</td>
                      <td className="py-2 pr-4">string</td>
                      <td className="py-2">Custom legend title</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono">invertColors</td>
                      <td className="py-2 pr-4">boolean</td>
                      <td className="py-2">Reverse the color scale</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono">hideValues</td>
                      <td className="py-2 pr-4">boolean</td>
                      <td className="py-2">Hide numeric values on map</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono">hideStateNames</td>
                      <td className="py-2 pr-4">boolean</td>
                      <td className="py-2">Hide state labels</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono">hideDistrictNames</td>
                      <td className="py-2 pr-4">boolean</td>
                      <td className="py-2">Hide district labels</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4 font-mono">darkMode</td>
                      <td className="py-2 pr-4">boolean</td>
                      <td className="py-2">Enable dark mode with black background and white text</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-mono">width</td>
                      <td className="py-2 pr-4">string</td>
                      <td className="py-2">Width (iframe only, default: "100%")</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <footer className="bg-[hsl(25,8%,9%)] text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[hsl(30,8%,55%)]">
            BharatViz is open-source software licensed under MIT.{' '}
            <a
              href="https://github.com/saketlab/bharatviz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(35,55%,60%)] hover:text-[hsl(35,48%,72%)]"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

// Extend window type for BharatViz
declare global {
  interface Window {
    BharatViz?: {
      embed: (options: {
        container: string;
        dataUrl: string;
        colorScale?: string;
        title?: string;
      }) => void;
    };
  }
}

export default EmbedDemo;
