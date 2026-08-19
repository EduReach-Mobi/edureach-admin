import { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Loading dashboard' }: { label?: string }) {
  return (
    <div className="state-panel">
      <Loader2 className="spin" size={28} />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-panel error-panel">
      <AlertCircle size={30} />
      <h3>Could not load this section</h3>
      <p>{message}</p>
      {onRetry && <button className="btn secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function MetricCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <section className={`metric ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{new Intl.NumberFormat().format(value ?? 0)}</strong>
    </section>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function formatDate(value?: string) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function formatBytes(value?: number) {
  if (!value) return 'Unknown';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
