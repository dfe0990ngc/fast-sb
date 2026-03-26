// Apply this in the component/file that actually calls the PDF export API.
// That file was not included in the uploaded ZIP, so this is the exact snippet
// to merge into your existing export handler.

import { ExportPdfOptions } from './ExportPdfDialog';

export function buildFranchisePdfExportQuery(
  startDate: Date | null,
  endDate: Date | null,
  options?: ExportPdfOptions
): string {
  const params = new URLSearchParams();

  if (options?.type) {
    params.set('report_type', options.type);
  }

  if (options?.status) {
    params.set('status', options.status);
  }

  if (options?.gender && options.gender !== 'all') {
    params.set('gender', options.gender);
  }

  if (startDate) {
    params.set('start_date', startDate.toISOString().slice(0, 10));
  }

  if (endDate) {
    params.set('end_date', endDate.toISOString().slice(0, 10));
  }

  if (options?.action) {
    params.set('action', options.action);
  }

  return `/api/franchises/export/pdf?${params.toString()}`;
}
