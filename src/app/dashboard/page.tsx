import { getMessageStats } from '@/app/messages/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCategory } from '@/lib/types';

export default async function DashboardPage() {
  const stats = await getMessageStats();

  const categoryLabels: Record<MessageCategory, string> = {
    EVENT_TRACK: 'Event Track',
    MESSAGE: 'Message',
    AUTHENTICATION: 'Authentication',
    GENERAL: 'General',
  };

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of all requests</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          {stats.byCategory.map((item) => (
            <Card key={item.category}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {categoryLabels[item.category]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.count}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Provider Statistics</CardTitle>
            <CardDescription>Breakdown by provider</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.byProvider.length > 0 ? (
              <div className="space-y-2">
                {stats.byProvider.map((item) => (
                  <div key={item.provider} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.provider}</span>
                    <span className="text-sm text-muted-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No provider data available</p>
            )}
          </CardContent>
        </Card>
      </div>
  );
}

