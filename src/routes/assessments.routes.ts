import { Router, Request, Response } from 'express';

const router = Router();

// Strict User interface matching the application's authentication definition
interface User {
  id: string;
  role: string;
}

/**
 * Security access policy engine method.
 * Explicitly accepts a strongly-typed User parameter.
 */
function canAccessPatientRecord(user: User, patientId: string): boolean {
  if (user.role === 'ADMIN' || user.role === 'CLINICIAN') {
    return true;
  }
  return false;
}

/**
 * Handle Clinical Assessment Resource Access Verification.
 * Drops unnecessary '(user as any)' type bypasses during validation checks.
 */
router.get('/patient/:patientId', async (req: Request, res: Response) => {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized session frame.' });
  }

  const { patientId } = req.params;
  
  // Clean invocation utilizing the strictly typed session user object directly
  const isAuthorized = canAccessPatientRecord(req.session.user, patientId);

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied. Security clearance parameters rejected this operation.'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Security validation verified. Restrictive payload context unlocked.'
  });
});

export default router;
