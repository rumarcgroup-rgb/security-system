import Card from "../../components/ui/Card";

export default function AdminPlaceholderPage({ title }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">This section is ready for your next custom implementation.</p>
    </Card>
  );
}
