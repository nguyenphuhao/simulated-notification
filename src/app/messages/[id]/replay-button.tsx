'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { JsonViewer } from '@/components/json-viewer';

interface ReplayButtonProps {
  messageId: string;
  forwarded: boolean;
}

export function ReplayButton({ messageId, forwarded }: ReplayButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!forwarded) {
    return null;
  }

  const handleReplay = async () => {
    setIsReplaying(true);
    setError(null);
    setReplayResult(null);

    try {
      const response = await fetch(`/api/messages/${messageId}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to replay request');
      }

      const result = await response.json();
      setReplayResult(result.data);
      setIsOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to replay request');
      setIsOpen(true);
    } finally {
      setIsReplaying(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleReplay}
        disabled={isReplaying}
        variant="outline"
        size="sm"
      >
        {isReplaying ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Replaying...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Replay
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Replay Result</DialogTitle>
            <DialogDescription>
              Result of replaying the request
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="text-destructive">{error}</div>
          ) : replayResult ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Response</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge
                      variant={
                        replayResult.statusCode && replayResult.statusCode < 400
                          ? 'default'
                          : 'destructive'
                      }
                    >
                      {replayResult.statusCode || 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Response Time:</span>
                    <span className="text-sm">
                      {replayResult.responseTime || 'N/A'}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Success:</span>
                    <Badge variant={replayResult.success ? 'default' : 'destructive'}>
                      {replayResult.success ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  {replayResult.responseBody && (
                    <div>
                      <span className="text-sm font-medium">Response Body:</span>
                      <div className="mt-2 rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
                        <JsonViewer
                          src={
                            typeof replayResult.responseBody === 'string'
                              ? JSON.parse(replayResult.responseBody)
                              : replayResult.responseBody
                          }
                          name={false}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {replayResult.comparison && (
                <Card>
                  <CardHeader>
                    <CardTitle>Comparison</CardTitle>
                    <CardDescription>
                      Comparison with original response
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Status Match:</span>
                      <Badge
                        variant={
                          replayResult.comparison.statusCodeMatch
                            ? 'default'
                            : 'destructive'
                        }
                      >
                        {replayResult.comparison.statusCodeMatch ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {replayResult.comparison.responseTimeDiff !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Time Difference:</span>
                        <span className="text-sm">
                          {replayResult.comparison.responseTimeDiff > 0 ? '+' : ''}
                          {replayResult.comparison.responseTimeDiff}ms
                        </span>
                      </div>
                    )}
                    {replayResult.comparison.responseBodyDiff && (
                      <div>
                        <span className="text-sm font-medium">Body Differences:</span>
                        <div className="mt-2 rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
                          <JsonViewer
                            src={JSON.parse(replayResult.comparison.responseBodyDiff)}
                            name={false}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

