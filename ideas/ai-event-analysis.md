# AI Event Analysis & Anomaly Detection

## Tổng quan

Tính năng sử dụng AI để phân tích và trích xuất thông tin từ Snowplow events, đồng thời phát hiện các bất thường dựa trên timeline của events.

## Mục tiêu

1. **Trích xuất thông tin quan trọng** từ Snowplow events:
   - Action (page_view, button_click, etc.)
   - Label
   - Role (user role)
   - User ID, Session ID
   - Context quan trọng (page, product_id, amount, etc.)

2. **Phát hiện bất thường** trong timeline:
   - Timing anomalies (events quá nhanh/chậm)
   - Frequency anomalies (tần suất bất thường)
   - Pattern anomalies (sequence không logic)
   - Value anomalies (giá trị không hợp lệ)

## Database Schema

### 1. EventAnalysis Model

```prisma
model EventAnalysis {
  id            String   @id @default(cuid())
  messageId     String   @unique
  message       Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  
  // Extracted fields từ AI
  action        String?  // "page_view", "button_click", etc.
  label         String?  // Label của event
  role          String?  // User role
  userId        String?  // User ID nếu có
  sessionId     String?  // Session ID nếu có
  
  // Context quan trọng (JSON)
  importantContext String? // JSON string của các context fields quan trọng
  
  // AI Analysis metadata
  extractedFields String? // JSON string của tất cả fields được extract
  confidence     Float?   // Confidence score của AI (0-1)
  analysisModel  String?   // Model version được sử dụng
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([messageId])
  @@index([action])
  @@index([role])
  @@index([userId])
  @@index([createdAt])
  @@map("event_analyses")
}
```

### 2. EventAnomaly Model

```prisma
model EventAnomaly {
  id            String   @id @default(cuid())
  
  // Anomaly details
  type          String   // "TIMING", "FREQUENCY", "PATTERN", "VALUE"
  severity      String   // "LOW", "MEDIUM", "HIGH", "CRITICAL"
  description   String   // Mô tả anomaly
  
  // Related events
  relatedMessageIds String // JSON array of message IDs
  
  // Analysis context
  detectedAt    DateTime @default(now())
  timeWindow    String?  // Time window được phân tích (e.g., "1h", "24h")
  
  // AI Analysis
  anomalyScore  Float?   // Score từ 0-1
  explanation   String?  // Giải thích tại sao được coi là anomaly
  
  // Status
  status        String   @default("NEW") // NEW, REVIEWED, RESOLVED, FALSE_POSITIVE
  reviewedAt    DateTime?
  reviewedBy    String?
  
  createdAt     DateTime @default(now())
  
  @@index([type])
  @@index([severity])
  @@index([status])
  @@index([detectedAt])
  @@map("event_anomalies")
}
```

### 3. EventPattern Model (Optional - cho future enhancement)

```prisma
model EventPattern {
  id            String   @id @default(cuid())
  
  // Pattern identification
  patternType   String   // "USER_JOURNEY", "BEHAVIORAL", "TEMPORAL"
  patternName   String   // Tên pattern (e.g., "Checkout Flow")
  
  // Pattern details
  description   String?
  keyActions    String   // JSON array of action sequences
  
  // Statistics
  occurrenceCount Int    @default(0)
  firstSeenAt   DateTime @default(now())
  lastSeenAt    DateTime @default(now())
  
  // AI Analysis
  confidence    Float?
  insights     String?  // JSON string của insights
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([patternType])
  @@index([patternName])
  @@map("event_patterns")
}
```

## Implementation

### 1. AI Event Analyzer Service

**File:** `src/lib/ai-event-analyzer.ts`

**Chức năng chính:**
- `extractEventData()`: Trích xuất structured data từ event body
- `detectAnomalies()`: Phát hiện anomalies trong timeline
- `detectTimingAnomalies()`: Phát hiện timing issues
- `detectFrequencyAnomalies()`: Phát hiện frequency spikes
- `detectPatternAnomalies()`: Phát hiện pattern bất thường (dùng AI)
- `detectValueAnomalies()`: Phát hiện giá trị bất thường

**Dependencies:**
- `openai` package
- Environment variable: `OPENAI_API_KEY`, `OPENAI_MODEL` (default: 'gpt-4o-mini')

### 2. Event Processor Service

**File:** `src/lib/event-processor.ts`

**Chức năng:**
- `processEventMessage(messageId)`: Process một message và extract data + detect anomalies
- `detectAndSaveAnomalies()`: Detect và lưu anomalies vào database

**Flow:**
1. Load message từ database
2. Parse body và headers
3. Gọi AI để extract event data
4. Lưu extracted data vào EventAnalysis table
5. Load recent events để phân tích timeline
6. Detect anomalies
7. Lưu anomalies vào EventAnomaly table

