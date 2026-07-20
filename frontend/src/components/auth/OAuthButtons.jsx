import { useState } from "react";
import { Github } from "lucide-react";
import Button from "../ui/Button";
import { OAUTH_PROVIDERS } from "../../constants/oauthProviders";

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.96 11.96 0 000 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

const PROVIDERS = [
  { id: OAUTH_PROVIDERS.GOOGLE, label: "Google", Icon: GoogleIcon },
  { id: OAUTH_PROVIDERS.GITHUB, label: "GitHub", Icon: Github },
];

/**
 * OAuth is a full-page redirect flow (the backend owns the entire
 * handshake with the provider), so there's no async request to await here
 * — clicking just navigates the browser to /api/auth/<provider>. The
 * `loadingProvider` state exists purely so the clicked button shows a
 * spinner in the brief moment before the browser actually navigates away,
 * rather than looking unresponsive.
 */
export default function OAuthButtons({ disabled = false }) {
  const [loadingProvider, setLoadingProvider] = useState(null);

  const handleContinue = (providerId) => {
    setLoadingProvider(providerId);
    window.location.href = `/api/auth/${providerId}`;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={disabled || loadingProvider !== null}
          loading={loadingProvider === id}
          onClick={() => handleContinue(id)}
        >
          {loadingProvider !== id && <Icon size={15} />}
          {label}
        </Button>
      ))}
    </div>
  );
}
