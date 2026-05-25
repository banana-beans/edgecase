import { Card } from "@/components/common/Card";

export default function ProfilePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Profile</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Local-only. No accounts, no sync. Your reps stay on this device.
        </p>
      </header>

      <Card>
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Coming soon
        </p>
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li>· streak + daily drill counter</li>
          <li>· track-by-track progress bars</li>
          <li>· bookmarked / mastered problem list</li>
          <li>· settings (theme, font size, drill length)</li>
        </ul>
      </Card>
    </div>
  );
}
