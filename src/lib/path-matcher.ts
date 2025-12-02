/**
 * Match a path pattern (with params like :id) against an actual path
 * Returns match status and extracted path parameters
 */
export function matchPath(
  pattern: string,
  actualPath: string
): { match: boolean; params: Record<string, string> } {
  // Normalize paths - remove trailing slashes except root
  const normalizePath = (path: string) => {
    if (path === '/') return path;
    return path.endsWith('/') ? path.slice(0, -1) : path;
  };

  const normalizedPattern = normalizePath(pattern);
  const normalizedActual = normalizePath(actualPath);

  // Split paths into parts
  const patternParts = normalizedPattern.split('/').filter(Boolean);
  const actualParts = normalizedActual.split('/').filter(Boolean);

  // Must have same number of parts
  if (patternParts.length !== actualParts.length) {
    return { match: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const actualPart = actualParts[i];

    if (patternPart.startsWith(':')) {
      // Path parameter - extract name and value
      const paramName = patternPart.slice(1);
      params[paramName] = actualPart;
    } else if (patternPart !== actualPart) {
      // Literal mismatch
      return { match: false, params: {} };
    }
  }

  return { match: true, params };
}

/**
 * Strip query parameters from path
 */
function stripQueryParams(path: string): string {
  const queryIndex = path.indexOf('?');
  return queryIndex >= 0 ? path.slice(0, queryIndex) : path;
}

/**
 * Find matching mock endpoint for a given path and method
 */
export function findMatchingMockEndpoint(
  mockEndpoints: Array<{ path: string; method: string }>,
  actualPath: string,
  method: string
): { path: string; method: string; params: Record<string, string> } | null {
  // Strip query params from actual path for matching
  const actualPathWithoutQuery = stripQueryParams(actualPath);

  // First try exact match (without query params)
  const exactMatch = mockEndpoints.find((ep) => {
    const epPathWithoutQuery = stripQueryParams(ep.path);
    return (
      epPathWithoutQuery === actualPathWithoutQuery &&
      ep.method.toUpperCase() === method.toUpperCase()
    );
  });

  if (exactMatch) {
    return {
      path: exactMatch.path,
      method: exactMatch.method,
      params: {},
    };
  }

  // Then try pattern matching (without query params)
  for (const endpoint of mockEndpoints) {
    if (endpoint.method.toUpperCase() !== method.toUpperCase()) {
      continue;
    }

    const endpointPathWithoutQuery = stripQueryParams(endpoint.path);
    const matchResult = matchPath(endpointPathWithoutQuery, actualPathWithoutQuery);
    if (matchResult.match) {
      return {
        path: endpoint.path,
        method: endpoint.method,
        params: matchResult.params,
      };
    }
  }

  return null;
}

