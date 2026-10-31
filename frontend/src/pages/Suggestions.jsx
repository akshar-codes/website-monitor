import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Lightbulb, Send, Sparkles } from "lucide-react";
import { Page, Panel, Button } from "../components/ui/Primitives";
import {
  getMySuggestions,
  submitSuggestion,
} from "../services/api/suggestions";

const initialForm = { category: "feature", title: "", message: "" };

export default function Suggestions() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const loadSuggestions = useCallback(async () => {
    try {
      const result = await getMySuggestions();
      setSuggestions(result.data || []);
    } catch {
      // The API client presents the server error in a toast.
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuggestions();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSuggestions]);

  const update = (event) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await submitSuggestion(form);
      setForm(initialForm);
      toast.success("Thanks for helping make SiteWatch better!");
      await loadSuggestions();
    } catch {
      // The API client presents the server error in a toast.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page
      eyebrow="YOUR IDEAS MATTER"
      title="Share a suggestion"
      description="Tell us what would make monitoring your services better. Suggestions go straight to the SiteWatch team."
    >
      <div className="suggestion-layout">
        <Panel
          className="suggestion-form-panel"
          title="What’s on your mind?"
          subtitle="A little context helps us understand your idea."
        >
          <form className="suggestion-form" onSubmit={handleSubmit}>
            <label className="sw-field">
              <span>Suggestion type</span>
              <select name="category" value={form.category} onChange={update}>
                <option value="feature">New feature</option>
                <option value="improvement">Improvement</option>
                <option value="bug">Report a problem</option>
                <option value="other">Something else</option>
              </select>
            </label>
            <label className="sw-field">
              <span>Short title</span>
              <input
                name="title"
                value={form.title}
                onChange={update}
                maxLength={120}
                minLength={3}
                required
                placeholder="A quick summary of your idea"
              />
            </label>
            <label className="sw-field">
              <span>Details</span>
              <textarea
                name="message"
                value={form.message}
                onChange={update}
                maxLength={3000}
                minLength={10}
                required
                rows={7}
                placeholder="What would you like to see? How would it help your workflow?"
              />
              <small className="suggestion-character-count">
                {form.message.length}/3000
              </small>
            </label>
            <div className="suggestion-form-footer">
              <span>
                Your account details are included so we can follow up if needed.
              </span>
              <Button type="submit" disabled={submitting}>
                <Send size={15} /> {submitting ? "Sending…" : "Send suggestion"}
              </Button>
            </div>
          </form>
        </Panel>
        <aside className="suggestion-aside">
          <div className="suggestion-aside-icon">
            <Lightbulb size={21} />
          </div>
          <span className="suggestion-aside-kicker">
            <Sparkles size={13} /> PRODUCT FEEDBACK
          </span>
          <h2>Help shape what we build next.</h2>
          <p>
            Clear, specific feedback helps us prioritize improvements that make
            SiteWatch more useful for everyone.
          </p>
          <div className="suggestion-aside-note">
            <b>What makes a great suggestion?</b>
            <span>
              Share the problem you’re solving, what you expected, and any
              details that could help us understand it.
            </span>
          </div>
        </aside>
      </div>
      {suggestions.length > 0 && (
        <Panel
          className="my-suggestions-panel"
          title="Your suggestions"
          subtitle="Replies from our team will appear here and arrive by email."
        >
          <div className="my-suggestions-list">
            {suggestions.map((item) => (
              <article className="my-suggestion" key={item._id}>
                <div className="my-suggestion-heading">
                  <div>
                    <span className="suggestion-category-tag">
                      {item.category}
                    </span>
                    <h3>{item.title}</h3>
                  </div>
                  <time>{new Date(item.createdAt).toLocaleDateString()}</time>
                </div>
                <p className="my-suggestion-message">{item.message}</p>
                {item.adminReply && (
                  <div className="suggestion-reply-card">
                    <div>
                      <CheckCircle2 size={16} />
                      <b>SiteWatch team replied</b>
                      <time>
                        {item.repliedAt
                          ? new Date(item.repliedAt).toLocaleDateString()
                          : ""}
                      </time>
                    </div>
                    <p>{item.adminReply}</p>
                  </div>
                )}
                {!item.adminReply && (
                  <span className="suggestion-awaiting-reply">
                    We’ll let you know when our team replies.
                  </span>
                )}
              </article>
            ))}
          </div>
        </Panel>
      )}
    </Page>
  );
}
