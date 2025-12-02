'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Power,
  PowerOff,
  Copy,
  Check,
} from 'lucide-react';
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
import {
  deleteMockEndpoint,
  toggleMockEndpointActive,
} from './actions';
import { cn } from '@/lib/utils';

interface MockEndpoint {
  id: string;
  path: string;
  method: string;
  name: string | null;
  description: string | null;
  responseCode: number;
  responseBody: string;
  responseHeaders: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  requestCount: number;
}

interface MocksClientProps {
  initialEndpoints: MockEndpoint[];
  initialMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchParams: {
    page?: string;
    search?: string;
    method?: string;
    isActive?: string;
  };
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export function MocksClient({
  initialEndpoints,
  initialMeta,
  searchParams,
}: MocksClientProps) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const [endpoints, setEndpoints] = useState<MockEndpoint[]>(initialEndpoints);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.search || '');
  const [methodFilter, setMethodFilter] = useState(
    searchParams.method || 'all'
  );
  const [isActiveFilter, setIsActiveFilter] = useState(
    searchParams.isActive || 'all'
  );
  const [page, setPage] = useState(Number(searchParams.page) || 1);
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [endpointToDelete, setEndpointToDelete] = useState<string | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Get base URL after component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    } else {
      setBaseUrl(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7777');
    }
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParamsHook.toString());
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/mocks?${params.toString()}`);
  };

  const handleFilterChange = () => {
    const params = new URLSearchParams(searchParamsHook.toString());
    if (methodFilter !== 'all') {
      params.set('method', methodFilter);
    } else {
      params.delete('method');
    }
    if (isActiveFilter !== 'all') {
      params.set('isActive', isActiveFilter);
    } else {
      params.delete('isActive');
    }
    params.set('page', '1');
    router.push(`/mocks?${params.toString()}`);
  };

  const handleViewEndpoint = (id: string) => {
    router.push(`/mocks/${id}`);
  };

  const handleEditEndpoint = (id: string) => {
    router.push(`/mocks/${id}/edit`);
  };

  const handleDeleteClick = (id: string) => {
    setEndpointToDelete(id);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!endpointToDelete) return;

    setIsDeleting(true);
    try {
      await deleteMockEndpoint(endpointToDelete);
      setShowDeleteDialog(false);
      setEndpointToDelete(null);
      router.refresh();
    } catch (error: any) {
      console.error('Error deleting endpoint:', error);
      alert('Failed to delete endpoint: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await toggleMockEndpointActive(id);
      router.refresh();
    } catch (error: any) {
      console.error('Error toggling endpoint:', error);
      alert('Failed to toggle endpoint: ' + error.message);
    }
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParamsHook.toString());
    params.set('page', String(newPage));
    router.push(`/mocks?${params.toString()}`);
  };

  const handleCopyUrl = async (endpointId: string, endpointPath: string) => {
    const fullUrl = `${baseUrl}/api/proxy${endpointPath}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(endpointId);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mock Endpoints</h1>
          <p className="text-muted-foreground mt-1">
            Manage mock API endpoints and their responses
          </p>
        </div>
        <Button onClick={() => router.push('/mocks/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Mock Endpoint
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Search by path, name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            className="max-w-sm"
          />
          <Button onClick={handleSearch} variant="outline">
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Method" />
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

        <Select value={isActiveFilter} onValueChange={setIsActiveFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={handleFilterChange} variant="outline">
          Apply Filters
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Response Code</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpoints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="text-muted-foreground">
                    No mock endpoints found
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              endpoints.map((endpoint, index) => (
                <TableRow
                  key={endpoint.id}
                  onDoubleClick={() => handleViewEndpoint(endpoint.id)}
                  className={cn(
                    'cursor-pointer',
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/50'
                  )}
                >
                  <TableCell>
                    <Badge
                      variant={endpoint.isActive ? 'default' : 'secondary'}
                    >
                      {endpoint.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        methodColors[endpoint.method] ||
                        'bg-gray-100 text-gray-800'
                      }
                    >
                      {endpoint.method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-sm font-mono break-all">
                        {endpoint.path}
                      </div>
                      {baseUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => handleCopyUrl(endpoint.id, endpoint.path)}
                          title="Copy full URL"
                        >
                          {copiedUrl === endpoint.id ? (
                            <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {endpoint.name ? (
                      <div className="text-sm">
                        {endpoint.name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{endpoint.responseCode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{endpoint.requestCount}</Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(endpoint.createdAt), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <span className="sr-only">Open menu</span>
                          <span>⋯</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleViewEndpoint(endpoint.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEditEndpoint(endpoint.id)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(endpoint.id)}
                        >
                          {endpoint.isActive ? (
                            <>
                              <PowerOff className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(endpoint.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
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
            Showing {Math.min((page - 1) * meta.limit + 1, meta.total)} to{' '}
            {Math.min(page * meta.limit, meta.total)} of {meta.total} endpoints
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                Page {page} of {meta.totalPages}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === meta.totalPages || isPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Mock Endpoint</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this mock endpoint? This action
              cannot be undone and will also delete all associated requests.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setEndpointToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}

