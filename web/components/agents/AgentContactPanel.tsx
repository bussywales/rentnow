"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

type Props = {
  slug: string;
  agentName: string;
};

export default function AgentContactPanel({ slug, agentName }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; message?: string }>({});

  const validate = () => {
    const nextErrors: { name?: string; email?: string; message?: string } = {};
    if (name.trim().length < 2) {
      nextErrors.name = "Enter your full name.";
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (message.trim().length < 10) {
      nextErrors.message = "Please add a few more details (10+ characters).";
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/agents/${slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          message: message.trim(),
          company,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Unable to send message.");
        return;
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setCompany("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="contact-agent"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="agent-storefront-contact"
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
          Contact agent
        </p>
        <h2 className="text-xl font-semibold text-slate-900">Message {agentName}</h2>
        <p className="text-sm text-slate-600">
          Share what you’re looking for and the agent will respond by email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="agent-contact-name" className="text-[11px] font-semibold text-slate-500">
              Full name
            </label>
            <Input
              id="agent-contact-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              placeholder="Your name"
              autoComplete="name"
              data-testid="agent-contact-name"
            />
            {fieldErrors.name && <p className="text-xs text-rose-600">{fieldErrors.name}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="agent-contact-email" className="text-[11px] font-semibold text-slate-500">
              Email
            </label>
            <Input
              id="agent-contact-email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="you@email.com"
              type="email"
              autoComplete="email"
              data-testid="agent-contact-email"
            />
            {fieldErrors.email && <p className="text-xs text-rose-600">{fieldErrors.email}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="agent-contact-phone" className="text-[11px] font-semibold text-slate-500">
            Phone (optional)
          </label>
          <Input
            id="agent-contact-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+234 ..."
            autoComplete="tel"
            data-testid="agent-contact-phone"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="agent-contact-message" className="text-[11px] font-semibold text-slate-500">
            Message
          </label>
          <Textarea
            id="agent-contact-message"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (fieldErrors.message) {
                setFieldErrors((prev) => ({ ...prev, message: undefined }));
              }
            }}
            placeholder="Tell the agent what you need..."
            rows={4}
            data-testid="agent-contact-message"
          />
          {fieldErrors.message && (
            <p className="text-xs text-rose-600">{fieldErrors.message}</p>
          )}
        </div>

        <div className="hidden" aria-hidden="true">
          <label htmlFor="agent-contact-company">Company</label>
          <input
            id="agent-contact-company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {success && (
          <p className="text-sm text-emerald-600">Message sent. The agent will reply soon.</p>
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Sending..." : "Send message"}
        </Button>
      </form>
    </section>
  );
}
