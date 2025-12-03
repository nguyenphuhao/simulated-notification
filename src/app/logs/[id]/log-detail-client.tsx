'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { JsonViewer } from '@/components/json-viewer';
import { cn } from '@/lib/utils';

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

interface LogDetailClientProps {
  log: Log;
}

const levelColors: Record<string, { bg: string; text: string; border: string }> = {
  DEBUG: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
  INFO: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  WARN: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  ERROR: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  FATAL: { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' },
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

export function LogDetailClient({ log }: LogDetailClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const levelColor = levelColors[log.logLevel] || levelColors.INFO;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Log Information</CardTitle>
              <CardDescription>
                Created at {format(new Date(log.createdAt), 'PPpp')}
              </CardDescription>
            </div>
            <div className="flex gap-2">
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
              <Badge variant="outline">{log.logSource}</Badge>
              {log.logTags && log.logTags.length > 0 && (
                <>
                  {log.logTags.map((tag, i) => (
                    <Badge key={i} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Message</div>
              <div className="mt-1 text-sm break-all">{log.logMessage}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Source</div>
              <div className="mt-1 text-sm">{log.logSource}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">IP Address</div>
              <div className="mt-1 text-sm">{log.ipAddress || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">User Agent</div>
              <div className="mt-1 text-sm break-all">{log.userAgent || 'N/A'}</div>
            </div>
            {log.logTags && log.logTags.length > 0 && (
              <div className="md:col-span-2">
                <div className="text-sm font-medium text-muted-foreground">Tags</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {log.logTags.map((tag, i) => (
                    <Badge key={i} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Search Content</CardTitle>
          <CardDescription>
            Search across all log details below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Search in headers, body..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Log Details - 2 Column Grid */}
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
                  {highlightText(formatJSON(log.headers), searchTerm)}
                </pre>
              </div>
            ) : (
              <JsonViewer src={parseJSON(log.headers)} name={false} />
            )}
          </CardContent>
        </Card>

        {/* Body Section */}
        <Card>
          <CardHeader>
            <CardTitle>Body</CardTitle>
            <CardDescription>Log body content</CardDescription>
          </CardHeader>
          <CardContent>
            {searchTerm ? (
              <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
                <pre className="text-xs overflow-auto max-h-[400px]">
                  {highlightText(formatJSON(log.body), searchTerm)}
                </pre>
              </div>
            ) : (
              <JsonViewer src={parseJSON(log.body)} name={false} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

