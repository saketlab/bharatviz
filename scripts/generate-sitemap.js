import { SitemapStream, streamToPromise } from 'sitemap';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOMAIN = 'https://bharatviz.org';

const routes = [
  { url: '/', changefreq: 'weekly', priority: 1.0 },
  { url: '/states', changefreq: 'weekly', priority: 0.9 },
  { url: '/districts', changefreq: 'weekly', priority: 0.9 },
  { url: '/state-districts', changefreq: 'weekly', priority: 0.8 },
  { url: '/regions', changefreq: 'monthly', priority: 0.7 },
  { url: '/district-stats', changefreq: 'monthly', priority: 0.7 },
  { url: '/mcp', changefreq: 'monthly', priority: 0.8 },
  { url: '/help', changefreq: 'monthly', priority: 0.7 },
  { url: '/embed-demo', changefreq: 'monthly', priority: 0.6 },
  { url: '/credits', changefreq: 'yearly', priority: 0.3 },
  { url: '/llms.txt', changefreq: 'monthly', priority: 0.5 },
  { url: '/llms-full.txt', changefreq: 'monthly', priority: 0.5 },
];

async function generateSitemap() {
  try {
    const sitemap = new SitemapStream({ hostname: DOMAIN });
    const lastmod = new Date().toISOString();

    routes.forEach(route => {
      sitemap.write({ ...route, lastmod });
    });

    sitemap.end();

    const sitemapXML = await streamToPromise(sitemap);
    const outputPath = path.join(__dirname, '../public/sitemap.xml');
    const formattedXML = sitemapXML.toString().replace(/></g, '>\n<');
    fs.writeFileSync(outputPath, formattedXML);

    console.log(`Sitemap generated: ${outputPath} (${routes.length} URLs)`);
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateSitemap();
}

export { generateSitemap, routes };
