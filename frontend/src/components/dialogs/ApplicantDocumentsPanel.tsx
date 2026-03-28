import EntityPdfDocumentsPanel from './EntityPdfDocumentsPanel';
import { ManagedPdfDocument, ManagedPdfDocumentsEnvelope } from './pdf-documents.types';

type ApplicantDocumentsPanelProps = {
  applicantId?: string | number | null;
  initialDocuments?: ManagedPdfDocument[];
};

function normalizeApplicantDocuments(
  documents: ManagedPdfDocument[] | undefined,
  applicantId?: string | number | null
): ManagedPdfDocument[] {
  return (documents || []).map((document) => ({
    ...document,
    StreamUrl:
      document.StreamUrl ||
      (applicantId ? `/fast-sb/api/applicants/${applicantId}/documents/${document.id}/stream` : undefined),
    Label: document.Label || 'PDF',
  }));
}

function extractApplicantDocuments(
  payload: ManagedPdfDocumentsEnvelope,
  applicantId?: string | number | null
): ManagedPdfDocument[] {
  return normalizeApplicantDocuments(
    payload.documents ||
      payload.data?.documents ||
      payload.applicant?.documents ||
      payload.data?.applicant?.documents ||
      [],
    applicantId
  );
}

export default function ApplicantDocumentsPanel({
  applicantId,
  initialDocuments = [],
}: ApplicantDocumentsPanelProps) {
  return (
    <EntityPdfDocumentsPanel
      entityId={applicantId}
      initialDocuments={initialDocuments}
      title="Requirement Documents"
      helperText="PDF only. Up to 7 files total, 50 MB maximum per file."
      browseText="Tap or click the box to browse requirement PDFs."
      dragTitle="Drag and drop scanned PDF files here"
      dragHint="These files will be attached directly to the applicant record."
      disabledMessage="Save the applicant first before uploading requirement documents."
      uploadSuccessMessage="Applicant requirement PDFs uploaded successfully."
      uploadErrorMessage="Failed to upload applicant requirement PDFs."
      loadErrorMessage="Failed to load applicant requirement PDFs."
      deleteSuccessMessage="Applicant document deleted successfully."
      deleteErrorMessage="Failed to delete applicant document."
      loadingText="Loading applicant documents..."
      emptyLabel="PDF"
      uploadButtonLabel="Upload PDF"
      getLoadUrl={(applicantIdValue) => `/api/applicants/${applicantIdValue}`}
      getUploadUrl={(applicantIdValue) => `/api/applicants/${applicantIdValue}/documents`}
      getDeleteUrl={(applicantIdValue, documentId) =>
        `/api/applicants/${applicantIdValue}/documents/${documentId}`
      }
      getStreamUrl={(applicantIdValue, documentId) =>
        `/api/applicants/${applicantIdValue}/documents/${documentId}/stream`
      }
      extractDocuments={extractApplicantDocuments}
    />
  );
}
