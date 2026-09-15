import { useRef, useState } from "react";
import type {
  PrerequisitePlan,
  SetupConversation,
  SetupSelection,
} from "@agentintersect-world/world-schema/agent-setup";
import {
  applySetupPrerequisite,
  cancelSetupPrerequisites,
  checkSetupCandidate,
  listSetupConversations,
  previewSetupPrerequisites,
} from "./agent-setup-client.js";

export function InstallationSetupActions({
  input,
  hermes,
  busy,
  onBusy,
  onConversation,
}: {
  readonly input: SetupSelection;
  readonly hermes: boolean;
  readonly busy: boolean;
  readonly onBusy: (busy: boolean) => void;
  readonly onConversation: (id: string) => void;
}) {
  const pending = useRef(false);
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<PrerequisitePlan | null>(null);
  const [confirmed, setConfirmed] = useState("");
  const [conversations, setConversations] = useState<
    readonly SetupConversation[] | null
  >(null);
  const [conversation, setConversation] = useState("");
  async function run(action: () => Promise<void>) {
    if (pending.current || busy) return;
    pending.current = true;
    onBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Setup action unavailable. Recheck the selected identity.",
      );
    } finally {
      pending.current = false;
      onBusy(false);
    }
  }
  return (
    <div className="agent-setup-actions">
      {hermes ? (
        <>
          <label>
            Conversation for new Worlds
            <select
              value={conversation}
              onChange={(event) => {
                setConversation(event.target.value);
                onConversation(event.target.value);
              }}
            >
              <option value="">
                Create a separate new conversation (default)
              </option>
              {conversations?.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {session.id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const list = await listSetupConversations(input);
                setConversations(list);
                if (conversation && !list.some((s) => s.id === conversation)) {
                  setConversation("");
                  onConversation("");
                }
                setMessage(
                  list.length
                    ? "Choose an existing conversation explicitly, or keep the separate-new-conversation default."
                    : "No accessible conversations in this profile. The new-conversation default is unchanged.",
                );
              })
            }
          >
            List existing Hermes conversations
          </button>
          <p className="agent-setup-note">
            The agent name is a World label, not a native conversation search.
            An existing selection reuses that conversation; it is not copied or
            renamed.
          </p>
        </>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            if (plan) await cancelSetupPrerequisites(plan.id);
            setPlan(await previewSetupPrerequisites(input));
            setConfirmed("");
          })
        }
      >
        Preview prerequisites
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(async () =>
            setMessage((await checkSetupCandidate(input)).message),
          )
        }
      >
        Recheck selected identity
      </button>
      {plan ? (
        <section
          aria-label="Prerequisite plan"
          className="agent-setup-prerequisites"
        >
          <h3>Review before changing native setup</h3>
          <p>
            <strong>Target:</strong> {plan.target}
          </p>
          <p>
            Approval expires at {new Date(plan.expiresAt).toLocaleTimeString()}.
            No change has been applied.
          </p>
          {plan.actions.map((action) => (
            <div key={action.id}>
              <h4>{action.title}</h4>
              <p>{action.reason}</p>
              <p>{action.effect}</p>
              <ul>
                {action.paths.map((filename) => (
                  <li key={filename}>
                    <code>{filename}</code>
                  </li>
                ))}
              </ul>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed === action.id}
                  onChange={(event) =>
                    setConfirmed(event.target.checked ? action.id : "")
                  }
                />
                I approve this specific change to this native profile.
              </label>
              <button
                type="button"
                disabled={busy || confirmed !== action.id}
                onClick={() =>
                  void run(async () => {
                    const result = await applySetupPrerequisite(
                      plan.id,
                      action.id,
                    );
                    setPlan(null);
                    setConfirmed("");
                    setMessage(
                      `Change applied and rechecked. ${result.check.message} Attach separately when ready.`,
                    );
                  })
                }
              >
                Apply approved change
              </button>
            </div>
          ))}
          {!plan.actions.length ? (
            <p>
              No automatic change is proposed. Follow the native steps below,
              then Recheck.
            </p>
          ) : null}
          <ul>
            {plan.guidance.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await cancelSetupPrerequisites(plan.id);
                setPlan(null);
                setConfirmed("");
                setMessage("Plan cancelled. No change applied.");
              })
            }
          >
            Cancel prerequisite plan
          </button>
        </section>
      ) : null}
      {message ? (
        <p role="status" className="agent-setup-status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
