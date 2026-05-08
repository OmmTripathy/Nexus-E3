import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import MobileLayout from "@/components/MobileLayout";
import FormInput from "@/components/FormInput";
import GradientButton from "@/components/GradientButton";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

const SetPassword = () => {
  const navigate = useNavigate();
  const { pendingUserData, pendingEmail, pendingRole } = useAuth();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: { newPassword?: string; confirmPassword?: string } = {};

    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        newErrors.newPassword = err.errors[0]?.message;
      }
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
  if (!validateForm()) return;

  setIsLoading(true);

  try {
    const response = await fetch(`${BACKEND_URL}/user/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email: pendingEmail,
        password: newPassword,
        role: pendingRole,
        fullName: pendingUserData.fullName,
        yearBatch: pendingUserData.yearBatch,
        routeNo: pendingUserData.routeNo,
        timing: pendingUserData.timing,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || "Signup failed");
    }

    await fetch(`${BACKEND_URL}/api/otp/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingEmail }),
    });

    toast({
      title: "Account Created",
      description: "Proceeding to verification",
    });

    navigate("/otp-verification");

  } catch (err: any) {
    toast({
      title: "Signup Failed",
      description: err.message || "Please try again",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
};

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen px-8 py-6">
        <BackButton />
        
        <div className="flex-1 pt-8">
          <h1 className="text-3xl font-bold text-foreground text-center mb-2">
            Set Password
          </h1>
          <p className="text-muted-foreground text-center mb-12">
            Welcome !
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">New Password</label>
              <FormInput
                type="password"
                placeholder="••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                showPasswordToggle
                showLockIcon
                error={errors.newPassword}
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Confirm Password</label>
              <FormInput
                type="password"
                placeholder="••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                showPasswordToggle
                showLockIcon
                error={errors.confirmPassword}
              />
            </div>
          </div>

          <div className="mt-12">
            <GradientButton onClick={handleSignUp} disabled={isLoading}>
              {isLoading ? "Sending..." : "Sign Up"}
            </GradientButton>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default SetPassword;
