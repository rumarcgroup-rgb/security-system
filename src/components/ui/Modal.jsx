import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  showCloseButton = true,
  variant = "center",
  panelClassName = "",
}) {
  const isBottomSheet = variant === "bottomSheet";
  const overlayClassName = isBottomSheet
    ? "fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:p-4"
    : "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4";
  const panelBaseClassName = isBottomSheet
    ? "max-h-[88vh] w-full max-w-md overflow-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-2xl"
    : "max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl";
  const panelInitial = isBottomSheet ? { y: 32, opacity: 0 } : { scale: 0.96, opacity: 0 };
  const panelAnimate = isBottomSheet ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 };
  const panelExit = isBottomSheet ? { y: 32, opacity: 0 } : { scale: 0.96, opacity: 0 };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={overlayClassName}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`${panelBaseClassName} ${panelClassName}`}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            onClick={(e) => e.stopPropagation()}
          >
            {title || showCloseButton ? (
              <div className="mb-4 flex items-center justify-between gap-3">
                {title ? <h3 className="text-lg font-semibold text-slate-800">{title}</h3> : <div />}
                {showCloseButton ? (
                  <button type="button" aria-label="Close modal" className="app-icon-close" onClick={onClose}>
                    <X size={18} />
                  </button>
                ) : null}
              </div>
            ) : null}
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
