'use client';

import { useState, useEffect, useTransition, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { debounce } from 'lodash';
import { Search, Eye, Trash2, ChevronLeft, ChevronRight, Trash } from 'lucide-react';
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
import { MessageCategory } from '@/lib/types';
import { format } from 'date-fns';
import { deleteMessage, deleteAllMessages } from './actions';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';

interface Message {
  id: string;
  category: MessageCategory;
  provider: string | null;
  sourceUrl: string;
  method: string;
  headers: string;
  body: string | null;
  ipAddress: string | null;
  createdAt: Date;
  duplicateCount?: number;
  isDuplicate?: boolean;
}

interface MessagesClientProps {
  initialMessages: Message[];
  initialMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchParams: {
    page?: string;
    search?: string;
    category?: string;
    provider?: string;
    method?: string;
    ipAddress?: string;
    startDate?: string;
    endDate?: string;
  };
  uniqueIpAddresses: string[];
  uniqueProviders: string[];
  uniqueMethods?: string[]; // Optional, not used anymore but kept for backward compatibility
}

// All supported categories
const ALL_CATEGORIES: MessageCategory[] = [
  'EVENT_TRACK',
  'MESSAGE',
  'AUTHENTICATION',
  'MOCK_API',
  'FORWARD',
  'GENERAL',
];

// All supported HTTP methods
const ALL_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

const categoryColors: Record<MessageCategory, string> = {
  EVENT_TRACK: 'bg-blue-500',
  MESSAGE: 'bg-green-500',
  AUTHENTICATION: 'bg-orange-500',
  MOCK_API: 'bg-purple-500',
  FORWARD: 'bg-cyan-500',
  GENERAL: 'bg-gray-500',
};

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800',
  POST: 'bg-green-100 text-green-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-purple-100 text-purple-800',
};

