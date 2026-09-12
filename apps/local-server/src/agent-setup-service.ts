import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { discoverAgents, type DiscoveryResult } from "./agent-discovery.js";

export const RegistrationSchema = z.object({
  id: z.string().uuid(),
  adapterId: z.enum(["hermes", "openclaw", "codex", "claude-code"]),
  displayName: z.string().trim().min(1).max(80),
  installationId: z.string().min(1).max(128),
  environment: z.object({
    id: z.string(),
    kind: z.enum(["linux", "macos", "windows", "wsl"]),
    label: z.string(),
    distro: z.string().optional(),
  }),
  executablePath: z.string().min(1).max(4096),
  homePath: z.string().min(1).max(4096),
  identity: z.object({
    id: z.string(),
    label: z.string(),
    kind: z.enum(["profile", "agent"]),
    profilePath: z.string(),
  }),
  connectedAt: z.string().datetime(),
});
export type AgentRegistration = z.infer<typeof RegistrationSchema>;
const SetupStateSchema = z.object({
  schema: z.literal("aiw.agent-setup/1"),
  completed: z.boolean(),
  registrations: z.array(RegistrationSchema).max(64),
});
export type AgentSetupState = z.infer<typeof SetupStateSchema>;

export class AgentSetupService {
  readonly filename: string;
  readonly discover: () => Promise<DiscoveryResult>;
  lastDiscovery: DiscoveryResult | null = null;
  constructor(options: {
    readonly dataDirectory: string;
    readonly discover?: () => Promise<DiscoveryResult>;
  }) {
    this.filename = path.join(options.dataDirectory, "agent-setup.json");
    this.discover = options.discover ?? discoverAgents;
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
          completed: false,
          registrations: [],
        };
      throw new Error(
        "Saved Agent Setup could not be read. Restore its backup before replacing connections.",
        { cause: error },
      );
    }
  }
}
