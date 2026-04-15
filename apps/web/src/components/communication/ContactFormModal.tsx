"use client";

import { useState } from "react";

import type { Contact, ContactCategory } from "@pm/types";

const CATEGORY_OPTIONS: { value: ContactCategory; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "client",       label: "Client" },
  { value: "vendor",       label: "Vendor" },
  { value: "personal",     label: "Personal" },
  { value: "family",       label: "Family" },
  { value: "other",        label: "Other" },
];

interface Props {
  /** When provided, renders in edit mode pre-filled with contact data. */
  contact?: Contact;
  isPending: boolean;
  onSave: (data: {
    full_name: string;
    category: ContactCategory;
    company: string | null;
    role: string | null;
    phone: string | null;
    email: string | null;
  }) => void;
  onClose: () => void;
}

export function ContactFormModal({ contact, isPending, onSave, onClose }: Props) {
  const isEdit = contact !== undefined;

  const [fullName, setFullName] = useState(contact?.full_name ?? "");
  const [category, setCategory] = useState<ContactCategory>(contact?.category ?? "professional");
  const [company, setCompany] = useState(contact?.company ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    if (!fullName.trim()) { setError("Name is required."); return; }
    onSave({
      full_name: fullName.trim(),
      category,
      company: company.trim() || null,
      role: role.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-handwriting text-xl text-ink">
          {isEdit ? "Edit Contact" : "Add Contact"}
        </h2>

        <div className="space-y-3">
          {/* Full name */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              autoFocus
              className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ContactCategory)}
              className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Company */}
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Role / Title</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Product Manager"
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@acme.com"
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-ink-light mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-ink focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-1 border-t border-blue-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-light hover:bg-blue-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Add contact"}
          </button>
        </div>
      </div>
    </div>
  );
}
