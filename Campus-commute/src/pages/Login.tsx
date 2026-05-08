import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { Apple } from "lucide-react";
import MobileLayout from "@/components/MobileLayout";
import FormInput from "@/components/FormInput";
import GradientButton from "@/components/GradientButton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useGoogleLogin } from "@react-oauth/google";

const emailSchema = z.string().email("Invalid email address").refine((email) => {
  const domain = email.split("@")[1];
  return (
    domain?.endsWith("gmail.com") ||
    domain?.endsWith(".ac.in") ||
    domain?.endsWith(".edu")
  );
}, "Only gmail.com, .ac.in, or .edu emails allowed");

const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

const Login = () => {
  const navigate = useNavigate();
  const { login, pendingRole } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  // ✅ FIXED: Normal Login Function
  const handleLogin = async () => {
    setIsLoading(true);

    try {
      const emailResult = emailSchema.safeParse(email);
      const passwordResult = passwordSchema.safeParse(password);

      if (!emailResult.success || !passwordResult.success) {
        setErrors({
          email: emailResult.success ? undefined : emailResult.error.errors[0].message,
          password: passwordResult.success
            ? undefined
            : passwordResult.error.errors[0].message,
        });
        return;
      }

      const success = await login(email, password, pendingRole || "student");

      if (success) {
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });

        navigate(pendingRole === "driver" ? "/driver-home" : "/home");
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Google OAuth ---
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      try {
        toast({
          title: "Google Auth Success",
          description: "Fetching your profile details...",
        });

        const userInfoRes = await fetch(
          `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${tokenResponse.access_token}`,
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
              Accept: "application/json",
            },
          }
        );

        if (!userInfoRes.ok) throw new Error("Failed to fetch Google profile");

        const googleUser = await userInfoRes.json();
        const socialEmail = googleUser.email;
        const socialName = googleUser.name || "Google User";
        const role = pendingRole || "student";
        const socialPassword = "OAuthGeneratedPassword!123";

        const registeredAccounts = JSON.parse(
          localStorage.getItem("campus-commute-accounts") || "[]"
        );

        let account = registeredAccounts.find(
          (acc: any) => acc.email === socialEmail && acc.role === role
        );

        if (!account) {
          const newAccount = {
            email: socialEmail,
            password: socialPassword,
            role,
            fullName: socialName,
            routeNo: role === "driver" ? "CUTTACK-1-A" : undefined,
            profileImage: googleUser.picture,
          };
          registeredAccounts.push(newAccount);
          localStorage.setItem(
            "campus-commute-accounts",
            JSON.stringify(registeredAccounts)
          );
        }

        localStorage.setItem(
  "google-user",
  JSON.stringify({
    email: socialEmail,
    fullName: socialName,
    role,
    profileImage: googleUser.picture,
  })
);

toast({
  title: `Welcome, ${socialName}!`,
  description: "Successfully authenticated with Google",
});

navigate(role === "driver" ? "/driver-home" : "/home");
      } catch (err) {
        console.error(err);
        toast({
          title: "Setup Incomplete",
          description: err?.message || "Unknown Google login error",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      toast({
        title: "Login Failed",
        description: "Google login failed.",
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  const handleSocialLogin = (provider: string) => {
    if (provider === "Google") {
      handleGoogleLogin();
    } else {
      toast({
        title: `${provider} Login`,
        description: "Apple login not implemented.",
      });
    }
  };

  return (
    <MobileLayout>
      <div className="flex flex-col min-h-screen px-8 py-12">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-center mt-8 mb-2">Log In</h1>
          <p className="text-center mb-10">
            Please provide the details below to log in
          </p>

          <div className="space-y-4 mb-6">
            <FormInput
              placeholder="Enter your Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <FormInput
              placeholder="Enter Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showPasswordToggle
              error={errors.password}
            />
          </div>

          <GradientButton onClick={handleLogin} disabled={isLoading}>
            {isLoading ? "Logging in..." : "Log In"}
          </GradientButton>

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => handleSocialLogin("Google")}
              className="flex-1 py-3 border rounded-full"
            >
              Google
            </button>
            <button
              onClick={() => handleSocialLogin("Apple")}
              className="flex-1 py-3 border rounded-full flex items-center justify-center gap-2"
            >
              <Apple size={20} />
              Apple
            </button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default Login;