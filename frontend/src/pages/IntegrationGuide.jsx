import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  HeartPulse,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { Page } from "../components/ui/Primitives";

const snippets = {
  route: `// routes/health.js
import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

async function checkFrontend() {
  const url = process.env.FRONTEND_URL;
  if (!url) return "unknown";

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return response.ok ? "up" : "down";
  } catch {
    return "down";
  }
}

async function checkDatabase() {
  try {
    await mongoose.connection.db.command({ ping: 1 });
    return "up";
  } catch {
    return "down";
  }
}

router.get("/", async (_req, res) => {
  const [frontend, database] = await Promise.all([
    checkFrontend(),
    checkDatabase(),
  ]);
  // This route responding means the backend process is up.
  const services = { frontend, backend: "up", database };
  const allUp = Object.values(services).every((state) => state === "up");

  // Keep HTTP 200 so SiteWatch can read and classify all component states.
  res.status(200).json({
    status: allUp ? "ok" : "degraded",
    services,
    timestamp: new Date().toISOString(),
  });
});

export default router;`,
  mount: `// app.js
import healthRoute from "./routes/health.js";

  app.use("/api/health", healthRoute);`,
  response: `// Everything is up (HTTP 200)
{
  "status": "ok",
  "services": {
    "frontend": "up",
    "backend": "up",
    "database": "up"
  },
  "timestamp": "2026-10-31T10:15:00.000Z"
}

// Database check failed (still HTTP 200; component state carries the result)
{
  "status": "degraded",
  "services": {
    "frontend": "up",
    "backend": "up",
    "database": "down"
  },
  "timestamp": "2026-10-31T10:15:00.000Z"
}`,
};

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="guide-code-wrap">
      <div className="guide-code-topline">
        <span>{label}</span>
        <button type="button" onClick={copy} aria-label={`Copy ${label} code`}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="guide-code">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const steps = [
  {
    number: "01",
    title: "Choose one public health URL",
    description:
      "Expose one route such as /api/health from your backend. SiteWatch reads this single response to classify your frontend, backend, and database together.",
    icon: HeartPulse,
  },
  {
    number: "02",
    title: "Report each component in JSON",
    description:
      "Include status plus services.frontend, services.backend, and services.database. Use up, down, or degraded for each service so SiteWatch can identify which part needs attention.",
    icon: CircleCheck,
  },
  {
    number: "03",
    title: "Check dependencies and deploy",
    description:
      "Probe the frontend URL and database from the backend route. Keep the endpoint quick, public, and free of secrets; then verify its JSON over HTTPS.",
    icon: Rocket,
  },
  {
    number: "04",
    title: "Add it as a monitor",
    description:
      "In SiteWatch, open Monitors and create a monitor with the endpoint URL. Choose a check interval available on your plan, then keep the monitor active.",
    icon: Activity,
  },
];

export default function IntegrationGuide() {
  return (
    <Page
      eyebrow="GET STARTED"
      title="Integration Guide"
      description="Report frontend, backend, and database health together through one API endpoint, then monitor that endpoint in SiteWatch."
      actions={
        <Link className="sw-button primary guide-cta" to="/monitors">
          Open monitors <ArrowRight size={16} />
        </Link>
      }
    >
      <section className="guide-hero">
        <div className="guide-hero-copy">
          <span className="guide-hero-kicker">
            <span /> YOUR QUICK START
          </span>
          <h2>Your whole stack, one health check.</h2>
          <p>
            Give SiteWatch one dependable URL that reports the state of your
            frontend, backend, and database together. The backend gathers those
            checks and returns a single structured response.
          </p>
          <div className="guide-hero-points">
            <span>
              <ShieldCheck size={15} /> One endpoint for all three layers
            </span>
            <span>
              <HeartPulse size={15} /> Component level status
            </span>
          </div>
        </div>
        <div className="guide-pulse-art" aria-hidden="true">
          <div className="guide-pulse-orbit orbit-one" />
          <div className="guide-pulse-orbit orbit-two" />
          <div className="guide-pulse-core">
            <Activity size={33} />
          </div>
          <span className="pulse-dot dot-one" />
          <span className="pulse-dot dot-two" />
          <span className="pulse-dot dot-three" />
          <div className="guide-live-pill">
            <i /> Endpoint ready
          </div>
        </div>
      </section>

      <div className="guide-section-heading">
        <div>
          <span>THE FLOW</span>
          <h2>From route to alert in four steps</h2>
        </div>
        <p>Usually just a few minutes for an existing web app.</p>
      </div>

      <section className="guide-steps" aria-label="Integration steps">
        {steps.map(({ number, title, description, icon: Icon }, index) => (
          <article className="guide-step" key={number}>
            <div className="guide-step-top">
              <span>{number}</span>
              <Icon size={18} />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            {index < steps.length - 1 && (
              <ArrowDown className="guide-step-arrow" size={16} />
            )}
          </article>
        ))}
      </section>

      <div className="guide-section-heading guide-code-heading">
        <div>
          <span>EXPRESS + MONGOOSE EXAMPLE</span>
          <h2>Check the full stack in one route</h2>
        </div>
        <p>Set FRONTEND_URL to your deployed frontend’s public URL.</p>
      </div>
      <section className="guide-code-grid">
        <CodeBlock label="routes/health.js" code={snippets.route} />
        <CodeBlock label="app.js — mount the route" code={snippets.mount} />
      </section>
      <section className="guide-response-card">
        <div className="guide-response-intro">
          <span className="guide-response-icon">
            <Activity size={18} />
          </span>
          <div>
            <h3>One response, three component states</h3>
            <p>
              SiteWatch reads these fields and derives the overall service
              health. Keep details safe for public access.
            </p>
          </div>
        </div>
        <CodeBlock label="JSON response examples" code={snippets.response} />
      </section>

      <section className="guide-checklist">
        <div className="guide-checklist-title">
          <CircleCheck size={19} />
          <div>
            <h2>Before you add the monitor</h2>
            <p>Run through this short launch check.</p>
          </div>
        </div>
        <div className="guide-checklist-items">
          <span>
            <Check size={15} /> Endpoint is public over HTTPS
          </span>
          <span>
            <Check size={15} /> JSON contains all three services fields
          </span>
          <span>
            <Check size={15} /> Endpoint returns HTTP 200 with component states
          </span>
          <span>
            <Check size={15} /> Response contains no secrets or personal data
          </span>
        </div>
        <Link to="/monitors" className="guide-inline-link">
          Create your first monitor <ExternalLink size={14} />
        </Link>
      </section>
      <p className="guide-footnote">
        The backend route confirms its own availability, probes the frontend
        URL, and pings the database. A frontend URL probe checks that it
        responds; it does not execute browser JavaScript. SiteWatch derives the
        overall status from the three component states.
      </p>
    </Page>
  );
}
