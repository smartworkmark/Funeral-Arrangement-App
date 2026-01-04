import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, FileText, Brain, Calendar, Settings, Crown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function AdminAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<string>("current");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState<string>("");

  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You need administrator privileges to access this page.</p>
        </div>
      </div>
    );
  }

  // Get all users usage stats
  const { data: allUsersStats, isLoading, refetch, error } = useQuery({
    queryKey: [`/api/analytics/admin/all-users`, startDate, endDate, timeRange],
    queryFn: async () => {
      let url = `/api/analytics/admin/all-users`;
      const params = new URLSearchParams();
      
      if (timeRange === "custom" && startDate) params.append("startDate", startDate);
      if (timeRange === "custom" && endDate) params.append("endDate", endDate);
      if (timeRange === "previous") {
        // Previous billing period logic
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        params.append("startDate", lastMonth.toISOString().split('T')[0]);
        params.append("endDate", thisMonth.toISOString().split('T')[0]);
      }
      
      if (params.toString()) url += `?${params.toString()}`;
      
      try {
        console.log('Fetching admin analytics from:', url);
        const response = await apiRequest("GET", url);
        const data = await response.json();
        console.log('Admin analytics data:', data);
        return data;
      } catch (error) {
        console.error('Admin analytics error:', error);
        throw error;
      }
    },
    enabled: !!user && user.role === 'admin',
    retry: 2,
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/role`, {
        role,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Role Updated",
        description: `User role updated to ${data.user.role} and billing period reset.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/analytics/admin/all-users`] });
      setSelectedUser(null);
      setNewRole("");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const getTotalStats = () => {
    if (!allUsersStats) return { totalTranscripts: 0, totalDocuments: 0, totalUsers: 0 };
    
    return {
      totalUsers: allUsersStats.length,
      totalTranscripts: allUsersStats.reduce((sum: number, user: any) => sum + user.transcriptsProcessed, 0),
      totalDocuments: allUsersStats.reduce((sum: number, user: any) => sum + user.documentsGenerated, 0),
    };
  };

  const getChartData = () => {
    if (!allUsersStats) return [];
    
    return allUsersStats.map((user: any) => ({
      name: user.userName,
      transcripts: user.transcriptsProcessed,
      documents: user.documentsGenerated,
    }));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'premium': return 'secondary';
      case 'user': return 'outline';
      default: return 'outline';
    }
  };

  const totalStats = getTotalStats();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Crown className="w-8 h-8" />
            Admin Analytics
          </h1>
          <p className="text-muted-foreground">
            Monitor platform usage across all users
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transcripts Processed</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalTranscripts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Generated</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalDocuments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Time Range Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Time Period Selection</CardTitle>
          <CardDescription>
            Choose the time period for usage statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="timeRange">Period:</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Billing Period</SelectItem>
                  <SelectItem value="previous">Previous Billing Period</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {timeRange === "custom" && (
              <>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="startDate">Start Date:</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Label htmlFor="endDate">End Date:</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}

            <Button onClick={() => refetch()} variant="outline">
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Usage Overview</CardTitle>
          <CardDescription>
            Transcripts processed and documents generated by user
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div>Loading chart data...</div>
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="transcripts" fill="#8884d8" name="Transcripts" />
                  <Bar dataKey="documents" fill="#82ca9d" name="Documents" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Usage Details</CardTitle>
          <CardDescription>
            Detailed usage statistics for all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              {error ? (
                <div>
                  <p>Error loading user data: {(error as Error).message}</p>
                  <p className="text-sm text-muted-foreground mt-2">Please check your admin permissions</p>
                </div>
              ) : (
                "Loading user data..."
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Transcripts</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Billing Start</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsersStats?.map((userStat: any) => (
                  <TableRow key={userStat.userId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{userStat.userName}</div>
                        <div className="text-sm text-muted-foreground">{userStat.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(userStat.role)}>
                        {userStat.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{userStat.transcriptsProcessed}</TableCell>
                    <TableCell>{userStat.documentsGenerated}</TableCell>
                    <TableCell>{formatDate(userStat.billingPeriodStart)}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(userStat);
                              setNewRole(userStat.role);
                            }}
                          >
                            <Settings className="w-4 h-4 mr-1" />
                            Manage
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Manage User: {selectedUser?.userName}</DialogTitle>
                            <DialogDescription>
                              Update user role and reset billing period. This will reset their usage counters to zero.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="roleSelect">New Role</Label>
                              <Select value={newRole} onValueChange={setNewRole}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="premium">Premium</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Current usage: {selectedUser?.transcriptsProcessed} transcripts, {selectedUser?.documentsGenerated} documents
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                if (selectedUser && newRole) {
                                  updateUserRoleMutation.mutate({
                                    userId: selectedUser.userId,
                                    role: newRole,
                                  });
                                }
                              }}
                              disabled={updateUserRoleMutation.isPending}
                            >
                              {updateUserRoleMutation.isPending ? "Updating..." : "Update Role & Reset Billing"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}