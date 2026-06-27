import { describe, expect, it } from "vitest";
import { detectSqlInjectionPattern } from "./searchValidation";

describe("detectSqlInjectionPattern", () => {
  describe("OR and AND boolean-based injection", () => {
    it("detects OR 1=1 pattern", () => {
      expect(detectSqlInjectionPattern("' OR '1'='1")).not.toBeNull();
      expect(detectSqlInjectionPattern("admin' OR '1'='1")).not.toBeNull();
    });

    it("detects OR 1=1 numeric pattern", () => {
      expect(detectSqlInjectionPattern("1 OR 1=1")).not.toBeNull();
      expect(detectSqlInjectionPattern("id=5 OR 2=2")).not.toBeNull();
    });

    it("detects AND '1'='1 pattern", () => {
      expect(detectSqlInjectionPattern("' AND '1'='1")).not.toBeNull();
    });

    it("detects AND 1=1 numeric pattern", () => {
      expect(detectSqlInjectionPattern("1 AND 1=1")).not.toBeNull();
    });

    it("detects single-quote OR pattern", () => {
      expect(detectSqlInjectionPattern("' OR 'x'='x")).not.toBeNull();
    });
  });

  describe("UNION SELECT injection", () => {
    it("detects UNION SELECT", () => {
      expect(detectSqlInjectionPattern("1 UNION SELECT null")).not.toBeNull();
      expect(detectSqlInjectionPattern("1 UNION ALL SELECT username,password FROM users")).not.toBeNull();
    });

    it("detects union select case-insensitively", () => {
      expect(detectSqlInjectionPattern("1 union select * from users")).not.toBeNull();
      expect(detectSqlInjectionPattern("1 UnIoN SeLeCt 1,2,3")).not.toBeNull();
    });
  });

  describe("DDL and DML statements", () => {
    it("detects DROP TABLE", () => {
      expect(detectSqlInjectionPattern("1; DROP TABLE users")).not.toBeNull();
    });

    it("detects DELETE", () => {
      expect(detectSqlInjectionPattern("1; DELETE FROM patients")).not.toBeNull();
    });

    it("detects INSERT", () => {
      expect(detectSqlInjectionPattern("1; INSERT INTO admin VALUES('hacker','pass')")).not.toBeNull();
    });

    it("detects UPDATE", () => {
      expect(detectSqlInjectionPattern("1; UPDATE patients SET risk='HIGH'")).not.toBeNull();
    });

    it("detects ALTER", () => {
      expect(detectSqlInjectionPattern("1; ALTER TABLE users ADD COLUMN hack TEXT")).not.toBeNull();
    });

    it("detects TRUNCATE", () => {
      expect(detectSqlInjectionPattern("1; TRUNCATE TABLE audit_log")).not.toBeNull();
    });
  });

  describe("SQL comment injection", () => {
    it("detects double-dash comment", () => {
      expect(detectSqlInjectionPattern("admin'--")).not.toBeNull();
      expect(detectSqlInjectionPattern("name' -- ")).not.toBeNull();
    });

    it("detects block comment injection", () => {
      expect(detectSqlInjectionPattern("1/* comment */UNION SELECT")).not.toBeNull();
      expect(detectSqlInjectionPattern("1/**/DROP/**/TABLE")).not.toBeNull();
    });
  });

  describe("Stored procedure injection", () => {
    it("detects EXEC()", () => {
      expect(detectSqlInjectionPattern("1; EXEC(sp_executesql)")).not.toBeNull();
      expect(detectSqlInjectionPattern("1; exec(@cmd)")).not.toBeNull();
    });

    it("detects xp_ stored procedures", () => {
      expect(detectSqlInjectionPattern("1; xp_cmdshell 'dir'")).not.toBeNull();
      expect(detectSqlInjectionPattern("1; xp_dirtree")).not.toBeNull();
      expect(detectSqlInjectionPattern("1; XP_FILEEXIST")).not.toBeNull();
    });
  });

  describe("Schema enumeration", () => {
    it("detects INFORMATION_SCHEMA", () => {
      expect(detectSqlInjectionPattern("1 UNION SELECT table_name FROM information_schema.tables")).not.toBeNull();
    });

    it("detects SYS tables", () => {
      expect(detectSqlInjectionPattern("1; SELECT * FROM sys.tables")).not.toBeNull();
      expect(detectSqlInjectionPattern("1; SELECT name FROM sys.columns")).not.toBeNull();
      expect(detectSqlInjectionPattern("1; SELECT * FROM sys.objects")).not.toBeNull();
    });
  });

  describe("Time-based blind injection", () => {
    it("detects SLEEP()", () => {
      expect(detectSqlInjectionPattern("1; SELECT SLEEP(5)")).not.toBeNull();
      expect(detectSqlInjectionPattern("1 AND SLEEP(3)")).not.toBeNull();
    });

    it("detects WAITFOR DELAY", () => {
      expect(detectSqlInjectionPattern("1; WAITFOR DELAY '0:0:5'")).not.toBeNull();
    });

    it("detects BENCHMARK", () => {
      expect(detectSqlInjectionPattern("1; BENCHMARK(1000000,SHA1('test'))")).not.toBeNull();
    });
  });

  describe("File operations", () => {
    it("detects LOAD_FILE", () => {
      expect(detectSqlInjectionPattern("1; LOAD_FILE('/etc/passwd')")).not.toBeNull();
    });

    it("detects INTO OUTFILE", () => {
      expect(detectSqlInjectionPattern("1; SELECT * FROM users INTO OUTFILE '/tmp/dump.txt'")).not.toBeNull();
    });
  });

  describe("safe queries", () => {
    it("returns null for normal patient name searches", () => {
      expect(detectSqlInjectionPattern("John Smith")).toBeNull();
      expect(detectSqlInjectionPattern("Alice O'Brien")).toBeNull();
    });

    it("returns null for normal query strings", () => {
      expect(detectSqlInjectionPattern("diabetes risk assessment")).toBeNull();
      expect(detectSqlInjectionPattern("age > 40")).toBeNull();
    });

    it("returns null for alphanumeric codes", () => {
      expect(detectSqlInjectionPattern("P12345")).toBeNull();
      expect(detectSqlInjectionPattern("A1B2C3")).toBeNull();
    });

    it("returns null for numeric identifiers", () => {
      expect(detectSqlInjectionPattern("42")).toBeNull();
      expect(detectSqlInjectionPattern("100")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(detectSqlInjectionPattern("")).toBeNull();
    });

    it("returns null for whitespace-only input", () => {
      expect(detectSqlInjectionPattern("   ")).toBeNull();
      expect(detectSqlInjectionPattern("\t\n")).toBeNull();
    });

    it("returns null for common medical terms", () => {
      expect(detectSqlInjectionPattern("blood glucose level")).toBeNull();
      expect(detectSqlInjectionPattern("HbA1c test")).toBeNull();
      expect(detectSqlInjectionPattern("BMI calculation")).toBeNull();
    });
  });
});
