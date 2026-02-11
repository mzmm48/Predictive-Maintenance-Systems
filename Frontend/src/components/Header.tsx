import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Header() {
  const navigate = useNavigate();
  const auth = useAuth();

  const handleLogout = async () => {
    try {
      await auth.logout();
    } finally {
      navigate('/login');
    }
  };

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md border-b"
      style={{
        background: 'rgba(35, 36, 33, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.05)'
      }}
    >
      <div className="px-8 py-4 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)',
              boxShadow: '0 0 20px rgba(34, 211, 238, 0.3)'
            }}
          ></div>
          <div className="flex items-center gap-1">
            <span style={{ color: '#e5e7eb' }}>Machine</span>
            <span style={{ color: '#22d3ee' }}>Analysis</span>
          </div>
        </div>

        {/* User + Logout */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2" style={{ color: '#9ca3af' }}>
            <User className="w-4 h-4" />
            <span>
              {auth.user?.username ?? "—"}
              {auth.user?.role ? ` (${auth.user.role})` : ""}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors hover:bg-white/10"
            style={{ color: '#9ca3af' }}
          >
            <LogOut className="w-4 h-4" />
            <span>Abmelden</span>
          </button>
        </div>
      </div>
    </header>
  );
}
