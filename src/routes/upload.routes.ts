import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';

const router = Router();

// Configure storage strategy
const storage = multer.memoryStorage();

/**
 * Enforce strict type checking on Multer configuration filters.
 * Replaces loose `any` declarations with genuine framework types.
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  // Validate file content types safely using explicitly typed properties
  if (file.mimetype === 'application/pdf' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDFs and images are permitted for clinical insights.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB Limit
  }
});

// Single file upload route
router.post('/clinical-document', upload.single('document'), async (req: Request, res: Response) => {
  // Safely check file parameters without escaping compiler checks via 'as any'
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No document payload processed in file upload buffer.'
    });
  }

  try {
    // Access safely typed Multer Express parameters natively
    const documentBuffer = req.file.buffer;
    const documentName = req.file.originalname;
    const documentSize = req.file.size;

    return res.status(200).json({
      success: true,
      data: {
        filename: documentName,
        sizeInBytes: documentSize,
        message: 'Document successfully staged in safe buffer pipeline.'
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

export default router;
