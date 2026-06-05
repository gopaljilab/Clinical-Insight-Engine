import { loginAuditLogs, type Assessment, type InsertAssessment, type AssessmentFactor, type User, type InsertUser } from "@shared/schema";
import type { RiskCategory } from "./validation/searchValidation";

import { UserRepository } from "./repositories/user.repository";
import { AssessmentRepository } from "./repositories/assessment.repository";
import { AuditRepository } from "./repositories/audit.repository";
import { AnalyticsRepository } from "./repositories/analytics.repository";

export interface IStorage {
  getAssessments(limit?: number, cursor?: number, createdBy?: string): Promise<{ data: Assessment[]; nextCursor: number | null }>;
  searchAssessments(searchTerm: string, createdBy?: string, riskCategory?: RiskCategory, limit?: number, cursor?: number): Promise<{ data: Assessment[]; nextCursor: number | null }>;
  getAssessmentById(id: number): Promise<Assessment | undefined>;
  createAssessment(assessment: any): Promise<Assessment>;
  createUser(data: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(page: number, limit: number): Promise<{ data: User[]; total: number }>;
  getLoginAuditLogs(page: number, limit: number): Promise<{ data: typeof loginAuditLogs.$inferSelect[]; total: number }>;
  updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>): Promise<User>;
  getSystemStats(): Promise<{ totalUsers: number; totalAssessments: number; riskDistribution: { category: string; count: number }[]; }>;
  recordLoginAudit(params: { userId?: string; ipAddress?: string; userAgent?: string; loginStatus: string; }): Promise<void>;
  getAnalyticsStats(createdBy?: string): Promise<any>;
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
  private userRepository: UserRepository;
  private assessmentRepository: AssessmentRepository;
  private auditRepository: AuditRepository;
  private analyticsRepository: AnalyticsRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.assessmentRepository = new AssessmentRepository();
    this.auditRepository = new AuditRepository();
    this.analyticsRepository = new AnalyticsRepository();
  }

  getAssessments(limit?: number, cursor?: number, createdBy?: string) { return this.assessmentRepository.getAssessments(limit, cursor, createdBy); }
  searchAssessments(searchTerm: string, createdBy?: string, riskCategory?: RiskCategory, limit?: number, cursor?: number) { return this.assessmentRepository.searchAssessments(searchTerm, createdBy, riskCategory, limit, cursor); }
  getAssessmentById(id: number) { return this.assessmentRepository.getAssessmentById(id); }
  createAssessment(assessment: any) { return this.assessmentRepository.createAssessment(assessment); }
  
  createUser(data: InsertUser) { return this.userRepository.createUser(data); }
  getUserByEmail(email: string) { return this.userRepository.getUserByEmail(email); }
  getUserById(id: string) { return this.userRepository.getUserById(id); }
  getAllUsers(page: number, limit: number) { return this.userRepository.getAllUsers(page, limit); }
  updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>) { return this.userRepository.updateUser(id, data); }

  getLoginAuditLogs(page: number, limit: number) { return this.auditRepository.getLoginAuditLogs(page, limit); }
  recordLoginAudit(params: any) { return this.auditRepository.recordLoginAudit(params); }

  getSystemStats() { return this.analyticsRepository.getSystemStats(); }
  getAnalyticsStats(createdBy?: string) { return this.analyticsRepository.getAnalyticsStats(createdBy); }
}

export const storage = new DatabaseStorage();
