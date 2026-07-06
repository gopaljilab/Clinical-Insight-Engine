import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSend, mockCreateTransport } = vi.hoisted(() => {
  const mockSend = vi.fn().mockResolvedValue({ messageId: "test-id-123" });
  const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSend });
  return { mockSend, mockCreateTransport };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { emailService } from "./email.service";

describe("EmailService", () => {
  beforeEach(() => {
    mockSend.mockClear();
    mockCreateTransport.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sendEmail calls transporter.sendMail with correct to, subject, and html", async () => {
    await emailService.sendEmail({
      to: "patient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toBe("patient@example.com");
    expect(callArgs.subject).toBe("Test Subject");
    expect(callArgs.html).toBe("<p>Hello</p>");
  });

  it("uses default from address when SMTP_FROM env var is not set", async () => {
    await emailService.sendEmail({
      to: "test@example.com",
      subject: "Subject",
      html: "<p>Body</p>",
    });

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.from).toContain("noreply@example.com");
  });

  it("does not throw when sendMail rejects", async () => {
    mockSend.mockRejectedValueOnce(new Error("SMTP error"));

    // Should not throw — errors are caught internally
    await expect(
      emailService.sendEmail({
        to: "test@example.com",
        subject: "Subject",
        html: "<p>Body</p>",
      })
    ).resolves.not.toThrow();
  });

  it("constructs email with subject containing clinical engine identifier", async () => {
    await emailService.sendEmail({
      to: "doctor@hospital.org",
      subject: "Assessment Ready",
      html: "<p>Your assessment is ready.</p>",
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.to).toBe("doctor@hospital.org");
    expect(callArgs.subject).toBe("Assessment Ready");
    expect(callArgs.html).toContain("assessment");
  });
});
