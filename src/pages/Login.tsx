import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) return toast.error(res.error || "Login failed");
    toast.success("Welcome back!");
    navigate(location.state?.from?.pathname || "/", { replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <Sparkles className="h-7 w-7" />
          </div>
          <CardTitle>
            AI <span className="text-primary">Screener</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to access your dashboard</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</> : "Sign In"}
            </Button>
            <div className="text-xs text-muted-foreground bg-muted rounded-md p-3 space-y-1">
              <div className="font-semibold">Demo credentials:</div>
              <div>admin@demo.com / admin123</div>
              <div>hr@demo.com / hr123</div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
