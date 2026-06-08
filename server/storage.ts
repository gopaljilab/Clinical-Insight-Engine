import { loginAuditLogs, type Assessment, type InsertAssessment, type AssessmentFactor, type User, type InsertUser } from "@shared/schema";
import type { RiskCategory } from "./validation/searchValidation";

import { UserRepository } from "./repositories/user.repository";
import { AssessmentRepository } from "./repositories/assessment.repository";
import { AuditRepository } from "./repositories/audit.repository";
import { AnalyticsRepository } from "./repositories/analytics.repository";

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
  
  async getSystemStats() { 
    return this.analyticsRepository.getSystemStats(); 
  }
  
  async recordLoginAudit(params: { userId?: string; ipAddress?: string; userAgent?: string; loginStatus: string; }) { 
    return this.auditRepository.recordLoginAudit(params); 
  }
  
  async getLoginAuditLogs(page: number, limit: number) { 
    return this.auditRepository.getLoginAuditLogs(page, limit); 
  }
  
  async getAnalyticsStats(createdBy?: string) { 
    return this.analyticsRepository.getAnalyticsStats(createdBy); 
  }
}

export const storage = new DatabaseStorage();
