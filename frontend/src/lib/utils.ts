import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const appVersion: string = '2.0.0';
export const appName: string = import.meta.env.VITE_APP_NAME || 'F.A.S.T SB';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const lpad = (value: number | string, pad = '0', len = 2) => {
  const v = value+'';
  const l = len - v.length;
  if(l > 0){
    return pad.repeat(l)+v;
  }else{
    return v;
  }
}

export const isRenewed = (expiryDate?: string, latestExpiryDate?: string) => {
  if (!expiryDate || !latestExpiryDate) return false;
  if (latestExpiryDate === '0000-00-00') return false;

  const expiry = new Date(expiryDate);
  const latest = new Date(latestExpiryDate);
  
  // Renewed means the latest expiry is AFTER the original expiry (extended)
  return latest.getTime() > expiry.getTime();
};

export const isExpiringSoon = (expiryDate?: string, latestExpiryDate?: string) => {
  if (!expiryDate) return false;
  
  // If renewed, don't treat as expiring soon - it's been taken care of
  if (isRenewed(expiryDate, latestExpiryDate)) return false;
  
  // Only check the original expiryDate if NOT renewed
  const dateToCheck = new Date(expiryDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(dateToCheck);
  checkDate.setHours(0, 0, 0, 0);
  
  const diffTime = checkDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= 90 && diffDays > 0;
};

export const isExpiredAlready = (expiryDate?: string, latestExpiryDate?: string) => {
  if (!expiryDate) return false;
  
  // If renewed, don't treat as expired - it's been renewed
  if (isRenewed(expiryDate, latestExpiryDate)) return false;
  
  // Only check the original expiryDate if NOT renewed
  const dateToCheck = new Date(expiryDate);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(dateToCheck);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate.getTime() < today.getTime();
};

// Utility functions
export const getStatusColor = (status: string, strDate = '', strLatestExpiry = '') => {
  const colors = {
    new: 'bg-green-100 text-green-800 border-green-200',
    renew: 'bg-blue-100 text-blue-800 border-blue-200',
    drop: 'bg-red-100 text-red-800 border-red-200',
  };

  if(strDate !== ''){
      // If renewed, always show green (renewal is completed)
      if (isRenewed(strDate, strLatestExpiry)) {
        return 'bg-green-100 text-green-800 border-green-200';
      }
      
      // Only check expiry status if NOT renewed
      if (isExpiredAlready(strDate, strLatestExpiry)) {
        return 'bg-red-100 text-red-800 border-red-200';
      }
    
      if (isExpiringSoon(strDate, strLatestExpiry)) {
        return 'bg-orange-100 text-orange-800 border-orange-200';
      }
  }
  
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
};

export const getStatusLabel = (status: string) => {
  const labels = {
    new: 'New',
    renew: 'Renewed',
    drop: 'Dropped',
  };

  return labels[status as keyof typeof labels] || 'N/A';
}

export const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getStatusBadgeClass = (status: string, strDate = '', strLatestExpiry = ''): string => {
  
  if(strDate !== ''){
      // If renewed, always show green (renewal is completed)
      if (isRenewed(strDate, strLatestExpiry)) {
        return 'bg-green-100 text-green-800 border-green-200';
      }
      
      // Only check expiry status if NOT renewed
      if (isExpiredAlready(strDate, strLatestExpiry)) {
        return 'bg-red-100 text-red-800 border-red-200';
      }
    
      if (isExpiringSoon(strDate, strLatestExpiry)) {
        return 'bg-orange-100 text-orange-800 border-orange-200';
      }
  }

  switch (status.toLowerCase()) {
    case 'new':
      return 'bg-blue-100 text-blue-800';
    case 'renew':
      return 'bg-green-100 text-green-800';
    case 'drop':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};