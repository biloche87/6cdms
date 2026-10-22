import React, { useRef } from 'react';
import { Camera, Upload, Trash2, Check, User as UserIcon } from 'lucide-react';

export const AFRICAN_AVATAR_PRESETS = [
  {
    id: 'amadou',
    name: 'Amadou (Direction)',
    url: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=300&auto=format&fit=crop&q=80',
    gender: 'M',
  },
  {
    id: 'fatoumata',
    name: 'Fatoumata (Cadre)',
    url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300&auto=format&fit=crop&q=80',
    gender: 'F',
  },
  {
    id: 'oumar',
    name: 'Oumar (Superviseur)',
    url: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=300&auto=format&fit=crop&q=80',
    gender: 'M',
  },
  {
    id: 'ibrahim',
    name: 'Ibrahim (Terrain)',
    url: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=300&auto=format&fit=crop&q=80',
    gender: 'M',
  },
  {
    id: 'aminata',
    name: 'Aminata (Terrain)',
    url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&auto=format&fit=crop&q=80',
    gender: 'F',
  },
  {
    id: 'moussa',
    name: 'Moussa (Terrain)',
    url: 'https://images.unsplash.com/photo-1507152832244-10d45c7eda57?w=300&auto=format&fit=crop&q=80',
    gender: 'M',
  },
];

interface AvatarPickerProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  initials?: string;
  isOptional?: boolean;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  value,
  onChange,
  label = 'Photo de profil',
  initials = '6C',
  isOptional = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: max 3MB
    if (file.size > 3 * 1024 * 1024) {
      alert('La photo ne doit pas dépasser 3 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        onChange(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-slate-300 font-semibold text-xs flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-red-500" />
          <span>{label}</span>
          {isOptional && (
            <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Facultatif
            </span>
          )}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition"
          >
            <Trash2 className="w-3 h-3" />
            <span>Retirer la photo</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        {/* Current Preview */}
        <div className="relative shrink-0">
          {value ? (
            <img
              src={value}
              alt="Photo de profil"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-red-500/60 shadow-md"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">
              <UserIcon className="w-6 h-6 text-slate-500 mb-0.5" />
              <span className="text-[10px] font-mono">{initials}</span>
            </div>
          )}
          {value && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shadow-xs">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex-1 space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-red-400" />
              <span>Importer un fichier / Prendre photo</span>
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs border border-slate-800 transition"
              >
                Sans photo (Initiales)
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            JPG, PNG ou capture caméra (max 3 Mo). Si non renseignée, les initiales seront utilisées.
          </p>
        </div>
      </div>

      {/* Suggested African Portraits */}
      <div>
        <p className="text-[11px] text-slate-400 font-medium mb-1.5 flex items-center justify-between">
          <span>Ou choisir parmi nos suggestions de profils africains :</span>
        </p>
        <div className="grid grid-cols-6 gap-2">
          {AFRICAN_AVATAR_PRESETS.map((preset) => {
            const isSelected = value === preset.url;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.url)}
                className={`relative group rounded-xl overflow-hidden aspect-square border-2 transition ${
                  isSelected
                    ? 'border-red-500 ring-2 ring-red-500/30'
                    : 'border-slate-800 hover:border-slate-600'
                }`}
                title={preset.name}
              >
                <img
                  src={preset.url}
                  alt={preset.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-red-600/30 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