### 3. API Route

**File:** `src/app/api/events/analyze/route.ts`

**Endpoint:** `POST /api/events/analyze`

**Request body:**
```json
{
  "messageId": "clx123..."
}
```

**Response:**
```json
{
  "success": true
}
```

### 4. Auto-processing Integration

**File:** `src/app/api/proxy/[...path]/route.ts`

Thêm vào sau khi save message (sau line ~399):

```typescript
// Auto-process nếu là EVENT_TRACK
if (category === MessageCategory.EVENT_TRACK) {
  // Process async để không block response
  processEventMessage(savedMessage.id).catch((err) => {
    console.error(`[PROXY] Error processing event ${savedMessage.id}:`, err);
  });
}
```

### 5. UI Components

**File:** `src/app/messages/[id]/event-analysis-client.tsx`

Component để hiển thị:
- Extracted event data (action, label, role, userId, sessionId, context)
- Detected anomalies với severity và explanation
- Confidence scores

**Integration:** Thêm vào `src/app/messages/[id]/page.tsx` để load và hiển thị analysis data.

## Environment Variables

Thêm vào `.env.local`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # hoặc gpt-4o, gpt-3.5-turbo
```

## Dependencies

Thêm vào `package.json`:

```json
{
  "dependencies": {
    "openai": "^4.0.0"
  }
}
```

## Migration Steps

1. **Tạo migration:**
   ```bash
   yarn prisma migrate dev --name add_event_analysis
   ```

2. **Install dependencies:**
   ```bash
   yarn add openai
   ```

3. **Set environment variables:**
   - Thêm `OPENAI_API_KEY` vào `.env.local`
   - Optionally set `OPENAI_MODEL`

4. **Implement services:**
   - Tạo `src/lib/ai-event-analyzer.ts`
   - Tạo `src/lib/event-processor.ts`
   - Tạo `src/app/api/events/analyze/route.ts`

5. **Update proxy route:**
   - Thêm auto-processing logic

6. **Create UI components:**
   - Tạo `src/app/messages/[id]/event-analysis-client.tsx`
   - Update `src/app/messages/[id]/page.tsx`

## Anomaly Detection Logic

### Timing Anomalies
- Events quá nhanh (< 100ms): Có thể là bot/spam
- Events quá chậm (> 1 hour): Session bị gián đoạn

### Frequency Anomalies
- Sử dụng Z-score để detect spikes
- Z-score > 2 hoặc < -2 được coi là anomaly
- Phân tích theo time windows (hourly)

### Pattern Anomalies
- Sử dụng AI để phân tích user journey
- Detect actions không logic (ví dụ: checkout trước add_to_cart)
- Detect missing actions (ví dụ: payment thành công nhưng không có checkout)
- Detect repetitive actions

### Value Anomalies
- Amount âm
- Category không hợp lệ
- Missing required fields

## Benefits

1. **Tự động hóa phân tích:** Không cần manual review từng event
2. **Phát hiện sớm vấn đề:** Anomalies được detect ngay khi events được gửi
3. **Structured data:** Dễ query và filter theo action, role, userId
4. **Actionable insights:** Anomalies có explanation để dễ debug
5. **Scalable:** Có thể xử lý hàng nghìn events mỗi ngày

## Future Enhancements

1. **Pattern Learning:** Học các pattern phổ biến và detect deviations
2. **Real-time Dashboard:** Dashboard hiển thị anomalies real-time
3. **Alert System:** Gửi alerts khi detect critical anomalies
4. **User Journey Visualization:** Visualize user journeys và highlight anomalies
5. **Machine Learning:** Train custom model trên historical data để improve accuracy
6. **Batch Processing:** Process events theo batch để optimize cost
7. **Caching:** Cache extracted data để tránh re-processing

## Cost Considerations

- **OpenAI API:** 
  - gpt-4o-mini: ~$0.15/1M input tokens, ~$0.60/1M output tokens
  - gpt-4o: ~$2.50/1M input tokens, ~$10/1M output tokens
  - Mỗi event analysis: ~500-1000 tokens input, ~200-500 tokens output
  - Estimated cost: ~$0.0001-0.001 per event (với gpt-4o-mini)

- **Optimization:**
  - Chỉ process EVENT_TRACK category
  - Batch processing để reduce API calls
  - Cache extracted data
  - Use gpt-4o-mini cho non-critical analysis

## Notes

- Processing được thực hiện async để không block API response
- Errors trong processing được log nhưng không fail request
- Confidence scores giúp filter low-quality extractions
- Anomaly scores giúp prioritize issues

