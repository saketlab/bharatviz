import { Router } from 'express';
import { EmbedController } from '../controllers/embedController.js';

const router = Router();
const controller = new EmbedController();

router.get('/', (req, res) => controller.getEmbedPage(req, res));
router.get('/svg', (req, res) => controller.getEmbedSVG(req, res));
router.post('/generate', (req, res) => controller.generateEmbed(req, res));

export default router;
