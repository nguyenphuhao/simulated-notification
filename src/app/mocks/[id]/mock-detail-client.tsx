'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { JsonViewer } from '@/components/json-viewer';
import { Edit, Eye, Power, PowerOff, Copy, Check, Play, Loader2 } from 'lucide-react';
import { toggleMockEndpointActive } from '../actions';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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

interface MockRequest {
  id: string;
  headers: string;
  body: string | null;
  queryParams: string | null;
  pathParams: string | null;
  responseCode: number;
  responseBody: string | null;
  responseHeaders: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface MockDetailClientProps {
  endpoint: MockEndpoint;
  initialRequests: MockRequest[];
  initialMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

function parseJSON(str: string | null): object | string | null {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export function MockDetailClient({
  endpoint,
  initialRequests,
  initialMeta,
}: MockDetailClientProps) {
  const router = useRouter();
  const [requests] = useState(initialRequests);
  const [meta] = useState(initialMeta);
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<{
    status: number;
    headers: Record<string, string>;
    body: any;
    error?: string;
    warning?: string;
  } | null>(null);
  
  // Test form state
  const [testHeaders, setTestHeaders] = useState<string>('{}');
  const [testBody, setTestBody] = useState<string>('');
  const [testQueryParams, setTestQueryParams] = useState<string>('');
  const [testPathParams, setTestPathParams] = useState<string>('{}');

  // Get base URL after component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    } else {
      setBaseUrl(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7777');
    }
  }, []);

  // Initialize path params if endpoint has path parameters
  useEffect(() => {
    const pathParams: Record<string, string> = {};
    const pathParts = endpoint.path.split('/');
    pathParts.forEach((part) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1);
        pathParams[paramName] = '';
      }
    });
    if (Object.keys(pathParams).length > 0) {
      setTestPathParams(JSON.stringify(pathParams, null, 2));
    }
  }, [endpoint.path]);

  const fullUrl = baseUrl ? `${baseUrl}/api/proxy${endpoint.path}` : '';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleToggleActive = async () => {
    try {
      await toggleMockEndpointActive(endpoint.id);
      router.refresh();
    } catch (error: any) {
      console.error('Error toggling endpoint:', error);
      alert('Failed to toggle endpoint: ' + error.message);
    }
  };

  const handleTestApi = async () => {
    if (!baseUrl || !endpoint.isActive) {
      alert('Endpoint is not active. Please activate it first.');
      return;
    }

    setIsTesting(true);
    setTestResponse(null);

    try {
      // Replace path params - must replace all :paramName with actual values
      let finalPath = endpoint.path;
      try {
        const pathParamsObj = JSON.parse(testPathParams || '{}');
        // Check if all path params are filled
        const pathParamNames: string[] = [];
        const pathParts = endpoint.path.split('/');
        pathParts.forEach((part) => {
          if (part.startsWith(':')) {
            pathParamNames.push(part.slice(1));
          }
        });

        // Replace each path parameter
        pathParamNames.forEach((paramName) => {
          const paramValue = pathParamsObj[paramName];
          if (paramValue) {
            finalPath = finalPath.replace(`:${paramName}`, paramValue);
          } else {
            // If path param is not provided, use a placeholder that will match
            // But better to show error
            throw new Error(`Path parameter "${paramName}" is required`);
          }
        });
      } catch (e: any) {
        if (e.message && e.message.includes('required')) {
          alert(e.message);
          setIsTesting(false);
          return;
        }
        // Invalid path params JSON, check if path has params
        if (endpoint.path.includes(':')) {
          alert('Please fill in all path parameters');
          setIsTesting(false);
          return;
        }
      }

      // Build URL with query params
      let testUrl = `${baseUrl}/api/proxy${finalPath}`;
      
      // Add query params
      try {
        const queryParamsObj = JSON.parse(testQueryParams || '{}');
        const queryString = new URLSearchParams(
          Object.entries(queryParamsObj).reduce((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {} as Record<string, string>)
        ).toString();
        if (queryString) {
          testUrl += `?${queryString}`;
        }
      } catch (e) {
        // Invalid query params JSON, ignore
      }

      // Parse headers
      let headers: Record<string, string> = {};
      try {
        headers = JSON.parse(testHeaders || '{}');
      } catch (e) {
        // Invalid headers JSON, use empty object
      }

      // Parse body
      let body: any = null;
      if (testBody.trim()) {
        try {
          body = JSON.parse(testBody);
        } catch (e) {
          body = testBody; // Use as plain text if not valid JSON
        }
      }

      // Make request
      const fetchOptions: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(testUrl, fetchOptions);
      
      // Get response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Get response body
      let responseBody: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch (e) {
          responseBody = await response.text();
        }
      } else {
        responseBody = await response.text();
      }

      // Check if this is a mock response or general proxy response
      // General proxy response has structure: { success: true, category: ..., message: "Request logged successfully" }
      const isGeneralProxyResponse = 
        responseBody &&
        typeof responseBody === 'object' &&
        'success' in responseBody &&
        'category' in responseBody &&
        'message' in responseBody &&
        responseBody.message === 'Request logged successfully';

      setTestResponse({
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
        ...(isGeneralProxyResponse ? { 
          warning: 'This appears to be a general proxy response, not a mock response. Make sure the mock endpoint is active and the path matches correctly.' 
        } : {}),
      });
    } catch (error: any) {
      setTestResponse({
        status: 0,
        headers: {},
        body: null,
        error: error.message || 'Failed to test API',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Endpoint Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Endpoint Configuration</CardTitle>
              <CardDescription>
                Created at {format(new Date(endpoint.createdAt), 'PPpp')}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge
                variant={endpoint.isActive ? 'default' : 'secondary'}
              >
                {endpoint.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Badge
                variant="outline"
                className={
                  methodColors[endpoint.method] ||
                  'bg-gray-100 text-gray-800'
                }
              >
                {endpoint.method}
              </Badge>
              <Badge variant="outline">{endpoint.responseCode}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Path
              </label>
              <p className="mt-1 font-mono text-sm">{endpoint.path}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              <p className="mt-1">
                {endpoint.name || (
                  <span className="text-muted-foreground">-</span>
                )}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Full URL
            </label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md border">
              <code className="flex-1 font-mono text-sm break-all">
                {fullUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyUrl}
                className="h-8 w-8 flex-shrink-0"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use this URL to call the mock endpoint
            </p>
          </div>

          {endpoint.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Description
              </label>
              <p className="mt-1">{endpoint.description}</p>
            </div>
          )}

          <Separator />

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Response Headers
            </label>
            <div className="mt-1">
              {endpoint.responseHeaders ? (
                <JsonViewer src={parseJSON(endpoint.responseHeaders)} />
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Response Body Script
            </label>
            <pre className="mt-1 p-4 bg-muted rounded-md overflow-x-auto text-xs">
              {endpoint.responseBody}
            </pre>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={() => router.push(`/mocks/${endpoint.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Endpoint
            </Button>
            <Button
              variant="outline"
              onClick={handleToggleActive}
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
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test API */}
      <Card>
        <CardHeader>
          <CardTitle>Test API</CardTitle>
          <CardDescription>
            Test the mock endpoint and see the response
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!endpoint.isActive && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This endpoint is inactive. Please activate it to test.
              </p>
            </div>
          )}

          <Tabs defaultValue="params" className="w-full">
            <TabsList>
              <TabsTrigger value="params">Path & Query Params</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
            </TabsList>

            <TabsContent value="params" className="space-y-4">
              {Object.keys(JSON.parse(testPathParams || '{}')).length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="pathParams">Path Parameters</Label>
                  <Textarea
                    id="pathParams"
                    value={testPathParams}
                    onChange={(e) => setTestPathParams(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                    placeholder='{"id": "123", "userId": "456"}'
                  />
                  <p className="text-xs text-muted-foreground">
                    JSON object with path parameter values
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="queryParams">Query Parameters</Label>
                <Textarea
                  id="queryParams"
                  value={testQueryParams}
                  onChange={(e) => setTestQueryParams(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                  placeholder='{"page": "1", "limit": "10"}'
                />
                <p className="text-xs text-muted-foreground">
                  JSON object with query parameter key-value pairs
                </p>
              </div>
            </TabsContent>

            <TabsContent value="headers" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="headers">Request Headers</Label>
                <Textarea
                  id="headers"
                  value={testHeaders}
                  onChange={(e) => setTestHeaders(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                  placeholder='{"Authorization": "Bearer token", "X-Custom-Header": "value"}'
                />
                <p className="text-xs text-muted-foreground">
                  JSON object with header key-value pairs
                </p>
              </div>
            </TabsContent>

            <TabsContent value="body" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="body">Request Body</Label>
                <Textarea
                  id="body"
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder='{"key": "value"}'
                />
                <p className="text-xs text-muted-foreground">
                  JSON object or plain text (only for POST, PUT, PATCH methods)
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2">
            <Button
              onClick={handleTestApi}
              disabled={isTesting || !endpoint.isActive}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Test API
                </>
              )}
            </Button>
            {testResponse && (
              <Button
                variant="outline"
                onClick={() => {
                  setTestResponse(null);
                  setTestHeaders('{}');
                  setTestBody('');
                  setTestQueryParams('');
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {testResponse && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label className="text-sm font-medium">Response Status</Label>
                <div className="mt-1">
                  <Badge
                    variant={
                      testResponse.status >= 200 && testResponse.status < 300
                        ? 'default'
                        : 'destructive'
                    }
                  >
                    {testResponse.status || 'Error'}
                  </Badge>
                </div>
              </div>

              {testResponse.warning && (
                <div>
                  <Label className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    Warning
                  </Label>
                  <div className="mt-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">{testResponse.warning}</p>
                  </div>
                </div>
              )}

              {testResponse.error && (
                <div>
                  <Label className="text-sm font-medium text-destructive">
                    Error
                  </Label>
                  <div className="mt-1 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{testResponse.error}</p>
                  </div>
                </div>
              )}

              {Object.keys(testResponse.headers).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Response Headers</Label>
                  <div className="mt-1">
                    <JsonViewer src={testResponse.headers} />
                  </div>
                </div>
              )}

              {testResponse.body !== null && (
                <div>
                  <Label className="text-sm font-medium">Response Body</Label>
                  <div className="mt-1">
                    <JsonViewer src={testResponse.body} />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requests History */}
      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
          <CardDescription>
            {meta.total} request{meta.total !== 1 ? 's' : ''} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No requests recorded yet
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {requests.map((request, index) => (
                <AccordionItem key={request.id} value={request.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2 flex-1 text-left">
                      <Badge variant="outline">
                        {format(new Date(request.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                      </Badge>
                      <Badge variant="outline">{request.responseCode}</Badge>
                      {request.ipAddress && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {request.ipAddress}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {request.pathParams && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Path Params
                          </label>
                          <div className="mt-1">
                            <JsonViewer src={parseJSON(request.pathParams)} />
                          </div>
                        </div>
                      )}

                      {request.queryParams && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Query Params
                          </label>
                          <div className="mt-1">
                            <JsonViewer src={parseJSON(request.queryParams)} />
                          </div>
                        </div>
                      )}

                      {request.body && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Request Body
                          </label>
                          <div className="mt-1">
                            <JsonViewer src={parseJSON(request.body)} />
                          </div>
                        </div>
                      )}

                      {request.responseBody && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Response Body
                          </label>
                          <div className="mt-1">
                            <JsonViewer src={parseJSON(request.responseBody)} />
                          </div>
                        </div>
                      )}

                      {request.responseHeaders && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Response Headers
                          </label>
                          <div className="mt-1">
                            <JsonViewer src={parseJSON(request.responseHeaders)} />
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

