import { Router } from 'express';
import { DistrictsMapController } from '../controllers/districtsMapController.js';

const router = Router();
const controller = new DistrictsMapController();

/**
 * POST /state-districts/map
 * Generate state-district-level choropleth map (single state with districts)
 *
 * Request body:
 * {
 *   "data": [{"state": "...", "district": "...", "value": ...}],
 *   "state": "...",                         // Required: which state to display
 *   "mapType": "LGD" | "NFHS5" | "NFHS4" | "BHUVAN" | "SOI" | "NSSO" | "2011" | "2001" | ... // Optional, default: "LGD"
 *   "colorScale": "...",                    // Optional
 *   "invertColors": false,                  // Optional
 *   "mainTitle": "...",                     // Optional
 *   "legendTitle": "...",                   // Optional
 *   "formats": ["png", "svg", "pdf"]        // Optional
 * }
 */
router.post('/state-districts/map', (req, res) => controller.generateStateDistrictsMap(req, res));

/**
 * POST /districts/map
 * Generate district-level choropleth map
 *
 * Request body:
 * {
 *   "data": [{"state": "...", "district": "...", "value": ...}],
 *   "mapType": "LGD" | "NFHS5" | "NFHS4" | "BHUVAN" | "SOI" | "NSSO" | "2011" | "2001" | ... // Optional, default: "LGD"
 *   "colorScale": "...",                    // Optional
 *   "invertColors": false,                  // Optional
 *   "showStateBoundaries": true,            // Optional
 *   "mainTitle": "...",                     // Optional
 *   "legendTitle": "...",                   // Optional
 *   "formats": ["png", "svg", "pdf"]        // Optional
 * }
 */
router.post('/map', (req, res) => controller.generateDistrictsMap(req, res));

export default router;
