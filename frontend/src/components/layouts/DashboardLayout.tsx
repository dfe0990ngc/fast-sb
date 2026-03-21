import { ReactNode, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger, SidebarFooter } from '../ui/sidebar';
import { MobileHeader, MobileMenuOverlay } from '../ui/mobile-navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Home,
  Settings,
  LogOut,
  User,
  Car,
  Truck,
  User2,
} from 'lucide-react';
import SB from '../../assets/images/sb.png';
import LGU from '../../assets/images/lgu.png';
import VMO from '../../assets/images/vmo.jpg';

import { appName, appVersion } from '../../lib/utils';
import FastSBLogo from '../ui/fast-sb-path-new';

interface DashboardLayoutProps {
  children: ReactNode;
  currentPage?: string;  // Make it optional
}

export const DashboardLayout = ({ children, currentPage }: DashboardLayoutProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // const [notifications, setNotifications] = useState(3);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return null;

  const getMenuItems = () => {
    const allItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard', roles: ['Admin', 'Editor', 'Viewer'] },
      { id: 'franchises', label: 'Franchise', icon: Car, path: '/franchises', roles: ['Admin', 'Editor', 'Viewer'] },
      { id: 'applicants', label: 'Applicants', icon: User, path: '/applicants', roles: ['Admin', 'Editor','Viewer'] },
      { id: 'makes', label: 'Makes', icon: Truck, path: '/makes', roles: ['Admin', 'Editor'] },
      { id: 'users', label: 'Users', icon: User2, path: '/users', roles: ['Admin'] },
    ];

    if (!user) return [];

    return allItems.filter(item => item.roles.includes(user.UserType));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800';
      case 'Editor': return 'bg-blue-100 text-blue-800';
      case 'Viewer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const menuItems = getMenuItems();

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <Sidebar>
          <SidebarHeader className="p-4 border-sidebar-border border-b">
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
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={location.pathname === item.path}
                    className="group justify-start hover:shadow-sm px-3 py-2 rounded-lg w-full min-h-[40px] font-medium text-sm hover:scale-[1.01] transition-all duration-200"
                  >
                    <div className="flex justify-center items-center bg-primary/10 rounded-md w-6 h-6 transition-colors duration-200">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="ml-2 transition-colors duration-200">{item.label}</span>
                    {item.badge && (
                      <Badge variant="destructive" className="shadow-sm ml-auto px-1.5 py-0.5 rounded-full text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

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
                <DropdownMenuItem onClick={() => navigate('/my-profile')} className="px-3 py-3 rounded-lg">
                  <div className="flex justify-center items-center bg-blue-100 mr-3 rounded-lg w-8 h-8">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-base">Profile Settings</span>
                </DropdownMenuItem>
                {user.UserType === 'Admin' && (
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="px-3 py-3 rounded-lg">
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
        </Sidebar>

        <div className="flex flex-col flex-1 w-full">
          {/* Mobile Header */}
          <div className="lg:hidden top-0 z-50 sticky">
            <MobileHeader
              currentPage={currentPage}
              userName={user.FirstName}
              isMenuOpen={isMobileMenuOpen}
              onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </div>

          {/* Desktop Header */}
          <header className="hidden lg:block top-0 z-40 sticky bg-white shadow-sm px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              
              <div className="flex items-center gap-4">
                <SidebarTrigger className="min-w-touch min-h-touch" />
                <div>
                  <h1 className="font-bold text-2xl capitalize">
                    {(currentPage || 'dashboard').replace('-', ' ')}  {/* Line 171 - FIXED */}
                  </h1>
                  <p className="mt-1 text-muted-foreground text-lg">
                    Welcome back, {user.FirstName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* <Button variant="outline" size="default" onClick={() => navigate('/notifications')} className="px-4 py-2 min-h-touch text-base">
                  <Bell className="w-4 h-4" />
                  {notifications > 0 && (
                    <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-xs">
                      {notifications}
                    </Badge>
                  )}
                </Button> */}

                <Avatar onClick={() => navigate('/my-profile')} className="hover:bg-primary/55 w-10 h-10 transition-all duration-200 cursor-pointer">
                  <AvatarFallback className="text-base">{([user.FirstName[0],user.LastName[0]]).join('')}</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          <main className="flex-1 bg-gray-50 p-3 sm:p-4 lg:p-6">
            <div className="accessibility-enhanced">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <MobileMenuOverlay
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        menuItems={menuItems}
      />
    </SidebarProvider>
  );
};