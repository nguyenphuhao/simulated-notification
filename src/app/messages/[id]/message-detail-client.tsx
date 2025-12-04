'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { MessageCategory } from '@/lib/types';
import { JsonViewer } from '@/components/json-viewer';

interface Message {
  id: string;
  category: MessageCategory;
  provider: string | null;
  sourceUrl: string;
  method: string;
  headers: string;
  body: string | null;
  queryParams: string | null;
  statusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  processedAt: Date | null;
  forwarded?: boolean;
  forwardTarget?: string | null;
  forwardStatus?: string | null;
  forwardError?: string | null;
  responseTime?: number | null;
  responseSize?: number | null;
  requestSize?: number | null;
  responseHeaders?: string | null;
}

interface MessageDetailClientProps {
  message: Message;
}

const categoryColors: Record<MessageCategory, string> = {
  EVENT_TRACK: 'bg-blue-500',
  MESSAGE: 'bg-green-500',
  AUTHENTICATION: 'bg-orange-500',
  MOCK_API: 'bg-purple-500',
  GENERAL: 'bg-gray-500',
};

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800',
  POST: 'bg-green-100 text-green-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-purple-100 text-purple-800',
};

function parseJSON(str: string | null): object | string | null {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function formatJSON(str: string | null): string {
  if (!str) return 'N/A';
  try {
    const parsed = JSON.parse(str);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return str;
  }
}

function highlightText(text: string, search: string) {
  if (!search) return text;
  const regex = new RegExp(`(${search})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function MessageDetailClient({ message }: MessageDetailClientProps) {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Request Information</CardTitle>
              <CardDescription>
                Created at {format(new Date(message.createdAt), 'PPpp')}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={categoryColors[message.category]}>
                {message.category}
              </Badge>
              {message.provider && (
                <Badge variant="outline">{message.provider}</Badge>
              )}
              <Badge
                variant="outline"
                className={methodColors[message.method] || ''}
              >
                {message.method}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">URL</div>
              <div className="mt-1 text-sm font-mono break-all">{message.sourceUrl}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">IP Address</div>
              <div className="mt-1 text-sm">{message.ipAddress || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">User Agent</div>
              <div className="mt-1 text-sm break-all">{message.userAgent || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status Code</div>
              <div className="mt-1 text-sm">
                {message.statusCode ? (
                  <Badge
                    variant={
                      message.statusCode >= 200 && message.statusCode < 300
                        ? 'default'
                        : 'destructive'
                    }
                  >
                    {message.statusCode}
                  </Badge>
                ) : (
                  'N/A'
                )}
              </div>
            </div>
            {message.processedAt && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Processed At</div>
                <div className="mt-1 text-sm">
                  {format(new Date(message.processedAt), 'PPpp')}
                </div>
              </div>
            )}
            {message.errorMessage && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Error</div>
                <div className="mt-1 text-sm text-destructive">{message.errorMessage}</div>
              </div>
            )}
            {message.forwarded && (
              <>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Forwarded</div>
                  <div className="mt-1">
                    <Badge variant="default">Yes</Badge>
                  </div>
                </div>
                {message.forwardTarget && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Forward Target</div>
                    <div className="mt-1 text-sm font-mono break-all">{message.forwardTarget}</div>
                  </div>
                )}
                {message.forwardStatus && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Forward Status</div>
                    <div className="mt-1">
                      <Badge
                        variant={
                          message.forwardStatus === 'SUCCESS' ? 'default' : 'destructive'
                        }
                      >
                        {message.forwardStatus}
                      </Badge>
                    </div>
                  </div>
                )}
                {message.responseTime !== null && message.responseTime !== undefined && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Response Time</div>
                    <div className="mt-1 text-sm">{message.responseTime}ms</div>
                  </div>
                )}
                {message.forwardError && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Forward Error</div>
                    <div className="mt-1 text-sm text-destructive">{message.forwardError}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Search Content</CardTitle>
          <CardDescription>
            Search across all request details below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Search in headers, body, query params, response..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Request Details - 2 Column Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Headers Section */}
        <Card>
          <CardHeader>
            <CardTitle>Headers</CardTitle>
            <CardDescription>Request headers</CardDescription>
          </CardHeader>
          <CardContent>
            {searchTerm ? (
              <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
                <pre className="text-xs overflow-auto max-h-[400px]">
                  {highlightText(formatJSON(message.headers), searchTerm)}
                </pre>
              </div>
            ) : (
              <JsonViewer src={parseJSON(message.headers)} name={false} />
            )}
          </CardContent>
        </Card>

        {/* Body Section */}
        <Card>
          <CardHeader>
            <CardTitle>Body</CardTitle>
            <CardDescription>Request body content</CardDescription>
          </CardHeader>
          <CardContent>
            {searchTerm ? (
              <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
                <pre className="text-xs overflow-auto max-h-[400px]">
                  {highlightText(formatJSON(message.body), searchTerm)}
                </pre>
              </div>
            ) : (
              <JsonViewer src={parseJSON(message.body)} name={false} />
            )}
          </CardContent>
        </Card>

        {/* Query Params Section */}
        <Card>
          <CardHeader>
            <CardTitle>Query Parameters</CardTitle>
            <CardDescription>URL query parameters</CardDescription>
          </CardHeader>
          <CardContent>
            {searchTerm ? (
              <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
                <pre className="text-xs overflow-auto max-h-[400px]">
                  {highlightText(formatJSON(message.queryParams), searchTerm)}
                </pre>
              </div>
            ) : (
              <JsonViewer src={parseJSON(message.queryParams)} name={false} />
            )}
          </CardContent>
        </Card>

        {/* Response Section */}
        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
            <CardDescription>Response body</CardDescription>
          </CardHeader>
          <CardContent>
            {searchTerm ? (
              <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
                <pre className="text-xs overflow-auto max-h-[400px]">
                  {highlightText(formatJSON(message.responseBody), searchTerm)}
                </pre>
              </div>
            ) : (
              <JsonViewer src={parseJSON(message.responseBody)} name={false} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

