import { useEffect, useState } from "react";
import { getOAuthProviders } from "../../services/api/auth";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="oauth-provider-icon">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11c-.5 2.4-1.9 4.4-4 5.8v4.8h6.5c3.8-3.5 6.1-8.6 6.1-14.2Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-5l-6.5-5c-1.8 1.2-4.1 2-7 2-5.3 0-9.8-3.6-11.4-8.4H5.9v5.2A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.9a20 20 0 0 0 0 17.6l6.7-5.2Z"
      />
      <path
        fill="#EA4335"
        d="M24 12.1c3 0 5.6 1 7.7 3.1l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.9 15.2l6.7 5.2C14.2 15.7 18.7 12.1 24 12.1Z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="oauth-provider-icon oauth-github-icon"
    >
      <path
        fill="currentColor"
        d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.2.8-.6v-2.1c-3.4.7-4.1-1.4-4.1-1.4-.5-1.3-1.2-1.6-1.2-1.6-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.6-1.4-5.6-6.2 0-1.4.5-2.5 1.2-3.4-.1-.3-.5-1.6.1-3.3 0 0 1-.3 3.5 1.3a12 12 0 0 1 6.4 0c2.4-1.6 3.5-1.3 3.5-1.3.7 1.7.3 3 .1 3.3.8.9 1.2 2 1.2 3.4 0 4.8-2.9 5.9-5.6 6.2.4.4.8 1.1.8 2.2v3.1c0 .4.2.7.8.6A11.1 11.1 0 0 0 12 .9Z"
      />
    </svg>
  );
}

/**
 * Show only OAuth providers enabled by the current backend deployment.
 * Navigation goes directly to the Passport route so the session and OAuth
 * state remain first-party browser navigations.
 */
export default function OAuthButtons() {
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    let active = true;
    getOAuthProviders()
      .then((enabled) => {
        if (active) setProviders(enabled);
      })
      .catch(() => {
        if (active) setProviders({});
      });
    return () => {
      active = false;
    };
  }, []);

  const providerList = [
    { id: "google", label: "Google", icon: <GoogleMark /> },
    { id: "github", label: "GitHub", icon: <GitHubMark /> },
  ];
  const anyEnabled = providerList.some(({ id }) => providers?.[id] === true);

  return (
    <div className="oauth-buttons">
      <div className="oauth-divider">
        <span>or continue with</span>
      </div>
      <div className="oauth-provider-list">
        {providerList.map(({ id, label, icon }) =>
          providers?.[id] === true ? (
            <a
              key={id}
              className="oauth-provider-button"
              href={`/api/auth/${id}`}
            >
              {icon}
              {label}
            </a>
          ) : (
            <button
              key={id}
              type="button"
              className="oauth-provider-button"
              disabled
              title="OAuth credentials are not configured on this server"
            >
              {icon}
              {label}
            </button>
          ),
        )}
      </div>
      {providers === null ? (
        <p role="status" className="text-center text-xs text-slate-500">
          Checking social sign-in availability…
        </p>
      ) : (
        !anyEnabled && (
          <p role="status" className="text-center text-xs text-slate-500">
            Social sign-in needs to be configured by the site administrator.
          </p>
        )
      )}
    </div>
  );
}
