'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ErrorLevel } from '../actions';
import { Input } from '@/components/ui/input';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { JsonViewer } from '@/components/json-viewer';

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

interface ErrorLogDetailClientProps {
  errorLog: ErrorLog;
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

function parseJSON(str: string | null): object | string | null {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function highlightText(text: string, search: string) {
  if (!search) return text;
  const parts = text.split(new RegExp(`(${search})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function ErrorLogDetailClient({ errorLog }: ErrorLogDetailClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const LevelIcon = levelIcons[errorLog.level];

  return (
    <div className="space-y-6">
      {/* Header Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Error Information</CardTitle>
            <Badge className={levelColors[errorLog.level]}>
              <LevelIcon className="h-3 w-3 mr-1" />
              {errorLog.level}
            </Badge>
          </div>
          <CardDescription>Basic error information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Source</div>
              <div className="text-sm font-mono">{errorLog.source}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Created At</div>
              <div className="text-sm">{format(new Date(errorLog.createdAt), 'PPpp')}</div>
            </div>
            {errorLog.ipAddress && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">IP Address</div>
                <div className="text-sm">{errorLog.ipAddress}</div>
              </div>
            )}
            {errorLog.userAgent && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">User Agent</div>
                <div className="text-sm font-mono text-xs">{errorLog.userAgent}</div>
              </div>
            )}
          </div>
          <Separator />
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Message</div>
            <div className="text-sm bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md">
              {highlightText(errorLog.message, searchTerm)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Bar Card */}
      <Card>
        <CardHeader>
          <CardTitle>Search Content</CardTitle>
          <CardDescription>Search across all error details below</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Search in message, stack trace, context, request details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Details Sections - 2 Column Layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Stack Trace Section */}
        {errorLog.stack && (
          <Card>
            <CardHeader>
              <CardTitle>Stack Trace</CardTitle>
              <CardDescription>Error stack trace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
                <pre className="text-xs overflow-auto max-h-[400px] whitespace-pre-wrap">
                  {highlightText(errorLog.stack, searchTerm)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Context Section */}
        {errorLog.context && (
          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
              <CardDescription>Additional context information</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonViewer src={parseJSON(errorLog.context)} name={false} />
            </CardContent>
          </Card>
        )}

        {/* Request Headers Section */}
        {errorLog.requestHeaders && (
          <Card>
            <CardHeader>
              <CardTitle>Request Headers</CardTitle>
              <CardDescription>HTTP request headers</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonViewer src={parseJSON(errorLog.requestHeaders)} name={false} />
            </CardContent>
          </Card>
        )}

        {/* Request Body Section */}
        {errorLog.requestBody && (
          <Card>
            <CardHeader>
              <CardTitle>Request Body</CardTitle>
              <CardDescription>HTTP request body</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonViewer src={parseJSON(errorLog.requestBody)} name={false} />
            </CardContent>
          </Card>
        )}

        {/* Request URL Section */}
        {errorLog.requestUrl && (
          <Card>
            <CardHeader>
              <CardTitle>Request URL</CardTitle>
              <CardDescription>HTTP request URL and method</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {errorLog.requestMethod && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Method</div>
                    <div className="text-sm font-mono">{errorLog.requestMethod}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-muted-foreground">URL</div>
                  <div className="text-sm font-mono break-all">{errorLog.requestUrl}</div>
                </div>
                {errorLog.responseStatus && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Response Status</div>
                    <div className="text-sm">{errorLog.responseStatus}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

