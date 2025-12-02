# Simulated Notification Proxy Service

A proxy service that receives requests from anywhere, intelligently categorizes them, stores them in SQLite, and provides a web UI for viewing and managing messages.

## Features

- **Smart Request Categorization**: Automatically categorizes requests into:
  - Event Track (Snowplow, Snowplow BDP, Mixpanel, Segment)
  - Message (Email, SMS, Push Notification)
  - Authentication
  - General

- **PostgreSQL Storage**: All messages are stored in PostgreSQL database (compatible with Vercel Postgres)
- **Auto Purge**: Automatically purges old messages when a category exceeds 500 messages (configurable)
- **Web UI**: Beautiful admin interface to view, filter, and search messages
- **Message Details**: View detailed information about each request including headers, body, query params, and response

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL + Prisma ORM (compatible with Vercel Postgres)
- **UI**: shadcn/ui + Tailwind CSS
- **Design System**: Same as dokifree-admin

## Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Setup Environment Variables

Create `.env.local` file:

**For Local Development (PostgreSQL):**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/simulated_notification"
NEXT_PUBLIC_APP_URL="http://localhost:7777"
```

**For Vercel Deployment:**
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add `DATABASE_URL` from Vercel Postgres (automatically provided if using Vercel Postgres)
- Or use your own PostgreSQL connection string

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

## Docker Setup

### Development with Docker Compose

1. **Start PostgreSQL database only:**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Set environment variables:**
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/simulated_notification"
   ```
   
   **Note:** Port 5433 is used to avoid conflict with local PostgreSQL on port 5432

3. **Run migrations:**
   ```bash
   yarn prisma migrate dev
   ```

4. **Start development server:**
   ```bash
   yarn dev
   ```

### Production with Docker Compose

1. **Build and start all services:**
   ```bash
   docker-compose up -d --build
   ```

   This will:
   - Start PostgreSQL database
   - Build and start the Next.js application
   - Automatically run database migrations
   - Make the app available at `http://localhost:7777`

2. **View logs:**
   ```bash
   docker-compose logs -f app
   ```

3. **Stop services:**
   ```bash
   docker-compose down
   ```

4. **Stop and remove volumes (clean slate):**
   ```bash
   docker-compose down -v
   ```

### Docker Commands

- **Build image:**
  ```bash
  docker build -t simulated-notification .
  ```

- **Run migrations manually:**
  ```bash
  docker-compose exec app npx prisma migrate deploy
  ```

- **Access Prisma Studio:**
  ```bash
  docker-compose exec app npx prisma studio
  ```

- **Access PostgreSQL:**
  ```bash
  docker-compose exec postgres psql -U postgres -d simulated_notification
  ```

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
3. Store it in PostgreSQL database
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
│   └── schema.prisma          # PostgreSQL schema
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

## Deployment

### Vercel Deployment

1. **Create Vercel Postgres Database:**
   - Go to Vercel Dashboard → Your Project → Storage → Create Database → Postgres
   - Or use Vercel CLI: `vercel postgres create`

2. **Set Environment Variables:**
   - The `DATABASE_URL` will be automatically set if using Vercel Postgres
   - Or manually add `DATABASE_URL` in Vercel Dashboard → Settings → Environment Variables

3. **Run Migrations:**
   ```bash
   # Generate Prisma client
   yarn prisma generate
   
   # Push schema to database (for production)
   yarn prisma db push
   
   # Or create and run migrations
   yarn prisma migrate dev --name init
   yarn prisma migrate deploy  # For production
   ```

4. **Deploy:**
   - Push to GitHub and Vercel will automatically deploy
   - Or use Vercel CLI: `vercel --prod`

### Environment Variables for Production

Make sure these are set in Vercel:
- `DATABASE_URL` - PostgreSQL connection string (auto-set if using Vercel Postgres)
- `NEXT_PUBLIC_APP_URL` - Your production URL (optional)

## Notes

- The proxy service only logs requests, it doesn't forward them to actual destinations
