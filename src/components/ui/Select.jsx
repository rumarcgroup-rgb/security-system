export default function Select({ label, children, className = "", ...props }) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span> : null}
      <select
        className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
