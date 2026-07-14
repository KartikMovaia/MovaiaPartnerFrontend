// "Report sent" indicator for scan tables (partner surface).
import { useTranslation } from 'react-i18next';

export default function ReportFlag({ value }: { value: 'sent' | 'pending' | 'none' }) {
  const { t } = useTranslation('common');
  if (value === 'sent')
    return <span className="font-semibold text-[13px]" style={{ color: '#5a7d16' }}>✓ {t('report.sent')}</span>;
  if (value === 'pending') return <span className="text-[13px]" style={{ color: '#9a9a9a' }}>{t('report.pending')}</span>;
  return <span className="text-[13px]" style={{ color: '#9a9a9a' }}>—</span>;
}
