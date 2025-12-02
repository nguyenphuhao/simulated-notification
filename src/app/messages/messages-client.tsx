'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  };
  uniqueIpAddresses: string[];
}

const categoryColors: Record<MessageCategory, string> = {
  EVENT_TRACK: 'bg-blue-500',
  MESSAGE: 'bg-green-500',
  AUTHENTICATION: 'bg-orange-500',
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
}: MessagesClientProps) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.search || '');
  const [categoryFilter, setCategoryFilter] = useState(
    searchParams.category || 'all'
  );
  const [providerFilter, setProviderFilter] = useState(
    searchParams.provider || 'all'
  );
  const [methodFilter, setMethodFilter] = useState(
    searchParams.method || 'all'
  );
  const [ipFilter, setIpFilter] = useState(
    searchParams.ipAddress || 'all'
  );
  const [page, setPage] = useState(Number(searchParams.page) || 1);
  const [isPending, startTransition] = useTransition();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(
    initialMessages.length > 0 ? initialMessages[0].id : null
  );

  // Check for new messages only when on page 1 with no filters
  // This way we only refresh when new messages would appear at the top
  useEffect(() => {
    // Only check for new messages if we're on page 1 and have no active filters
    const hasNoFilters = 
      page === 1 &&
      !search &&
      categoryFilter === 'all' &&
      providerFilter === 'all' &&
      methodFilter === 'all' &&
      ipFilter === 'all';

    if (!hasNoFilters) {
      return; // Don't check if filters are active or not on first page
    }

    const interval = setInterval(async () => {
      try {
        // Check if there are new messages
        const checkParams = new URLSearchParams();
        if (lastMessageId) {
          checkParams.set('lastMessageId', lastMessageId);
        }
        
        const checkRes = await fetch(`/api/messages/check?${checkParams.toString()}`);
        const checkData = await checkRes.json();

        // Only fetch messages if there are new ones
        if (checkData.hasNewMessages) {
          const params = new URLSearchParams();
          if (page > 1) params.set('page', page.toString());
          if (search) params.set('search', search);
          if (categoryFilter !== 'all') params.set('category', categoryFilter);
          if (providerFilter !== 'all') params.set('provider', providerFilter);
          if (methodFilter !== 'all') params.set('method', methodFilter);
          if (ipFilter !== 'all') params.set('ipAddress', ipFilter);

          setLoading(true);
          try {
            const res = await fetch(`/api/messages?${params.toString()}`);
            const data = await res.json();
            if (data.messages && Array.isArray(data.messages)) {
              setMessages(data.messages);
              if (data.meta) {
                setMeta(data.meta);
              }
              // Update last message ID
              if (data.messages.length > 0) {
                setLastMessageId(data.messages[0].id);
              }
            }
          } catch (err) {
            console.error('Error refreshing messages:', err);
          } finally {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error checking for new messages:', err);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [page, search, categoryFilter, providerFilter, methodFilter, ipFilter, lastMessageId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (search) params.set('search', search);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (providerFilter !== 'all') params.set('provider', providerFilter);
    if (methodFilter !== 'all') params.set('method', methodFilter);
    if (ipFilter !== 'all') params.set('ipAddress', ipFilter);

    router.push(`/messages?${params.toString()}`);
  }, [page, search, categoryFilter, providerFilter, methodFilter, ipFilter, router]);

  // Update lastMessageId when messages change (due to filters, page changes, etc.)
  useEffect(() => {
    if (messages.length > 0 && page === 1 && 
        !search && categoryFilter === 'all' && 
        providerFilter === 'all' && methodFilter === 'all' && ipFilter === 'all') {
      setLastMessageId(messages[0].id);
    }
  }, [messages, page, search, categoryFilter, providerFilter, methodFilter, ipFilter]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategoryFilter = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const handleProviderFilter = (value: string) => {
    setProviderFilter(value);
    setPage(1);
  };

  const handleMethodFilter = (value: string) => {
    setMethodFilter(value);
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
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by URL, body content, headers..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={handleCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="EVENT_TRACK">Event Track</SelectItem>
            <SelectItem value="MESSAGE">Message</SelectItem>
            <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
            <SelectItem value="GENERAL">General</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={handleMethodFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ipFilter} onValueChange={handleIpFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
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

      {/* Table */}
      <div className="rounded-md border relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
            <Loading text="Loading messages..." />
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
                            This request has {message.duplicateCount} similar request{message.duplicateCount !== 1 ? 's' : ''} within 5 minutes
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

