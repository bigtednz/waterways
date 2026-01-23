import { Outlet, Link, useLocation } from "react-router-dom";
import { auth } from "../lib/auth";

const navItems = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/competitions", label: "Competitions" },
  { path: "/analysis", label: "Analysis" },
  { path: "/run-library", label: "Run Library" },
  { path: "/penalties", label: "Penalties" },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        <aside className="w-64 bg-gray-900 text-white">
          <div className="p-6">
            <h1 className="text-xl font-bold">Waterways</h1>
            <p className="text-sm text-gray-400 mt-1">Performance Platform</p>
          </div>
          <nav className="mt-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-6 py-3 hover:bg-gray-800 ${
                  location.pathname.startsWith(item.path)
                    ? "bg-gray-800 border-l-4 border-blue-500"
                    : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white shadow-sm border-b">
            <div className="px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                {navItems.find((item) =>
                  location.pathname.startsWith(item.path)
                )?.label || "Waterways"}
              </h2>
              <button
                onClick={auth.logout}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Logout
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
