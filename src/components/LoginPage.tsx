import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import QRCode from 'qrcode';
import { Smartphone, ArrowRight } from 'lucide-react';
import './LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onError: (error: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const { signInWithGoogle } = useAuth();

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Generate salutation based on time
  const getSalutation = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  };

  // Get time string
  const getTimeString = () => {
    return currentTime.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Generate QR code for Google OAuth
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const googleAuthUrl = `https://accounts.google.com/oauth/authorize?client_id=${process.env.REACT_APP_GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=code&scope=openid%20email%20profile`;
        const qrUrl = await QRCode.toDataURL(googleAuthUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#ffffff',
            light: '#000000'
          }
        });
        setQrCodeUrl(qrUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };
    generateQRCode();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      onLoginSuccess();
    } catch (error: any) {
      onError(error.message || 'Google login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="background-pattern"></div>
        <div className="background-glow"></div>
      </div>
      
      <div className="login-content-horizontal">
        <div className="login-desktop-section">
          <div className="auth-card">
            <div className="auth-header">
              <div className="login-logo">
                <div className="logo-icon">📝</div>
              </div>
              <div className="salutation">
                <span className="greeting">{getSalutation()}</span>
                <span className="time">{getTimeString()}</span>
              </div>
              <h1 className="login-title">AI Question Paper Generator</h1>
              <p className="login-subtitle">Sign in to continue</p>
            </div>

            <div className="auth-buttons">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="auth-btn google-btn"
              >
                <div className="btn-content">
                  <div className="btn-icon">
                    {isLoading ? (
                      <div className="btn-loading-spinner"></div>
                    ) : (
                      <svg className="social-icon" viewBox="0 0 24 24">
                        <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    )}
                  </div>
                  <span className="btn-text">
                    {isLoading ? 'Signing in...' : 'Continue with Google'}
                  </span>
                  <ArrowRight size={16} className="btn-arrow" />
                </div>
              </button>
            </div>

            <div className="auth-footer">
              <p>Secure authentication powered by Firebase</p>
            </div>
          </div>
        </div>

        <div className="login-mobile-section">
          <div className="qr-card">
            <div className="qr-header">
              <Smartphone size={32} className="mobile-icon" />
              <h2>Scan with Phone</h2>
              <p>Use your mobile device to scan and sign in</p>
            </div>

            <div className="qr-section">
              <div className="qr-code-container">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code for Google Login" className="qr-code" />
                ) : (
                  <div className="qr-loading">
                    <div className="qr-spinner"></div>
                    <p>Generating QR Code...</p>
                  </div>
                )}
              </div>
              
              <div className="qr-instructions">
                <div className="qr-steps">
                  <div className="step">
                    <span className="step-number">1</span>
                    <span>Open camera on your phone</span>
                  </div>
                  <div className="step">
                    <span className="step-number">2</span>
                    <span>Point at the QR code</span>
                  </div>
                  <div className="step">
                    <span className="step-number">3</span>
                    <span>Tap the notification to sign in</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;