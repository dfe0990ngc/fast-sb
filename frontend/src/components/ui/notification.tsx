import React from 'react';
import {
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  X
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

export const NotificationContainer = () => {
    const { notifications, removeNotification } = useNotification();

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5" />;
            case 'error':
                return <XCircle className="w-5 h-5" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5" />;
            case 'info':
            default:
                return <Info className="w-5 h-5" />;
        }
    };

    const getNotificationStyles = (type: string) => {
        switch (type) {
            case 'success':
                return 'bg-green-500 text-white border-green-600';
            case 'error':
                return 'bg-red-500 text-white border-red-600';
            case 'warning':
                return 'bg-yellow-500 text-white border-yellow-600';
            case 'info':
            default:
                return 'bg-blue-500 text-white border-blue-600';
        }
    };

    return (
        <div className="top-4 right-2 sm:right-4 z-[999999] fixed space-y-2 max-w-[calc(100vw-1rem)] sm:max-w-sm">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 border ${getNotificationStyles(notification.type)}`}
                >
                    {getNotificationIcon(notification.type)}
                    <span className="flex-1 font-medium text-sm">{notification.message}</span>
                    <button
                        onClick={() => removeNotification(notification.id)}
                        className="hover:bg-white/20 ml-2 p-1 rounded-full transition-colors"
                        aria-label="Dismiss notification"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};

// Export the useNotification hook for easy access
export { useNotification } from '../../context/NotificationContext';
