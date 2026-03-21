import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge } from './badge';
import {
  Home,
  Bell,
  User,
  Settings,
  LogOut,
  Car,
  Truck,
  User2,
} from 'lucide-react';
import Logo from '../../assets/images/logo.png';
import { SidebarFooter } from './sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';
import { Button } from './button';
import { Avatar, AvatarFallback } from './avatar';
import { appName, appVersion } from '../../lib/utils';
import FastSBLogo from './fast-sb-path-new';

import SB from '../../assets/images/sb.png';
import LGU from '../../assets/images/lgu.png';
import VMO from '../../assets/images/vmo.jpg';

interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: number;
  roles?: string[];
}

export function MobileBottomNavigation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications] = useState(3);

  if (!user) return null;

  const getBottomNavItems = (): MobileNavItem[] => {
    const allItems: MobileNavItem[] = [
      { id: 'dashboard', label: 'Home', icon: Home, path: '/dashboard', roles: ['Admin', 'Editor', 'Viewer'] },
      { id: 'franchises', label: 'Franchises', icon: Car, path: '/franchises', roles: ['Admin', 'Editor', 'Viewer'] },
      { id: 'applicants', label: 'Applicants', icon: User, path: '/applicants', roles: ['Admin', 'Editor','Viewer'] },
      { id: 'makes', label: 'Makes', icon: Truck, path: '/makes', roles: ['Admin', 'Editor'] },
      { id: 'users', label: 'Users', icon: User2, path: '/users', roles: ['Admin'] },
    ];

    const filteredItems = allItems.filter(item => item.roles.includes(user.UserType));
    return filteredItems.slice(0, 5); // Limit to 5 items for mobile
  };

  const bottomNavItems = getBottomNavItems();

  return (
    <div className="lg:hidden right-0 bottom-0 safe-bottom left-0 z-50 fixed bg-white border-border border-t">
      <nav className="gap-1 grid grid-cols-5 px-2 py-2">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`
                relative flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-h-touch
                ${isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }
              `}
            >
              <div className="relative">
                <Icon className="mb-1 w-4 h-4" />
                {item.badge && (
                  <Badge 
                    variant="destructive" 
                    className="-top-2 -right-2 absolute flex justify-center items-center p-0 w-4 h-4 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className="w-full font-medium text-xs text-center truncate">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

interface MobileHeaderProps {
  currentPage: string;
  userName: string;
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

export function MobileHeader({ currentPage, userName, onMenuToggle, isMenuOpen }: MobileHeaderProps) {
  const navigate = useNavigate();
  const [notifications] = useState(3);

  return (
    <header className="lg:hidden safe-top top-0 z-40 sticky bg-white px-4 py-3 border-border border-b">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="hover:bg-accent p-2 rounded-lg min-w-touch min-h-touch transition-colors"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          >
            <div className={`w-6 h-6 flex flex-col justify-center items-center transition-all duration-300 ${isMenuOpen ? 'rotate-45' : ''}`}>
              <span className={`block h-0.5 w-6 bg-current transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-0.5' : '-translate-y-1'}`} />
              <span className={`block h-0.5 w-6 bg-current transition-all duration-300 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
              <span className={`block h-0.5 w-6 bg-current transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-0.5' : 'translate-y-1'}`} />
            </div>
          </button>
          <div>
            <h1 className="font-semibold text-lg truncate capitalize">
              {(currentPage || 'dashboard').replace('-', ' ')}
              &nbsp;<span className="font-bold text-gray-700 text-sm">(v{appVersion})</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Hi, {userName.split(' ')[0]}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* <button
            onClick={() => navigate('/notifications')}
            className="relative hover:bg-accent p-2 rounded-lg min-w-touch min-h-touch transition-colors"
          >
            <Bell className="w-4 h-4" />
            {notifications > 0 && (
              <Badge 
                variant="destructive" 
                className="-top-1 -right-1 absolute flex justify-center items-center p-0 w-4 h-4 text-xs"
              >
                {notifications}
              </Badge>
            )}
          </button> */}
          <button
            onClick={() => navigate('/my-profile')}
            className="hover:bg-accent p-1 rounded-full min-w-touch min-h-touch transition-colors"
          >
            <div className="flex justify-center items-center bg-primary/10 rounded-full w-8 h-8">
              <User className="w-4 h-4 text-primary" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}

interface MobileMenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    path: string;
    badge?: number;
  }[];
}

export function MobileMenuOverlay({ isOpen, onClose, menuItems }: MobileMenuOverlayProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800';
      case 'Editor': return 'bg-blue-100 text-blue-800';
      case 'Viewer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="lg:hidden z-40 fixed inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Menu */}
      <div className="lg:hidden top-0 left-0 z-50 fixed bg-white shadow-xl w-80 max-w-[85%] h-full animate-slide-in-left">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-border border-b">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center w-16 h-16">
                <FastSBLogo/>
                {/* <img src={Logo} alt="Logo" className="min-w-16 min-h-16" /> */}
              </div>
              <div className="text-gray-700">
                <div className="font-bold text-xl leading-tight">{ appName }</div>
                <div className="text-gray-500 text-sm">Sta. Cruz, Dvo Sur</div>
              </div>
            </div>
          </div>
          
          {/* Menu Items */}
          <nav className="flex-1 py-4 overflow-y-auto">
            <div className="space-y-2 px-4">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.path)}
                    className={`
                      w-full flex items-center gap-1 p-1 rounded-xl transition-all duration-200 min-h-touch
                      ${isActive 
                        ? 'bg-primary/10 text-primary border border-primary/20' 
                        : 'text-foreground hover:bg-accent'
                      }
                    `}
                  >
                    <div className="flex justify-center items-center bg-primary/10 rounded-lg w-8 h-8">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="flex-1 font-medium text-left">{item.label}</span>
                    {item.badge && (
                      <Badge variant="destructive" className="px-2 py-1 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
          
          {/* Footer */}
          <SidebarFooter className="p-4 border-sidebar-border border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="justify-start hover:bg-sidebar-accent p-3 rounded-lg w-full min-h-touch hover:scale-[1.01] transition-all duration-200">
                  <Avatar className="ring-2 ring-primary/20 w-9 h-9">
                    <AvatarFallback className="bg-primary/10 font-medium text-primary text-sm">
                      {([user.FirstName[0],user.LastName[0]]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 items-start ml-3">
                    <span className="font-medium text-foreground text-sm">{user.FirstName}</span>
                    <Badge className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(user.UserType)}`}>
                      {user.UserType.charAt(0).toUpperCase() + user.UserType.slice(1)}
                    </Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="p-2 w-64">
                <div className="mb-2 px-3 py-2">
                  <p className="font-medium text-foreground text-sm">{user.FirstName}</p>
                  <p className="text-muted-foreground text-xs">{user.UserType} Account</p>
                </div>
                <DropdownMenuItem onClick={() => handleNavigation('/my-profile')} className="px-3 py-3 rounded-lg">
                  <div className="flex justify-center items-center bg-blue-100 mr-3 rounded-lg w-8 h-8">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-base">Profile Settings</span>
                </DropdownMenuItem>
                {user.UserType === 'Admin' && (
                  <DropdownMenuItem onClick={() => handleNavigation('/settings')} className="px-3 py-3 rounded-lg">
                    <div className="flex justify-center items-center bg-gray-100 mr-3 rounded-lg w-8 h-8">
                      <Settings className="w-4 h-4 text-gray-600" />
                    </div>
                    <span className="text-base">System Settings</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem onClick={logout} className="hover:bg-red-50 px-3 py-3 rounded-lg text-red-600">
                  <div className="flex justify-center items-center bg-red-100 mr-3 rounded-lg w-8 h-8">
                    <LogOut className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="text-base">Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </div>
      </div>
    </>
  );
}
