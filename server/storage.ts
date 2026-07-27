import { loginAuditLogs, patientAccessAuditLogs, type Assessment, type InsertAssessment, type AssessmentFactor, type User, type InsertUser, type ModelVersion, type InsertModelVersion, type InsertPatientUser, type PatientUser, type AssessmentNote, type InsertAssessmentNote } from "@shared/schema";
import { assessments, users } from "@shared/schema";

import { getDb } from "./db";
import { eq, desc, and, or, ilike } from "drizzle-orm";
import type { RiskCategory } from "./validation/searchValidation";

import { UserRepository } from "./repositories/user.repository";
import { AssessmentRepository } from "./repositories/assessment.repository";
import { AuditRepository, type AuditLogFilters } from "./repositories/audit.repository";
import { AnalyticsRepository } from "./repositories/analytics.repository";
import { ModelVersionRepository } from "./repositories/model-version.repository";
import { PatientUserRepository } from "./repositories/patient-user.repository";
import { PatientAuthRepository, type VerifyOutcome } from "./repositories/patient-auth.repository";

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
  getAssessmentById(id: number, createdBy?: string): Promise<Assessment | undefined>;
  createAssessment(assessment: any): Promise<Assessment>;
  updateClinicalNote(id: number, clinicalNote: string): Promise<Assessment | undefined>;
  deleteAssessment(id: number): Promise<void>;
  autocompletePatientNames(query: string, createdBy?: string, limit?: number): Promise<string[]>;
  createUser(data: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(page: number, limit: number): Promise<{ data: User[]; total: number }>;
  getLoginAuditLogs(page: number, limit: number, filters?: AuditLogFilters): Promise<{ data: typeof loginAuditLogs.$inferSelect[]; total: number }>;
  updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>): Promise<User>;
  getSystemStats(): Promise<{ totalUsers: number; totalAssessments: number; riskDistribution: { category: string; count: number }[]; }>;
  recordLoginAudit(params: { userId?: string; ipAddress?: string; userAgent?: string; loginStatus: string; }): Promise<void>;
  recordPatientAccess(params: { userId: string; resourceType: string; resourceId?: string; action: string; ipAddress?: string; userAgent?: string; granted: boolean; }): Promise<void>;
  getPatientAccessAuditLogs(page: number, limit: number): Promise<{ data: typeof patientAccessAuditLogs.$inferSelect[]; total: number }>;
  getAnalyticsStats(createdBy?: string): Promise<any>;
  getCohortStats(params: {
    minAge?: number; maxAge?: number;
    minBmi?: number; maxBmi?: number;
    minHba1c?: number; maxHba1c?: number;
    minGlucose?: number; maxGlucose?: number;
    gender?: string; smokingHistory?: string;
    hypertension?: boolean; heartDisease?: boolean;
    riskCategory?: string;
    startDate?: string; endDate?: string;
    createdBy?: string;
  }): Promise<{
    total: number;
    avgRiskScore: number | null;
    avgBmi: number | null;
    avgHba1c: number | null;
    avgGlucose: number | null;
    riskDistribution: { category: string; count: number }[];
    ageDistribution: { range: string; count: number }[];
    genderDistribution: { gender: string; count: number }[];
    smokingDistribution: { status: string; count: number }[];
    comorbidityRate: number;
  }>;
  getModelVersions(): Promise<ModelVersion[]>;
  getLatestModelVersion(): Promise<ModelVersion | undefined>;
  createModelVersion(data: InsertModelVersion): Promise<ModelVersion>;
  getModelDatasetStats(): Promise<{ classBalance: Record<string, number>; featureStats: Record<string, { mean: number; std: number }>; totalSamples: number } | null>;
  getPatientUserByEmail(email: string): Promise<PatientUser | undefined>;
  getPatientUserByPatientName(patientName: string): Promise<PatientUser | undefined>;
  getPatientUserById(id: string): Promise<PatientUser | undefined>;
  createPatientUser(data: InsertPatientUser): Promise<PatientUser>;
  updatePatientEmailVerified(id: string, verified: boolean): Promise<PatientUser>;
  createPatientOtp(patientUserId: string, otp: string, expiresAt: Date): Promise<void>;
  replacePatientOtp(patientUserId: string, otp: string, expiresAt: Date): Promise<void>;
  verifyPatientOtpAndSetVerified(patientUser: PatientUser, code: string): Promise<VerifyOutcome>;
  getAssessmentsByPatientName(patientName: string, limit?: number, offset?: number, createdBy?: string, startDate?: string, endDate?: string): Promise<{ data: Assessment[]; total: number }>;
  getPatientTrends(patientName: string, createdBy?: string): Promise<{ date: string; riskScore: number; riskCategory: string }[]>;
  getTrendsDashboardData(patientName: string, startDate?: string, endDate?: string): Promise<{
    assessments: any[];
    summary: { total: number; latestRiskScore: number | null; latestRiskCategory: string | null; earliestRiskScore: number | null; trend: string; avgRiskScore: number; change: number };
  }>;
  createAssessmentsBatch(data: AssessmentCreateInput[]): Promise<Assessment[]>;
  getAssessmentNotes(assessmentId: number): Promise<(AssessmentNote & { user: { fullName: string } })[]>;
  addAssessmentNote(note: InsertAssessmentNote): Promise<AssessmentNote & { user: { fullName: string } }>;
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
  private patientAuthRepository = new PatientAuthRepository();

  async getAssessments(limitOrParams?: number | {
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
    createdBy?: string,
  ) {
    if (typeof limitOrParams === "number") {
      return this.assessmentRepository.getAssessments({
        limit: limitOrParams,
        cursor,
        createdBy,
      });
    }

    return this.assessmentRepository.getAssessments({
      ...(limitOrParams ?? {}),
      cursor: limitOrParams?.cursor ?? cursor,
      createdBy: limitOrParams?.createdBy ?? createdBy,
    });
  }

  async searchAssessments(
    searchTerm: string,
    createdBy?: string,
    riskCategory?: RiskCategory,
    limit: number = 20,
    cursor?: number
  ) {
    return this.assessmentRepository.searchAssessments(searchTerm, createdBy, riskCategory, limit, cursor);
  }
  
  async getAssessmentById(id: number, createdBy?: string) { 
    return this.assessmentRepository.getAssessmentById(id, createdBy); 
  }

  async createAssessment(assessment: any) {
    return this.assessmentRepository.createAssessment(assessment);
  }

  async updateClinicalNote(id: number, clinicalNote: string) {
    return this.assessmentRepository.updateClinicalNote(id, clinicalNote);
  }

  async deleteAssessment(id: number) {
    return this.assessmentRepository.deleteAssessment(id);
  }

  async createAssessmentsBatch(data: AssessmentCreateInput[]) {
    return this.assessmentRepository.createAssessmentsBatch(data);
  }

  async getAssessmentNotes(assessmentId: number) {
    return this.assessmentRepository.getNotes(assessmentId);
  }

  async addAssessmentNote(note: InsertAssessmentNote) {
    return this.assessmentRepository.addNote(note);
  }

  async autocompletePatientNames(query: string, createdBy?: string, limit?: number) {
    return this.assessmentRepository.autocompletePatientNames(query, createdBy, limit);
  }


  async createUser(data: InsertUser): Promise<User> {
    return this.userRepository.createUser(data);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.userRepository.getUserByEmail(email);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.userRepository.getUserById(id);
  }


  async getAllUsers(page: number, limit: number): Promise<{ data: User[]; total: number }> {
    return this.userRepository.getAllUsers(page, limit);
  }

  async updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>): Promise<User> {
    return this.userRepository.updateUser(id, data);
  }

  async getLoginAuditLogs(page: number, limit: number, filters?: AuditLogFilters) {
    return this.auditRepository.getLoginAuditLogs(page, limit, filters);
  }

  async recordLoginAudit(params: { userId?: string; ipAddress?: string; userAgent?: string; loginStatus: string; }): Promise<void> {
    return this.auditRepository.recordLoginAudit(params);
  }

  async getSystemStats(): Promise<{ totalUsers: number; totalAssessments: number; riskDistribution: { category: string; count: number }[]; }> {
    return this.analyticsRepository.getSystemStats();
  }

  async getAnalyticsStats(createdBy?: string): Promise<any> {
    return this.analyticsRepository.getAnalyticsStats(createdBy);
  }

  async getCohortStats(params: {
    minAge?: number; maxAge?: number;
    minBmi?: number; maxBmi?: number;
    minHba1c?: number; maxHba1c?: number;
    minGlucose?: number; maxGlucose?: number;
    gender?: string; smokingHistory?: string;
    hypertension?: boolean; heartDisease?: boolean;
    riskCategory?: string;
    startDate?: string; endDate?: string;
    createdBy?: string;
  }) {
    return this.assessmentRepository.getCohortStats(params);
  }

  async recordPatientAccess(params: { userId: string; resourceType: string; resourceId?: string; action: string; ipAddress?: string; userAgent?: string; granted: boolean; }): Promise<void> {
    return this.auditRepository.recordPatientAccess(params);
  }

  async getPatientAccessAuditLogs(page: number, limit: number) {
    return this.auditRepository.getPatientAccessAuditLogs(page, limit);
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

  async updatePatientEmailVerified(id: string, verified: boolean): Promise<PatientUser> {
    return this.patientUserRepository.updateEmailVerified(id, verified);
  }

  async createPatientOtp(patientUserId: string, otp: string, expiresAt: Date): Promise<void> {
    return this.patientAuthRepository.createPatientOtp(patientUserId, otp, expiresAt);
  }

  async replacePatientOtp(patientUserId: string, otp: string, expiresAt: Date): Promise<void> {
    return this.patientAuthRepository.replacePatientOtp(patientUserId, otp, expiresAt);
  }

  async verifyPatientOtpAndSetVerified(patientUser: PatientUser, code: string): Promise<VerifyOutcome> {
    return this.patientAuthRepository.verifyPatientOtpAndSetVerified(patientUser, code);
  }

  async getAssessmentsByPatientName(patientName: string, limit?: number, offset?: number, createdBy?: string, startDate?: string, endDate?: string) {
    return this.assessmentRepository.getAssessmentsByPatientName(patientName, limit, offset, createdBy, startDate, endDate);
  }

  async getPatientTrends(patientName: string, createdBy?: string) {
    return this.assessmentRepository.getPatientTrends(patientName, createdBy);
  }

  async getTrendsDashboardData(patientName: string, startDate?: string, endDate?: string) {
    return this.assessmentRepository.getTrendsDashboardData(patientName, startDate, endDate);
  }
}


export const storage = new DatabaseStorage();
