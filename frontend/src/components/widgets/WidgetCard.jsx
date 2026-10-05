import React from 'react';

// =========================================================
// WIDGET SHELL — nền tảng của Dashboard theo tư duy widget-based.
// Mỗi widget là một khối độc lập: header (icon + tiêu đề + toolbar) → body → footer.
// Widget tự quản lý nội dung của mình, không phụ thuộc widget khác.
// =========================================================
export default function WidgetCard({
  title,
  subtitle,
  icon: Icon,
  accent = '#6366f1',
  span = 12,
  toolbar,
  footer,
  dense = false,
  className = '',
  children,
}) {
  return (
    <section className={`widget widget-span-${span} ${className}`.trim()}>
      <header className="widget-head">
        <div className="widget-title-group">
          {Icon && (
            <span
              className="widget-icon"
              style={{ color: accent, background: `${accent}1f`, borderColor: `${accent}3d` }}
            >
              <Icon size={16} />
            </span>
          )}
          <div className="widget-title-text">
            <h3 className="widget-title">{title}</h3>
            {subtitle && <p className="widget-subtitle">{subtitle}</p>}
          </div>
        </div>
        {toolbar && <div className="widget-toolbar">{toolbar}</div>}
      </header>

      <div className={`widget-body ${dense ? 'dense' : ''}`}>{children}</div>

      {footer && <footer className="widget-foot">{footer}</footer>}
    </section>
  );
}

// Trạng thái rỗng dùng chung cho mọi widget
export function EmptyState({ icon: Icon, text, hint }) {
  return (
    <div className="widget-empty">
      {Icon && <Icon size={22} />}
      <p>{text}</p>
      {hint && <span>{hint}</span>}
    </div>
  );
}

// Chip trạng thái chuẩn hoá màu theo đúng quy ước IoT platform:
// green = online/normal · red = critical/error · amber = warning · gray = offline/unknown
export function StatusChip({ tone = 'neutral', children, title }) {
  return (
    <span className={`status-chip tone-${tone}`} title={title}>
      {children}
    </span>
  );
}
