import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import GradientButton from "@/components/GradientButton";
import BackButton from "@/components/BackButton";
import FormInput from "@/components/FormInput";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const OTPVerification = () => {
  const navigate = useNavigate();
  const { pendingEmail, setPendingEmail } = useAuth();
  const { toast } = useToast();
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendCount, setResendCount] = useState(3);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter all 6 digits",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/otp/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, otp: fullOtp }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Verification failed");
      }

      toast({ title: "Success", description: "Email Verified successfully!" });
      navigate("/success");
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleResend = async () => {
    if (resendCount <= 0) {
      toast({
        title: "Max attempts reached",
        description: "Please try again later",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/otp/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });

      if (!response.ok) throw new Error();

      setResendCount(resendCount - 1);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      
      toast({
        title: "OTP Resent",
        description: "A new verification code has been sent to your email",
      });
    } catch (err) {
      toast({ title: "Error", description: "Failed to resend OTP", variant: "destructive" });
    }
  };

  const handleChangeEmail = () => {
    setShowChangeEmail(true);
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/otp/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });

      if (!response.ok) throw new Error();

      setPendingEmail(newEmail);
      setNewEmail("");
      setShowChangeEmail(false);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();

      toast({
        title: "Email Updated",
        description: `Verification code sent to ${newEmail}`,
      });
    } catch (err) {
      toast({ title: "Error", description: "Failed to send code to new email", variant: "destructive" });
    }
  };

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen px-8 py-6">
        <BackButton />
        
        <div className="flex-1 pt-8">
          {!showChangeEmail ? (
            <>
              <h1 className="text-2xl font-bold text-foreground text-center mb-4">
                Verification Code
              </h1>
              <p className="text-muted-foreground text-center mb-8">
                We have sent the verification code<br />to your Email address
              </p>

              <div className="flex justify-center gap-4 mb-8">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-16 h-16 text-center text-2xl font-semibold bg-background border-2 border-muted rounded-2xl focus:border-primary focus:outline-none transition-colors"
                  />
                ))}
              </div>

              <GradientButton onClick={handleVerify}>
                Verify
              </GradientButton>

              <p className="text-center text-muted-foreground mt-6">
                Didn't receive code?{" "}
                <button 
                  onClick={handleResend}
                  className="text-foreground font-medium hover:underline"
                  disabled={resendCount <= 0}
                >
                  Resend({resendCount} left)
                </button>
              </p>

            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground text-center mb-4">
                Change Email Address
              </h1>
              <p className="text-muted-foreground text-center mb-8">
                Enter your new email address
              </p>

              <div className="mb-6">
                <FormInput
                  placeholder="Enter new email address"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <GradientButton onClick={handleUpdateEmail}>
                  Update Email
                </GradientButton>
                <button
                  onClick={() => {
                    setShowChangeEmail(false);
                    setNewEmail("");
                  }}
                  className="w-full py-3 px-4 border-2 border-foreground/20 rounded-full text-foreground font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>

        {!showChangeEmail && (
          <button 
            onClick={handleChangeEmail}
            className="text-center text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            Change email address
          </button>
        )}
      </div>
    </MobileLayout>
  );
};

export default OTPVerification;
