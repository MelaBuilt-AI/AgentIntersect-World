import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AgentPrerequisites } from "./agent-prerequisites.js";
import { discoverAgents, type DiscoveryResult } from "./agent-discovery.js";

import {
  RegistrationSchema,
  SetupStateSchema,
  AttachAgentInputSchema,
  type AgentRegistration,
  type AgentSetupState,
  type SetupCheck,
  type SetupConversation,
} from "@agentintersect-world/world-schema/agent-setup";
export { RegistrationSchema, AttachAgentInputSchema };
export type { AgentRegistration, AgentSetupState, SetupCheck };

export class AgentSetupService {
  readonly prerequisites = new AgentPrerequisites();
  readonly filename: string;
  readonly legacyConfigured: boolean;
  readonly discover: (additionalDirectory?: string) => Promise<DiscoveryResult>;
  lastDiscovery: DiscoveryResult | null = null;
  readonly checkConnection: (
    registration: AgentRegistration,
  ) => Promise<SetupCheck>;
  #writes = Promise.resolve();
  readonly listConversations: (
    registration: AgentRegistration,
  ) => Promise<readonly SetupConversation[]>;
  constructor(options: {
    readonly dataDirectory: string;
    readonly listConversations?: (
      registration: AgentRegistration,
    ) => Promise<readonly SetupConversation[]>;
    readonly legacyConfigured?: boolean;
    readonly discover?: (
      additionalDirectory?: string,
    ) => Promise<DiscoveryResult>;
    readonly checkConnection?: (
      registration: AgentRegistration,
    ) => Promise<SetupCheck>;
  }) {
    this.legacyConfigured = options.legacyConfigured === true;
    this.listConversations = options.listConversations ?? (async () => []);
    this.filename = path.join(options.dataDirectory, "agent-setup.json");
    this.discover =
      options.discover ??
      ((additionalDirectory) =>
        discoverAgents(
          additionalDirectory
            ? {
                searchPath: [additionalDirectory, process.env.PATH ?? ""].join(
                  path.delimiter,
                ),
              }
            : {},
        ));
    this.checkConnection =
      options.checkConnection ??
      (async () => ({
        status: "needs-attention",
        message:
          "Native connection setup is not available in this server. Start the matching World local server and Recheck.",
      }));
  }
  async candidate(
    input: z.infer<typeof AttachAgentInputSchema>,
  ): Promise<AgentRegistration> {
    const request = AttachAgentInputSchema.parse(input);
    const installation = this.lastDiscovery?.installations.find(
      (entry) => entry.id === request.installationId,
    );
    const identity = installation?.identities.find(
      (entry) => entry.id === request.identityId,
    );
    if (!installation || !identity)
      throw new Error(
        "Discover Agents again and select an installation and native identity from the results.",
      );
    const state = await this.state();
    const existing = state.registrations.find(
      (entry) =>
        entry.installationId === installation.id &&
        entry.identity.id === identity.id &&
        entry.conversationRef === request.conversationRef,
    );
    if (request.conversationRef && installation.adapterId !== "hermes")
      throw new Error(
        "Existing conversation selection is supported for Hermes only.",
      );
    return RegistrationSchema.parse({
      id: existing?.id ?? randomUUID(),
      adapterId: installation.adapterId,
      displayName: request.displayName,
      installationId: installation.id,
      environment: installation.environment,
      executablePath: installation.executablePath,
      homePath: installation.homePath,
      identity,
      connectedAt: new Date().toISOString(),
      ...(request.conversationRef
        ? { conversationRef: request.conversationRef }
        : {}),
    });
  }
  async conversations(
    input: z.infer<typeof AttachAgentInputSchema>,
  ): Promise<readonly SetupConversation[]> {
    const candidate = await this.candidate(input);
    if (candidate.adapterId !== "hermes")
      throw new Error("Select a Hermes identity to list its conversations.");
    return this.listConversations(candidate);
  }
  async attach(
    input: z.infer<typeof AttachAgentInputSchema>,
  ): Promise<{ registration: AgentRegistration | null; check: SetupCheck }> {
    const candidate = await this.candidate(input);
    if (
      candidate.conversationRef &&
      !(await this.listConversations(candidate)).some(
        (s) => s.id === candidate.conversationRef,
      )
    )
      throw new Error(
        "Selected conversation is no longer available in this Hermes profile. List conversations again.",
      );
    const check = await this.checkConnection(candidate);
    if (check.status !== "ready") return { registration: null, check };
    await this.#save((current) => {
      if (
        current.registrations.some(
          (entry) =>
            entry.id !== candidate.id &&
            entry.displayName.normalize("NFC").toLowerCase() ===
              candidate.displayName.normalize("NFC").toLowerCase(),
        )
      )
        throw new Error(
          "Choose a distinct name for this saved agent connection.",
        );
      return {
        ...current,
        registrations: [
          ...current.registrations.filter((entry) => entry.id !== candidate.id),
          candidate,
        ],
      };
    });
    return { registration: candidate, check };
  }
  async complete(): Promise<AgentSetupState> {
    await this.#save((state) => {
      if (!state.registrations.length)
        throw new Error("Attach at least one agent before completing setup.");
      return { ...state, completed: true };
    });
    return this.state();
  }
  async recheck(connectionId: string): Promise<SetupCheck> {
    const registration = (await this.state()).registrations.find(
      (entry) => entry.id === connectionId,
    );
    if (!registration)
      throw new Error(
        "Saved agent connection was not found. Discover Agents again.",
      );
    return this.checkConnection(registration);
  }
  #save(update: (state: AgentSetupState) => AgentSetupState): Promise<void> {
    const write = this.#writes.then(async () => {
      const next = SetupStateSchema.parse(update(await this.state()));
      await mkdir(path.dirname(this.filename), {
        recursive: true,
        mode: 0o700,
      });
      const temporary = `${this.filename}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(next) + "\n", {
          flag: "wx",
          mode: 0o600,
        });
        await rename(temporary, this.filename);
      } finally {
        await rm(temporary, { force: true });
      }
    });
    this.#writes = write.catch(() => undefined);
    return write;
  }
  async state(): Promise<AgentSetupState> {
    try {
      return SetupStateSchema.parse(
        JSON.parse(await readFile(this.filename, "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return {
          schema: "aiw.agent-setup/1",
          completed: this.legacyConfigured,
          registrations: [],
        };
      throw new Error(
        "Saved Agent Setup could not be read. Restore its backup before replacing connections.",
        { cause: error },
      );
    }
  }
}
