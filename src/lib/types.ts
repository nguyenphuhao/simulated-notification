// MessageCategory type definition (SQLite doesn't support enums)
export type MessageCategory =
  | 'EVENT_TRACK'
  | 'MESSAGE'
  | 'AUTHENTICATION'
  | 'MOCK_API'
  | 'FORWARD'
  | 'GENERAL';

export const MessageCategory = {
  EVENT_TRACK: 'EVENT_TRACK' as const,
  MESSAGE: 'MESSAGE' as const,
  AUTHENTICATION: 'AUTHENTICATION' as const,
  MOCK_API: 'MOCK_API' as const,
  FORWARD: 'FORWARD' as const,
  GENERAL: 'GENERAL' as const,
} as const;

