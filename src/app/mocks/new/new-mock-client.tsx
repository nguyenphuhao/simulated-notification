'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeEditor } from '@/components/code-editor';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { createMockEndpoint } from '../actions';

export function NewMockClient() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    path: '',
    method: 'GET',
    name: '',
    description: '',
    responseCode: 200,
    responseBody: `// Example: Return a simple response
return {
  statusCode: 200,
  body: {
    message: 'Hello from mock endpoint',
    timestamp: utils.timestamp(),
  },
};`,
    responseHeaders: '',
    isActive: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createMockEndpoint({
        path: formData.path,
        method: formData.method,
        name: formData.name || undefined,
        description: formData.description || undefined,
        responseCode: formData.responseCode,
        responseBody: formData.responseBody,
        responseHeaders: formData.responseHeaders || undefined,
        isActive: formData.isActive,
      });

      router.push('/mocks');
      router.refresh();
    } catch (error: any) {
      console.error('Error creating mock endpoint:', error);
      alert('Failed to create mock endpoint: ' + error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/mocks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1" />
        <Button type="submit" disabled={isSubmitting}>
          <Save className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Creating...' : 'Create Mock Endpoint'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Configure the endpoint path and method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="path">Path *</Label>
              <Input
                id="path"
                placeholder="/api/users/:id"
                value={formData.path}
                onChange={(e) =>
                  setFormData({ ...formData, path: e.target.value })
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                Use :paramName for path parameters (e.g., /api/users/:id)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Method *</Label>
              <Select
                value={formData.method}
                onValueChange={(value) =>
                  setFormData({ ...formData, method: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="User API Endpoint"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Description of this mock endpoint"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response Configuration</CardTitle>
            <CardDescription>
              Configure the response code and headers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="responseCode">Response Code</Label>
              <Input
                id="responseCode"
                type="number"
                min={100}
                max={599}
                value={formData.responseCode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    responseCode: parseInt(e.target.value) || 200,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="responseHeaders">Response Headers (JSON)</Label>
              <Textarea
                id="responseHeaders"
                placeholder='{"Content-Type": "application/json", "X-Custom-Header": "value"}'
                value={formData.responseHeaders}
                onChange={(e) =>
                  setFormData({ ...formData, responseHeaders: e.target.value })
                }
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Optional: JSON object of headers to include in response
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Response Body Script</CardTitle>
          <CardDescription>
            JSON object (raw) or JavaScript code that generates the response. 
            If JSON, it will be returned directly. 
            If JavaScript, available variables: request (method, path, headers, body, queryParams, pathParams),
            utils (random, uuid, timestamp, date, map, filter, find, reduce, sort, keys, values, entries, includes, startsWith, endsWith, getQueryParam, getPathParam, getHeader, parseBody)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="responseBody">JavaScript Code *</Label>
            <CodeEditor
              value={formData.responseBody}
              onChange={(value) =>
                setFormData({ ...formData, responseBody: value })
              }
              placeholder="// Example: Return a simple response&#10;return {&#10;  statusCode: 200,&#10;  body: {&#10;    message: 'Hello from mock endpoint',&#10;    timestamp: utils.timestamp(),&#10;  },&#10;};"
              height="400px"
            />
            <p className="text-xs text-muted-foreground">
              The script should return an object with statusCode and body, or
              just a value (will be wrapped in 200 response)
            </p>
          </div>
        </CardContent>
      </Card>
    </form>
    </TooltipProvider>
  );
}

