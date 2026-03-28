import EntityPdfDocumentsPanel from './EntityPdfDocumentsPanel';
import { FranchiseDocument, extractFranchiseDocuments } from './franchiseDocuments.helpers';

type FranchiseDocumentsPanelProps = {
  franchiseId?: string | number | null;
  initialDocuments?: FranchiseDocument[];
};

export default function FranchiseDocumentsPanel({
  franchiseId,
  initialDocuments = [],
}: FranchiseDocumentsPanelProps) {
  return (
    <EntityPdfDocumentsPanel
      entityId={franchiseId}
      initialDocuments={initialDocuments}
      title="Driver Authorization Documents"
      helperText="PDF only. Upload scanned authorization documents for the authorized driver. Up to 7 files total, 50 MB maximum per file."
      browseText="Tap or click the box to browse authorization PDFs."
      dragTitle="Drag and drop driver authorization PDFs here"
      dragHint="These files will be attached directly to the franchise record."
      disabledMessage="Save the franchise first before uploading driver authorization PDFs."
      uploadSuccessMessage="Driver authorization PDFs uploaded successfully."
      uploadErrorMessage="Failed to upload driver authorization PDFs."
      loadErrorMessage="Failed to load driver authorization PDFs."
      deleteSuccessMessage="Driver authorization PDF deleted successfully."
      deleteErrorMessage="Failed to delete driver authorization PDF."
      loadingText="Loading driver authorization documents..."
      emptyLabel="Authorization PDF"
      uploadButtonLabel="Upload PDF"
      getLoadUrl={(franchiseIdValue) => `/api/franchises/${franchiseIdValue}`}
      getUploadUrl={(franchiseIdValue) => `/api/franchises/${franchiseIdValue}/documents`}
      getDeleteUrl={(franchiseIdValue, documentId) =>
        `/api/franchises/${franchiseIdValue}/documents/${documentId}`
      }
      getStreamUrl={(franchiseIdValue, documentId) =>
        `/api/franchises/${franchiseIdValue}/documents/${documentId}/stream`
      }
      extractDocuments={extractFranchiseDocuments}
    />
  );
}
