'use client';

import React, { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { debounce } from 'lodash';
import { Search, Eye, Trash2, ChevronLeft, ChevronRight, Trash, ChevronDown, ChevronUp } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { deleteLog, deleteAllLogs } from './actions';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { JsonViewer } from '@/components/json-viewer';

interface Log {
  id: string;
  logLevel: string;
  logMessage: string;
  logSource: string;
  logTags: string[];
  body: string | null;
  headers: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface LogsClientProps {
  initialLogs: Log[];
  initialMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchParams: {
    page?: string;
    search?: string;
    level?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
  };
  uniqueSources: string[];
  uniqueLevels: string[];
}

const levelColors: Record<string, { bg: string; text: string; border: string }> = {
  DEBUG: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
  INFO: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  WARN: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  ERROR: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  FATAL: { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' },
};

function truncateText(text: string | null, maxLength: number = 150): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function LogsClient({
  initialLogs,
  initialMeta,
  searchParams,
  uniqueSources,
  uniqueLevels,
}: LogsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsHook = useSearchParams();
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.search || '');
  const [search, setSearch] = useState(searchParams.search || '');
  const [levelFilter, setLevelFilter] = useState<string[]>(
    searchParams.level ? searchParams.level.split(',') : []
  );
  const [sourceFilter, setSourceFilter] = useState<string[]>(
    searchParams.source ? searchParams.source.split(',') : []
  );
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: searchParams.startDate ? new Date(searchParams.startDate) : undefined,
    to: searchParams.endDate ? new Date(searchParams.endDate) : undefined,
  });
  const [page, setPage] = useState(Number(searchParams.page) || 1);
  const [isPending, startTransition] = useTransition();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [lastLogId, setLastLogId] = useState<string | null>(
    initialLogs.length > 0 ? initialLogs[0].id : null
  );
  const eventSourceRef = useRef<EventSource | null>(null);

  // Sync state with props
  useEffect(() => {
    setLogs(initialLogs);
    setMeta(initialMeta);
    if (initialLogs.length > 0 && page === 1 && 
        !search && levelFilter.length === 0 && 
        sourceFilter.length === 0) {
      setLastLogId(initialLogs[0].id);
    }
  }, [initialLogs, initialMeta, page, search, levelFilter, sourceFilter]);

  // Debounced search
  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
      setPage(1);
    }, 500),
    []
  );

  useEffect(() => {
    debouncedSetSearch(searchInput);
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [searchInput, debouncedSetSearch]);

  // Sync filters with URL
  useEffect(() => {
    const urlSearch = searchParamsHook.get('search') || '';
    const urlLevel = searchParamsHook.get('level') || 'all';
    const urlSource = searchParamsHook.get('source') || 'all';
    const urlPage = Number(searchParamsHook.get('page')) || 1;

    if (urlSearch !== search) {
      setSearch(urlSearch);
      setSearchInput(urlSearch);
    }
    const urlLevels = urlLevel && urlLevel !== 'all' ? urlLevel.split(',').filter(Boolean) : [];
    if (JSON.stringify(urlLevels.sort()) !== JSON.stringify(levelFilter.sort())) {
      setLevelFilter(urlLevels);
    }
    const urlSources = urlSource && urlSource !== 'all' ? urlSource.split(',').filter(Boolean) : [];
    if (JSON.stringify(urlSources.sort()) !== JSON.stringify(sourceFilter.sort())) {
      setSourceFilter(urlSources);
    }
    if (urlPage !== page) setPage(urlPage);
  }, [searchParamsHook.toString()]);

  // Setup SSE for real-time updates (only for logs from /api/logs)
  useEffect(() => {
    const hasNoFilters = 
      page === 1 &&
      !search &&
      levelFilter.length === 0 &&
      sourceFilter.length === 0;

    if (!hasNoFilters) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Use messages stream but filter for logs
    const streamUrl = lastLogId 
      ? `/api/messages/stream?lastMessageId=${lastLogId}`
      : '/api/messages/stream';
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message' && data.hasNewMessages) {
          // Fetch latest logs
          const params = new URLSearchParams();
          const res = await fetch(`/api/logs?${params.toString()}`);
          const responseData = await res.json();
          
          if (responseData.logs && Array.isArray(responseData.logs)) {
            setLogs(responseData.logs);
            if (responseData.meta) {
              setMeta(responseData.meta);
            }
            if (responseData.logs.length > 0) {
              setLastLogId(responseData.logs[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Error handling SSE message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setTimeout(() => {
        if (hasNoFilters && !eventSourceRef.current) {
          const streamUrl = lastLogId 
            ? `/api/messages/stream?lastMessageId=${lastLogId}`
            : '/api/messages/stream';
          const newEventSource = new EventSource(streamUrl);
          eventSourceRef.current = newEventSource;
          
          newEventSource.onmessage = async (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'new_message' && data.hasNewMessages) {
                const params = new URLSearchParams();
                const res = await fetch(`/api/logs?${params.toString()}`);
                const responseData = await res.json();
                if (responseData.logs && Array.isArray(responseData.logs)) {
                  setLogs(responseData.logs);
                  if (responseData.meta) {
                    setMeta(responseData.meta);
                  }
                  if (responseData.logs.length > 0) {
                    setLastLogId(responseData.logs[0].id);
                  }
                }
              }
            } catch (err) {
              console.error('Error handling SSE message:', err);
            }
          };
        }
      }, 3000);
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [page, search, levelFilter, sourceFilter, lastLogId]);

  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 300);
    return () => clearTimeout(timer);
  }, [pathname, searchParamsHook.toString()]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (search) params.set('search', search);
    if (levelFilter.length > 0) params.set('level', levelFilter.join(','));
    if (sourceFilter.length > 0) params.set('source', sourceFilter.join(','));
    if (dateRange.from) params.set('startDate', dateRange.from.toISOString());
    if (dateRange.to) params.set('endDate', dateRange.to.toISOString());

    router.push(`/logs?${params.toString()}`);
  }, [page, search, levelFilter, sourceFilter, dateRange, router]);

  const handleSearch = (value: string) => {
    setSearchInput(value);
  };

  const handleLevelFilter = (values: string[]) => {
    setLevelFilter(values);
    setPage(1);
  };

  const handleSourceFilter = (values: string[]) => {
    setSourceFilter(values);
    setPage(1);
  };

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range);
    setPage(1);
  };

  const handleViewLog = (id: string) => {
    router.push(`/logs/${id}`);
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Are you sure you want to delete this log?')) return;

    startTransition(async () => {
      try {
        await deleteLog(id);
        setLogs(logs.filter((l) => l.id !== id));
      } catch (error) {
        console.error('Error deleting log:', error);
      }
    });
  };

  const handleClearAllLogs = async () => {
    setIsClearing(true);
    try {
      await deleteAllLogs();
      setLogs([]);
      setMeta({
        ...meta,
        total: 0,
        totalPages: 0,
      });
      setLastLogId(null);
      setShowClearDialog(false);
      router.refresh();
    } catch (error) {
      console.error('Error clearing all logs:', error);
      alert('Failed to clear all logs. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Logs</h1>
            <p className="text-muted-foreground mt-1">
              View and manage application logs
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowClearDialog(true)}
            disabled={meta.total === 0 || isClearing}
          >
            <Trash className="h-4 w-4 mr-2" />
            Clear All Logs
          </Button>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
                    !dateRange.from && !dateRange.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={(range) => handleDateRangeChange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Level</label>
              <Select
                value={levelFilter.length > 0 ? levelFilter.join(',') : 'all'}
                onValueChange={(value) => handleLevelFilter(value === 'all' ? [] : value.split(','))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {uniqueLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Source</label>
              <Select
                value={sourceFilter.length > 0 ? sourceFilter.join(',') : 'all'}
                onValueChange={(value) => handleSourceFilter(value === 'all' ? [] : value.split(','))}
              >
                <SelectTrigger>
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
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border relative">
          {(loading || isNavigating) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
              <Loading text={isNavigating ? "Loading..." : "Loading logs..."} />
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[100px]">Level</TableHead>
                <TableHead className="w-[150px]">Source</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[100px]">Tags</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, index) => {
                  const isExpanded = expandedRows.has(log.id);
                  const levelColor = levelColors[log.logLevel] || levelColors.INFO;
                  
                  return (
                    <React.Fragment key={log.id}>
                      <TableRow 
                        className={cn(
                          "cursor-pointer",
                          index % 2 === 0 ? "bg-background" : "bg-muted/50"
                        )}
                        onClick={() => toggleRowExpansion(log.id)}
                      >
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.createdAt), 'MMM dd, HH:mm:ss.SSS')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              levelColor.bg,
                              levelColor.text,
                              levelColor.border
                            )}
                          >
                            {log.logLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.logSource}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[600px] truncate text-sm">
                            {log.logMessage}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.logTags && log.logTags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {log.logTags.slice(0, 2).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {log.logTags.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{log.logTags.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="sr-only">Open menu</span>
                                <span>⋯</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewLog(log.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteLog(log.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">Log Details</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleRowExpansion(log.id)}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium text-muted-foreground">Full Message:</span>
                                  <div className="mt-1 font-mono text-xs bg-background p-2 rounded border">
                                    {log.logMessage}
                                  </div>
                                </div>
                                <div>
                                  <span className="font-medium text-muted-foreground">IP Address:</span>
                                  <div className="mt-1">{log.ipAddress || '-'}</div>
                                </div>
                                {log.logTags && log.logTags.length > 0 && (
                                  <div>
                                    <span className="font-medium text-muted-foreground">Tags:</span>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {log.logTags.map((tag, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {log.body && (
                                  <div className="col-span-2">
                                    <span className="font-medium text-muted-foreground">Raw Body:</span>
                                    <div className="mt-1">
                                      <JsonViewer data={log.body} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} logs
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

        {/* Clear All Logs Dialog */}
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear All Logs</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete all {meta.total} logs? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowClearDialog(false)}
                disabled={isClearing}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearAllLogs}
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear All'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

