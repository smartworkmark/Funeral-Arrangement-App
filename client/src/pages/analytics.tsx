import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, FileText, Brain, TrendingUp, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Analytics() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<number>(6);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Get user usage stats
  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: [`/api/analytics/user/${user?.id}/stats`, startDate, endDate],
    enabled: !!user?.id,
  });

  // Get user usage trends
  const { data: userTrends, isLoading: trendsLoading } = useQuery({
    queryKey: [`/api/analytics/user/${user?.id}/trends?months=${timeRange}`],
    enabled: !!user?.id,
  });

  if (!user) {
    return <div>Please log in to view analytics.</div>;
  }

  const formatBillingPeriodStart = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysInCurrentPeriod = () => {
    if (!user?.billingPeriodStart) return 0;
    const start = new Date(user.billingPeriodStart);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Usage Analytics</h1>
          <p className="text-muted-foreground">
            Track your transcript processing and document generation usage
          </p>
        </div>
      </div>

      {/* Current Billing Period Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Current Billing Period
          </CardTitle>
          <CardDescription>
            Your usage tracking started on {user?.billingPeriodStart ? formatBillingPeriodStart(user.billingPeriodStart) : 'N/A'} 
            ({getDaysInCurrentPeriod()} days ago)
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Usage Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transcripts Processed</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : (userStats as any)?.transcriptsProcessed || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Since {user?.billingPeriodStart ? formatBillingPeriodStart(user.billingPeriodStart) : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Generated</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : (userStats as any)?.documentsGenerated || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Since {user?.billingPeriodStart ? formatBillingPeriodStart(user.billingPeriodStart) : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Time Range Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Usage Trends
          </CardTitle>
          <CardDescription>
            View your usage patterns over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center space-x-2">
              <Label htmlFor="timeRange">Time Range:</Label>
              <Select value={timeRange.toString()} onValueChange={(value) => setTimeRange(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="24">24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="startDate">Custom Start:</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="endDate">Custom End:</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>

            {(startDate || endDate) && (
              <Button
                variant="outline"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Clear Custom Range
              </Button>
            )}
          </div>

          {/* Usage Trends Chart */}
          {trendsLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div>Loading trends...</div>
            </div>
          ) : userTrends && Array.isArray(userTrends) && userTrends.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="transcriptsProcessed" 
                    stroke="#8884d8" 
                    name="Transcripts Processed"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="documentsGenerated" 
                    stroke="#82ca9d" 
                    name="Documents Generated"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No usage data available for the selected time range</p>
                <p className="text-sm">Start processing transcripts to see your trends here</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Account Type</Label>
              <p className="text-lg capitalize">{user.role}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Billing Period Started</Label>
              <p className="text-lg">{user?.billingPeriodStart ? formatBillingPeriodStart(user.billingPeriodStart) : 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <p className="text-lg">{user.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Funeral Home</Label>
              <p className="text-lg">{user.funeralHome || "Not specified"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}