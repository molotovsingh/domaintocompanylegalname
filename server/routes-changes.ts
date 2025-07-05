
import { Router } from 'express';
import { changeLogger } from './services/changeLogger.js';

const router = Router();

router.get('/api/changes', async (req, res) => {
  try {
    const changes = changeLogger.getFormattedChanges();
    res.json({ success: true, changes });
  } catch (error) {
    console.error('Failed to get changes:', error);
    res.status(500).json({ success: false, error: 'Failed to get changes' });
  }
});

export default router;
