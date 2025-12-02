'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { TooltipProvider } from '@/components/ui/tooltip';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
  readOnly?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  placeholder,
  height = '400px',
  readOnly = false,
}: CodeEditorProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine theme: use resolvedTheme if available, otherwise use theme
  const currentTheme = resolvedTheme || theme || 'light';
  const isDark = currentTheme === 'dark';

  if (!mounted) {
    return (
      <div
        className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4"
        style={{ height }}
      >
        <pre className="text-xs text-muted-foreground">Loading editor...</pre>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border overflow-hidden">
        <CodeMirror
          value={value}
          height={height}
          theme={isDark ? oneDark : undefined}
          extensions={[javascript({ jsx: false })]}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
          }}
          style={{
            fontSize: '14px',
          }}
        />
      </div>
    </TooltipProvider>
  );
}

