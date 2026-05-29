import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import UsersPage from "./pages/Users.tsx";
import AuditLogPage from "./pages/AuditLog.tsx";
import AnalyticsPage from "./pages/Analytics.tsx";
import PipelinePage from "./pages/Pipeline.tsx";
import AppLayout from "./components/AppLayout";
import { AuthProvider, RequireAuth, RequireAdmin } from "./lib/auth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/pipeline" element={<PipelinePage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
              <Route path="/audit-log" element={<AuditLogPage />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
