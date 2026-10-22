import React, { useRef, useState } from 'react';
import { Camera, UploadCloud, FileText, Image as ImageIcon, X, Eye, CheckCircle2 } from 'lucide-react';

interface DocumentAttachmentPickerProps {
  label?: string;
  helperText?: string;
  value?: string; // base64 or url
  fileName?: string;
  fileType?: string;
  onChange: (data: { attachmentUrl: string; fileName: string; fileType: string }) => void;
  onClear?: () => void;
  disabled?: boolean;
  required?: boolean;
}

export const DocumentAttachmentPicker: React.FC<DocumentAttachmentPickerProps> = ({
  label = 'Document Bon de Livraison (BL)',
  helperText = 'Prenez une photo directe ou parcourez un fichier PDF, JPG ou PNG',
  value,
  fileName,
  fileType,
  onChange,
  onClear,
  disabled = false,
  required = false,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const processFile = (file: File) => {
    setErrorMsg(null);
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMsg('Format non supporté. Veuillez sélectionner un fichier PDF, JPG ou PNG.');
      return;
    }

    // Limit to 12MB
    if (file.size > 12 * 1024 * 1024) {
      setErrorMsg('Taille maximale autorisée : 12 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        onChange({
          attachmentUrl: result,
          fileName: file.name,
          fileType: file.type,
        });
      }
    };
    reader.onerror = () => {
      setErrorMsg('Erreur lors de la lecture du fichier.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const isPdf = fileType?.includes('pdf') || fileName?.toLowerCase().endsWith('.pdf');
  const isImage = fileType?.includes('image') || (!isPdf && value?.startsWith('data:image'));

  return (
    <div className="w-full space-y-2">
      {/* Hidden file inputs: one dedicated to mobile camera capture, one for file browsing */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        disabled={disabled}
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-300">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        {value && onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Retirer le fichier
          </button>
        )}
      </div>

      {!value ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-4 transition-all duration-200 text-center ${
            isDragging
              ? 'border-red-500 bg-red-500/10'
              : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="p-3 bg-slate-700/50 rounded-full text-slate-300">
              <UploadCloud className="w-6 h-6 text-red-400" />
            </div>

            <div>
              <p className="text-xs font-medium text-slate-200">{helperText}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Formats acceptés : PDF, JPG, PNG (max 12 Mo)</p>
            </div>

            {/* Action buttons: Direct Camera Photo + Browse Files */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1 w-full max-w-sm">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled}
                className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Prendre photo</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-semibold border border-slate-600 shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4 text-slate-300" />
                <span>Parcourir PDF / Image</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Document Preview Card */
        <div className="relative rounded-xl border border-slate-700 bg-slate-800/70 p-3 overflow-hidden shadow-md">
          <div className="flex items-center gap-3">
            {isImage ? (
              <div
                onClick={() => setPreviewModalOpen(true)}
                className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 flex-shrink-0 cursor-pointer group"
                title="Cliquer pour agrandir"
              >
                <img
                  src={value}
                  alt="Aperçu BL"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg bg-red-950/60 border border-red-800/60 flex items-center justify-center flex-shrink-0 text-red-400">
                <FileText className="w-7 h-7" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isPdf ? 'Document PDF prêt' : 'Photo / Image prête'}</span>
              </div>
              <p className="text-xs font-medium text-white truncate mt-0.5" title={fileName || 'Fichier joint'}>
                {fileName || (isPdf ? 'bon-de-livraison.pdf' : 'bl-photo.jpg')}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {isImage && (
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(true)}
                    className="text-[11px] text-red-400 hover:text-red-300 underline font-medium flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" /> Agrandir
                  </button>
                )}
                {isPdf && value && (
                  <a
                    href={value}
                    download={fileName || 'bon-de-livraison.pdf'}
                    className="text-[11px] text-red-400 hover:text-red-300 underline font-medium flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" /> Consulter / Télécharger
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  Remplacer
                </button>
              </div>
            </div>

            {onClear && !disabled && (
              <button
                type="button"
                onClick={onClear}
                className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition"
                title="Supprimer le fichier"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <p className="text-xs text-rose-400 font-medium bg-rose-950/40 border border-rose-900/50 rounded-lg p-2">
          {errorMsg}
        </p>
      )}

      {/* Fullscreen / Zoom Image Preview Modal */}
      {previewModalOpen && isImage && value && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-slate-900 rounded-2xl border border-slate-700 p-2 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ImageIcon className="w-4 h-4 text-red-400" />
                <span className="truncate max-w-xs">{fileName || 'Aperçu Bon de Livraison'}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center max-h-[75vh]">
              <img
                src={value}
                alt="BL Preview Full"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
