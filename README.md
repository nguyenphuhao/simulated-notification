# Simulated Notification Proxy Service

A proxy service that receives requests from anywhere, intelligently categorizes them, stores them in SQLite, and provides a web UI for viewing and managing messages.

## Features

- **Smart Request Categorization**: Automatically categorizes requests into:
  - Event Track (Snowplow, Snowplow BDP, Mixpanel, Segment)
  - Message (Email, SMS, Push Notification)
  - Authentication
  - General

- **SQLite Storage**: All messages are stored locally in SQLite database
- **Auto Purge**: Automatically purges old messages when a category exceeds 500 messages (configurable)
- **Web UI**: Beautiful admin interface to view, filter, and search messages
- **Message Details**: View detailed information about each request including headers, body, query params, and response

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite + Prisma ORM
- **UI**: shadcn/ui + Tailwind CSS
- **Design System**: Same as dokifree-admin

## Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Setup Environment Variables

Create `.env.local` file:

```env
DATABASE_URL="file:./messages.db"
NEXT_PUBLIC_APP_URL="http://localhost:7777"
```

### 3. Generate Prisma Client & Run Migrations

```bash
yarn prisma:generate
yarn prisma:migrate
```

### 4. Run Development Server

```bash
yarn dev
```

The app will be available at `http://localhost:7777`

## Usage

### Proxy Endpoint

Send requests to the proxy endpoint:

```
POST http://localhost:7777/api/proxy/your/path/here
GET http://localhost:7777/api/proxy/your/path/here
PUT http://localhost:7777/api/proxy/your/path/here
DELETE http://localhost:7777/api/proxy/your/path/here
PATCH http://localhost:7777/api/proxy/your/path/here
```

The proxy will:
1. Capture all request data (headers, body, query params)
2. Categorize the request based on URL and content
3. Store it in SQLite database
4. Return a success response

### Example Requests

**Event Track (Snowplow):**
```bash
curl -X POST http://localhost:7777/api/proxy/snowplow/track \
  -H "Content-Type: application/json" \
  -d '{"event": "page_view", "userId": "123"}'
```

**Message (Email):**
```bash
curl -X POST http://localhost:7777/api/proxy/send-email \
  -H "Content-Type: application/json" \
  -d '{"to": "user@example.com", "subject": "Hello"}'
```

**Authentication:**
```bash
curl -X POST http://localhost:7777/api/proxy/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret"}'
```

## Web UI

### Pages

- **Dashboard** (`/dashboard`): Overview statistics
- **Messages** (`/messages`): List all messages with filters
- **Message Detail** (`/messages/[id]`): View detailed information about a specific message

### Filters

- Search by URL, body, headers, or IP address
- Filter by category (Event Track, Message, Authentication, General)
- Filter by HTTP method (GET, POST, PUT, DELETE, PATCH)
- Filter by provider (Snowplow, Mixpanel, Segment, Email, SMS, etc.)

## Auto Purge Configuration

By default, each category will keep a maximum of 500 messages. When this limit is exceeded, the oldest messages are automatically deleted.

To configure purge settings, you can modify the `PurgeConfig` model in the database or update the default value in `src/lib/auto-purge.ts`.

## Database Schema

### Message Model

- `id`: Unique identifier
- `category`: MessageCategory enum
- `provider`: Provider name (optional)
- `sourceUrl`: Request URL path
- `method`: HTTP method
- `headers`: JSON string of headers
- `body`: JSON string of body (optional)
- `queryParams`: JSON string of query params (optional)
- `statusCode`: Response status code (optional)
- `responseBody`: Response body (optional)
- `errorMessage`: Error message (optional)
- `ipAddress`: Client IP address
- `userAgent`: User agent string
- `createdAt`: Timestamp
- `processedAt`: Processing timestamp (optional)

### PurgeConfig Model

- `id`: Unique identifier
- `category`: MessageCategory enum (unique)
- `maxMessages`: Maximum messages to keep (default: 500)
- `lastPurgedAt`: Last purge timestamp

## Development

### Available Scripts

- `yarn dev` - Start development server (port 7777)
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
- `yarn type-check` - Type check without emitting
- `yarn prisma:generate` - Generate Prisma client
- `yarn prisma:studio` - Open Prisma Studio
- `yarn prisma:migrate` - Run database migrations

## Project Structure

```
simulated-notification/
├── prisma/
│   └── schema.prisma          # SQLite schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── proxy/
│   │   │       └── [...path]/
│   │   │           └── route.ts    # Proxy endpoint
│   │   ├── messages/
│   │   │   ├── page.tsx            # Messages list page
│   │   │   ├── messages-client.tsx # Client component
│   │   │   ├── actions.ts          # Server actions
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Message detail page
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Dashboard page
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── admin/                  # Admin layout components
│   │   └── ui/                     # shadcn/ui components
│   └── lib/
│       ├── prisma.ts
│       ├── message-categorizer.ts  # Smart grouping logic
│       ├── auto-purge.ts           # Auto purge logic
│       └── utils.ts
└── package.json
```

## Notes

- The proxy service only logs requests, it doesn't forward them to actual destinations
- All data is stored locally in SQLite
