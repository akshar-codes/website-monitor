import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Lightbulb, Mail, RefreshCw, Send } from "lucide-react";
import { Page, Panel, Button } from "../components/ui/Primitives";
import {
  getAdminSuggestions,
  markSuggestionReviewed,
  replyToSuggestion,
} from "../services/api/suggestions";

export default function AdminSuggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminSuggestions();
      setSuggestions(result.data || []);
    } catch {
      // The API client presents the server error in a toast.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuggestions();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSuggestions]);

  const markReviewed = async (id) => {
    setUpdatingId(id);
    try {
      await markSuggestionReviewed(id);
      setSuggestions((current) =>
        current.map((item) =>
          item._id === id ? { ...item, status: "reviewed" } : item,
        ),
      );
    } catch {
      // The API client presents the server error in a toast.
    } finally {
      setUpdatingId(null);
    }
  };

  const sendReply = async (event, item) => {
    event.preventDefault();
    const reply = (replyDrafts[item._id] ?? item.adminReply ?? "").trim();
    if (reply.length < 3) return;
    setUpdatingId(item._id);
    try {
      const result = await replyToSuggestion(item._id, reply);
      setSuggestions((current) =>
        current.map((suggestion) =>
          suggestion._id === item._id
            ? {
                ...suggestion,
                adminReply: reply,
                repliedAt: new Date().toISOString(),
                status: "replied",
              }
            : suggestion,
        ),
      );
      if (result.data?.emailSent)
        toast.success("Reply sent in SiteWatch and by email.");
      else
        toast.warning(
          "Reply is visible in SiteWatch, but the email could not be sent.",
        );
    } catch {
      // The API client presents the server error in a toast.
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Page
      eyebrow="CUSTOMER VOICE"
      title="Suggestions"
      description="Review ideas and feedback submitted by SiteWatch users."
      actions={
        <Button
          variant="secondary"
          onClick={loadSuggestions}
          disabled={loading}
        >
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <Panel
        title="Latest suggestions"
        subtitle={`${suggestions.length} recent submissions`}
      >
        {loading ? (
          <p className="suggestion-admin-empty">Loading suggestions…</p>
        ) : suggestions.length ? (
          <div className="suggestion-admin-list">
            {suggestions.map((item) => (
              <article className="suggestion-admin-item" key={item._id}>
                <div className="suggestion-admin-icon">
                  <Lightbulb size={17} />
                </div>
                <div className="suggestion-admin-content">
                  <div className="suggestion-admin-heading">
                    <h3>{item.title}</h3>
                    <div className="suggestion-admin-actions">
                      <span className={`suggestion-status ${item.status}`}>
                        {item.status}
                      </span>
                      {item.status === "new" && (
                        <button
                          className="suggestion-review-button"
                          onClick={() => markReviewed(item._id)}
                          disabled={updatingId === item._id}
                        >
                          <Check size={13} />{" "}
                          {updatingId === item._id
                            ? "Saving…"
                            : "Mark reviewed"}
                        </button>
                      )}
                    </div>
                  </div>
                  <p>{item.message}</p>
                  <div className="suggestion-admin-meta">
                    <span>
                      {item.user?.name || "Unknown user"} ·{" "}
                      {item.user?.email || ""}
                    </span>
                    <span>
                      {item.category} ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <form
                    className="admin-suggestion-reply"
                    onSubmit={(event) => sendReply(event, item)}
                  >
                    <label htmlFor={`reply-${item._id}`}>
                      {item.adminReply ? "Update team reply" : "Reply to user"}
                    </label>
                    <textarea
                      id={`reply-${item._id}`}
                      rows={3}
                      minLength={3}
                      maxLength={3000}
                      required
                      placeholder="Write a helpful response…"
                      value={replyDrafts[item._id] ?? item.adminReply ?? ""}
                      onChange={(event) =>
                        setReplyDrafts((current) => ({
                          ...current,
                          [item._id]: event.target.value,
                        }))
                      }
                    />
                    <div className="admin-suggestion-reply-footer">
                      <span>
                        <Mail size={13} /> Sends by email and adds a SiteWatch
                        notification
                      </span>
                      <button type="submit" disabled={updatingId === item._id}>
                        <Send size={13} />{" "}
                        {updatingId === item._id
                          ? "Sending…"
                          : item.adminReply
                            ? "Update reply"
                            : "Send reply"}
                      </button>
                    </div>
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="suggestion-admin-empty">
            No suggestions yet. New submissions will appear here.
          </p>
        )}
      </Panel>
    </Page>
  );
}
