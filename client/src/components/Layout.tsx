import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-semibold text-primary-800">
                  FuneralFlow
                </h1>
              </div>
              <nav className="hidden md:flex space-x-8">
                <Link href="/">
                  <a
                    className={`py-2 px-1 text-sm font-medium transition-colors ${
                      isActive("/")
                        ? "text-primary-600 border-b-2 border-primary-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Dashboard
                  </a>
                </Link>
                <Link href="/transcripts">
                  <a
                    className={`py-2 px-1 text-sm font-medium transition-colors ${
                      isActive("/transcripts")
                        ? "text-primary-600 border-b-2 border-primary-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Transcripts
                  </a>
                </Link>
                <Link href="/analytics">
                  <a
                    className={`py-2 px-1 text-sm font-medium transition-colors ${
                      isActive("/analytics")
                        ? "text-primary-600 border-b-2 border-primary-600"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Analytics
                  </a>
                </Link>
                {user?.role === 'admin' && (
                  <>
                    <Link href="/admin">
                      <a
                        className={`py-2 px-1 text-sm font-medium transition-colors ${
                          isActive("/admin")
                            ? "text-primary-600 border-b-2 border-primary-600"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Admin
                      </a>
                    </Link>
                    <Link href="/admin/analytics">
                      <a
                        className={`py-2 px-1 text-sm font-medium transition-colors ${
                          isActive("/admin/analytics")
                            ? "text-primary-600 border-b-2 border-primary-600"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Admin Analytics
                      </a>
                    </Link>
                  </>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <Bell className="h-5 w-5 text-slate-400" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary-100 text-primary-700 text-sm">
                        {user ? getInitials(user.name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm text-slate-600">
                      {user?.name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <span className="font-medium">{user?.email}</span>
                  </DropdownMenuItem>
                  {user?.funeralHome && (
                    <DropdownMenuItem>
                      <span className="text-sm text-slate-500">
                        {user.funeralHome}
                      </span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <Link href="/profile">
                    <DropdownMenuItem>Profile Settings</DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
