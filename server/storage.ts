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
  private modelVersionRepository = new ModelVersionRepository();
  private patientUserRepository = new PatientUserRepository();

  getAssessments(limitOrParams?: number | Parameters<AssessmentRepository["getAssessments"]>[0], cursor?: number, createdBy?: string) { return this.assessmentRepository.getAssessments(limitOrParams, cursor, createdBy); }

  async searchAssessments(searchTerm: string, createdBy?: string, riskCategory?: RiskCategory, limit?: number, cursor?: number) {
    return this.assessmentRepository.searchAssessments(searchTerm, createdBy, riskCategory, limit, cursor);
  }

  async getAssessmentById(id: number) {
    return this.assessmentRepository.getAssessmentById(id);
  }

  async createAssessment(assessment: AssessmentCreateInput) {
    return this.assessmentRepository.createAssessment(assessment);
  }

  async deleteAssessment(id: number) {
    return this.assessmentRepository.deleteAssessment(id);
  }

  async autocompletePatientNames(query: string, createdBy?: string, limit?: number) {
    return this.assessmentRepository.autocompletePatientNames(query, createdBy, limit);
  }

  async createUser(data: InsertUser) {
    return this.userRepository.createUser(data);
  }

  async getUserByEmail(email: string) {
    return this.userRepository.getUserByEmail(email);
  }

  async getUserById(id: string) {
    return this.userRepository.getUserById(id);
  }

  async getAllUsers(page: number, limit: number) {
    return this.userRepository.getAllUsers(page, limit);
  }

  async updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>) {
    return this.userRepository.updateUser(id, data);
  }

  async recordLoginAudit(params: { userId?: string; ipAddress?: string; userAgent?: string; loginStatus: string; }) {
    return this.auditRepository.recordLoginAudit(params);
  }

  async getLoginAuditLogs(page: number, limit: number) {
    return this.auditRepository.getLoginAuditLogs(page, limit);
  }

  async getSystemStats() {
    return this.analyticsRepository.getSystemStats();
  }

  async getAnalyticsStats(createdBy?: string) {
    return this.analyticsRepository.getAnalyticsStats(createdBy);
  }

  async getModelVersions(): Promise<ModelVersion[]> {
    return this.modelVersionRepository.findAll();
  }

  async getLatestModelVersion(): Promise<ModelVersion | undefined> {
    return this.modelVersionRepository.findLatest();
  }

  async createModelVersion(data: InsertModelVersion): Promise<ModelVersion> {
    return this.modelVersionRepository.create(data);
  }

  async getModelDatasetStats() {
    return this.modelVersionRepository.getDatasetStats();
  }

  async getPatientUserByEmail(email: string): Promise<PatientUser | undefined> {
    return this.patientUserRepository.findByEmail(email);
  }

  async getPatientUserByPatientName(patientName: string): Promise<PatientUser | undefined> {
    return this.patientUserRepository.findByPatientName(patientName);
  }

  async getPatientUserById(id: string): Promise<PatientUser | undefined> {
    return this.patientUserRepository.findById(id);
  }

  async createPatientUser(data: InsertPatientUser): Promise<PatientUser> {
    return this.patientUserRepository.create(data);
  }

  async getAssessmentsByPatientName(patientName: string, limit?: number, offset?: number) {
    return this.assessmentRepository.getAssessmentsByPatientName(patientName, limit, offset);
  }

  async getPatientTrends(patientName: string) {
    return this.assessmentRepository.getPatientTrends(patientName);
  }
}

export const storage = new DatabaseStorage();
