import { KeyboardEvent, useEffect, useRef, useState } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, length = 6, disabled = false }: OtpInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      const chars = value.split("").slice(0, length);
      const newOtp = [...chars, ...Array(length - chars.length).fill("")];
      setOtp(newOtp);
    } else {
      setOtp(Array(length).fill(""));
    }
  }, [value, length]);

  const focusInput = (index: number) => {
    if (index >= 0 && index < length && inputRefs.current[index]) {
      inputRefs.current[index]?.focus();
    }
  };

  const updateDigit = (index: number, digit: string) => {
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    onChange(newOtp.join(""));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    updateDigit(index, val);

    if (val && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, length);
    if (!pastedData) return;

    const chars = pastedData.split("");
    const newOtp = [...chars, ...Array(length - chars.length).fill("")];
    setOtp(newOtp);
    onChange(newOtp.join(""));

    const nextIndex = Math.min(chars.length, length - 1);
    focusInput(nextIndex);
  };

  return (
    <div className="flex justify-between gap-2" dir="ltr">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className="h-12 w-12 rounded-lg border border-slate-300 bg-white text-center text-xl font-semibold text-slate-900 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800 sm:h-14 sm:w-14 sm:text-2xl"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
