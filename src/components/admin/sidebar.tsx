'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  Activity,
  Mail,
  Lock,
  Globe,
  Settings,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const menuItems = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Messages', href: '/messages', icon: MessageSquare },
      { label: 'Error Logs', href: '/errors', icon: AlertTriangle },
    ],
  },
  {
    title: 'Categories',
    items: [
      { label: 'Event Track', href: '/messages?category=EVENT_TRACK', icon: Activity },
      { label: 'Messages', href: '/messages?category=MESSAGE', icon: Mail },
      { label: 'Authentication', href: '/messages?category=AUTHENTICATION', icon: Lock },
      { label: 'General', href: '/messages?category=GENERAL', icon: Globe },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Purge Config', href: '/settings/purge', icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getIsActive = (href: string) => {
    const [basePath, queryString] = href.split('?');
    const hrefParams = queryString ? new URLSearchParams(queryString) : null;

    // Check if pathname matches
    if (pathname !== basePath) {
      return false;
    }

    // If href has query params, check if they match
    if (hrefParams) {
      const currentCategory = searchParams.get('category');
      const hrefCategory = hrefParams.get('category');
      
      // Only active if category matches exactly
      return currentCategory === hrefCategory;
    }

    // If href has no query params, check if current page also has no category filter
    // This makes "/messages" active only when there's no category filter
    if (basePath === '/messages') {
      const currentCategory = searchParams.get('category');
      return !currentCategory;
    }

    return true;
  };

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col items-center justify-center border-b px-6 py-4 relative">
        {collapsed ? (
          <h2 className="text-xs font-semibold">PS</h2>
        ) : (
          <h2 className="text-sm font-semibold">PROXY SERVICE</h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 h-6 w-6"
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        <TooltipProvider delayDuration={0}>
          {menuItems.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed && (
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = getIsActive(item.href);
                const linkContent = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      collapsed ? 'justify-center' : 'gap-3',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkContent;
              })}
            </div>
          ))}
        </TooltipProvider>
      </nav>
    </div>
  );
}

