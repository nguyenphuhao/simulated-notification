'use client';

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

// Dynamically import ReactJson to avoid SSR issues
const ReactJson = dynamic(
  () => import('react-json-view').then((mod) => mod.default || mod),
  { 
    ssr: false,
    loading: () => (
      <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
        <pre className="text-xs text-muted-foreground">Loading...</pre>
      </div>
    )
  }
) as any;

interface JsonViewerProps {
  src: object | string | null;
  name?: string | false;
  collapsed?: number | boolean;
  maxHeight?: string;
}

export function JsonViewer({ 
  src, 
  name = false, 
  collapsed = false,
  maxHeight = '400px'
}: JsonViewerProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
        <pre className="text-xs text-muted-foreground">Loading...</pre>
      </div>
    );
  }

  // Determine theme: use resolvedTheme if available, otherwise use theme
  const currentTheme = resolvedTheme || theme || 'light';
  const jsonViewTheme = currentTheme === 'dark' ? 'bright' : 'rjv-default';

  // Parse JSON string if needed
  let jsonData: object | null = null;
  if (src === null || src === undefined) {
    return (
      <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
        <pre className="text-xs text-muted-foreground">No data</pre>
      </div>
    );
  }

  if (typeof src === 'string') {
    try {
      jsonData = JSON.parse(src);
    } catch {
      // If it's not valid JSON, return as plain text
      return (
        <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
          <pre className="text-xs overflow-auto max-h-[400px] whitespace-pre-wrap break-words">
            {src}
          </pre>
        </div>
      );
    }
  } else {
    jsonData = src;
  }

  const handleCopy = async () => {
    try {
      const jsonString = JSON.stringify(jsonData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 w-7 p-0"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <div style={{ maxHeight, overflow: 'auto' }} className="json-viewer-container">
        <ReactJson
          src={jsonData}
          name={name}
          theme={jsonViewTheme}
          collapsed={collapsed}
          iconStyle="triangle"
          displayDataTypes={false}
          displayObjectSize={true}
          enableClipboard={false}
          style={{
            backgroundColor: 'transparent',
            fontSize: '12px',
          }}
        />
      </div>
    </div>
  );
}

