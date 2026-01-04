import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import Transcripts from "@/pages/transcripts";
import ArrangementPage from "@/pages/arrangement";
import AdminPage from "@/pages/admin";
import ProfilePage from "@/pages/profile";
import Analytics from "@/pages/analytics";
import AdminAnalytics from "@/pages/admin-analytics";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import Layout from "@/components/Layout";
import OfflineStatus from "@/components/OfflineStatus";
import PWAStatusBar from "@/components/PWAStatusBar";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/" nest>
        <ProtectedRoute>
          <Switch>
            <Route path="/">
              <Layout>
                <Dashboard />
              </Layout>
            </Route>
            <Route path="/transcripts">
              <Layout>
                <Transcripts />
              </Layout>
            </Route>
            <Route path="/admin">
              <AdminRoute>
                <Layout>
                  <AdminPage />
                </Layout>
              </AdminRoute>
            </Route>
            <Route path="/profile">
              <Layout>
                <ProfilePage />
              </Layout>
            </Route>
            <Route path="/analytics">
              <Layout>
                <Analytics />
              </Layout>
            </Route>
            <Route path="/admin/analytics">
              <AdminRoute>
                <Layout>
                  <AdminAnalytics />
                </Layout>
              </AdminRoute>
            </Route>
            <Route path="/arrangement/:id" component={ArrangementPage} />
            <Route>
              <Layout>
                <NotFound />
              </Layout>
            </Route>
          </Switch>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PWAStatusBar />
        <Toaster />
        <OfflineStatus />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
