import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { ApplicantDocument } from '../../types/types';
import { streamPdfToBrowser } from '../../lib/pdfStream';

const MAX_FILES = 7;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ['application/pdf'];
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/fast-sb`).replace(/\/$/, '');

type ApplicantDocumentsPanelProps = {
  applicantId?: string | number | null;
  initialDocuments?: ApplicantDocument[];
};

type ApplicantPayload = {
  documents?: ApplicantDocument[];
};

type ApiEnvelope = {
  success?: boolean;
  message?: string;
  documents?: ApplicantDocument[];
  applicant?: ApplicantPayload;
  data?: {
    documents?: ApplicantDocument[];
    applicant?: ApplicantPayload;
  };
};

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function normalizeDocuments(
  documents: ApplicantDocument[] | undefined,
  applicantId?: string | number | null
): ApplicantDocument[] {
  return (documents || []).map((document) => ({
    ...document,
    StreamUrl:
      document.StreamUrl ||
      (applicantId
        ? buildApiUrl(`/api/applicants/${applicantId}/documents/${document.id}/stream`)
        : undefined),
    Label: document.Label || 'PDF',
  }));
}

function extractDocuments(payload: ApiEnvelope, applicantId?: string | number | null): ApplicantDocument[] {
  return normalizeDocuments(
    payload.documents ||
      payload.data?.documents ||
      payload.applicant?.documents ||
      payload.data?.applicant?.documents ||
      [],
    applicantId
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(bytes / 1024, 0.1).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFiles(files: File[], existingCount: number): string | null {
  if (!files.length) {
    return 'Please select at least one PDF file.';
  }

  if (files.length > MAX_FILES) {
    return 'You can upload a maximum of 7 PDF files at once.';
  }

  if (existingCount + files.length > MAX_FILES) {
    return `This applicant can only have up to 7 requirement PDFs. Remaining slots: ${Math.max(MAX_FILES - existingCount, 0)}.`;
  }

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!(ACCEPTED_MIME_TYPES.includes(file.type) || file.type === '') || extension !== 'pdf') {
      return 'Only PDF files are allowed.';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `"${file.name}" exceeds the 50 MB limit.`;
    }
  }

  return null;
}

function getAccessToken(): string {
  return localStorage.getItem('access_token') || localStorage.getItem('token') || '';
}

async function parseJsonResponse(response: Response): Promise<ApiEnvelope> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as ApiEnvelope;
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as ApiEnvelope;
  } catch {
    return {
      success: response.ok,
      message: text || `HTTP ${response.status}`,
    };
  }
}

export default function ApplicantDocumentsPanel({
  applicantId,
  initialDocuments = [],
}: ApplicantDocumentsPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<ApplicantDocument[]>(() =>
    normalizeDocuments(initialDocuments, applicantId)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const endpointBase = useMemo(() => {
    if (!applicantId) {
      return '';
    }

    return `/api/applicants/${applicantId}/documents`;
  }, [applicantId]);

  const loadDocuments = useCallback(async () => {
    if (!applicantId) {
      setDocuments([]);
      return;
    }

    setIsLoadingDocuments(true);

    try {
      const response = await fetch(buildApiUrl(`/api/applicants/${applicantId}`), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      });

      const payload = await parseJsonResponse(response);
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || 'Failed to load applicant requirement PDFs.');
      }

      setDocuments(extractDocuments(payload, applicantId));
    } catch (error) {
      setDocuments(normalizeDocuments(initialDocuments, applicantId));
      toast.error(error instanceof Error ? error.message : 'Failed to load applicant requirement PDFs.');
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [applicantId, initialDocuments]);

  useEffect(() => {
    setDocuments(normalizeDocuments(initialDocuments, applicantId));
  }, [applicantId, initialDocuments]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleOpenPicker = () => {
    if (!applicantId || isUploading) {
      return;
    }
    inputRef.current?.click();
  };

  const uploadFiles = async (fileList: FileList | null) => {
    if (!applicantId) {
      toast.warning('Save the applicant first before uploading requirement PDFs.');
      return;
    }

    const files = Array.from(fileList || []);
    const validationError = validateFiles(files, documents.length);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('documents[]', file));

    setIsUploading(true);

    try {
      const response = await fetch(buildApiUrl(endpointBase), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
        body: formData,
      });

      const payload = await parseJsonResponse(response);
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || 'Failed to upload applicant requirement PDFs.');
      }

      const nextDocuments = extractDocuments(payload, applicantId);
      setDocuments(nextDocuments);
      toast.success('Applicant requirement PDFs uploaded successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload applicant requirement PDFs.');
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (document: ApplicantDocument) => {
    if (!applicantId || deletingId) {
      return;
    }

    const confirmed = window.confirm(`Delete "${document.OriginalFileName}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(String(document.id));

    try {
      const response = await fetch(buildApiUrl(`${endpointBase}/${document.id}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      });

      const payload = await parseJsonResponse(response);
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || 'Failed to delete applicant document.');
      }

      const nextDocuments = extractDocuments(payload, applicantId);
      setDocuments(nextDocuments);
      toast.success('Applicant document deleted successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete applicant document.');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePreview = async (document: ApplicantDocument) => {
    try {
      await streamPdfToBrowser({
        url:
          document.StreamUrl ||
          buildApiUrl(`/api/applicants/${applicantId}/documents/${document.id}/stream`),
        fileName: document.OriginalFileName || `applicant-document-${document.id}.pdf`,
        mode: 'open',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open PDF document.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-2">
        <div>
          <p className="font-medium text-sm">Requirement Documents</p>
          <p className="text-muted-foreground text-xs">
            PDF only. Up to 7 files total, 50 MB maximum per file.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleOpenPicker}
          disabled={!applicantId || isUploading || documents.length >= MAX_FILES}
        >
          {isUploading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Upload className="mr-2 w-4 h-4" />}
          Upload PDF
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(event) => void uploadFiles(event.target.files)}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={handleOpenPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpenPicker();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!applicantId || isUploading) return;
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!applicantId || isUploading) return;
          void uploadFiles(event.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed p-4 text-center transition ${
          isDragging ? 'border-[#008ea2] bg-[#008ea2]/5' : 'border-slate-300 bg-slate-50/70'
        } ${!applicantId ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
      >
        <Upload className="mx-auto mb-2 w-5 h-5 text-slate-500" />
        <p className="font-medium text-sm">Drag and drop scanned PDF files here</p>
        <p className="mt-1 text-muted-foreground text-xs">
          or click this box to browse requirement PDFs
        </p>
        {!applicantId ? (
          <p className="mt-2 text-amber-600 text-xs">
            Save the applicant first before uploading requirement documents.
          </p>
        ) : null}
      </div>

      {isLoadingDocuments ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading applicant documents...
        </div>
      ) : null}

      {documents.length ? (
        <div className="gap-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => {
            const isDeleting = deletingId === String(document.id);

            return (
              <div
                key={document.id}
                role="button"
                tabIndex={0}
                onClick={() => void handlePreview(document)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void handlePreview(document);
                  }
                }}
                className="group relative flex flex-col items-start gap-2 hover:shadow-md p-4 border rounded-xl text-left transition"
              >
                <button
                  type="button"
                  className="top-2 right-2 absolute flex justify-center items-center bg-white hover:bg-red-50 border rounded-full w-6 h-6 text-slate-500 hover:text-red-600 transition"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleDelete(document);
                  }}
                  disabled={isDeleting}
                  aria-label={`Delete ${document.OriginalFileName}`}
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                </button>

                <div className="flex items-start gap-3 w-full">
                  <div className="flex justify-center items-center bg-red-50 group-hover:bg-red-100 rounded-lg w-11 h-11 transition shrink-0">
                    <FileText className="w-5 h-5 text-red-600" />
                  </div>

                  <div className="min-w-0">
                    <div className="inline-flex bg-red-100 mb-1 px-2 py-0.5 rounded-full font-semibold text-[10px] text-red-700 uppercase tracking-wide">
                      {document.Label || 'PDF'}
                    </div>
                    <div className="font-medium text-xs break-words leading-snug">
                      {document.OriginalFileName || `Document #${document.id}`}
                    </div>
                    {document.FileSize ? (
                      <p className="mt-1 text-muted-foreground text-xs">{formatFileSize(document.FileSize)}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