function truncateText(text: string | null, maxLength: number = 100): string {
  if (!text) return '-';
  try {
    // Try to parse as JSON and stringify nicely
    const parsed = JSON.parse(text);
    const stringified = JSON.stringify(parsed);
    if (stringified.length <= maxLength) return stringified;
    return stringified.substring(0, maxLength) + '...';
  } catch {
    // If not JSON, just truncate the string
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
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

export function MessagesClient({
  initialMessages,
  initialMeta,
  searchParams,
  uniqueIpAddresses,
  uniqueProviders,
  uniqueMethods,
}: MessagesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsHook = useSearchParams();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.search || '');
  const [search, setSearch] = useState(searchParams.search || '');
  const [categoryFilter, setCategoryFilter] = useState<string[]>(
    searchParams.category ? searchParams.category.split(',') : []
  );
  const [providerFilter, setProviderFilter] = useState<string[]>(
    searchParams.provider ? searchParams.provider.split(',') : []
  );
  const [methodFilter, setMethodFilter] = useState<string[]>(
    searchParams.method ? searchParams.method.split(',') : []
  );
  const [ipFilter, setIpFilter] = useState(
    searchParams.ipAddress || 'all'
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
  const [lastMessageId, setLastMessageId] = useState<string | null>(
    initialMessages.length > 0 ? initialMessages[0].id : null
  );
  const eventSourceRef = useRef<EventSource | null>(null);

  // Sync state with props when they change (e.g., when filters change and page re-renders)
  useEffect(() => {
    setMessages(initialMessages);
    setMeta(initialMeta);
    // Update lastMessageId when initial messages change
    if (initialMessages.length > 0 && page === 1 && 
        !search && categoryFilter.length === 0 && 
        providerFilter.length === 0 && methodFilter.length === 0 && ipFilter === 'all') {
      setLastMessageId(initialMessages[0].id);
    }
  }, [initialMessages, initialMeta, page, search, categoryFilter, providerFilter, methodFilter, ipFilter]);

  // Debounced function to update search state
  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
      setPage(1); // Reset to page 1 when search changes
    }, 500),
    []
  );

  // Update search when searchInput changes (debounced)
  useEffect(() => {
    debouncedSetSearch(searchInput);
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [searchInput, debouncedSetSearch]);

  // Sync filter states with URL params when they change externally
  useEffect(() => {
    const urlSearch = searchParamsHook.get('search') || '';
    const urlCategory = searchParamsHook.get('category') || 'all';
    const urlProvider = searchParamsHook.get('provider') || 'all';
    const urlMethod = searchParamsHook.get('method') || 'all';
    const urlIp = searchParamsHook.get('ipAddress') || 'all';
    const urlPage = Number(searchParamsHook.get('page')) || 1;

    // Only sync if different to avoid unnecessary updates
    if (urlSearch !== search) {
      setSearch(urlSearch);
      setSearchInput(urlSearch);
    }
    const urlCategories = urlCategory && urlCategory !== 'all' ? urlCategory.split(',').filter(Boolean) : [];
    if (JSON.stringify(urlCategories.sort()) !== JSON.stringify(categoryFilter.sort())) {
      setCategoryFilter(urlCategories);
    }
    const urlProviders = urlProvider && urlProvider !== 'all' ? urlProvider.split(',').filter(Boolean) : [];
    if (JSON.stringify(urlProviders.sort()) !== JSON.stringify(providerFilter.sort())) {
      setProviderFilter(urlProviders);
    }
    const urlMethods = urlMethod && urlMethod !== 'all' ? urlMethod.split(',').filter(Boolean) : [];
    if (JSON.stringify(urlMethods.sort()) !== JSON.stringify(methodFilter.sort())) {
      setMethodFilter(urlMethods);
    }
    if (urlIp !== ipFilter) setIpFilter(urlIp);
    if (urlPage !== page) setPage(urlPage);
  }, [searchParamsHook.toString()]);

  // Setup Server-Sent Events for real-time updates
  useEffect(() => {
    // Only setup SSE if we're on page 1 with no filters
    const hasNoFilters = 
      page === 1 &&
      !search &&
      categoryFilter.length === 0 &&
      providerFilter.length === 0 &&
      methodFilter.length === 0 &&
      ipFilter === 'all';

    if (!hasNoFilters) {
      // Close existing connection if filters are active
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Setup SSE connection with lastMessageId parameter
    const streamUrl = lastMessageId 
      ? `/api/messages/stream?lastMessageId=${lastMessageId}`
      : '/api/messages/stream';
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message' && data.hasNewMessages) {
          // Fetch latest messages
          const params = new URLSearchParams();
          const res = await fetch(`/api/messages?${params.toString()}`);
          const responseData = await res.json();
          
          if (responseData.messages && Array.isArray(responseData.messages)) {
            setMessages(responseData.messages);
            if (responseData.meta) {
              setMeta(responseData.meta);
            }
            // Update last message ID
            if (responseData.messages.length > 0) {
              setLastMessageId(responseData.messages[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Error handling SSE message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Close and reconnect after a delay
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (hasNoFilters && !eventSourceRef.current) {
          const streamUrl = lastMessageId 
            ? `/api/messages/stream?lastMessageId=${lastMessageId}`
            : '/api/messages/stream';
          const newEventSource = new EventSource(streamUrl);
          eventSourceRef.current = newEventSource;
          
          newEventSource.onmessage = async (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'new_message' && data.hasNewMessages) {
                const params = new URLSearchParams();
                const res = await fetch(`/api/messages?${params.toString()}`);
                const responseData = await res.json();
                if (responseData.messages && Array.isArray(responseData.messages)) {
                  setMessages(responseData.messages);
                  if (responseData.meta) {
                    setMeta(responseData.meta);
                  }
                  if (responseData.messages.length > 0) {
                    setLastMessageId(responseData.messages[0].id);
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
  }, [page, search, categoryFilter, providerFilter, methodFilter, ipFilter, lastMessageId]);

  // Handle navigation loading state
  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 300);
    return () => clearTimeout(timer);
  }, [pathname, searchParamsHook.toString()]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (search) params.set('search', search);
    if (categoryFilter.length > 0) params.set('category', categoryFilter.join(','));
    if (providerFilter.length > 0) params.set('provider', providerFilter.join(','));
    if (methodFilter.length > 0) params.set('method', methodFilter.join(','));
    if (ipFilter !== 'all') params.set('ipAddress', ipFilter);
    if (dateRange.from) params.set('startDate', dateRange.from.toISOString());
    if (dateRange.to) params.set('endDate', dateRange.to.toISOString());

    router.push(`/messages?${params.toString()}`);
  }, [page, search, categoryFilter, providerFilter, methodFilter, ipFilter, dateRange, router]);

  const handleSearch = (value: string) => {
    // Update input immediately for responsive UI
    setSearchInput(value);
  };

  const handleCategoryFilter = (values: string[]) => {
    setCategoryFilter(values);
    setPage(1);
  };

  const handleProviderFilter = (values: string[]) => {
    setProviderFilter(values);
    setPage(1);
  };

  const handleMethodFilter = (values: string[]) => {
    setMethodFilter(values);
    setPage(1);
  };

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range);
    setPage(1);
  };

  const handleIpFilter = (value: string) => {
    setIpFilter(value);
    setPage(1);
  };

  const handleViewMessage = (id: string) => {
    router.push(`/messages/${id}`);
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    startTransition(async () => {
      try {
        await deleteMessage(id);
        setMessages(messages.filter((m) => m.id !== id));
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    });
  };

  const handleClearAllMessages = async () => {
    setIsClearing(true);
    try {
      const result = await deleteAllMessages();
      setMessages([]);
      setMeta({
        ...meta,
        total: 0,
        totalPages: 0,
      });
      setLastMessageId(null);
      setShowClearDialog(false);
      // Refresh the page to update stats
      router.refresh();
    } catch (error) {
      console.error('Error clearing all messages:', error);
      alert('Failed to clear all messages. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all proxy requests
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setShowClearDialog(true)}
          disabled={meta.total === 0 || isClearing}
        >
          <Trash className="h-4 w-4 mr-2" />
          Clear All Messages
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Search and Date Range */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by URL..."
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
          <Select value={ipFilter} onValueChange={handleIpFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {uniqueIpAddresses.map((ip) => (
                <SelectItem key={ip} value={ip}>
                  {ip}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Toggle Groups */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          {/* Categories */}
          <div className="flex-1">
            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Categories</label>
            <ToggleGroup
              type="multiple"
              value={categoryFilter}
              onValueChange={handleCategoryFilter}
              className="flex flex-wrap gap-1.5 justify-start"
            >
              {ALL_CATEGORIES.map((category) => {
                const categoryColorMap: Record<MessageCategory, { active: string; hover: string; label: string }> = {
                  EVENT_TRACK: {
                    active: 'data-[state=on]:bg-blue-500 data-[state=on]:text-white data-[state=on]:hover:bg-blue-600',
                    hover: 'hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300',
                    label: 'Event Track',
                  },
                  MESSAGE: {
                    active: 'data-[state=on]:bg-green-500 data-[state=on]:text-white data-[state=on]:hover:bg-green-600',
                    hover: 'hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950 dark:hover:text-green-300',
                    label: 'Message',
                  },
                  AUTHENTICATION: {
                    active: 'data-[state=on]:bg-orange-500 data-[state=on]:text-white data-[state=on]:hover:bg-orange-600',
                    hover: 'hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950 dark:hover:text-orange-300',
                    label: 'Authentication',
                  },
                  MOCK_API: {
                    active: 'data-[state=on]:bg-purple-500 data-[state=on]:text-white data-[state=on]:hover:bg-purple-600',
                    hover: 'hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-950 dark:hover:text-purple-300',
                    label: 'Mock API',
                  },
                  FORWARD: {
                    active: 'data-[state=on]:bg-cyan-500 data-[state=on]:text-white data-[state=on]:hover:bg-cyan-600',
                    hover: 'hover:bg-cyan-50 hover:text-cyan-700 dark:hover:bg-cyan-950 dark:hover:text-cyan-300',
                    label: 'Forward',
                  },
                  GENERAL: {
                    active: 'data-[state=on]:bg-gray-500 data-[state=on]:text-white data-[state=on]:hover:bg-gray-600',
                    hover: 'hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-950 dark:hover:text-gray-300',
                    label: 'General',
                  },
                };
                const colors = categoryColorMap[category];
                return (
                  <ToggleGroupItem 
                    key={category}
                    value={category} 
                    aria-label={colors.label}
                    className={cn(
                      "bg-transparent",
                      colors.active,
                      colors.hover
                    )}
                  >
                    {colors.label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>

          {/* Methods */}
          <div className="flex-1">
            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Methods</label>
            <ToggleGroup
              type="multiple"
              value={methodFilter}
              onValueChange={handleMethodFilter}
              className="flex flex-wrap gap-1.5 justify-start"
            >
              {ALL_METHODS.map((method) => {
                const methodColorMap: Record<string, { active: string; hover: string }> = {
                  GET: { 
                    active: 'data-[state=on]:bg-blue-500 data-[state=on]:text-white data-[state=on]:hover:bg-blue-600', 
                    hover: 'hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300' 
                  },
                  POST: { 
                    active: 'data-[state=on]:bg-green-500 data-[state=on]:text-white data-[state=on]:hover:bg-green-600', 
                    hover: 'hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950 dark:hover:text-green-300' 
                  },
                  PUT: { 
                    active: 'data-[state=on]:bg-yellow-500 data-[state=on]:text-white data-[state=on]:hover:bg-yellow-600', 
                    hover: 'hover:bg-yellow-50 hover:text-yellow-700 dark:hover:bg-yellow-950 dark:hover:text-yellow-300' 
                  },
                  DELETE: { 
                    active: 'data-[state=on]:bg-red-500 data-[state=on]:text-white data-[state=on]:hover:bg-red-600', 
                    hover: 'hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-300' 
                  },
                  PATCH: { 
                    active: 'data-[state=on]:bg-purple-500 data-[state=on]:text-white data-[state=on]:hover:bg-purple-600', 
                    hover: 'hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-950 dark:hover:text-purple-300' 
                  },
                  HEAD: { 
                    active: 'data-[state=on]:bg-cyan-500 data-[state=on]:text-white data-[state=on]:hover:bg-cyan-600', 
                    hover: 'hover:bg-cyan-50 hover:text-cyan-700 dark:hover:bg-cyan-950 dark:hover:text-cyan-300' 
                  },
                  OPTIONS: { 
                    active: 'data-[state=on]:bg-slate-500 data-[state=on]:text-white data-[state=on]:hover:bg-slate-600', 
                    hover: 'hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-950 dark:hover:text-slate-300' 
                  },
                };
                const colors = methodColorMap[method] || { 
                  active: 'data-[state=on]:bg-gray-500 data-[state=on]:text-white data-[state=on]:hover:bg-gray-600', 
                  hover: 'hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-950 dark:hover:text-gray-300' 
                };
                return (
                  <ToggleGroupItem 
                    key={method} 
                    value={method} 
                    aria-label={method}
                    className={cn(
                      "bg-transparent",
                      colors.active,
                      colors.hover
                    )}
                  >
                    {method}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>

          {/* Providers */}
          {uniqueProviders.length > 0 && (
            <div className="flex-1">
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Providers</label>
              <ToggleGroup
                type="multiple"
                value={providerFilter}
                onValueChange={handleProviderFilter}
                className="flex flex-wrap gap-1.5 justify-start"
              >
                {uniqueProviders.map((provider, index) => {
                  const providerColors = [
                    { 
                      active: 'data-[state=on]:!bg-indigo-500 data-[state=on]:!text-white data-[state=on]:hover:!bg-indigo-600', 
                      hover: 'hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300',
                    },
                    { 
                      active: 'data-[state=on]:!bg-pink-500 data-[state=on]:!text-white data-[state=on]:hover:!bg-pink-600', 
                      hover: 'hover:bg-pink-50 hover:text-pink-700 dark:hover:bg-pink-950 dark:hover:text-pink-300',
                    },
                    { 
                      active: 'data-[state=on]:!bg-teal-500 data-[state=on]:!text-white data-[state=on]:hover:!bg-teal-600', 
                      hover: 'hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950 dark:hover:text-teal-300',
                    },
                    { 
                      active: 'data-[state=on]:!bg-amber-500 data-[state=on]:!text-white data-[state=on]:hover:!bg-amber-600', 
                      hover: 'hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950 dark:hover:text-amber-300',
                    },
                  ];
                  const colors = providerColors[index % providerColors.length];
                  return (
                    <ToggleGroupItem 
                      key={provider} 
                      value={provider} 
                      aria-label={provider}
                      className={cn(
                        "bg-transparent data-[state=off]:bg-transparent",
                        colors.active,
                        colors.hover
                      )}
                    >
                      {provider}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border relative">
        {(loading || isNavigating) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
            <Loading text={isNavigating ? "Loading..." : "Loading messages..."} />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Headers</TableHead>
              <TableHead>Body</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Duplicate</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No messages found
                </TableCell>
              </TableRow>
            ) : (
              messages.map((message, index) => (
                <TableRow 
                  key={message.id}
                  onDoubleClick={() => handleViewMessage(message.id)}
                  className={cn(
                    "cursor-pointer",
                    index % 2 === 0 ? "bg-background" : "bg-muted/50"
                  )}
                >
                  <TableCell>
                    <Badge
                      className={categoryColors[message.category]}
                    >
                      {message.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {message.provider ? (
                      <Badge variant="outline">{message.provider}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={methodColors[message.method] || ''}
                    >
                      {message.method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="max-w-[300px] truncate text-sm cursor-help">
                          {message.sourceUrl}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        <pre className="text-xs whitespace-pre-wrap break-words">
                          {message.sourceUrl}
                        </pre>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="max-w-[200px] truncate text-sm font-mono text-xs cursor-help">
                          {truncateText(message.headers, 80)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-lg">
                        <pre className="text-xs whitespace-pre-wrap break-words max-h-[300px] overflow-auto">
                          {formatForTooltip(message.headers)}
                        </pre>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="max-w-[200px] truncate text-sm font-mono text-xs cursor-help">
                          {truncateText(message.body, 80)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-lg">
                        <pre className="text-xs whitespace-pre-wrap break-words max-h-[300px] overflow-auto">
                          {formatForTooltip(message.body)}
                        </pre>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm cursor-help">{message.ipAddress || '-'}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{message.ipAddress || 'No IP address'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {message.isDuplicate && message.duplicateCount !== undefined ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="destructive" className="cursor-help">
                            {message.duplicateCount} duplicate{message.duplicateCount !== 1 ? 's' : ''}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            This request has {message.duplicateCount} similar request{message.duplicateCount !== 1 ? 's' : ''} within the same second
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm cursor-help">
                          {format(new Date(message.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          {format(new Date(message.createdAt), 'PPpp')}
                        </p>
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
                        <DropdownMenuItem onClick={() => handleViewMessage(message.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteMessage(message.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4 mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {(meta.page - 1) * meta.limit + 1} to{' '}
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} messages
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

      {/* Clear All Messages Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Messages</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {meta.total} messages? This action cannot be undone.
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
              onClick={handleClearAllMessages}
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

