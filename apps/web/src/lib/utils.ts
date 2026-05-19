import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

export function severityColour(severity: string | null | undefined): string {
  switch (severity) {
    case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200';
    case 'HIGH':     return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'MEDIUM':   return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'LOW':      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:         return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function statusColour(status: string): string {
  switch (status) {
    case 'PASS':        return 'text-green-700 bg-green-50';
    case 'FAIL':        return 'text-red-700 bg-red-50';
    case 'WARNING':     return 'text-yellow-700 bg-yellow-50';
    case 'NOT_CHECKED': return 'text-gray-500 bg-gray-50';
    // Fix job statuses
    case 'COMPLETED':   return 'text-green-700 bg-green-50';
    case 'DELIVERED':   return 'text-blue-700 bg-blue-50';
    case 'IN_PROGRESS': return 'text-brand-700 bg-brand-50';
    case 'PENDING':     return 'text-gray-700 bg-gray-100';
    case 'AWAITING_PARTS': return 'text-orange-700 bg-orange-50';
    case 'CANCELLED':   return 'text-red-700 bg-red-50';
    default:            return 'text-gray-700 bg-gray-100';
  }
}