import { loginAuditLogs, type Assessment, type InsertAssessment, type AssessmentFactor, type User, type InsertUser, type ModelVersion, type InsertModelVersion, type InsertPatientUser, type PatientUser } from "@shared/schema";
import { assessments, users } from "@shared/schema";
import { getDb } from "./db";
import { eq, desc, and, or, ilike } from "drizzle-orm";
import type { RiskCategory } from "./validation/searchValidation";

import { UserRepository } from "./repositories/user.repository";
import { AssessmentRepository } from "./repositories/assessment.repository";
import { AuditRepository } from "./repositories/audit.repository";
import { AnalyticsRepository } from "./repositories/analytics.repository";
import { ModelVersionRepository } from "./repositories/model-version.repository";
import { PatientUserRepository } from "./repositories/patient-user.repository";

export interface IStorage {
  getAssessments(
    limitOrParams?: number | {
      limit?: number;
      page?: number;
      cursor?: number;
      createdBy?: string;
      sortBy?: string;
      order?: "asc" | "desc";
      searchTerm?: string;
      riskCategory?: string;
      gender?: string;
      minAge?: number;
      maxAge?: number;
      startDate?: string;
      endDate?: string;
    },
    cursor?: number,
    createdBy?: string
  ): Promise<{
    data: Assessment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    nextCursor: number | null;
  }>;
  searchAssessments(
    searchTerm: string,
    createdBy?: string,
    riskCategory?: RiskCategory,
    limit?: number,
    cursor?: number
  ): Promise<{ data: Assessment[]; nextCursor: number | null }>;
  getAssessmentById(id: number): Promise<Assessment | undefined>;
  createAssessment(assessment: any): Promise<Assessment>;
  deleteAssessment(id: number): Promise<void>;
  autocompletePatientNames(query: string, createdBy?: string, limit?: number): Promise<string[]>;
  createUser(data: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(page: number, limit: number): Promise<{ data: User[]; total: number }>;
  getLoginAuditLogs(page: number, limit: number): Promise<{ data: typeof loginAuditLogs.$inferSelect[]; total: number }>;
  updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>): Promise<User>;
  getSystemStats(): Promise<{ totalUsers: number; totalAssessments: number; riskDistribution: { category: string; count: number }[]; }>;
  recordLoginAudit(params: { userId?: string; ipAddress?: string; userAgent?: string; loginStatus: string; }): Promise<void>;
  getAnalyticsStats(createdBy?: string): Promise<any>;
  getModelVersions(): Promise<ModelVersion[]>;
  getLatestModelVersion(): Promise<ModelVersion | undefined>;
  createModelVersion(data: InsertModelVersion): Promise<ModelVersion>;
  getModelDatasetStats(): Promise<{ classBalance: Record<string, number>; featureStats: Record<string, { mean: number; std: number }>; totalSamples: number } | null>;
  getPatientUserByEmail(email: string): Promise<PatientUser | undefined>;
  getPatientUserByPatientName(patientName: string): Promise<PatientUser | undefined>;
  getPatientUserById(id: string): Promise<PatientUser | undefined>;
  createPatientUser(data: InsertPatientUser): Promise<PatientUser>;
  getAssessmentsByPatientName(patientName: string, limit?: number, offset?: number): Promise<{ data: Assessment[]; total: number }>;
  getPatientTrends(patientName: string): Promise<{ date: string; riskScore: number; riskCategory: string }[]>;
}

export type AssessmentCreateInput = InsertAssessment & {
  riskScore: number;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string;
  modelConfidence?: number;
  createdBy: string;
};

export class DatabaseStorage implements IStorage {
  private assessmentRepository = new AssessmentRepository();
  private userRepository = new UserRepository();
  private auditRepository = new AuditRepository();
  private analyticsRepository = new AnalyticsRepository();

  async updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>): Promise<User> {
    return this.userRepo.updateUser(id, data);
  }

  async getLoginAuditLogs(page: number, limit: number): Promise<{ data: typeof loginAuditLogs.$inferSelect[]; total: number }> {
    return this.auditRepo.getLoginAuditLogs(page, limit);
  }

  async recordLoginAudit(params: { userId?: string; ipAddress?: string; userAgent?: string; loginStatus: string; }): Promise<void> {
    return this.auditRepo.recordLoginAudit(params);
  }

  async getSystemStats(): Promise<{ totalUsers: number; totalAssessments: number; riskDistribution: { category: string; count: number }[]; }> {
    return this.analyticsRepo.getSystemStats();
  }

  async getAnalyticsStats(createdBy?: string): Promise<any> {
    return this.analyticsRepo.getAnalyticsStats(createdBy);
  }

  async getModelVersions(): Promise<ModelVersion[]> {
    return this.modelVersionRepo.findAll();
  }

  async getLatestModelVersion(): Promise<ModelVersion | undefined> {
    return this.modelVersionRepo.findLatest();
  }

  async createModelVersion(data: InsertModelVersion): Promise<ModelVersion> {
    return this.modelVersionRepo.create(data);
  }

  async getModelDatasetStats(): Promise<{ classBalance: Record<string, number>; featureStats: Record<string, { mean: number; std: number }>; totalSamples: number } | null> {
    return this.modelVersionRepo.getDatasetStats();
  }

  async getPatientUserByEmail(email: string): Promise<PatientUser | undefined> {
    return this.patientUserRepo.findByEmail(email);
  }

  async getPatientUserByPatientName(patientName: string): Promise<PatientUser | undefined> {
    return this.patientUserRepo.findByPatientName(patientName);
  }

  async getPatientUserById(id: string): Promise<PatientUser | undefined> {
    return this.patientUserRepo.findById(id);
  }

  async createPatientUser(data: InsertPatientUser): Promise<PatientUser> {
    return this.patientUserRepo.create(data);
  }

  async getAssessmentsByPatientName(patientName: string, limit: number = 20, offset: number = 0): Promise<{ data: Assessment[]; total: number }> {
    return this.assessmentRepo.getAssessmentsByPatientName(patientName, limit, offset);
  }

  async getPatientTrends(patientName: string): Promise<{ date: string; riskScore: number; riskCategory: string }[]> {
    return this.assessmentRepo.getPatientTrends(patientName);
  }
}

export const storage = new DatabaseStorage();
