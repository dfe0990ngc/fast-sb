import api from '../api/api.js';

export type StreamPdfMode = 'open' | 'download';

type StreamPdfOptions = {
  url: string;
  fileName?: string;
  mode?: 'open' | 'download';
};

export const streamPdfToBrowser = async ({
  url,
  fileName = 'document.pdf',
  mode = 'open',
}: StreamPdfOptions): Promise<void> => {
  const response = await api.get(url, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const objectUrl = window.URL.createObjectURL(blob);

  if (mode === 'open') {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
  } else {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 60000);
};
