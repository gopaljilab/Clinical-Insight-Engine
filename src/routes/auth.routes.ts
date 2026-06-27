import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Handle authentication status validation framework pipeline checks.
 * Resolves architectural code leak by dropping 'as any' un-typed escape hatches.
 */
router.get('/session', (req: Request, res: Response) => {
  // Rely on explicit express-session ambient module augmentations instead of type bypasses
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Active clinical session token missing or expired.'
    });
  }

  // Access user identifier naturally without using structural bypass tokens
  const activeUserId = req.session.user.id;

  return res.status(200).json({
    success: true,
    data: {
      userId: activeUserId,
      role: req.session.user.role
    }
  });
});

export default router;
