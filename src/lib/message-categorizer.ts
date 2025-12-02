import { MessageCategory } from './types';

export interface CategorizeResult {
  category: MessageCategory;
  provider?: string;
}

export function categorizeRequest(
  url: string,
  headers: Record<string, string>,
  body?: any
): CategorizeResult {
  const lowerUrl = url.toLowerCase();
  const bodyStr = body ? JSON.stringify(body).toLowerCase() : '';

  // Event Track - Snowplow
  if (
    lowerUrl.includes('snowplow') ||
    lowerUrl.includes('com.snowplowanalytics') ||
    headers['user-agent']?.toLowerCase().includes('snowplow')
  ) {
    return {
      category: MessageCategory.EVENT_TRACK,
      provider: lowerUrl.includes('bdp') || bodyStr.includes('bdp') ? 'SNOWPLOW_BDP' : 'SNOWPLOW',
    };
  }

  // Event Track - Mixpanel
  if (
    lowerUrl.includes('mixpanel') ||
    lowerUrl.includes('api.mixpanel.com') ||
    headers['host']?.toLowerCase().includes('mixpanel')
  ) {
    return {
      category: MessageCategory.EVENT_TRACK,
      provider: 'MIXPANEL',
    };
  }

  // Event Track - Segment
  if (
    lowerUrl.includes('segment') ||
    lowerUrl.includes('api.segment.io') ||
    headers['host']?.toLowerCase().includes('segment')
  ) {
    return {
      category: MessageCategory.EVENT_TRACK,
      provider: 'SEGMENT',
    };
  }

  // Message - Email
  if (
    lowerUrl.includes('/email') ||
    lowerUrl.includes('/send-email') ||
    lowerUrl.includes('/mail') ||
    bodyStr.includes('"email"') ||
    bodyStr.includes('"to"') ||
    headers['content-type']?.includes('email')
  ) {
    return {
      category: MessageCategory.MESSAGE,
      provider: 'EMAIL',
    };
  }

  // Message - SMS
  if (
    lowerUrl.includes('/sms') ||
    lowerUrl.includes('/send-sms') ||
    lowerUrl.includes('/text') ||
    bodyStr.includes('"phone"') ||
    bodyStr.includes('"mobile"')
  ) {
    return {
      category: MessageCategory.MESSAGE,
      provider: 'SMS',
    };
  }

  // Message - Push Notification
  if (
    lowerUrl.includes('/push') ||
    lowerUrl.includes('/notification') ||
    lowerUrl.includes('/fcm') ||
    lowerUrl.includes('/apns') ||
    bodyStr.includes('"push"') ||
    bodyStr.includes('"notification"')
  ) {
    return {
      category: MessageCategory.MESSAGE,
      provider: 'PUSH_NOTIFICATION',
    };
  }

  // Authentication
  if (
    lowerUrl.includes('/auth') ||
    lowerUrl.includes('/login') ||
    lowerUrl.includes('/logout') ||
    lowerUrl.includes('/token') ||
    lowerUrl.includes('/oauth') ||
    lowerUrl.includes('/register') ||
    lowerUrl.includes('/signin') ||
    lowerUrl.includes('/signup')
  ) {
    return {
      category: MessageCategory.AUTHENTICATION,
    };
  }

  // General - default
  return {
    category: MessageCategory.GENERAL,
  };
}

