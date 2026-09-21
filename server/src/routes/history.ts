import { Router, Request, Response } from 'express';
import { getRecentReports } from '../services/rag';

const router = Router();

/**
 * GET /api/history
 * Returns the 10 most recent research reports stored in the vector DB.
 * Returns [] if Supabase is not configured.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const reports = await getRecentReports(10);
    return res.json({ reports });
  } catch (err) {
    console.error('[History] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
