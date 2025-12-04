'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Trash2,
  Plus,
  Edit,
  Power,
  PowerOff,
  ExternalLink,
  MoreVertical,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
  toggleForwardConfigEnabled,
  deleteForwardConfig,
} from './actions';
import { cn } from '@/lib/utils';

interface ForwardConfig {
  id: string;
  proxyPath: string;
  method: string;
  targetUrl: string;
  pathRewrite: string | null;
  addHeaders: string | null;
  removeHeaders: string | null;
  enabled: boolean;
  timeout: number;
  retryCount: number;
  retryDelay: number;
  name: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ForwardConfigsClientProps {
  initialConfigs: ForwardConfig[];
  searchParams: {
    enabled?: string;
  };
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export function ForwardConfigsClient({
  initialConfigs,
  searchParams,
}: ForwardConfigsClientProps) {
  const router = useRouter();
  const [configs, setConfigs] = useState<ForwardConfig[]>(initialConfigs);
  const [search, setSearch] = useState('');
  const [enabledFilter, setEnabledFilter] = useState<string>(
    searchParams.enabled || 'all'
  );
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredConfigs = configs.filter((config) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        config.proxyPath.toLowerCase().includes(searchLower) ||
        config.targetUrl.toLowerCase().includes(searchLower) ||
        config.name?.toLowerCase().includes(searchLower) ||
        config.method.toLowerCase().includes(searchLower)
      );
    }
    if (enabledFilter !== 'all') {
      return config.enabled === (enabledFilter === 'true');
    }
    return true;
  });

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    startTransition(async () => {
      try {
        await toggleForwardConfigEnabled(id, !currentEnabled);
        setConfigs((prev) =>
          prev.map((c) => (c.id === id ? { ...c, enabled: !currentEnabled } : c))
        );
      } catch (error: any) {
        console.error('Error toggling config:', error);
        alert(error.message || 'Failed to toggle config');
      }
    });
  };

  const handleDelete = async () => {
    if (!configToDelete) return;

    setIsDeleting(true);
    try {
      await deleteForwardConfig(configToDelete);
      setConfigs((prev) => prev.filter((c) => c.id !== configToDelete));
      setShowDeleteDialog(false);
      setConfigToDelete(null);
    } catch (error: any) {
      console.error('Error deleting config:', error);
      alert(error.message || 'Failed to delete config');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (id: string) => {
    setConfigToDelete(id);
    setShowDeleteDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Forward Configs</h1>
          <p className="text-muted-foreground mt-1">
            Manage request forwarding configurations
          </p>
        </div>
        <Button onClick={() => router.push('/forward-configs/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Config
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by path, target URL, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={enabledFilter} onValueChange={setEnabledFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Enabled</SelectItem>
            <SelectItem value="false">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg relative">
        {(isPending || isDeleting) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <Loading text={isDeleting ? 'Deleting...' : 'Updating...'} />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Proxy Path</TableHead>
              <TableHead>Target URL</TableHead>
              <TableHead>Timeout</TableHead>
              <TableHead>Retries</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">
                <MoreVertical className="h-4 w-4 inline-block" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConfigs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="text-muted-foreground">
                    No forward configs found
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredConfigs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    <Badge
                      variant={config.enabled ? 'default' : 'secondary'}
                      className={cn(
                        config.enabled
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : ''
                      )}
                    >
                      {config.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {config.name || 'Unnamed Config'}
                      </div>
                      {config.description && (
                        <div className="text-sm text-muted-foreground">
                          {config.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={methodColors[config.method] || ''}
                    >
                      {config.method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {config.proxyPath}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded max-w-[300px] truncate">
                        {config.targetUrl}
                      </code>
                      <a
                        href={config.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>{config.timeout}ms</TableCell>
                  <TableCell>{config.retryCount}</TableCell>
                  <TableCell>
                    {format(new Date(config.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/forward-configs/${config.id}/edit`)
                          }
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggleEnabled(config.id, config.enabled)
                          }
                        >
                          {config.enabled ? (
                            <>
                              <PowerOff className="h-4 w-4 mr-2" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4 mr-2" />
                              Enable
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(config.id)}
                          className="text-destructive"
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

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Forward Config</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this forward config? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setConfigToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

