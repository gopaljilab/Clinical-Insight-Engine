import React, { useState } from 'react';
import { ApiClient } from '../utils/api-client'; // Using the central configured API utility

interface AuthFlowProps {
  email: string;
}

/**
 * AuthFlow Component managing authentication registration and verification loops.
 * Refactored to utilize ApiClient for OTP resend triggers, preventing multi-origin network drops.
 */
export const AuthFlow: React.FC<AuthFlowProps> = ({ email }) => {
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');

  const handleResendOtp = async () => {
    if (!email) return;
    
    setResending(true);
    setMessage('');
    
    try {
      // ApiClient naturally prefixes VITE_API_BASE and satisfies cross-origin pipeline configurations
      const response = await ApiClient.post<{ success: boolean; message?: string }>('/auth/resend-otp', {
        email
      });

      if (response.data && response.data.success) {
        setMessage('A fresh verification token has been routed to your inbox.');
      } else {
        setMessage(response.data.message || 'Verification token transmission rejected by identity gateway.');
      }
    } catch (err: any) {
      setMessage(err.message || 'Network infrastructure exception encountered during OTP transmission.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-flow-container">
      <h2>Verify Your Clinical Identity</h2>
      <p>An authentication credential frame has been dispatched to {email}.</p>
      
      <div className="action-row">
        <button 
          onClick={handleResendOtp} 
          disabled={resending}
          className="resend-action-btn"
        >
          {resending ? 'Transmitting Token...' : 'Resend OTP Token'}
        </button>
      </div>

      {message && <div className="status-feedback-msg">{message}</div>}
    </div>
  );
};

export default AuthFlow;
