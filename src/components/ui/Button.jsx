import { Loader2 } from "lucide-react";

const variants = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  danger: "bg-rose-500 text-white hover:bg-rose-600",
};

export default function Button({
  children,
  className = "",
  loading = false,
  variant = "primary",
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
