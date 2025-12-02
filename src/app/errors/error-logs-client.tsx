'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Eye, Trash2, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ErrorLevel } from './actions';
import { format } from 'date-fns';
import { deleteErrorLog } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ErrorLog {
  id: string;
  level: ErrorLevel;
  source: string;
  message: string;
  stack: string | null;
  context: string | null;
  requestUrl: string | null;
  requestMethod: string | null;
  requestHeaders: string | null;
  requestBody: string | null;
  responseStatus: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface ErrorLogsClientProps {
  initialLogs: ErrorLog[];
  initialMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchParams: {
    page?: string;
    search?: string;
    level?: ErrorLevel;
    source?: string;
  };
  uniqueSources: string[];
  stats: {
    total: number;
    byLevel: Record<string, number>;
    bySource: Array<{ source: string; count: number }>;
  };
}

const levelColors: Record<ErrorLevel, string> = {
  ERROR: 'bg-red-500',
  WARN: 'bg-yellow-500',
  INFO: 'bg-blue-500',
};

const levelIcons: Record<ErrorLevel, typeof AlertTriangle> = {
  ERROR: AlertTriangle,
  WARN: AlertCircle,
  INFO: Info,
};

function truncateText(text: string | null, maxLength: number = 100): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function formatForTooltip(text: string | null): string {
  if (!text) return 'N/A';
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

export function ErrorLogsClient({
  initialLogs,
  initialMeta,
  searchParams,
  uniqueSources,
  stats,
}: ErrorLogsClientProps) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const [logs, setLogs] = useState<ErrorLog[]>(initialLogs);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.search || '');
  const [levelFilter, setLevelFilter] = useState<ErrorLevel | 'all'>(searchParams.level || 'all');
  const [sourceFilter, setSourceFilter] = useState(searchParams.source || 'all');
  const [page, setPage] = useState(Number(searchParams.page) || 1);
  const [isPending, startTransition] = useTransition();

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const params = new URLSearchParams();
      if (page > 1) params.set('page', page.toString());
      if (search) params.set('search', search);
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);

      setLoading(true);
      try {
        const res = await fetch(`/api/errors?${params.toString()}`);
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs);
          setMeta(data.meta);
        }
      } catch (error) {
        console.error('Error fetching error logs for auto-refresh:', error);
      } finally {
        setLoading(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [page, search, levelFilter, sourceFilter]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (search) params.set('search', search);
    if (levelFilter !== 'all') params.set('level', levelFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);

    router.push(`/errors?${params.toString()}`);
  }, [page, search, levelFilter, sourceFilter, router]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleLevelFilter = (value: string) => {
    setLevelFilter(value as ErrorLevel | 'all');
    setPage(1);
  };

  const handleSourceFilter = (value: string) => {
    setSourceFilter(value);
    setPage(1);
  };

  const handleViewLog = (id: string) => {
    router.push(`/errors/${id}`);
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Are you sure you want to delete this error log?')) return;

    startTransition(async () => {
      try {
        await deleteErrorLog(id);
        setLogs(logs.filter((log) => log.id !== id));
      } catch (error) {
        console.error('Error deleting log:', error);
        alert('Failed to delete error log');
      }
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Error Logs</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and debug application errors
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {stats.byLevel.ERROR || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {stats.byLevel.WARN || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Info</CardTitle>
              <Info className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {stats.byLevel.INFO || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by message, source, stack trace..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={levelFilter} onValueChange={handleLevelFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
              <SelectItem value="WARN">Warning</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={handleSourceFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {uniqueSources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
              <Loading text="Loading error logs..." />
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No error logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, index) => {
                  const LevelIcon = levelIcons[log.level];
                  return (
                    <TableRow
                      key={log.id}
                      onDoubleClick={() => handleViewLog(log.id)}
                      className={cn(
                        "cursor-pointer",
                        index % 2 === 0 ? "bg-background" : "bg-muted/50"
                      )}
                    >
                      <TableCell>
                        <Badge className={levelColors[log.level]}>
                          <LevelIcon className="h-3 w-3 mr-1" />
                          {log.level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">{log.source}</span>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild className="cursor-help">
                            <div className="max-w-[300px] truncate text-sm">
                              {truncateText(log.message, 80)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-lg max-h-[300px] overflow-auto whitespace-pre-wrap">
                            {log.message}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {log.requestMethod && log.requestUrl ? (
                          <Tooltip>
                            <TooltipTrigger asChild className="cursor-help">
                              <div className="max-w-[200px] truncate text-sm font-mono text-xs">
                                {log.requestMethod} {truncateText(log.requestUrl, 50)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-lg">
                              <div className="font-mono text-xs">
                                {log.requestMethod} {log.requestUrl}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild className="cursor-help">
                            <span className="text-sm">{log.ipAddress || '-'}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {log.ipAddress || 'N/A'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild className="cursor-help">
                            <span className="text-sm">
                              {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {format(new Date(log.createdAt), 'PPpp')}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                            >
                              <span className="sr-only">Open menu</span>
                              <span>⋯</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewLog(log.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteLog(log.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {meta.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(meta.page - 1) * meta.limit + 1} to{' '}
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} error logs
            </div>
            {meta.totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1 || isPending}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1 || isPending}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (meta.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= meta.totalPages - 2) {
                      pageNum = meta.totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        disabled={isPending}
                        className="min-w-[2.5rem]"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= meta.totalPages || isPending}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(meta.totalPages)}
                  disabled={page >= meta.totalPages || isPending}
                >
                  Last
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

