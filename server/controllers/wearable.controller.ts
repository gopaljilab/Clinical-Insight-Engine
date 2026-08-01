import { type Request, type Response } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { subDays, startOfDay } from "date-fns";

const connectSchema = z.object({
  deviceType: z.enum(["fitbit", "apple_health"]),
});

export const connectWearable = async (req: Request, res: Response) => {
  try {
    const patientUserId = (req as any).jwtUser?.sub;
    if (!patientUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { deviceType } = connectSchema.parse(req.body);

    const wearableRepo = storage.getWearableRepository();
    const device = await wearableRepo.upsertDevice({
      patientId: patientUserId,
      deviceType,
      accessToken: "mock_access_token_" + Math.random().toString(36).substring(7),
      refreshToken: "mock_refresh_token_" + Math.random().toString(36).substring(7),
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    });

    res.json({ message: "Device connected successfully", device });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Invalid input data", errors: error.errors });
    } else {
      res.status(500).json({ message: "Failed to connect device" });
    }
  }
};

export const getWearableStatus = async (req: Request, res: Response) => {
  try {
    const patientUserId = (req as any).jwtUser?.sub;
    if (!patientUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const wearableRepo = storage.getWearableRepository();
    const devices = await wearableRepo.getDevicesForPatient(patientUserId);

    res.json({ devices });
  } catch (error) {
    res.status(500).json({ message: "Failed to get wearable status" });
  }
};

export const syncWearableData = async (req: Request, res: Response) => {
  try {
    const patientUserId = (req as any).jwtUser?.sub;
    if (!patientUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const wearableRepo = storage.getWearableRepository();
    const devices = await wearableRepo.getDevicesForPatient(patientUserId);

    if (devices.length === 0) {
      return res.status(400).json({ message: "No wearable devices connected" });
    }

    // Mock syncing data for the last 7 days
    const today = startOfDay(new Date());
    const metricsToInsert = [];

    for (let i = 0; i < 7; i++) {
      const date = subDays(today, i);
      metricsToInsert.push({
        patientId: patientUserId,
        date: date,
        steps: Math.floor(Math.random() * (12000 - 3000 + 1)) + 3000, // 3000 to 12000 steps
        averageHeartRate: Math.floor(Math.random() * (90 - 60 + 1)) + 60, // 60 to 90 bpm
        sleepHours: Number((Math.random() * (9 - 5) + 5).toFixed(1)), // 5.0 to 9.0 hours
      });
    }

    // For mock simplicity, we just insert.
    await wearableRepo.insertMetrics(metricsToInsert);

    // Update lastSyncAt for devices
    for (const device of devices) {
      await wearableRepo.upsertDevice({
        patientId: patientUserId,
        deviceType: device.deviceType,
        accessToken: device.accessToken,
        refreshToken: device.refreshToken,
        expiresAt: device.expiresAt,
      });
    }

    res.json({ message: "Data synced successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to sync wearable data" });
  }
};

export const getWearableMetrics = async (req: Request, res: Response) => {
  try {
    const patientUserId = (req as any).jwtUser?.sub;
    if (!patientUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const wearableRepo = storage.getWearableRepository();
    const metrics = await wearableRepo.getMetrics(patientUserId, 30); // Get last 30 days

    res.json({ metrics });
  } catch (error) {
    res.status(500).json({ message: "Failed to get wearable metrics" });
  }
};
