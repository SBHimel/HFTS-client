"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt, isOpen, onClose }: ImageLightboxProps) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  // Lock / unlock body scroll and register key listener
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        /* Backdrop – click anywhere outside the image to close */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8"
          aria-modal="true"
          role="dialog"
          aria-label={`Full-screen view: ${alt}`}
        >
          {/* Close button – top-right */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close image viewer"
            className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md transition-colors cursor-pointer active:scale-90 touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Image – click intercepted so it doesn't close the lightbox */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full max-h-full flex items-center justify-center"
          >
            <img
              src={src}
              alt={alt}
              className="max-w-[90vw] max-h-[88vh] w-auto h-auto object-contain rounded-xl shadow-2xl"
              draggable={false}
            />
          </motion.div>

          {/* Hint label at bottom */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/40 select-none pointer-events-none whitespace-nowrap">
            Press <kbd className="font-mono">Esc</kbd> or click outside to close
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Convenience wrapper: a container that shows a zoom cursor and opens the
 * lightbox when clicked. Drop this around any <img> that should be lightbox-able.
 */
export function LightboxTrigger({
  src,
  alt,
  children,
  className = "",
}: {
  src: string;
  alt: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`View full image: ${alt}`}
      className={`cursor-zoom-in relative group/lb ${className}`}
      onClick={(e) => e.stopPropagation()} // parent onClick handled via state lift
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
      }}
    >
      {children}
      {/* Zoom hint overlay */}
      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/lb:opacity-100 transition-opacity pointer-events-none">
        <span className="p-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/20">
          <ZoomIn className="w-4 h-4 text-white" />
        </span>
      </span>
    </span>
  );
}
