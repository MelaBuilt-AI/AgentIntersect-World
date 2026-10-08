import { useEffect, useId, useRef, useState } from "react";
import type { GitIdentity } from "./repository-workbench-client.js";
import "./repository-workbench.css";

export function GitAuthorDialog({
  initial,
  busy,
  error,
  onSave,
  onCancel,
}: {
  initial: GitIdentity;
  busy: boolean;
  error: string | null;
  onSave: (identity: GitIdentity) => Promise<void>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const valid =
    !!name.trim() &&
    // eslint-disable-next-line no-control-regex -- match server commit metadata validation
    !/[<>\x00-\x1f\x7f]/.test(name) &&
    // eslint-disable-next-line no-control-regex -- match server commit metadata validation
    /^[^\s<>\x00-\x1f\x7f]+@[^\s<>\x00-\x1f\x7f]+$/.test(email.trim());
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="repository-workbench git-author-dialog"
      data-world-ui="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !busy)
            void onSave({ name: name.trim(), email: email.trim() });
        }}
      >
        <p className="repository-workbench__eyebrow">LOCAL GIT SETUP</p>
        <h2 id={titleId}>Set up your commit author</h2>
        <p id={descriptionId}>
          Used to label your local commits. This does not sign you in or publish
          anything.
        </p>
        <fieldset disabled={busy}>
          <label>
            Commit author name
            <input
              name="authorName"
              autoComplete="name"
              required
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Commit author email
            <input
              name="authorEmail"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        </fieldset>
        <p>
          Saved for <strong>this repository only</strong>, including its
          Workstreams. Your computer-wide Git settings stay unchanged.
        </p>
        <p>
          This name and email become part of commit history and are visible to
          others if you publish it. You can use your GitHub-provided private
          commit email.
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="repository-workbench__actions">
          <button type="submit" disabled={busy || !valid}>
            {busy ? "Saving and continuing…" : "Save and continue"}
          </button>
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
