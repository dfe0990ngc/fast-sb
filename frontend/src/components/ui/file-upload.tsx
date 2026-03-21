import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileImage, Loader2, AlertCircle, File, Video, Music, Archive, FileText } from 'lucide-react';
import { Button } from './button';
import { Label } from './label';
import { Alert, AlertDescription } from './alert';
import { postFormData, del } from '../../api/api';
import { useAbortableRequest } from '../../hooks/useAbortableRequest';

interface FileUploadProps {
  onUploadSuccess?: (publicLink: string, fileId: string) => void;
  onDeleteSuccess?: () => void;
  currentFileId?: string;
  currentFileUrl?: string;
  currentFileName?: string;
  accept?: string;
  maxSize?: number; // in bytes
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
  folderPath?: string;
  contextId?: number | null;
  uploadContext?: string | null;
}

interface UploadResponse {
  public_link: string;
  id: string;
  filename: string;
  size: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUploadSuccess,
  onDeleteSuccess,
  currentFileId,
  currentFileUrl,
  currentFileName,
  accept = "*",
  maxSize = 5 * 1024 * 1024, // 5MB default
  label = "Upload File",
  description = "Drag and drop your file here, or click to browse",
  className = "",
  disabled = false,
  folderPath = 'general',
  contextId = null,
  uploadContext = null,
}) => {
  const { createRequest } = useAbortableRequest();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return FileImage;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'mkv':
      case 'webm':
        return Video;
      case 'mp3':
      case 'wav':
      case 'aac':
      case 'ogg':
        return Music;
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
        return FileText;
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
        return Archive;
      default:
        return File;
    }
  };

  const isImageFile = (fileName: string): boolean => {
    const extension = fileName.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '');
  };

  const isVideoFile = (fileName: string): boolean => {
    const extension = fileName.toLowerCase().split('.').pop();
    return ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(extension || '');
  };

  const isAudioFile = (fileName: string): boolean => {
    const extension = fileName.toLowerCase().split('.').pop();
    return ['mp3', 'wav', 'aac', 'ogg'].includes(extension || '');
  };

  const isPdfFile = (fileName: string): boolean => {
    const extension = fileName.toLowerCase().split('.').pop();
    return extension === 'pdf';
  };

  const renderFilePreview = () => {
    if (!currentFileUrl || !currentFileName) return null;

    if (isImageFile(currentFileName)) {
      return (
        <img 
          src={currentFileUrl} 
          alt={currentFileName}
          className="mx-auto rounded-full w-full max-w-60 h-full max-h-60 object-center object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      );
    }

    if (isVideoFile(currentFileName)) {
      return (
        <video 
          src={currentFileUrl}
          controls
          className="rounded w-full h-32 object-cover"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    if (isAudioFile(currentFileName)) {
      return (
        <audio 
          src={currentFileUrl}
          controls
          className="w-full"
          preload="metadata"
        >
          Your browser does not support the audio tag.
        </audio>
      );
    }

    if (isPdfFile(currentFileName)) {
      return (
        <iframe
          src={currentFileUrl}
          className="border rounded w-full h-32"
          title={currentFileName}
        >
          <p>Your browser does not support PDFs. <a href={currentFileUrl} target="_blank" rel="noopener noreferrer">Download the PDF</a></p>
        </iframe>
      );
    }

    // For non-renderable files, show file icon
    const IconComponent = getFileIcon(currentFileName);
    return (
      <div className="flex justify-center items-center w-full h-16">
        <IconComponent className="w-8 h-8 text-gray-400" />
      </div>
    );
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)} limit`;
    }
    
    if (accept !== "*" && !file.type.match(new RegExp(accept.replace(/\*/g, '.*')))) {
      return `File type not supported. Expected: ${accept}`;
    }
    
    return null;
  };

  const uploadFile = async (file: File, uploadContext: string | null, contextId: number | null, folderPath: string = 'general') => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_context',(uploadContext || '').toString());
      formData.append('context_id',(contextId ?? 0).toString());
      formData.append('folder_path',folderPath);

      const request = createRequest((signal) => 
        postFormData(
          '/api/files/upload',
          formData,
          {},
          {
            signal,
            onUploadProgress: (progressEvent) => {
              if (progressEvent.lengthComputable) {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(progress);
              }
            }
          }
        )
      );

      const { data } = await request.promise;
      
      if (data.success && data.data) {
        if (onUploadSuccess) {
          onUploadSuccess(data.data.public_url, data.data.id, data.data.file_name);
        }
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteFile = async () => {
    if (!currentFileId) return;
    
    if(window.confirm('Do you want to continue deleting the file?')){
      setError(null);
      setIsDeleting(true);

      try {
        const request = createRequest((signal) => del(`/api/files/${currentFileId}`, {}, { signal }));
        await request.promise;
        
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Delete failed';
        setError(errorMessage);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }
    
    uploadFile(file, uploadContext, contextId, folderPath);
  }, [maxSize, accept]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const isLoading = isUploading || isDeleting;

  return (
    <div className={`space-y-3 ${className}`}>
      {label && <Label className="font-medium text-sm">{label}</Label>}
      
      {/* Current File Display */}
      {(currentFileUrl || currentFileName) && !isUploading && (
        <div className="relative">
          <div className="space-y-3 bg-gray-50 p-4 border rounded-lg">            
            {/* File Preview/Render */}
            {currentFileUrl && !isDeleting && (
              <div className="bg-white p-3 border rounded overflow-hidden">
                {renderFilePreview()}
                {/* Fallback icon for failed renders */}
                {/* {currentFileName && (
                  <div className="flex justify-center items-center p-4">
                    {(() => {
                      const IconComponent = getFileIcon(currentFileName);
                      return <IconComponent className="w-8 h-8 text-gray-400" />;
                    })()}
                  </div>
                )} */}
              </div>
            )}
            
            {/* File Info and Actions */}
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center gap-2 min-w-0">
                {currentFileName && !currentFileUrl && (() => {
                  const IconComponent = getFileIcon(currentFileName);
                  return <IconComponent className="flex-shrink-0 w-5 h-5 text-gray-500" />;
                })()}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {currentFileName || 'Uploaded File'}
                  </p>
                  <p className="text-gray-500 text-xs">Click delete to remove</p>
                </div>
              </div>
              
              {/* Delete Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deleteFile}
                disabled={isDeleting || disabled}
                className="flex-shrink-0 hover:border-red-300 text-red-600 hover:text-red-700"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                <span className="sr-only">Delete file</span>
              </Button>
            </div>
            
            {/* Download Link for non-renderable files */}
            {currentFileUrl && currentFileName && !isImageFile(currentFileName) && !isVideoFile(currentFileName) && !isAudioFile(currentFileName) && !isPdfFile(currentFileName) && (
              <div className="pt-2 border-t">
                <a 
                  href={currentFileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm underline"
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Area */}
      {!currentFileUrl && !currentFileName && (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer
            ${isDragging 
              ? 'border-[#008ea2] bg-[#008ea2]/5' 
              : 'border-gray-300 hover:border-gray-400'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${isLoading ? 'pointer-events-none' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!isLoading && !disabled ? triggerFileSelect : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          
          <div className="flex flex-col justify-center items-center text-center">
            {isUploading ? (
              <>
                <Loader2 className="mb-2 w-8 h-8 text-[#008ea2] animate-spin" />
                <p className="mb-1 font-medium text-gray-900 text-sm">Uploading...</p>
                <div className="bg-gray-200 mb-2 rounded-full w-full max-w-xs h-2">
                  <div 
                    className="bg-[#008ea2] rounded-full h-2 transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-gray-500 text-xs">{uploadProgress}% complete</p>
              </>
            ) : (
              <>
                <Upload className={`w-8 h-8 mb-2 ${isDragging ? 'text-[#008ea2]' : 'text-gray-400'}`} />
                <p className="mb-1 font-medium text-gray-900 text-sm">
                  {isDragging ? 'Drop your file here' : description}
                </p>
                <p className="text-gray-500 text-xs">
                  Maximum file size: {formatFileSize(maxSize)}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Upload Button (when file exists) */}
      {/* {(currentFileUrl || currentFileName) && !isLoading && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={triggerFileSelect}
          disabled={disabled}
        >
          <Upload className="mr-2 w-4 h-4" />
          Change File
        </Button>
      )} */}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default FileUpload;
