'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Eye, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { MessageCategory } from '@/lib/types';
import { format } from 'date-fns';
import { deleteMessage } from './actions';

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

  // Auto-refresh messages every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
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
        // Only update if we're on the same page and filters
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
          if (data.meta) {
            setMeta(data.meta);
          }
        }
      } catch (err) {
        console.error('Error refreshing messages:', err);
      } finally {
        setLoading(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [page, search, categoryFilter, providerFilter, methodFilter, ipFilter]);

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
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No messages found
                </TableCell>
              </TableRow>
            ) : (
              messages.map((message) => (
                <TableRow 
                  key={message.id}
                  onDoubleClick={() => handleViewMessage(message.id)}
                  className="cursor-pointer"
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm cursor-help">
                          {format(new Date(message.createdAt), 'MMM dd, yyyy HH:mm')}
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
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(meta.page - 1) * meta.limit + 1} to{' '}
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} messages
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= meta.totalPages || isPending}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}

