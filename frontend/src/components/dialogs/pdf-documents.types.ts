export type ManagedPdfDocument = {
  id: string | number;
  OriginalFileName?: string;
  FilePath?: string;
  FileSize?: number;
  MimeType?: string;
  Label?: string;
  StreamUrl?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type ManagedPdfDocumentsEnvelope = {
  success?: boolean;
  message?: string;
  documents?: ManagedPdfDocument[];
  applicant?: {
    documents?: ManagedPdfDocument[];
  };
  franchise?: {
    documents?: ManagedPdfDocument[];
  };
  data?: {
    documents?: ManagedPdfDocument[];
    applicant?: {
      documents?: ManagedPdfDocument[];
    };
    franchise?: {
      documents?: ManagedPdfDocument[];
    };
  };
};
