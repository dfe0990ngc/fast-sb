import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AlertNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number; // Duration in milliseconds (default: 5000)
}

interface NotificationContextType {
  notifications: AlertNotification[];
  showNotification: (type: AlertNotification['type'], message: string, duration?: number) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);

  // Auto-remove notifications after their duration
  useEffect(() => {
    if (notifications.length > 0) {
      const notification = notifications[0];
      const duration = notification.duration || 5000;
      
      const timer = setTimeout(() => {
        setNotifications(prev => prev.slice(1));
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const showNotification = (
    type: AlertNotification['type'], 
    message: string, 
    duration?: number
  ) => {
    const notification: AlertNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      duration
    };
    setNotifications(prev => [...prev, notification]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const value: NotificationContextType = {
    notifications,
    showNotification,
    removeNotification,
    clearAllNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
