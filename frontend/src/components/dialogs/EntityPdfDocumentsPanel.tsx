import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { streamPdfToBrowser } from '../../lib/pdfStream';
import { ManagedPdfDocument, ManagedPdfDocumentsEnvelope } from './pdf-documents.types';

const MAX_FILES = 7;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ['application/pdf'];
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/fast-sb`).replace(/\/$/, '');

export type EntityPdfDocumentsPanelProps = {
  entityId?: string | number | null;
  initialDocuments?: ManagedPdfDocument[];
  title: string;
  helperText: string;
  browseText: string;
  dragTitle: string;
  dragHint: string;
  disabledMessage: string;
  uploadSuccessMessage: string;
  uploadErrorMessage: string;
  loadErrorMessage: string;
  deleteSuccessMessage: string;
  deleteErrorMessage: string;
  loadingText: string;
  emptyLabel?: string;
  uploadButtonLabel?: string;
  getLoadUrl: (entityId: string | number) => string;
  getUploadUrl: (entityId: string | number) => string;
  getDeleteUrl: (entityId: string | number, documentId: string | number) => string;
  getStreamUrl: (entityId: string | number, documentId: string | number) => string;
  extractDocuments?: (
    payload: ManagedPdfDocumentsEnvelope,
    entityId?: string | number | null
  ) => ManagedPdfDocument[];
};

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
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
    return `This record can only have up to 7 PDFs. Remaining slots: ${Math.max(MAX_FILES - existingCount, 0)}.`;
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

async function parseJsonResponse(response: Response): Promise<ManagedPdfDocumentsEnvelope> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as ManagedPdfDocumentsEnvelope;
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as ManagedPdfDocumentsEnvelope;
  } catch {
    return {
      success: response.ok,
      message: text || `HTTP ${response.status}`,
    };
  }
}

function defaultExtractDocuments(
  payload: ManagedPdfDocumentsEnvelope,
  entityId?: string | number | null
): ManagedPdfDocument[] {
  const documents =
    payload.documents ||
    payload.data?.documents ||
    payload.applicant?.documents ||
    payload.franchise?.documents ||
    payload.data?.applicant?.documents ||
    payload.data?.franchise?.documents ||
    [];

  return Array.isArray(documents)
    ? documents.map((document) => ({
        ...document,
        Label: document.Label || 'PDF',
      }))
    : [];
}

export default function EntityPdfDocumentsPanel({
  entityId,
  initialDocuments = [],
  title,
  helperText,
  browseText,
  dragTitle,
  dragHint,
  disabledMessage,
  uploadSuccessMessage,
  uploadErrorMessage,
  loadErrorMessage,
  deleteSuccessMessage,
  deleteErrorMessage,
  loadingText,
  emptyLabel = 'PDF',
  uploadButtonLabel = 'Upload PDF',
  getLoadUrl,
  getUploadUrl,
  getDeleteUrl,
  getStreamUrl,
  extractDocuments = defaultExtractDocuments,
}: EntityPdfDocumentsPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<ManagedPdfDocument[]>(initialDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const normalizedInitialDocuments = useMemo(
    () => extractDocuments({ documents: initialDocuments }, entityId),
    [entityId, extractDocuments, initialDocuments]
  );

  useEffect(() => {
    setDocuments(normalizedInitialDocuments);
  }, [normalizedInitialDocuments]);

  const loadDocuments = useCallback(async () => {
    if (!entityId) {
      setDocuments([]);
      return;
    }

    setIsLoadingDocuments(true);

    try {
      const response = await fetch(buildApiUrl(getLoadUrl(entityId)), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      });

      const payload = await parseJsonResponse(response);
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || loadErrorMessage);
      }

      setDocuments(extractDocuments(payload, entityId));
    } catch (error) {
      setDocuments(normalizedInitialDocuments);
      toast.error(error instanceof Error ? error.message : loadErrorMessage);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [entityId, extractDocuments, getLoadUrl, loadErrorMessage, normalizedInitialDocuments]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleOpenPicker = () => {
    if (!entityId || isUploading) {
      return;
    }

    inputRef.current?.click();
  };

  const uploadFiles = async (fileList: FileList | null) => {
    if (!entityId) {
      toast.warning(disabledMessage);
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
      const response = await fetch(buildApiUrl(getUploadUrl(entityId)), {
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
        throw new Error(payload.message || uploadErrorMessage);
      }

      setDocuments(extractDocuments(payload, entityId));
      toast.success(uploadSuccessMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : uploadErrorMessage);
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (document: ManagedPdfDocument) => {
    if (!entityId || deletingId) {
      return;
    }

    const confirmed = window.confirm(`Delete "${document.OriginalFileName}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(String(document.id));

    try {
      const response = await fetch(buildApiUrl(getDeleteUrl(entityId, document.id)), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      });

      const payload = await parseJsonResponse(response);
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || deleteErrorMessage);
      }

      setDocuments(extractDocuments(payload, entityId));
      toast.success(deleteSuccessMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : deleteErrorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePreview = async (document: ManagedPdfDocument) => {
    if (!entityId) {
      return;
    }

    try {
      await streamPdfToBrowser({
        url: document.StreamUrl || buildApiUrl(getStreamUrl(entityId, document.id)),
        fileName: document.OriginalFileName || `document-${document.id}.pdf`,
        mode: 'open',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open PDF document.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-muted-foreground text-xs">{helperText}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleOpenPicker}
          disabled={!entityId || isUploading || documents.length >= MAX_FILES}
          className="w-full sm:w-auto"
        >
          {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {uploadButtonLabel}
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
          if (!entityId || isUploading) return;
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!entityId || isUploading) return;
          void uploadFiles(event.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed p-4 text-center transition ${
          isDragging ? 'border-[#008ea2] bg-[#008ea2]/5' : 'border-slate-300 bg-slate-50/70'
        } ${!entityId ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
      >
        <Upload className="mx-auto mb-2 h-5 w-5 text-slate-500" />
        <p className="font-medium text-sm">{dragTitle}</p>
        <p className="mt-1 text-muted-foreground text-xs">{dragHint}</p>
        {!entityId ? <p className="mt-2 text-xs text-amber-600">{disabledMessage}</p> : null}
        {entityId ? <p className="mt-1 text-xs text-muted-foreground">{browseText}</p> : null}
      </div>

      {isLoadingDocuments ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText}
        </div>
      ) : null}

      {documents.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                className="group relative flex min-h-[132px] flex-col gap-2 rounded-xl border p-4 text-left transition hover:shadow-md"
              >
                <button
                  type="button"
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-white text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleDelete(document);
                  }}
                  disabled={isDeleting}
                  aria-label={`Delete ${document.OriginalFileName}`}
                >
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </button>

                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 transition group-hover:bg-red-100">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                      {document.Label || emptyLabel}
                    </div>
                    <div className="break-words text-xs font-medium leading-snug">
                      {document.OriginalFileName || `Document #${document.id}`}
                    </div>
                    {document.FileSize ? (
                      <p className="mt-1 text-xs text-muted-foreground">{formatFileSize(document.FileSize)}</p>
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
