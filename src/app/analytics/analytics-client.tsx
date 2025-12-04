'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/loading';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface AnalyticsClientProps {
  searchParams: {
    startDate?: string;
    endDate?: string;
    endpoint?: string;
    method?: string;
  };
}

interface PerformanceMetrics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  totalBytesTransferred: number;
}

interface EndpointPerformance {
  endpoint: string;
  method: string;
  metrics: PerformanceMetrics;
  requestCount: number;
}

export function AnalyticsClient({ searchParams }: AnalyticsClientProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(searchParams.startDate || '');
  const [endDate, setEndDate] = useState(searchParams.endDate || '');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const [metricsRes, endpointsRes] = await Promise.all([
        fetch(`/api/analytics?${params.toString()}`),
        fetch(`/api/analytics?type=endpoints&${params.toString()}`),
      ]);

      const metricsData = await metricsRes.json();
      const endpointsData = await endpointsRes.json();

      setMetrics(metricsData.data);
      setEndpoints(endpointsData.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return <Loading text="Loading analytics..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Performance Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Analyze performance metrics for forwarded requests
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={loadAnalytics}>Apply Filters</Button>
          </div>
        </CardContent>
      </Card>

      {/* Overall Metrics */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalRequests}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.successRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(metrics.averageResponseTime)}ms
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.errorRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Percentiles */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Response Time Percentiles</CardTitle>
            <CardDescription>Response time distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">P50 (Median)</div>
                <div className="text-2xl font-bold">{Math.round(metrics.p50)}ms</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">P95</div>
                <div className="text-2xl font-bold">{Math.round(metrics.p95)}ms</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">P99</div>
                <div className="text-2xl font-bold">{Math.round(metrics.p99)}ms</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Min / Max</div>
                <div className="text-2xl font-bold">
                  {Math.round(metrics.minResponseTime)}ms / {Math.round(metrics.maxResponseTime)}ms
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Top Endpoints</CardTitle>
          <CardDescription>Performance by endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Avg Time</TableHead>
                <TableHead>P95</TableHead>
                <TableHead>P99</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">No data available</div>
                  </TableCell>
                </TableRow>
              ) : (
                endpoints.map((ep, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Badge>{ep.method}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{ep.endpoint}</code>
                    </TableCell>
                    <TableCell>{ep.requestCount}</TableCell>
                    <TableCell>
                      {ep.metrics.successRate.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      {Math.round(ep.metrics.averageResponseTime)}ms
                    </TableCell>
                    <TableCell>
                      {Math.round(ep.metrics.p95)}ms
                    </TableCell>
                    <TableCell>
                      {Math.round(ep.metrics.p99)}ms
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

