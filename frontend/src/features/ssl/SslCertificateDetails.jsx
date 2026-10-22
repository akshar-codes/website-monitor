import {
  ShieldCheck,
  Fingerprint,
  Calendar,
  Layers,
  KeyRound,
  Globe,
} from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import { formatDateTime } from "../../utils/format";

function DetailRow({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
        <Icon size={14} className="text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-text-muted">{label}</p>
        <p
          className={`mt-0.5 truncate text-sm font-medium text-white ${mono ? "font-mono text-xs" : ""}`}
          title={typeof value === "string" ? value : undefined}
        >
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

export default function SslCertificateDetails({ certificate, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="space-y-4">
          <Skeleton className="h-3 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!certificate || !certificate.validTo) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle px-6 py-4">
          <p className="text-sm font-semibold text-white">
            Certificate Details
          </p>
        </div>
        <EmptyState
          icon={ShieldCheck}
          title="No certificate data yet"
          description="Certificate details will appear after the next SSL check."
          className="py-12"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Certificate Details</p>
        {certificate.selfSigned && (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            Self-signed
          </span>
        )}
      </div>

      <div className="space-y-4">
        <DetailRow icon={Globe} label="Issued to" value={certificate.subject} />
        <DetailRow
          icon={ShieldCheck}
          label="Issued by"
          value={certificate.issuer}
        />
        <DetailRow
          icon={Calendar}
          label="Valid from"
          value={formatDateTime(certificate.validFrom)}
        />
        <DetailRow
          icon={Calendar}
          label="Valid to"
          value={formatDateTime(certificate.validTo)}
        />
        <DetailRow
          icon={Layers}
          label="Protocol"
          value={certificate.protocol}
        />
        <DetailRow
          icon={KeyRound}
          label="Signature algorithm"
          value={certificate.signatureAlgorithm}
        />
        <DetailRow
          icon={Fingerprint}
          label="SHA-256 fingerprint"
          value={certificate.fingerprint256}
          mono
        />

        {certificate.subjectAlternativeNames?.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] text-text-muted">
              Subject alternative names (
              {certificate.subjectAlternativeNames.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {certificate.subjectAlternativeNames.map((san) => (
                <span
                  key={san}
                  className="rounded-full border border-border-default bg-bg-elevated px-2 py-0.5 text-[11px] text-text-secondary"
                >
                  {san}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
