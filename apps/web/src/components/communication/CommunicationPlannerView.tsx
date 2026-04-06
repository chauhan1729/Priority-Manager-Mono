"use client";

import { useState, useTransition } from "react";

import {
  filterContactsByCategory,
  filterContactsBySearch,
  getContactDeletionInfo,
  sortContacts,
  type ContactSortKey,
} from "@pm/domain";
import type { Activity, Contact, ContactCategory, Meeting } from "@pm/types";

import { showToast } from "@/components/ui/Toaster";
import {
  createContact,
  deleteContact,
  updateContact,
  updateContactNote,
} from "@/app/(app)/communication-planner/actions";

import { ContactCard } from "./ContactCard";
import { ContactDrawer } from "./ContactDrawer";
import { ContactFormModal } from "./ContactFormModal";
import { DeleteContactModal } from "./DeleteContactModal";

const CATEGORY_OPTIONS: { value: ContactCategory | "all"; label: string }[] = [
  { value: "all",          label: "All" },
  { value: "professional", label: "Professional" },
  { value: "client",       label: "Client" },
  { value: "vendor",       label: "Vendor" },
  { value: "personal",     label: "Personal" },
  { value: "family",       label: "Family" },
  { value: "other",        label: "Other" },
];

const SORT_OPTIONS: { value: ContactSortKey; label: string }[] = [
  { value: "name",    label: "Name" },
  { value: "category", label: "Category" },
  { value: "updated", label: "Recently updated" },
];

interface Props {
  contacts: Contact[];
  meetings: Meeting[];
  delegatedActivities: Activity[];
}

export function CommunicationPlannerView({ contacts, meetings, delegatedActivities }: Props) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | "all">("all");
  const [sort, setSort] = useState<ContactSortKey>("name");

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const [isPending, startTransition] = useTransition();

  // Build a meetings-by-contact map once per render
  const meetingsMap = new Map<string, Meeting[]>();
  for (const meeting of meetings) {
    const list = meetingsMap.get(meeting.linked_contact_id) ?? [];
    list.push(meeting);
    meetingsMap.set(meeting.linked_contact_id, list);
  }

  // Build a delegated-activities-by-contact map
  const delegatedMap = new Map<string, Activity[]>();
  for (const activity of delegatedActivities) {
    if (!activity.delegated_contact_id) continue;
    const list = delegatedMap.get(activity.delegated_contact_id) ?? [];
    list.push(activity);
    delegatedMap.set(activity.delegated_contact_id, list);
  }

  // Derived: filtered + sorted contacts
  const filtered = sortContacts(
    filterContactsBySearch(filterContactsByCategory(contacts, categoryFilter), query),
    sort,
  );

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;
  const selectedMeetings = selectedContact ? (meetingsMap.get(selectedContact.id) ?? []) : [];
  const selectedDelegatedActivities = selectedContact ? (delegatedMap.get(selectedContact.id) ?? []) : [];

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleCreate(data: Parameters<typeof createContact>[0]) {
    startTransition(async () => {
      const result = await createContact(data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Contact added");
        setShowAddForm(false);
      }
    });
  }

  function handleUpdate(data: Parameters<typeof updateContact>[1]) {
    if (!editTarget) return;
    const id = editTarget.id;
    startTransition(async () => {
      const result = await updateContact(id, data);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Contact updated");
        setEditTarget(null);
      }
    });
  }

  function handleSaveNote(note: string) {
    if (!selectedContact) return;
    startTransition(async () => {
      const result = await updateContactNote(selectedContact.id, note);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Note saved");
      }
    });
  }

  function handleDeleteConfirm(mode: "soft" | "unlink") {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startTransition(async () => {
      const result = await deleteContact(id, mode);
      if (result && "error" in result) {
        showToast(result.error, "error");
      } else {
        showToast("Contact deleted");
        setDeleteTarget(null);
        if (selectedContactId === id) setSelectedContactId(null);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const deleteInfo = deleteTarget
    ? getContactDeletionInfo([], deleteTarget.id)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-blue-100 px-6 py-4 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-handwriting text-2xl text-ink">Communication Planner</h1>
          <button
            onClick={() => setShowAddForm(true)}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            + Add Contact
          </button>
        </div>

        {/* Search + filter + sort */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, company, email, or note…"
            className="flex-1 min-w-48 rounded-lg border border-blue-100 px-3 py-1.5 text-sm text-ink placeholder:text-ink-light/50 focus:border-blue-400 focus:outline-none"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ContactCategory | "all")}
            className="rounded-lg border border-blue-100 px-3 py-1.5 text-sm text-ink focus:border-blue-400 focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ContactSortKey)}
            className="rounded-lg border border-blue-100 px-3 py-1.5 text-sm text-ink focus:border-blue-400 focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>

        {contacts.length > 0 && (
          <p className="mt-1.5 text-xs text-ink-light">
            {filtered.length} of {contacts.length} contacts
          </p>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8">
        {contacts.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <p className="font-handwriting text-2xl text-ink-light mb-2">No contacts yet</p>
            <p className="text-sm text-ink-light mb-6">
              Add your first contact to start tracking relationships,
              delegated work, and meeting history.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add your first contact
            </button>
          </div>
        ) : filtered.length === 0 ? (
          // No search results
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-ink-light">No contacts match your search.</p>
            <button
              onClick={() => { setQuery(""); setCategoryFilter("all"); }}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          // Contact grid
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                meetings={meetingsMap.get(contact.id) ?? []}
                onClick={() => setSelectedContactId(contact.id)}
                onEdit={() => { setEditTarget(contact); setSelectedContactId(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contact drawer */}
      {selectedContact && (
        <ContactDrawer
          contact={selectedContact}
          meetings={selectedMeetings}
          delegatedActivities={selectedDelegatedActivities}
          isPending={isPending}
          onClose={() => setSelectedContactId(null)}
          onEdit={() => { setEditTarget(selectedContact); setSelectedContactId(null); }}
          onDelete={() => { setDeleteTarget(selectedContact); setSelectedContactId(null); }}
          onSaveNote={handleSaveNote}
        />
      )}

      {/* Add contact modal */}
      {showAddForm && (
        <ContactFormModal
          isPending={isPending}
          onSave={handleCreate}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Edit contact modal */}
      {editTarget && (
        <ContactFormModal
          contact={editTarget}
          isPending={isPending}
          onSave={handleUpdate}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete contact modal */}
      {deleteTarget && deleteInfo && (
        <DeleteContactModal
          contact={deleteTarget}
          delegatedActivityCount={deleteInfo.delegatedActivityCount}
          isPending={isPending}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
