'use client';

import { useState, useEffect } from 'react';
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

interface ForwardConfigOption {
  id: string;
  name: string | null;
  proxyPath: string;
  method: string;
}

export function NewForwardConfigClient() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forwardConfigs, setForwardConfigs] = useState<ForwardConfigOption[]>([]);
  const [formData, setFormData] = useState({
    proxyPath: '',
    method: 'POST',
    targetUrl: '',
    pathRewrite: '',
    name: '',
    description: '',
    addHeaders: '{}',
    removeHeaders: '[]',
    extractTokenFrom: 'none', // Default to none - optional feature
    tokenPath: '',
    tokenHeaderName: 'Authorization',
    nextForwardConfigId: '',
    timeout: 30000,
    retryCount: 0,
    retryDelay: 1000,
    enabled: true,
  });

  // Load forward configs for chaining dropdown
  useEffect(() => {
    fetch('/api/forward-configs')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setForwardConfigs(data.data);
        }
      })
      .catch((err) => console.error('Error loading forward configs:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Parse JSON fields
      let addHeaders: Record<string, string> | undefined;
      let removeHeaders: string[] | undefined;

      try {
        addHeaders = formData.addHeaders ? JSON.parse(formData.addHeaders) : undefined;
      } catch (e) {
        alert('Invalid JSON in Add Headers field');
        setIsSubmitting(false);
        return;
      }

      try {
        removeHeaders = formData.removeHeaders ? JSON.parse(formData.removeHeaders) : undefined;
      } catch (e) {
        alert('Invalid JSON in Remove Headers field');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/forward-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxyPath: formData.proxyPath,
          method: formData.method,
          targetUrl: formData.targetUrl,
          pathRewrite: formData.pathRewrite || undefined,
          name: formData.name || undefined,
          description: formData.description || undefined,
          addHeaders,
          removeHeaders,
          extractTokenFrom: formData.extractTokenFrom && formData.extractTokenFrom !== 'none' ? formData.extractTokenFrom : undefined,
          tokenPath: formData.extractTokenFrom === 'auto' || formData.extractTokenFrom === 'none' ? undefined : (formData.tokenPath || undefined),
          tokenHeaderName: formData.extractTokenFrom && formData.extractTokenFrom !== 'none' ? formData.tokenHeaderName : undefined,
          nextForwardConfigId: formData.extractTokenFrom && formData.extractTokenFrom !== 'none' ? (formData.nextForwardConfigId || undefined) : undefined,
          timeout: formData.timeout,
          retryCount: formData.retryCount,
          retryDelay: formData.retryDelay,
          enabled: formData.enabled,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create forward config');
      }

      router.push('/forward-configs');
      router.refresh();
    } catch (error: any) {
      console.error('Error creating forward config:', error);
      alert('Failed to create forward config: ' + error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/forward-configs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1" />
          <Button type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Creating...' : 'Create Forward Config'}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Configure the proxy path and target URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Snowplow Event Tracking"
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
                  placeholder="Description of this forward config"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="proxyPath">Proxy Path *</Label>
                <Input
                  id="proxyPath"
                  placeholder="/api/proxy/snowplow/track"
                  value={formData.proxyPath}
                  onChange={(e) =>
                    setFormData({ ...formData, proxyPath: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use * for wildcard (e.g., /api/proxy/snowplow/*)
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
                <Label htmlFor="targetUrl">Target URL *</Label>
                <Input
                  id="targetUrl"
                  placeholder="https://real-server.com/api/endpoint"
                  value={formData.targetUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, targetUrl: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use * to replace with extracted path from proxy path
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pathRewrite">Path Rewrite</Label>
                <Input
                  id="pathRewrite"
                  placeholder="/track"
                  value={formData.pathRewrite}
                  onChange={(e) =>
                    setFormData({ ...formData, pathRewrite: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Rewrite path when forwarding
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced Options</CardTitle>
              <CardDescription>
                Configure headers, timeout, and retry settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addHeaders">Add Headers (JSON)</Label>
                <CodeEditor
                  value={formData.addHeaders}
                  onChange={(value) =>
                    setFormData({ ...formData, addHeaders: value || '{}' })
                  }
                  height="120px"
                />
                <p className="text-xs text-muted-foreground">
                  JSON object: {'{"Authorization": "Bearer xxx"}'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="removeHeaders">Remove Headers (JSON Array)</Label>
                <CodeEditor
                  value={formData.removeHeaders}
                  onChange={(value) =>
                    setFormData({ ...formData, removeHeaders: value || '[]' })
                  }
                  height="80px"
                />
                <p className="text-xs text-muted-foreground">
                  JSON array: {'["X-Forwarded-For", "X-Real-IP"]'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (ms) *</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={formData.timeout}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      timeout: parseInt(e.target.value) || 30000,
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retryCount">Retry Count</Label>
                <Input
                  id="retryCount"
                  type="number"
                  value={formData.retryCount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      retryCount: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retryDelay">Retry Delay (ms)</Label>
                <Input
                  id="retryDelay"
                  type="number"
                  value={formData.retryDelay}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      retryDelay: parseInt(e.target.value) || 1000,
                    })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) =>
                    setFormData({ ...formData, enabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="enabled">Enabled</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Authentication & Chaining</CardTitle>
              <CardDescription>
                Configure token extraction and forward chaining
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="extractTokenFrom">Extract Token From</Label>
                <Select
                  value={formData.extractTokenFrom || undefined}
                  onValueChange={(value) =>
                    setFormData({ 
                      ...formData, 
                      extractTokenFrom: value,
                      tokenPath: value === 'auto' || value === 'none' ? '' : formData.tokenPath, // Clear tokenPath when selecting auto or none
                      nextForwardConfigId: value === 'none' ? '' : formData.nextForwardConfigId // Clear nextForwardConfigId when selecting none
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (No token extraction)</SelectItem>
                    <SelectItem value="auto">Auto-detect (Body & Headers)</SelectItem>
                    <SelectItem value="body">Response Body</SelectItem>
                    <SelectItem value="headers">Response Headers</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.extractTokenFrom === 'auto'
                    ? 'Automatically searches for token in both response body and headers'
                    : formData.extractTokenFrom === 'none' || !formData.extractTokenFrom
                    ? 'Select if you want to extract token and chain forward configs'
                    : 'Where to extract authentication token from'}
                </p>
              </div>

              {formData.extractTokenFrom && formData.extractTokenFrom !== 'none' && formData.extractTokenFrom !== 'auto' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tokenPath">
                      {formData.extractTokenFrom === 'body' ? 'Token Path (JSON)' : 'Header Name'} (Optional)
                    </Label>
                    <Input
                      id="tokenPath"
                      placeholder={formData.extractTokenFrom === 'body' ? '$.token or $.data.accessToken (leave empty for auto-detect)' : 'Authorization (leave empty for auto-detect)'}
                      value={formData.tokenPath}
                      onChange={(e) =>
                        setFormData({ ...formData, tokenPath: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.extractTokenFrom === 'body'
                        ? 'JSON path to extract token (e.g., $.token). Leave empty to auto-detect from common fields'
                        : 'Header name to extract token from. Leave empty to auto-detect from common headers'}
                    </p>
                  </div>
                </>
              )}

              {formData.extractTokenFrom === 'auto' && (
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                  <p className="font-medium">Auto-detect enabled</p>
                  <p className="mt-1 text-xs">
                    Will automatically search for token in:
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs">
                    <li>Response headers: Authorization, X-Auth-Token, X-Access-Token, etc.</li>
                    <li>Response body: token, accessToken, data.token, result.token, etc.</li>
                  </ul>
                </div>
              )}

              {formData.extractTokenFrom && formData.extractTokenFrom !== 'none' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tokenHeaderName">Token Header Name</Label>
                    <Input
                      id="tokenHeaderName"
                      placeholder="Authorization"
                      value={formData.tokenHeaderName}
                      onChange={(e) =>
                        setFormData({ ...formData, tokenHeaderName: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Header name to add extracted token to when forwarding
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nextForwardConfigId">Next Forward Config (Optional)</Label>
                    <Select
                      value={formData.nextForwardConfigId || undefined}
                      onValueChange={(value) =>
                        setFormData({ ...formData, nextForwardConfigId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select forward config to chain to" />
                      </SelectTrigger>
                      <SelectContent>
                        {forwardConfigs.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name || `${config.method} ${config.proxyPath}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Forward config to chain to after extracting token. Leave empty if you only want to extract token without chaining.
                    </p>
                  </div>
                </>
              )}

              {formData.extractTokenFrom === 'none' && (
                <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                  <p className="text-xs">
                    Token extraction and chaining disabled. This forward config will forward requests directly without extracting tokens or chaining to other configs.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </TooltipProvider>
  );
}

