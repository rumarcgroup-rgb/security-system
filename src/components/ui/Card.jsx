export default function Card({ className = "", children }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-card ${className}`}>{children}</div>;
}
