import { Router, Request, Response } from 'express';
import { queryEvolution, getDistrictGeoJSON, getTransitionsCsv, getDistrictNames, ensureLoaded, CENSUS_YEARS, YearEntry } from '../services/districtEvolutionService.js';

const router = Router();

router.get('/names', async (_req: Request, res: Response) => {
  await ensureLoaded();
  res.json(getDistrictNames());
});

router.get('/data.csv', async (_req: Request, res: Response) => {
  await ensureLoaded();
  const csv = getTransitionsCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="district_proliferation_1951_2011_deduped.csv"');
  res.send(csv);
});

router.get('/', async (req: Request, res: Response) => {
  const { district, state, year, geojson } = req.query;

  if (!district || typeof district !== 'string') {
    res.status(400).json({ error: 'district parameter is required' });
    return;
  }

  const parsedYear = year ? Number(year) : undefined;
  if (parsedYear !== undefined && !CENSUS_YEARS.includes(parsedYear as typeof CENSUS_YEARS[number])) {
    res.status(400).json({
      error: `Invalid year. Must be one of: ${CENSUS_YEARS.join(', ')}`,
    });
    return;
  }

  try {
    const result = await queryEvolution({
      district,
      state: typeof state === 'string' ? state : undefined,
      year: parsedYear,
    });

    if (geojson === 'true' && result.matches.length > 0) {
      const matchesWithGeo = await Promise.all(
        result.matches.map(async (match) => {
          const evolutionWithGeo: Record<string, Array<YearEntry & { geojson: object | null }>> = {};
          await Promise.all(
            Object.entries(match.evolution).map(async ([yr, entries]) => {
              evolutionWithGeo[yr] = await Promise.all(
                entries.map(async (entry) => {
                  const geo = await getDistrictGeoJSON({ district: entry.district, state: match.modern_state, year: Number(yr) });
                  return { ...entry, geojson: geo ?? null };
                })
              );
            })
          );
          return { ...match, evolution: evolutionWithGeo };
        })
      );
      res.json({ ...result, matches: matchesWithGeo });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('district-evolution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
