import { useEffect, useState } from "react";

type SavedSource = {
  content: string | null;
  files: { path: string }[];
  message: string;
};

/** Inspection never rebinds an agent, changes current work or dispatches a turn. */
export function SavedWorkstreamFiles({
  workstreamId,
}: {
  workstreamId: string;
}) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const key = `${workstreamId}:${path}`;
  const [result, setResult] = useState<{
    key: string;
    data?: SavedSource;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    const query = path ? `?${new URLSearchParams({ path })}` : "";
    void fetch(
      `/api/workstreams/${encodeURIComponent(workstreamId)}/source${query}`,
      { signal: abort.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.ok)
          throw new Error(body.error?.message ?? "Saved source unavailable");
        if (!abort.signal.aborted) setResult({ key, data: body.data });
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Saved source unavailable",
          });
      });
    return () => abort.abort();
  }, [open, path, workstreamId, key]);
  const current = result?.key === key ? result : null;
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close saved files" : "Inspect saved files"}
      </button>
      {open ? (
        <section aria-label="Saved Workstream files">
          <p>
            Read only · original Workstream files. No agent attached or coding
            turn sent.
          </p>
          {path ? (
            <button type="button" onClick={() => setPath("")}>
              Back to saved files
            </button>
          ) : null}
          {!current ? <p role="status">Reading saved files…</p> : null}
          {current?.error ? <p role="alert">{current.error}</p> : null}
          {current?.data ? (
            <>
              <p>{path || current.data.message}</p>
              {current.data.content !== null ? (
                <pre
                  className="repository-workbench__list"
                  tabIndex={0}
                  aria-label="Saved file contents"
                >
                  {current.data.content}
                </pre>
              ) : (
                <ul className="repository-workbench__list">
                  {current.data.files.map((file) => (
                    <li key={file.path}>
                      <button type="button" onClick={() => setPath(file.path)}>
                        {file.path}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
