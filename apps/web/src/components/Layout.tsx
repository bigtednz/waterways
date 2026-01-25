import { Outlet, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, User } from "../lib/auth";

const navItems = [
  { path: "/app/dashboard", label: "Dashboard" },
  { path: "/app/competitions", label: "Competitions" },
  { path: "/app/analysis", label: "Analysis" },
  { path: "/app/run-library", label: "Run Library" },
  { path: "/app/penalties", label: "Penalties" },
];

export function Layout() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  useEffect(() => {
    if (auth.isAuthenticated()) {
      auth.getCurrentUser().then((currentUser) => {
        setUser(currentUser);
        setIsAdmin(currentUser?.role === "ADMIN");
      });
    }
  }, []);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Swipe gesture handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && !sidebarOpen) {
      // Swipe left to open sidebar
      setSidebarOpen(true);
    }
    if (isRightSwipe && sidebarOpen) {
      // Swipe right to close sidebar
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
        >
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Waterways</h1>
                <p className="text-sm text-gray-400 mt-1">Big Teds Sports Analytics Platform</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <nav className="mt-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-6 py-3 hover:bg-gray-800 touch-manipulation min-h-[44px] ${
                  location.pathname.startsWith(item.path)
                    ? "bg-gray-800 border-l-4 border-blue-500"
                    : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`block px-6 py-3 hover:bg-gray-800 touch-manipulation min-h-[44px] ${
                  location.pathname.startsWith("/admin")
                    ? "bg-gray-800 border-l-4 border-purple-500"
                    : ""
                }`}
              >
                Admin
              </Link>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <div 
          className="flex-1 flex flex-col overflow-hidden lg:ml-0"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <header className="bg-white shadow-sm border-b">
            <div className="px-4 sm:px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden text-gray-600 hover:text-gray-800 p-2 -ml-2 touch-manipulation"
                  aria-label="Open menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h2 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
                  {navItems.find((item) =>
                    location.pathname.startsWith(item.path)
                  )?.label || 
                  (location.pathname.startsWith("/app/admin") ? "Admin" : "Big Teds Sports Analytics Platform")}
                </h2>
              </div>
              <button
                onClick={auth.logout}
                className="text-sm text-gray-600 hover:text-gray-800 px-2 py-1"
              >
                Logout
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
