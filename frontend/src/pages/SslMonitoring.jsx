import { useSslOverview } from "../hooks/useSsl";
import { formatDate } from "../utils/format";

export default function SslMonitoring() {
  const { data, loading, error, refetch } = useSslOverview();
  const overview = data?.data;

  const isInitialLoad = loading && !data;

  const expiringSoonCertificates = overview?.expiringSoonCertificates || [];
  const expiringSoonDomains = overview?.expiringSoonDomains || [];

  return null;
}
