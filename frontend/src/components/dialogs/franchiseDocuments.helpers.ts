import { ManagedPdfDocument, ManagedPdfDocumentsEnvelope } from './pdf-documents.types';

export type FranchiseDocument = ManagedPdfDocument & {
  FranchiseID?: string | number;
};

export function normalizeFranchiseDocuments(
  documents: FranchiseDocument[] | undefined,
  franchiseId?: string | number | null
): FranchiseDocument[] {
  return (documents || []).map((document) => ({
    ...document,
    StreamUrl:
      document.StreamUrl ||
      (franchiseId ? `/fast-sb/api/franchises/${franchiseId}/documents/${document.id}/stream` : undefined),
    Label: document.Label || 'Authorization PDF',
  }));
}

export function extractFranchiseDocuments(
  payload: ManagedPdfDocumentsEnvelope,
  franchiseId?: string | number | null
): FranchiseDocument[] {
  return normalizeFranchiseDocuments(
    (payload.documents ||
      payload.franchise?.documents ||
      payload.data?.documents ||
      payload.data?.franchise?.documents ||
      []) as FranchiseDocument[],
    franchiseId
  );
}
