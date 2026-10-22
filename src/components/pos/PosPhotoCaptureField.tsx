import React from 'react';
import { CameraCapture } from '../common/CameraCapture.tsx';

export interface PosPhotoCaptureFieldProps {
  value: string | null;
  onChange: (photoDataUrl: string | null) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Composant de capture photo spécialisé pour les points de vente (PDV)
 * Repose sur le composant réutilisable et sécurisé CameraCapture
 */
export const PosPhotoCaptureField: React.FC<PosPhotoCaptureFieldProps> = ({
  value,
  onChange,
  label = 'Photo du point de vente',
  disabled = false,
}) => {
  return (
    <CameraCapture
      value={value}
      onChange={onChange}
      label={label}
      disabled={disabled}
      framingHint="Cadrez la devanture du point de vente"
      helperText="Photographiez la façade ou l'enseigne de la boutique depuis votre smartphone ou tablette."
      defaultFacingMode="environment"
      showGalleryOption={true}
      aspectRatio="4/3"
    />
  );
};
