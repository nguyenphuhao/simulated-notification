/**
 * Context provided to mock response scripts
 */
export interface MockContext {
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: any;
    queryParams: Record<string, string>;
    pathParams: Record<string, string>;
  };
  utils: {
    // Basic utilities
    random: (min: number, max: number) => number;
    uuid: () => string;
    timestamp: () => number;
    date: (format?: string) => string;
    
    // Array utilities
    map: <T, U>(array: T[], fn: (item: T, index: number) => U) => U[];
    filter: <T>(array: T[], fn: (item: T, index: number) => boolean) => T[];
    find: <T>(array: T[], fn: (item: T) => boolean) => T | undefined;
    findIndex: <T>(array: T[], fn: (item: T) => boolean) => number;
    reduce: <T, U>(array: T[], fn: (acc: U, item: T, index: number) => U, initial: U) => U;
    some: <T>(array: T[], fn: (item: T) => boolean) => boolean;
    every: <T>(array: T[], fn: (item: T) => boolean) => boolean;
    sort: <T>(array: T[], compareFn?: (a: T, b: T) => number) => T[];
    
    // Object utilities
    keys: (obj: object) => string[];
    values: <T>(obj: Record<string, T>) => T[];
    entries: <T>(obj: Record<string, T>) => [string, T][];
    
    // String utilities
    includes: (str: string, search: string) => boolean;
    startsWith: (str: string, search: string) => boolean;
    endsWith: (str: string, search: string) => boolean;
    
    // Request processing helpers
    getQueryParam: (key: string, defaultValue?: string) => string | undefined;
    getPathParam: (key: string) => string | undefined;
    getHeader: (key: string) => string | undefined;
    parseBody: () => any;
  };
}

/**
 * Result of executing a mock response script
 */
export interface MockResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}

/**
 * Execute mock response - supports JSON raw or JavaScript code
 */
export function executeMockResponse(
  code: string,
  context: MockContext
): MockResponse {
  // First, try to parse as JSON (simple case)
  try {
    const trimmedCode = code.trim();
    // Check if it looks like JSON (starts with { or [)
    if (trimmedCode.startsWith('{') || trimmedCode.startsWith('[')) {
      const parsed = JSON.parse(trimmedCode);
      return {
        statusCode: 200,
        body: parsed,
      };
    }
  } catch (e) {
    // Not valid JSON, continue to execute as JavaScript code
  }
  // Create utility functions
  const utils = {
    random: (min: number, max: number) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    uuid: () => {
      // Simple UUID v4 generator
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    timestamp: () => {
      return Date.now();
    },
    date: (format?: string) => {
      const now = new Date();
      if (!format) {
        return now.toISOString();
      }
      // Simple date formatting
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      
      return format
        .replace('YYYY', String(year))
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
    },
    
    // Array utilities
    map: (array: any[], fn: Function) => {
      if (!Array.isArray(array)) return [];
      return array.map(fn);
    },
    filter: (array: any[], fn: Function) => {
      if (!Array.isArray(array)) return [];
      return array.filter(fn);
    },
    find: (array: any[], fn: Function) => {
      if (!Array.isArray(array)) return undefined;
      return array.find(fn);
    },
    findIndex: (array: any[], fn: Function) => {
      if (!Array.isArray(array)) return -1;
      return array.findIndex(fn);
    },
    reduce: (array: any[], fn: Function, initial: any) => {
      if (!Array.isArray(array)) return initial;
      return array.reduce(fn, initial);
    },
    some: (array: any[], fn: Function) => {
      if (!Array.isArray(array)) return false;
      return array.some(fn);
    },
    every: (array: any[], fn: Function) => {
      if (!Array.isArray(array)) return true;
      return array.every(fn);
    },
    sort: (array: any[], compareFn?: Function) => {
      if (!Array.isArray(array)) return [];
      return [...array].sort(compareFn);
    },
    
    // Object utilities
    keys: (obj: object) => {
      if (!obj || typeof obj !== 'object') return [];
      return Object.keys(obj);
    },
    values: (obj: object) => {
      if (!obj || typeof obj !== 'object') return [];
      return Object.values(obj);
    },
    entries: (obj: object) => {
      if (!obj || typeof obj !== 'object') return [];
      return Object.entries(obj);
    },
    
    // String utilities
    includes: (str: string, search: string) => {
      if (typeof str !== 'string') return false;
      return str.includes(search);
    },
    startsWith: (str: string, search: string) => {
      if (typeof str !== 'string') return false;
      return str.startsWith(search);
    },
    endsWith: (str: string, search: string) => {
      if (typeof str !== 'string') return false;
      return str.endsWith(search);
    },
    
    // Request processing helpers
    getQueryParam: (key: string, defaultValue?: string) => {
      return context.request.queryParams[key] || defaultValue;
    },
    getPathParam: (key: string) => {
      return context.request.pathParams[key];
    },
    getHeader: (key: string) => {
      const lowerKey = key.toLowerCase();
      return context.request.headers[lowerKey];
    },
    parseBody: () => {
      return context.request.body;
    },
  };

  try {
    // Wrap code to ensure it returns a value
    // The code should either:
    // 1. Return an object with {statusCode, body, headers}
    // 2. Return a value directly (will be wrapped in 200 response)
    // 3. If code doesn't have return statement, try to evaluate as expression
    
    // Check if code has return statement (more robust check)
    // Look for return statement that's not in a comment
    const lines = code.split('\n');
    let hasReturn = false;
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Skip comment lines
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
        continue;
      }
      // Check if line contains return statement
      if (/\breturn\s+/.test(trimmedLine)) {
        hasReturn = true;
        break;
      }
    }
    
    console.log('[MOCK_EXECUTOR] Code has return:', hasReturn);
    console.log('[MOCK_EXECUTOR] Code preview:', code.substring(0, 200));
    
    let wrappedCode: string;
    if (hasReturn) {
      // Code has return statement, execute as is
      wrappedCode = `
        (function() {
          const request = arguments[0];
          const utils = arguments[1];
          ${code}
        })();
      `;
    } else {
      // Code doesn't have return, wrap it to return the expression
      wrappedCode = `
        (function() {
          const request = arguments[0];
          const utils = arguments[1];
          return (${code});
        })();
      `;
    }

    // Execute in a controlled environment
    // Note: In production, consider using vm2 or isolated-vm for better sandboxing
    const func = new Function('request', 'utils', wrappedCode);
    const result = func(context.request, utils);

    // Handle different return types
    if (result === undefined || result === null) {
      console.log('[MOCK_EXECUTOR] Result is undefined/null, code:', code.substring(0, 100));
      return {
        statusCode: 200,
        body: { message: 'Mock response executed successfully' },
      };
    }

    // If result is an object with statusCode and body
    if (
      typeof result === 'object' &&
      result !== null &&
      'statusCode' in result &&
      'body' in result
    ) {
      return {
        statusCode: result.statusCode || 200,
        body: result.body,
        headers: result.headers,
      };
    }

    // If result is a primitive or plain object, wrap it
    console.log('[MOCK_EXECUTOR] Returning result:', typeof result, result);
    return {
      statusCode: 200,
      body: result,
    };
  } catch (error: any) {
    // Return error response instead of throwing
    console.error('[MOCK_EXECUTOR] Error executing mock:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Mock execution error',
        message: error.message || String(error),
        stack: error.stack,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
}

